import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { connectDataSource } from "@surfaces-ui/client-connect";
import { type DataSource, encodeBatch, encodeSchema } from "@surfaces-ui/data";
import { type Engine, EngineError, type Param } from "@surfaces-ui/engine";
import {
  CatalogService,
  type ExecuteRequest,
  type ExecuteResponse,
  ExecuteResponseSchema,
  QueryErrorDetailSchema,
  QueryService,
  type Source,
  SourceKind,
  SourceSchema,
  SourceService,
  type ViewQuery,
  ViewQuerySchema,
} from "@surfaces-ui/proto";
import { SqlError, columnsQuery, countQuery, initSql, rewriteQuery, trimStatement, withoutMissingFilters } from "@surfaces-ui/sql";
import { DataType, type RecordBatch } from "apache-arrow";
import { type Held, type StoredResultsOptions, createResultStore, overStored } from "./results.js";

export * from "./results.js";

/** One data source offered, backed by an engine adapter. */
export interface ServerSource {
  id: string;
  displayName?: string;
  kind?: SourceKind;
  engine: Engine;
}

export interface EngineServicesOptions {
  sources: ServerSource[];
  /** Rows per Arrow batch when the client does not ask. Defaults to 4096. */
  defaultBatchRows?: number;
  /** Most rows one Execute may return; the result is marked truncated beyond it. Defaults to 1,000,000. */
  maxResultRows?: number;
  /**
   * Keeps query results so sorting, filtering and paging do not run the query
   * again. Pass `false` to run every view live.
   */
  storedResults?: StoredResultsOptions | false;
}

export interface EngineServices {
  /** Registers QueryService, CatalogService and SourceService on a Connect router. */
  routes(router: ConnectRouter): void;
  /** The same services as a DataSource, called in process with no network. */
  dataSource: DataSource;
  /** The engine behind a source id, if there is one. */
  engineOf(id: string): Engine | undefined;
  /** Drops every kept result, for when the tables under them changed. */
  clearResults(): void;
  /** Stops running queries and drops kept results. Engines are left open. */
  close(): Promise<void>;
}

function queryError(code: Code, detailCode: string, message: string, extra: { line?: number; column?: number; engineCode?: string } = {}) {
  return new ConnectError(message, code, undefined, [
    { desc: QueryErrorDetailSchema, value: { code: detailCode, message, ...extra } },
  ]);
}

interface Position {
  line?: number;
  column?: number;
}

/** 1-based line and column of a character offset. */
function lineAndColumn(text: string, offset: number): Position {
  const before = text.slice(0, offset).split("\n");
  return { line: before.length, column: before.at(-1)!.length + 1 };
}

export function toConnectError(error: unknown, position: Position = {}): ConnectError {
  if (error instanceof ConnectError) return error;
  if (error instanceof SqlError) {
    return queryError(Code.InvalidArgument, error.code, error.message, { line: error.line, column: error.column });
  }
  if (error instanceof EngineError) {
    const code =
      error.code === "CANCELLED"
        ? Code.Canceled
        : error.code === "UNSUPPORTED"
          ? Code.Unimplemented
          : error.code === "UNKNOWN_TABLE"
            ? Code.NotFound
            : Code.InvalidArgument;
    return queryError(code, error.code, error.message, { engineCode: error.engineCode, ...position });
  }
  // Unknown failures are not echoed to the client; they may contain paths or internals.
  console.error("[surfaces] internal error:", error);
  return new ConnectError("The server hit an unexpected error.", Code.Internal);
}

/**
 * The query, catalog and source services over engine adapters. It runs
 * wherever the engines do: in the dev server, and in a browser over an
 * in-browser engine, so both behave the same way.
 */
