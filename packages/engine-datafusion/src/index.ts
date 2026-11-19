import { type Engine, type EngineCheck, EngineError, type EngineResult, type ExecuteOptions, type Param } from "@surfaces-ui/engine";
import { Engine as EngineKind, SqlDialect, TableKind, type TableRef } from "@surfaces-ui/proto";
import { blankLiterals } from "@surfaces-ui/sql";
import { type RecordBatch, RecordBatchReader, type Schema } from "apache-arrow";

export interface DataFusionEngineOptions {
  /**
   * Address of a DataFusion server's HTTP SQL endpoint, e.g.
   * `http://localhost:8080`. The server must answer `POST /api/sql` with an
   * Arrow stream and `GET /api/schema` with its tables, as ROAPI does.
   */
  baseUrl: string;
  /** Extra headers, e.g. authorisation for a proxy in front of the server. */
  headers?: Record<string, string>;
  /** Uses this instead of the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * The endpoint names tables only, not the catalog and schema they sit in
 * (those differ between servers and cannot be listed). Tables are therefore
 * reported without them, so that nothing writes a qualified name the server
 * would not recognise; these two are labels for the levels of a browser.
 */
const CATALOG = "default";
const SCHEMA = "default";
const BARE = { catalog: "", schema: "" };
const ARROW = "application/vnd.apache.arrow.stream";

const hex = (text: string) => Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * One value as SQL text. The server's HTTP endpoint takes a statement and
 * nothing else, so values cannot be bound; they are written so that no value
 * can change the statement. Numbers are checked to be numbers. Text never
 * appears as a quoted literal at all: it is sent as hexadecimal and decoded
 * by the engine, so quotes, backslashes and comment markers in it are only
 * ever data.
 */
export function literal(value: Param): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new EngineError("UNSUPPORTED", "A filter value is not a finite number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `CAST(decode('${hex(value)}', 'hex') AS VARCHAR)`;
}

/**
 * Replaces the numbered placeholders the SQL rewriter produced with values.
 * Placeholders inside string literals, quoted names and comments are left
 * alone, and every placeholder must have a value.
 */
export function inlineParams(sql: string, params: Param[]): string {
  if (params.length === 0) return sql;
  const bare = blankLiterals(sql);
  let out = "";
  let at = 0;
  for (const match of bare.matchAll(/\$(\d+)/g)) {
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= params.length) throw new EngineError("ENGINE", `The query refers to parameter ${match[1]}, which was not given.`);
    out += sql.slice(at, match.index) + literal(params[index]!);
    at = match.index + match[0].length;
  }
  return out + sql.slice(at);
}

/** Turns the server's error reply into an EngineError with a code the UI understands. */
export function dataFusionError(status: number, body: string): EngineError {
  let message = body.trim();
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    message = parsed.message ?? parsed.error ?? message;
  } catch {
    // Not JSON: use the text as it is.
  }
  const clean = message
    .replace(/^Failed to (plan execution from SQL query|execute query): /, "")
    .replace(/^(Error during planning|Schema error|SQL error|Execution error): /, "")
    .replace(/^ParserError\("(.*)"\)$/s, "$1")
    .trim();
  const code = /ParserError|Expected .* found/i.test(message)
    ? "SYNTAX"
    : /No field named|column .* not found/i.test(message)
      ? "UNKNOWN_COLUMN"
      : /table .* not found|No table named/i.test(message)
        ? "UNKNOWN_TABLE"
        : /not implemented|Unsupported logical plan/i.test(message)
          ? "UNSUPPORTED"
          : "ENGINE";
  return new EngineError(code, clean || `The server answered ${status}.`);
}

interface SchemaField {
  name: string;
  data_type: unknown;
  nullable?: boolean;
}

const typeName = (type: unknown): string => (typeof type === "string" ? type : JSON.stringify(type));

/**
 * Apache DataFusion behind the Engine interface, reached over a server's
 * HTTP SQL endpoint. Results arrive as an Arrow stream, so types are kept.
 *
 * It only reads: there is no `store` or `materialize`, so views of a query
 * run it again and pipelines cannot use this engine. Time travel and
 * positioned errors are not available over this endpoint.
 */
