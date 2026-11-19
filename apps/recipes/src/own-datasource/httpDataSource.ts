import { type DescMessage, type MessageInitShape, type MessageShape, create, fromJson, toJson } from "@bufbuild/protobuf";
import { type CallOptions, type DataSource, QueryError, encodeTable } from "@surfaces-ui/data";
import {
  CancelResponseSchema,
  CountRequestSchema,
  CountResponseSchema,
  DescribeTableRequestSchema,
  DescribeTableResponseSchema,
  ExecuteRequestSchema,
  ExecuteResponseSchema,
  ListCatalogsRequestSchema,
  ListCatalogsResponseSchema,
  ListSchemasRequestSchema,
  ListSchemasResponseSchema,
  ListSnapshotsResponseSchema,
  ListSourcesRequestSchema,
  ListSourcesResponseSchema,
  ListTablesRequestSchema,
  ListTablesResponseSchema,
} from "@surfaces-ui/proto";
import { tableFromIPC } from "apache-arrow";

export interface HttpDataSourceOptions {
  /** Where your API lives, e.g. "https://api.example.com/analytics". */
  baseUrl: string;
  /** Headers for every call, such as a session token. Called each time, so a refreshed token is used. */
  headers?: () => HeadersInit | Promise<HeadersInit>;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * A DataSource over your own HTTP API.
 *
 * - `POST /query` takes the ExecuteRequest as protobuf JSON and answers with
 *   an Arrow IPC stream holding only the requested window of rows. Your
 *   server applies the filters, sorts, grouping and page in the ViewQuery;
 *   nothing is sorted or filtered here.
 * - `POST /count`, `/sources`, `/catalogs`, `/schemas`, `/tables` and
 *   `/describe` take and return protobuf JSON.
 * - The query reply may name what ran in `x-executed-sql` (percent-encoded)
 *   and say `x-truncated: true` when rows were left out.
 * - A failure is a non-2xx reply with `{ message, code?, line?, column? }`.
 */
export function httpDataSource(options: HttpDataSourceOptions): DataSource {
  const base = options.baseUrl.replace(/\/$/, "");
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  const post = async (path: string, body: unknown, signal?: AbortSignal): Promise<Response> => {
    const headers = new Headers(await options.headers?.());
    headers.set("content-type", "application/json");
    let reply: Response;
    try {
      reply = await doFetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(`Could not reach the data service: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!reply.ok) throw await readError(reply);
    return reply;
  };

  const unary =
    <Req extends DescMessage, Res extends DescMessage>(path: string, requestSchema: Req, responseSchema: Res) =>
    async (init: MessageInitShape<Req>, callOptions?: CallOptions): Promise<MessageShape<Res>> => {
      const reply = await post(path, toJson(requestSchema, create(requestSchema, init)), callOptions?.signal);
      return fromJson(responseSchema, await reply.json(), { ignoreUnknownFields: true });
    };

  return {
    async *execute(init, callOptions) {
      const started = Date.now();
      const request = create(ExecuteRequestSchema, init);
      if (request.timeTravel) throw new Error("This data service has no time travel.");
      const reply = await post("/query", toJson(ExecuteRequestSchema, request), callOptions?.signal);
      const table = tableFromIPC(new Uint8Array(await reply.arrayBuffer()));
      // Re-frame the reply as the header, batch and footer parts components read.
      const encoded = encodeTable(table, request.batchRows);
      yield create(ExecuteResponseSchema, {
        part: {
          case: "header",
          value: {
            arrowSchema: encoded.schema,
            // What the server ran, percent-encoded because a header cannot hold new lines.
            executedSql: decodeURIComponent(reply.headers.get("x-executed-sql") ?? "") || (request.query?.baseSql ?? ""),
            queryId: request.queryId,
            columns: table.schema.fields.map((f) => ({ name: f.name, nativeType: String(f.type), sortable: true, filterable: true })),
          },
        },
      });
      for (const batch of encoded.batches) {
        yield create(ExecuteResponseSchema, { part: { case: "batch", value: { arrowBatch: batch.bytes, rowCount: BigInt(batch.rows) } } });
      }
      yield create(ExecuteResponseSchema, {
        part: {
          case: "footer",
          value: { totalRowsReturned: BigInt(table.numRows), truncated: reply.headers.get("x-truncated") === "true", elapsedMs: BigInt(Date.now() - started) },
        },
      });
    },
    count: unary("/count", CountRequestSchema, CountResponseSchema),
    listSources: unary("/sources", ListSourcesRequestSchema, ListSourcesResponseSchema),
    listCatalogs: unary("/catalogs", ListCatalogsRequestSchema, ListCatalogsResponseSchema),
    listSchemas: unary("/schemas", ListSchemasRequestSchema, ListSchemasResponseSchema),
    listTables: unary("/tables", ListTablesRequestSchema, ListTablesResponseSchema),
    describeTable: unary("/describe", DescribeTableRequestSchema, DescribeTableResponseSchema),
    // What this API does not offer, said plainly rather than faked.
    async explain() {
      throw new Error("This data service does not explain queries.");
    },
    // Aborting the signal passed to execute stops the request; there is no separate cancel call.
    async cancel() {
      return create(CancelResponseSchema, { cancelled: false });
    },
    // No time travel, so no snapshots.
    async listSnapshots() {
      return create(ListSnapshotsResponseSchema, {});
    },
  };
}

/** Turns a failed reply into an error a person can read, with its place in the SQL when the server says. */
async function readError(reply: Response): Promise<Error> {
  const text = await reply.text();
  try {
    const body = JSON.parse(text) as { message?: unknown; code?: unknown; line?: unknown; column?: unknown };
    if (typeof body.message === "string" && body.message !== "") {
      const number = (v: unknown) => (typeof v === "number" ? v : undefined);
      return new QueryError(body.message, { code: typeof body.code === "string" ? body.code : undefined, line: number(body.line), column: number(body.column) });
    }
  } catch {
    // Not JSON: fall through to the status.
  }
  return new Error(`The data service answered ${reply.status}${reply.statusText ? ` ${reply.statusText}` : ""}.`);
}