export async function createEngineServices(options: EngineServicesOptions): Promise<EngineServices> {
  await initSql();
  const sources = new Map(options.sources.map((s) => [s.id, s]));
  const defaultBatchRows = options.defaultBatchRows ?? 4096;
  const maxResultRows = options.maxResultRows ?? 1_000_000;
  const running = new Map<string, AbortController>();
  const results = options.storedResults === false ? undefined : createResultStore(options.storedResults);

  const source = (id: string): ServerSource => {
    const found = sources.get(id) ?? (id === "" && sources.size === 1 ? [...sources.values()][0] : undefined);
    if (!found) throw new ConnectError(`Unknown source: ${id || "(none given)"}`, Code.NotFound);
    return found;
  };

  const engineOf = (id: string): Engine | undefined => {
    try {
      return source(id).engine;
    } catch {
      return undefined;
    }
  };

  const describe = (s: ServerSource): Source =>
    create(SourceSchema, {
      id: s.id,
      displayName: s.displayName ?? s.id,
      kind: s.kind ?? SourceKind.DUCKDB,
      engine: s.engine.kind,
      dialect: s.engine.dialect,
      readOnly: true,
      connections: s.engine.connections ?? [],
      capabilities: {
        ...s.engine.capabilities,
        storedResults: results !== undefined && s.engine.store !== undefined,
        maxBatchRows: 65_536,
        maxResultRows: BigInt(maxResultRows),
      },
    });

  const viewQuery = (query: ViewQuery | undefined): ViewQuery => query ?? create(ViewQuerySchema);
  const part = (value: ExecuteResponse["part"]) => create(ExecuteResponseSchema, { part: value });
  const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      throw toConnectError(error);
    }
  };

  /**
   * Where in the person's SQL an engine error is. The SQL that failed was
   * usually a rewritten form, so the base query is planned on its own (not
   * run) and the engine's position for that is used.
   */
  const locate = async (error: unknown, engine: Engine | undefined, query: ViewQuery): Promise<Position> => {
    if (!engine || !(error instanceof EngineError) || error.code === "CANCELLED" || error.code === "TIMEOUT") return {};
    const sql = trimStatement(query.baseSql);
    try {
      await engine.explain(sql, query.parameters.map((p) => p.kind.value as Param));
    } catch (again) {
      if (again instanceof EngineError && again.position !== undefined) {
        return lineAndColumn(query.baseSql, Math.max(0, query.baseSql.indexOf(sql)) + again.position);
      }
    }
    return {};
  };

  /**
   * Runs a view. A filter can name a column the view's own rows lack, such as a
   * page-wide filter by site over a daily total: when the engine says a column is
   * unknown, the base query's columns are read (no rows), the filters on missing
   * columns are dropped with a notice saying so, and the view runs once more.
   */
  const open = async (
    request: { sourceId: string; query?: ViewQuery; timeTravel?: ExecuteRequest["timeTravel"]; notBefore: string },
    build: typeof rewriteQuery,
    signal?: AbortSignal,
  ) => {
    const query = viewQuery(request.query);
    try {
      return await openView(request, query, build, signal);
    } catch (error) {
      if (!(error instanceof EngineError) || error.code !== "UNKNOWN_COLUMN" || query.filters.length === 0) throw error;
      const { engine } = source(request.sourceId);
      const probe = columnsQuery(query, engine.dialect);
      const probed = await engine.execute(probe.sql, probe.params as Param[], { signal, timeTravel: request.timeTravel }).catch(() => undefined);
      if (!probed) throw error;
      const columns = probed.schema.fields.map((field) => field.name);
      await probed.batches[Symbol.asyncIterator]().return?.();
      const fewer = withoutMissingFilters(query, columns);
      if (fewer.notices.length === 0) throw error;
      const opened = await openView(request, fewer.query, build, signal);
      return { ...opened, notices: [...fewer.notices, ...opened.notices] };
    }
  };

  /** Runs a view as asked, reading the stored result when there is one. */
  const openView = async (
    request: { sourceId: string; timeTravel?: ExecuteRequest["timeTravel"]; notBefore: string },
    query: ViewQuery,
    build: typeof rewriteQuery,
    signal?: AbortSignal,
  ) => {
    const { id, engine } = source(request.sourceId);
    const live = build(query, engine.dialect);
    let held: Held | undefined = await results?.get(id, engine, query, request.timeTravel, request.notBefore);
    if (held) {
      const stored = build(overStored(query, held), engine.dialect);
      try {
        const result = await engine.execute(stored.sql, stored.params as Param[], { signal });
        // Stored rows keep their order, so paging them without a sort is repeatable.
        return { result, held, sql: live.sql, mode: live.mode, notices: live.notices.filter((n) => n.code !== "UNSTABLE_PAGE_ORDER") };
      } catch (error) {
        if (!(error instanceof EngineError) || error.code !== "UNKNOWN_TABLE") throw error;
        // The stored rows were dropped in the meantime: run live instead.
        results?.forget(held.key);
        held = undefined;
      }
    }
    const result = await engine.execute(live.sql, live.params as Param[], { signal, timeTravel: request.timeTravel });
    return { result, held, sql: live.sql, mode: live.mode, notices: live.notices };
  };

  const routes = (router: ConnectRouter) => {
    router.service(QueryService, {
      async *execute(request, context) {
        const started = Date.now();
        const controller = new AbortController();
        context.signal.addEventListener("abort", () => controller.abort(), { once: true });
        if (request.queryId) running.set(request.queryId, controller);
        try {
          const { result, held, sql, mode, notices } = await open(request, rewriteQuery, controller.signal);
          yield part({
            case: "header",
            value: {
              arrowSchema: encodeSchema(result.schema),
              executedSql: sql,
              rewriteMode: mode,
              notices,
              queryId: request.queryId,
              stored: held ? { createdAt: held.createdAt, rowCount: BigInt(held.rowCount) } : undefined,
              columns: result.schema.fields.map((field) => {
                const scalar = !DataType.isList(field.type) && !DataType.isStruct(field.type) && !DataType.isMap(field.type);
                return { name: field.name, nativeType: String(field.type), sortable: scalar, filterable: scalar };
              }),
            },
          } as ExecuteResponse["part"]);

          const batchRows = Math.min(request.batchRows || defaultBatchRows, 65_536);
          let total = 0;
          let truncated = false;
          let pending: RecordBatch[] = [];
          let pendingRows = 0;
          const flush = function* (final: boolean): Generator<ExecuteResponse> {
            // Engines hand back small batches; group them up to batchRows, and split large ones.
            while (pendingRows >= batchRows || (final && pendingRows > 0)) {
              let take = Math.min(batchRows, pendingRows);
              const group: RecordBatch[] = [];
              while (take > 0) {
                const head = pending[0]!;
                if (head.numRows <= take) {
                  group.push(head);
                  pending.shift();
                  take -= head.numRows;
                  pendingRows -= head.numRows;
                } else {
                  group.push(head.slice(0, take));
                  pending[0] = head.slice(take);
                  pendingRows -= take;
                  take = 0;
                }
              }
              for (const batch of group) {
                yield part({
                  case: "batch",
                  value: { arrowBatch: encodeBatch(batch).batch, rowCount: BigInt(batch.numRows) },
                } as ExecuteResponse["part"]);
              }
            }
          };
          for await (const batch of result.batches) {
            const room = maxResultRows - total;
            const kept = batch.numRows > room ? batch.slice(0, room) : batch;
            if (kept.numRows > 0) {
              pending.push(kept);
              pendingRows += kept.numRows;
              total += kept.numRows;
            }
            yield* flush(false);
            if (batch.numRows > room) {
              truncated = true;
              controller.abort();
              break;
            }
          }
          yield* flush(true);
          pending = [];
          yield part({
            case: "footer",
            value: { totalRowsReturned: BigInt(total), nextCursor: "", truncated, elapsedMs: BigInt(Date.now() - started) },
          } as ExecuteResponse["part"]);
        } catch (error) {
          throw toConnectError(error, await locate(error, engineOf(request.sourceId), viewQuery(request.query)));
        } finally {
          if (request.queryId) running.delete(request.queryId);
        }
      },

      async cancel(request) {
        const controller = running.get(request.queryId);
        controller?.abort();
        return { cancelled: controller !== undefined };
      },

      async explain(request) {
        const { engine } = source(request.sourceId);
        const query = viewQuery(request.query);
        try {
          const rewritten = rewriteQuery(query, engine.dialect);
          const plan = await engine.explain(rewritten.sql, rewritten.params as Param[]);
          return { ...plan, executedSql: rewritten.sql };
        } catch (error) {
          throw toConnectError(error, await locate(error, engine, query));
        }
      },

      async count(request) {
        const query = viewQuery(request.query);
        try {
          const { id, engine } = source(request.sourceId);
          const grouped = query.groupBy.length > 0 || query.aggregates.length > 0 || query.buckets.length > 0;
          if (query.filters.length === 0 && !grouped) {
            // The stored result already knows how many rows the query returned.
            const held = await results?.get(id, engine, query, request.timeTravel, request.notBefore);
            if (held) return { rowCount: BigInt(held.rowCount), estimated: false };
          }
          const { result } = await open(request, countQuery);
          let rowCount = 0n;
          for await (const batch of result.batches) {
            if (batch.numRows > 0) rowCount = BigInt(batch.getChildAt(0)?.get(0) ?? 0);
          }
          return { rowCount, estimated: false };
        } catch (error) {
          throw toConnectError(error, await locate(error, engineOf(request.sourceId), query));
        }
      },
    });

    router.service(CatalogService, {
      listCatalogs: (r) => guarded(async () => ({ catalogs: await source(r.sourceId).engine.listCatalogs() })),
      listSchemas: (r) => guarded(async () => ({ schemas: await source(r.sourceId).engine.listSchemas(r.catalog) })),
      listTables: (r) =>
        guarded(async () => {
          const { engine } = source(r.sourceId);
          const offset = Math.max(0, Number(r.pageToken || 0) || 0);
          if (engine.pagesTables && r.pageSize > 0) {
            // The engine cuts the page; one extra row says whether there is another.
            const found = await engine.listTables({ catalog: r.catalog, schema: r.schema, search: r.search, limit: r.pageSize + 1, offset });
            return { tables: found.slice(0, r.pageSize), nextPageToken: found.length > r.pageSize ? String(offset + r.pageSize) : "" };
          }
          const all = await engine.listTables({ catalog: r.catalog, schema: r.schema, search: r.search });
          const end = r.pageSize > 0 ? offset + r.pageSize : all.length;
          return { tables: all.slice(offset, end), nextPageToken: end < all.length ? String(end) : "" };
        }),
      describeTable: (r) =>
        guarded(async () => {
          if (!r.ref) throw new ConnectError("A table is required.", Code.InvalidArgument);
          const { engine } = source(r.sourceId);
          const ref = r.ref;
          try {
            return { table: await engine.describeTable(ref, r.includeStats) };
          } catch (error) {
            // A name written as SQL writes it (database.table, or catalog.schema.table) with nothing else said:
            // tried as one name first, then as its parts, so callers that hold only a name still reach the table.
            const parts = ref.table.split(".");
            if (!(error instanceof EngineError) || error.code !== "UNKNOWN_TABLE" || ref.schema || ref.catalog || parts.length < 2 || parts.length > 3 || parts.some((part) => !part)) throw error;
            const split = parts.length === 3 ? { catalog: parts[0]!, schema: parts[1]!, table: parts[2]! } : { catalog: "", schema: parts[0]!, table: parts[1]! };
            return { table: await engine.describeTable({ ...ref, ...split }, r.includeStats) };
          }
        }),
      listSnapshots: (r) =>
        guarded(async () => {
          if (!r.ref) throw new ConnectError("A table is required.", Code.InvalidArgument);
          return { snapshots: await source(r.sourceId).engine.listSnapshots(r.ref) };
        }),
    });

    router.service(SourceService, {
      listSources: async () => ({ sources: [...sources.values()].map(describe) }),
      getSource: async (r) => ({ source: describe(source(r.id)) }),
      registerSource: async () => {
        throw new ConnectError("Sources are set in the server's configuration.", Code.Unimplemented);
      },
      removeSource: async () => {
        throw new ConnectError("Sources are set in the server's configuration.", Code.Unimplemented);
      },
      listFiles: (r) =>
        guarded(async () => {
          const { engine } = source(r.sourceId);
          if (!engine.listFiles) throw new ConnectError("This source has no storage to list.", Code.Unimplemented);
          const { entries, truncated } = await engine.listFiles(r.path);
          // The engine lists a folder whole (it caps a very large one); pages are cut here.
          const size = Math.min(Math.max(r.pageSize || 500, 1), 2000);
          const from = Math.max(0, Number.parseInt(r.pageToken || "0", 10) || 0);
          const next = from + size;
          return { entries: entries.slice(from, next), nextPageToken: next < entries.length ? String(next) : "", truncated: truncated ?? false };
        }),
      testSource: (r) =>
        guarded(async () => {
          if (r.target.case !== "id") throw new ConnectError("Only configured sources can be tested.", Code.Unimplemented);
          const started = Date.now();
          const { engine } = source(r.target.value);
          // A system that cannot be reached still gets a report, not a failed call.
          let engineVersion = "";
          let unreachable: string | undefined;
          try {
            engineVersion = await engine.version();
          } catch (error) {
            unreachable = error instanceof Error ? error.message : String(error);
          }
          // Each table and catalog is reached in turn, so a person can see which connection is broken.
          const checks = (await engine.check?.().catch(() => undefined)) ?? [];
          const failed = checks.filter((c) => !c.ok);
          return {
            ok: !unreachable && failed.length === 0,
            message:
              unreachable && failed.length === 0
                ? `The source could not be reached: ${unreachable}`
                : failed.length === 0
                  ? "Connected"
                  : `${failed.length} of ${checks.length} could not be reached`,
            elapsedMs: BigInt(Date.now() - started),
            engineVersion,
            checks: checks.map((c) => ({ ...c, elapsedMs: BigInt(c.elapsedMs) })),
          };
        }),
    });
  };

  const dataSource = connectDataSource({ transport: createRouterTransport(routes) });
  // With no engine that can list its storage, the in-process data source has no `listFiles`, so a file browser says so plainly instead of failing.
  if (![...sources.values()].some((entry) => entry.engine.listFiles)) delete dataSource.listFiles;

  return {
    routes,
    dataSource,
    engineOf,
    clearResults: () => results?.clear(),
    async close() {
      for (const controller of running.values()) controller.abort();
      await results?.close();
    },
  };
}
