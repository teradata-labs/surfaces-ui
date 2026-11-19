import { EngineError } from "@surfaces-ui/engine";
import { type SessionSettings, type TeradataClient, type TeradataResult, applicationName, sessionStatements } from "./client.js";
import { scrub, teradataError } from "./errors.js";

/** What a named secret may hold for Teradata: a password for the user, or a JWT. */
export interface TeradataSecretValues {
  password?: string;
  token?: string;
}

export type ResolveTeradataSecret = (name: string) => TeradataSecretValues | undefined | Promise<TeradataSecretValues | undefined>;

/** Reads `<NAME>_PASSWORD` and `<NAME>_TOKEN` from the server's environment. */
export const envTeradataSecret: ResolveTeradataSecret = (name) => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const values = { password: env[`${name}_PASSWORD`], token: env[`${name}_TOKEN`] };
  return values.password || values.token ? values : undefined;
};

export interface QueryServiceOptions extends SessionSettings {
  /**
   * Address of Teradata Query Service, up to but not including `/systems`,
   * e.g. `https://vantage.example.com:1443`. Teradata's own examples differ
   * on whether a deployment puts `/api/query` in front; include it here if
   * yours does.
   */
  baseUrl: string;
  /** The system name (alias) configured in Query Service. */
  system: string;
  /** Database user. Needed with a password; not with a JWT. */
  user?: string;
  /** NAME of the secret that holds the password or JWT. Never the value. */
  secret: string;
  /** Looks a secret up by name. Defaults to the environment: `<NAME>_PASSWORD`, or `<NAME>_TOKEN` for a JWT. */
  resolveSecret?: ResolveTeradataSecret;
  /**
   * `explicit` (default) opens one Query Service session and runs every
   * statement on it, so the time zone (UTC), query band and default database
   * can be set. Query Service runs one request at a time on such a session
   * and queues the rest.
   *
   * `implicit` lets Query Service pick a pooled session for each request, so
   * requests run side by side. The query band is still sent with each
   * request, but the time zone and default database are then the database
   * user's own: give that user UTC, and write database names in queries.
   */
  session?: "explicit" | "implicit";
  /** Most rows one statement may return. More is an error, not a silently short result. Default 250,000. */
  rowLimit?: number;
  /**
   * How request fields are spelled. `snake` (default) is the spelling in
   * Teradata's OpenAPI specification (`include_columns`, `row_limit`);
   * `camel` is the spelling in the usage guide and quickstart
   * (`includeColumns`, `rowLimit`), and sends only the fields those show.
   */
  keyStyle?: "snake" | "camel";
  /** Extra headers, e.g. for a proxy in front of the service. */
  headers?: Record<string, string>;
  /** Uses this instead of the global `fetch`. */
  fetch?: typeof fetch;
}

const ACCEPT = "application/vnd.com.teradata.rest-v1.0+json";

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

/**
 * Parses a reply without losing digits: JSON numbers are floats, which
 * cannot hold every BIGINT or DECIMAL. A whole number too large for a float
 * becomes a bigint, and a fraction with more digits than a float keeps
 * becomes its own text. (Needs a runtime that passes the source text to a
 * reviver; without one, numbers are read as floats.)
 */
export function parseReply(body: string): unknown {
  return JSON.parse(body, ((_key: string, value: unknown, context?: { source?: string }) => {
    const source = context?.source;
    if (typeof value !== "number" || source === undefined) return value;
    if (/^-?\d+$/.test(source)) return Number.isSafeInteger(value) ? value : BigInt(source);
    return source.replace(/e.*$/i, "").replace(/\D/g, "").replace(/^0+/, "").length > 15 ? source : value;
  }) as (key: string, value: unknown) => unknown);
}

/** A bound value as JSON. Teradata has no boolean, and JSON no bigint. */
function bound(value: unknown): unknown {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  if (typeof value === "number" && !Number.isFinite(value)) throw new EngineError("UNSUPPORTED", "A filter value is not a finite number.");
  return value;
}

interface Reply {
  results?: { resultSet?: boolean; columns?: { name?: string; type?: string }[]; data?: unknown[]; rowLimitExceeded?: boolean }[];
  responseError?: unknown;
}

/**
 * Teradata Query Service (the Vantage REST API) as a transport.
 *
 * Written to Teradata's published description of the service, not tested
 * against one:
 * - "Query Service OpenAPI Specification" (downloads.teradata.com,
 *   apidoc_specs): `POST /systems/{systemName}/queries` and
 *   `/systems/{systemName}/sessions`, `DELETE /systems/{systemName}/sessions/{id}`,
 *   the request fields (`query`, `format`, `include_columns`,
 *   `include_column_types`, `date_format`, `row_limit`, `params`, `session`,
 *   `query_bands`), the reply fields (`results[].resultSet`, `columns[].name`
 *   and `.type`, `data`, `rowLimitExceeded`, `responseError`), status 420 for
 *   a database error and the error body `{ "error": "3802", "message": "..." }`.
 * - "Send queries using REST API" (Teradata quickstarts): port 1443, the
 *   `Basic` and `Bearer` forms of `Authorization`, `{ "auto_commit": true }`
 *   to open a session, `sessionId` in its reply, and `session` in a query.
 * - "Teradata Query Service Installation, Configuration and Usage Guide":
 *   the `Accept` header, and that a request naming a session in use queues.
 *
 * Values are bound: the statement keeps its `?` placeholders and the values
 * travel in `params`, one array for one run of the statement.
 */
