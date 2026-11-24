import type { DataSource } from "@surfaces-ui/data";
import type { TableModel } from "@surfaces-ui/engine";
import { type StoredResultsOptions, createEngineServices } from "@surfaces-ui/engine-service";
import { SourceKind } from "@surfaces-ui/proto";
import { type DuckDbWasmBindings, type DuckDbWasmEngine, createDuckDbWasmEngine } from "./engine.js";

export * from "./engine.js";

export interface WasmSourceConfig {
  /** Source id, also the DuckDB schema its tables live in. */
  id: string;
  displayName?: string;
}

export interface DuckDbWasmDataSourceOptions {
  bindings: DuckDbWasmBindings;
  /** Opens a new connection and returns its id; each source gets its own. */
  connect(): number | Promise<number>;
  sources: WasmSourceConfig[];
  /** Keep query results so views of one query share it. Defaults on, at 250,000 rows. */
  storedResults?: StoredResultsOptions | false;
  maxResultRows?: number;
}

export interface DuckDbWasmDataSource {
  /** Read-only, like any DataSource: one SELECT or WITH per query. */
  dataSource: DataSource;
  /** The engine behind a source, to add Parquet or run generator SQL. */
  engine(sourceId: string): DuckDbWasmEngine;
  /** Drops kept results, after the tables under a source changed. */
  refresh(): void;
  close(): Promise<void>;
}

/**
 * A DataSource that runs DuckDB in the browser. It goes through the same
 * query, catalog and source services as the dev server (`@surfaces-ui/engine-service`),
 * so sorting, filtering, paging, grouping, counts and errors behave the same,
 * with no server. Every component works against it unchanged.
 */
export async function createDuckDbWasmDataSource(options: DuckDbWasmDataSourceOptions): Promise<DuckDbWasmDataSource> {
  const engines = new Map<string, DuckDbWasmEngine>();
  for (const source of options.sources) {
    if (engines.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
    engines.set(source.id, await createDuckDbWasmEngine({ bindings: options.bindings, connection: await options.connect(), schema: source.id }));
  }
  const services = await createEngineServices({
    sources: options.sources.map((s) => ({ id: s.id, displayName: s.displayName, kind: SourceKind.DUCKDB, engine: engines.get(s.id)! })),
    storedResults: options.storedResults,
    maxResultRows: options.maxResultRows,
  });
  return {
    dataSource: services.dataSource,
    engine(sourceId) {
      const engine = engines.get(sourceId);
      if (!engine) throw new Error(`Unknown source: ${sourceId}`);
      return engine;
    },
    refresh: () => services.clearResults(),
    close: () => services.close(),
  };
}

/** The shape of a seed model this package can load; `@surfaces-ui/seeds` seeds fit it. */
export interface LoadableSeed {
  id: string;
  tables: {
    name: string;
    description: string;
    primaryKey?: string[];
    columns?: { name: string; description: string }[];
    foreignKeys?: { column: string; table: string; references: string }[];
  }[];
  sql(params?: Record<string, unknown>): string[];
}

/**
 * Fills a source with a seed model: from its Parquet files when `fetchTable`
 * is given (fast, the files that ship with the seeds), or by running its
 * generator SQL with `params` (any scale or random seed, a few seconds).
 * Replaces whatever the source held.
 */
export async function loadSeed(
  engine: DuckDbWasmEngine,
  seed: LoadableSeed,
  from: { fetchTable(table: string): Promise<Uint8Array> } | { params?: Record<string, unknown> },
): Promise<void> {
  await engine.clear();
  if ("fetchTable" in from) {
    const files = await Promise.all(seed.tables.map(async (t) => [t, await from.fetchTable(t.name)] as const));
    for (const [table, bytes] of files) await engine.registerParquet(table.name, bytes, { comment: table.description, model: modelOf(table) });
    return;
  }
  await engine.runStatements(seed.sql(from.params));
  for (const table of seed.tables) {
    await engine.runStatements([`COMMENT ON TABLE "${table.name}" IS '${table.description.replace(/'/g, "''")}'`]);
    await engine.describeAs(table.name, { comment: table.description, model: modelOf(table) });
  }
}

/** A seed table's declared keys and column descriptions, which Parquet files do not keep. */
function modelOf(table: LoadableSeed["tables"][number]): TableModel {
  return {
    primaryKey: table.primaryKey ?? [],
    columns: Object.fromEntries((table.columns ?? []).map((c) => [c.name, c.description])),
    foreignKeys: (table.foreignKeys ?? []).map((fk) => ({ columns: [fk.column], table: fk.table, references: [fk.references] })),
  };
}

/** The wasm and worker files for each DuckDB-wasm build, as URLs the host serves (with Vite, `?url` imports). */
export interface DuckDbWasmBundles {
  mvp: { mainModule: string; mainWorker: string };
  eh?: { mainModule: string; mainWorker: string };
}

/**
 * Starts DuckDB-wasm in a Web Worker. The host passes the bundle URLs so the
 * files come from its own build, never from a CDN at run time. The module is
 * loaded only when this is called.
 */
export async function openBrowserDuckDb(bundles: DuckDbWasmBundles): Promise<{ bindings: DuckDbWasmBindings; connect(): Promise<number>; terminate(): Promise<void> }> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle({ mvp: bundles.mvp, eh: bundles.eh } as Parameters<typeof duckdb.selectBundle>[0]);
  const worker = new Worker(bundle.mainWorker!);
  // A worker that fails to load or crashes (a browser out of memory, a module it cannot compile) answers nothing, so
  // without this the calls below would wait for ever instead of failing and letting the host fall back.
  const failed = new Promise<never>((_, reject) => {
    worker.addEventListener("error", (event) => reject(new Error(`The database worker stopped: ${event.message || "no reason given"}.`)));
    worker.addEventListener("messageerror", () => reject(new Error("The database worker sent a message that could not be read.")));
  });
  failed.catch(() => {});
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await Promise.race([db.instantiate(bundle.mainModule, bundle.pthreadWorker), failed]);
  await Promise.race([db.open({ query: { castBigIntToDouble: false } }), failed]);
  return { bindings: db, connect: () => db.connectInternal(), terminate: () => db.terminate() };
}