export async function createDataFusionEngine(options: DataFusionEngineOptions): Promise<Engine> {
  const call = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");

  const post = async (sql: string, accept: string, signal?: AbortSignal): Promise<Response> => {
    let response: Response;
    try {
      response = await call(`${base}/api/sql`, { method: "POST", headers: { Accept: accept, "Content-Type": "text/plain", ...options.headers }, body: sql, signal });
    } catch (error) {
      if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
      throw new EngineError("ENGINE", `The DataFusion server could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw dataFusionError(response.status, await response.text());
    return response;
  };

  const rowsOf = async (sql: string): Promise<Record<string, unknown>[]> => (await (await post(sql, "application/json")).json()) as Record<string, unknown>[];

  const tables = async (): Promise<Record<string, { fields: SchemaField[] }>> => {
    let response: Response;
    try {
      response = await call(`${base}/api/schema`, { headers: options.headers });
    } catch (error) {
      throw new EngineError("ENGINE", `The DataFusion server could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw dataFusionError(response.status, await response.text());
    return (await response.json()) as Record<string, { fields: SchemaField[] }>;
  };

  const quoted = (name: string) => `"${name.replace(/"/g, '""')}"`;
  const find = async (ref: TableRef | undefined) => {
    const all = await tables();
    const name = Object.keys(all).find((t) => t.toLowerCase() === (ref?.table ?? "").toLowerCase());
    if (!name) throw new EngineError("UNKNOWN_TABLE", `Table not found: ${ref?.table ?? ""}`);
    return { name, fields: all[name]!.fields };
  };

  return {
    kind: EngineKind.DATAFUSION,
    dialect: SqlDialect.DATAFUSION,
    capabilities: { cancel: true, explain: true, explainJson: false, timeTravel: false, keysetPaging: false, exactCount: true, columnStats: false },

    async execute(sql: string, params: Param[], executeOptions: ExecuteOptions = {}): Promise<EngineResult> {
      if (executeOptions.timeTravel?.at.case) throw new EngineError("UNSUPPORTED", "This source cannot read tables as of an earlier time.");
      const response = await post(inlineParams(sql, params), ARROW, executeOptions.signal);
      const reader = await RecordBatchReader.from(response);
      await reader.open();
      const signal = executeOptions.signal;
      async function* batches(): AsyncGenerator<RecordBatch> {
        try {
          for await (const batch of reader) {
            if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
            yield batch;
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
      }
      return { schema: reader.schema as Schema, batches: batches() };
    },

    async explain(sql, params) {
      const plan = await rowsOf(`EXPLAIN ${inlineParams(sql, params)}`);
      return { planText: plan.map((row) => `${String(row.plan_type ?? "")}\n${String(row.plan ?? "")}`).join("\n\n"), planJson: "" };
    },

    async check(): Promise<EngineCheck[]> {
      const names = Object.keys(await tables()).sort();
      return Promise.all(
        names.map(async (name) => {
          const started = Date.now();
          try {
            await rowsOf(`SELECT * FROM ${quoted(name)} LIMIT 0`);
            return { name, ok: true, message: "Reachable", elapsedMs: Date.now() - started };
          } catch (error) {
            return { name, ok: false, message: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started };
          }
        }),
      );
    },

    listCatalogs: async () => [{ name: CATALOG }],
    listSchemas: async () => [{ catalog: CATALOG, name: SCHEMA }],

    async listTables({ search }) {
      const needle = search.toLowerCase();
      return Object.keys(await tables())
        .filter((name) => name.toLowerCase().includes(needle))
        .sort()
        .map((name) => ({ ref: { ...BARE, table: name }, kind: TableKind.TABLE }));
    },

    async describeTable(ref, includeStats) {
      const { name, fields } = await find(ref);
      const counted = includeStats ? (await rowsOf(`SELECT COUNT(*) AS n FROM ${quoted(name)}`))[0]?.n : undefined;
      return {
        summary: { ref: { ...BARE, table: name }, kind: TableKind.TABLE },
        columns: fields.map((field, i) => ({ name: field.name, nativeType: typeName(field.data_type), arrowType: typeName(field.data_type), nullable: field.nullable !== false, ordinal: i + 1 })),
        rowCount: counted === undefined ? undefined : BigInt(counted as number),
      };
    },

    listSnapshots: async () => [],
    version: async () => String((await rowsOf("SELECT version() AS v"))[0]?.v ?? ""),
    close: async () => {},
  };
}