export function queryServiceClient(options: QueryServiceOptions): TeradataClient {
  const call = options.fetch ?? fetch;
  const root = `${options.baseUrl.replace(/\/+$/, "")}/systems/${encodeURIComponent(options.system)}`;
  const resolve = options.resolveSecret ?? envTeradataSecret;
  const explicit = (options.session ?? "explicit") === "explicit";
  const snake = (options.keyStyle ?? "snake") === "snake";
  const rowLimit = options.rowLimit ?? 250_000;
  const application = applicationName(options);
  let session: Promise<number> | undefined;

  const credentials = async (): Promise<{ header: string; secrets: string[] }> => {
    const values = await resolve(options.secret);
    if (values?.token) return { header: `Bearer ${values.token}`, secrets: [values.token] };
    if (values?.password) {
      if (!options.user) throw new EngineError("UNSUPPORTED", "A Teradata source that signs in with a password needs a user.");
      const encoded = base64(`${options.user}:${values.password}`);
      return { header: `Basic ${encoded}`, secrets: [values.password, encoded] };
    }
    throw new EngineError("UNSUPPORTED", `The secret "${options.secret}" is not set on the server. Set ${options.secret}_PASSWORD, or ${options.secret}_TOKEN for a JWT.`);
  };

  /** Sends one request. Whatever goes wrong, the password, token and header never appear in what is thrown. */
  const send = async (method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<{ status: number; text: string }> => {
    const { header, secrets } = await credentials();
    let response: Response;
    try {
      response = await call(`${root}${path}`, {
        method,
        headers: { Accept: ACCEPT, "Content-Type": "application/json", ...options.headers, Authorization: header },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
      throw new EngineError("ENGINE", scrub(`Teradata Query Service could not be reached: ${error instanceof Error ? error.message : String(error)}`, secrets));
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
      throw new EngineError("ENGINE", "The reply from Teradata Query Service was cut short.");
    }
    return { status: response.status, text: scrub(text, secrets) };
  };

  const failure = (status: number, text: string): EngineError => {
    if (status === 401) return new EngineError("ENGINE", `Teradata refused the sign-in. Check the user and the secret "${options.secret}".`, "401");
    let parsed: { error?: unknown; message?: unknown } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      // Not JSON: use the text as it is.
    }
    const message = typeof parsed.message === "string" ? parsed.message : text.trim().slice(0, 500);
    // 420 is the service's status for an error from the database; others are its own.
    if (status === 420 || /^\d+$/.test(String(parsed.error ?? ""))) return teradataError(String(parsed.error ?? ""), message);
    return new EngineError("ENGINE", message || `Teradata Query Service answered ${status}.`, String(status));
  };

  const submit = async (sql: string, params: unknown[], on: number | undefined, signal?: AbortSignal) => {
    const fields = {
      query: sql,
      format: "ARRAY",
      ...(snake ? { include_columns: true, include_column_types: true, date_format: "ISO_8601", row_limit: rowLimit } : { includeColumns: true, rowLimit }),
      ...(params.length > 0 ? { params: [params.map(bound)] } : {}),
      ...(on !== undefined ? { session: on } : { [snake ? "query_bands" : "queryBands"]: { ApplicationName: application } }),
    };
    return send("POST", "/queries", fields, signal);
  };

  const open = (): Promise<number> => {
    session ??= (async () => {
      const created = await send("POST", "/sessions", { auto_commit: true });
      if (created.status < 200 || created.status >= 300) throw failure(created.status, created.text);
      const id = (parseReply(created.text) as { sessionId?: unknown } | null)?.sessionId;
      if (typeof id !== "number") throw new EngineError("ENGINE", "Teradata Query Service did not say which session it opened.");
      for (const statement of sessionStatements(options)) {
        const set = await submit(statement, [], id);
        if (set.status < 200 || set.status >= 300) throw failure(set.status, set.text);
      }
      return id;
    })();
    session.catch(() => {
      session = undefined;
    });
    return session;
  };

  return {
    async query(sql, params, queryOptions = {}): Promise<TeradataResult> {
      let on = explicit ? await open() : undefined;
      let reply = await submit(sql, params, on, queryOptions.signal);
      if (reply.status === 404 && explicit) {
        // The session has gone (the service closes idle ones): open another and ask once more.
        session = undefined;
        on = await open();
        reply = await submit(sql, params, on, queryOptions.signal);
      }
      if (reply.status < 200 || reply.status >= 300) throw failure(reply.status, reply.text);
      let parsed: Reply;
      try {
        parsed = (parseReply(reply.text) ?? {}) as Reply;
      } catch {
        throw new EngineError("ENGINE", "The reply from Teradata Query Service could not be read.");
      }
      if (parsed.responseError) {
        const problem = parsed.responseError as { error?: unknown; message?: unknown } | string;
        throw typeof problem === "string" ? teradataError(undefined, problem) : teradataError(String(problem.error ?? ""), String(problem.message ?? ""));
      }
      const result = parsed.results?.find((r) => r.resultSet !== false && (r.columns || r.data));
      if (!result) return { columns: [], rows: [] };
      const data = result.data ?? [];
      // Named columns come with the result; a reply in object form names them in each row.
      const first = data[0];
      const names = result.columns?.map((c) => String(c.name ?? "")) ?? (first && !Array.isArray(first) ? Object.keys(first as object) : []);
      const rows = data.map((row) => (Array.isArray(row) ? (row as unknown[]) : names.map((name) => (row as Record<string, unknown>)[name])));
      return {
        columns: names.map((name, i) => ({ name, type: String(result.columns?.[i]?.type ?? "") })),
        rows,
        truncated: result.rowLimitExceeded === true,
      };
    },

    async close() {
      const pending = session;
      session = undefined;
      if (!pending) return;
      try {
        await send("DELETE", `/sessions/${await pending}`);
      } catch {
        // The session will time out on its own.
      }
    },
  };
}
