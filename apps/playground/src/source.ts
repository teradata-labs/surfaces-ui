import { connectDataSource, connectDiscovery, connectPipelines, connectSemantics, connectSurfaceLibrary } from "@surfaces-ui/client-connect";
import { type DataSource, type Discovery, type Pipelines, type Semantics, type SurfaceLibrary, memoryDataSource, memorySemantics, memorySurfaceLibrary, semanticModelDataProblems, semanticModelFromJson } from "@surfaces-ui/data";
import { Engine } from "@surfaces-ui/proto";
import { browserStorage } from "@surfaces-ui/state";
import { createDiscovery } from "@surfaces-ui/discovery";
import { seedById, seedSemanticModels, seeds } from "@surfaces-ui/seeds";
import type { SeedWorkingCopy } from "./areas/SeedsPanel.js";

export interface SourceOption {
  id: string;
  label: string;
  /** A table to open first. */
  table: string;
  /** One of the six industry models. */
  seed: boolean;
  /** The engine behind it, as a person reads it ("DuckDB", "Teradata"). Absent for sources in this page. */
  engine?: string;
  /** SQL to start the workbench on, when there is no known table to open. */
  startSql?: string;
}

export interface ActiveSource {
  dataSource: DataSource;
  discovery: Discovery;
  /** Only the dev server runs pipelines. */
  pipelines?: Pipelines;
  /** The source the area works on: the sample orders, or the model picked in the sidebar. */
  sourceId: string;
  /** The sample orders source the demo pages are written against. */
  sampleId: string;
  /** Every source a person can pick. */
  sources: SourceOption[];
  /** "server" is the local dev server; "browser" is DuckDB running in this page; "memory" is rows held in the page. */
  kind: "server" | "browser" | "memory";
  /** Makes sure a source's tables are loaded; in the browser, seeds load the first time they are picked. */
  prepare(sourceId: string): Promise<void>;
  /** Saved surfaces: files on the dev server, or this browser's storage when there is no server. */
  library: SurfaceLibrary;
  /** Semantic models: files on the dev server, or this browser's storage, starting from each seed's models. */
  semantics: Semantics;
  /** In the browser only: rerun a seed's SQL into this page's working copy, or reset it to the shipped files. Never touches the repo. */
  seedCopy?: SeedWorkingCopy;
  /** In the browser only: settles once the database in the page has started. */
  started?: Promise<void>;
  /** In the browser only: what is still loading, for the page to say. */
  loading?: LoadingStatus;
  /** In the browser only: rows held in the page, given when the database could not start there. */
  fallback?: Promise<ActiveSource | undefined>;
}

/** The table each model opens on: the one that records what happened. */
const FIRST_TABLE: Record<string, string> = {
  retail: "orders",
  healthcare: "encounters",
  fraud: "transactions",
  telco: "subscribers",
  transportation: "trips",
  manufacturing: "work_orders",
};

const seedOptions = (): SourceOption[] =>
  seeds.map((seed) => ({ id: seed.id, label: seed.title, table: FIRST_TABLE[seed.id] ?? seed.tables[0]!.name, seed: true }));

const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"];
const STATUS = ["shipped", "pending", "returned", null];

/** A repeatable number from 0 to 1 for a row and a purpose, so the sample is the same on every load. */
const chance = (id: number, salt: number) => {
  // Mixed twice so that two purposes for the same row do not move together.
  let h = Math.imul(id ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
/** The first index whose running share passes `p`. */
const pick = (p: number, shares: number[]) => Math.max(0, shares.findIndex((_, i) => p < shares.slice(0, i + 1).reduce((a, b) => a + b, 0)));

/**
 * Sample orders shaped like real ones: regions differ in size and order
 * value, sales grow through the year with a dip in spring, and most orders
 * ship. Uniform data would make every chart a row of equal bars.
 */
function sampleOrders(n: number) {
  const size = [1.3, 1, 0.75, 0.5];
  return Array.from({ length: n }, (_, i) => {
    const id = i + 1;
    const region = pick(chance(id, 1), [0.38, 0.29, 0.21, 0.12]);
    const status = pick(chance(id, 2), [0.62, 0.2, 0.1, 0.08]);
    const through = i / n;
    const season = 1 + 0.35 * through - 0.12 * Math.sin(through * Math.PI * 2);
    return {
      order_id: id,
      customer: `cust_${String(Math.floor(chance(id, 3) * (20 + 60 * through))).padStart(3, "0")}`,
      region: REGIONS[region]!,
      status: STATUS[status]!,
      amount: Math.round((40 + chance(id, 4) ** 2 * 900) * size[region]! * season * 100) / 100,
      quantity: 1 + Math.floor(chance(id, 5) ** 2 * 9),
      ordered_at: new Date(Date.UTC(2026, 0, 1) + id * 3_600_000),
    };
  });
}

/**
 * A published copy (GitHub Pages): built with `VITE_SURFACES_PUBLISHED=1`, it runs on DuckDB in the page and the sample
 * data only, and never calls an address on the visitor's own machine (no dev server, local model or Loom).
 */
export const PUBLISHED = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SURFACES_PUBLISHED === "1";

/** The dev server: `VITE_SURFACES_SERVER`, or port 5220 on this machine. */
export const SERVER = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SURFACES_SERVER ?? "http://localhost:5220";

/**
 * What a server source is called and where it opens. The sample lake has an
 * orders table; a Teradata system has no table every login can read, so it
 * opens on the system's own version information, which any login may read.
 */
function engineStart(engine: Engine): Pick<SourceOption, "engine" | "table" | "startSql"> {
  switch (engine) {
    case Engine.TERADATA:
      return { engine: "Teradata", table: "", startSql: "SELECT InfoKey, InfoData FROM DBC.DBCInfoV" };
    case Engine.DATAFUSION:
      return { engine: "DataFusion", table: "orders" };
    case Engine.POSTGRES:
      return { engine: "Postgres", table: "orders" };
    case Engine.MYSQL:
      return { engine: "MySQL", table: "orders" };
    default:
      return { engine: "DuckDB", table: "orders" };
  }
}

/** The dev server, when it is running. */
async function serverSource(): Promise<Omit<ActiveSource, "library" | "semantics"> | undefined> {
  const server = connectDataSource({ baseUrl: SERVER });
  try {
    const { sources } = await server.listSources({}, { signal: AbortSignal.timeout(1500) });
    if (sources.length === 0) return undefined;
    const sampleId = sources.find((s) => s.id === "lake")?.id ?? sources[0]!.id;
    const known = new Set(sources.map((s) => s.id));
    const options: SourceOption[] = [
      ...sources.filter((s) => !seedById(s.id)).map((s) => ({ id: s.id, label: s.displayName || s.id, seed: false, ...engineStart(s.engine) })),
      ...seedOptions()
        .filter((s) => known.has(s.id))
        .map((s) => ({ ...s, engine: "DuckDB" })),
    ];
    return {
      dataSource: server,
      discovery: connectDiscovery({ baseUrl: SERVER }),
      pipelines: connectPipelines({ baseUrl: SERVER }),
      sourceId: sampleId,
      sampleId,
      sources: options,
      kind: "server",
      prepare: async () => {},
    };
  } catch {
    return undefined;
  }
}

/** How long a step that downloads nothing may take before the page gives up on the database and uses rows in memory. */
const STEP_LIMIT_MS = 30_000;

/** Settles as `work` does, or fails once `ms` have passed, so a step that never answers cannot leave the page waiting. */
function withinTime<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish in ${ms / 1000} s.`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/**
 * DuckDB running in this page (WebAssembly): the same sample orders file the
 * server reads, and the six industry models, each loaded from its Parquet
 * files the first time it is picked. Nothing leaves the browser.
 */
function browserSource(): Omit<ActiveSource, "library" | "semantics"> {
  // The database (DuckDB, about 8 MB compressed) and the SQL parser every query goes through (about 7 MB) download
  // side by side, starting now. The page does not wait for them: the data source below is handed out at once, and each
  // call waits for the engine, and for its sample model's tables, itself.
  // What is still loading: the engine first, then any sample model asked for.
  const status = loadingStatus();
  let engineReady = false;
  // Which step the engine is on, so a page that stays on one says where.
  let step = "Downloading the sample database and SQL parser, about 15 MB.";
  const seedsLoading = new Set<string>();
  const say = () =>
    status.set(
      !engineReady
        ? `${step} Tables and charts fill in when they are ready.`
        : seedsLoading.size
          ? `Loading the ${[...seedsLoading].map((id) => seedById(id)?.title ?? id).join(", ")} sample…`
          : undefined,
    );
  say();
  const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
  const next = (text: string) => {
    step = text;
    say();
  };
  const started = (async () => {
    const [{ createDuckDbWasmDataSource, fileFormatOf, loadSeed, openBrowserDuckDb, tableNameOf }, mvpModule, mvpWorker, ehModule, ehWorker, ordersUrl] = await Promise.all([
      import("@surfaces-ui/datasource-duckdb-wasm"),
      import("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url"),
      import("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url"),
      import("../../../fixtures/lake/orders.parquet?url"),
    ]);
    next("Starting the sample database and downloading the SQL parser, about 15 MB.");
    const [duck] = await Promise.all([
      openBrowserDuckDb({
        mvp: { mainModule: mvpModule.default, mainWorker: mvpWorker.default },
        eh: { mainModule: ehModule.default, mainWorker: ehWorker.default },
      }),
      // Without this the parser starts downloading only once the database is open.
      import("@surfaces-ui/sql").then(({ initSql }) => initSql()),
    ]);
    next("Opening the sample database.");
    const wasm = await withinTime(
      createDuckDbWasmDataSource({
        bindings: duck.bindings,
        connect: duck.connect,
        sources: [{ id: "lake", displayName: "Sample orders" }, ...seeds.map((s) => ({ id: s.id, displayName: `${s.title} (sample)` }))],
      }),
      STEP_LIMIT_MS,
      "Opening the sample database",
    );
    next("Loading the sample orders.");
    await withinTime(
      fetchBytes(ordersUrl.default).then((bytes) => wasm.engine("lake").registerParquet("orders", bytes, { comment: "Sample orders (Parquet, 5,000 rows)", model: { primaryKey: ["order_id"] } })),
      STEP_LIMIT_MS,
      "Loading the sample orders",
    );
    return { wasm, loadSeed, fileFormatOf, tableNameOf };
  })().finally(() => {
    engineReady = true;
    say();
  });
  const loading = new Map<string, Promise<void>>();
  const seedFiles = (id: string) => (table: string) => fetchBytes(SEED_FILES[`${SEED_DIR}/${id}/${table}.parquet`]!);
  // A seed's tables load the first time anything asks for that source.
  const prepare = (sourceId: string): Promise<void> => {
    const seed = seedById(sourceId);
    if (!seed) return started.then(() => undefined);
    let pending = loading.get(sourceId);
    if (!pending) {
      seedsLoading.add(sourceId);
      say();
      pending = started
        .then(async ({ wasm, loadSeed }) => {
          await loadSeed(wasm.engine(sourceId), seed, { fetchTable: seedFiles(sourceId) });
          wasm.refresh();
          discovery.refresh?.();
        })
        .finally(() => {
          seedsLoading.delete(sourceId);
          say();
        });
      loading.set(sourceId, pending);
    }
    return pending;
  };
  const dataSource = waitingDataSource(
    started.then(({ wasm }) => wasm.dataSource),
    (sourceId) => (sourceId ? prepare(sourceId) : started.then(() => undefined)),
  );
  // Every value in these sources is made up, so they may be shown and profiled.
  const discovery = createDiscovery({ dataSource, allowSampleValues: ["lake", ...seeds.map((s) => s.id)] });
  return {
    dataSource,
    discovery,
    sourceId: "lake",
    sampleId: "lake",
    sources: [{ id: "lake", label: "Sample orders", table: "orders", seed: false }, ...seedOptions()],
    kind: "browser",
    started: started.then(() => undefined),
    loading: status,
    seedCopy: {
      async run(id, statements) {
        const seed = seedById(id);
        if (!seed) throw new Error(`No seed named ${id}.`);
        const { wasm, loadSeed } = await started;
        const done = loadSeed(wasm.engine(id), { ...seed, sql: () => statements }, { params: {} });
        loading.set(id, done.catch(() => {}));
        await done;
        wasm.refresh();
        discovery.refresh?.();
      },
      async reset(id) {
        const seed = seedById(id);
        if (!seed) throw new Error(`No seed named ${id}.`);
        const { wasm, loadSeed } = await started;
        const done = loadSeed(wasm.engine(id), seed, { fetchTable: seedFiles(id) });
        loading.set(id, done);
        await done;
        wasm.refresh();
        discovery.refresh?.();
      },
      async addFiles(id, files) {
        const { wasm, fileFormatOf, tableNameOf } = await started;
        // A seed loads on first pick; its own tables must be there before files join them.
        await loading.get(id);
        const names: string[] = [];
        for (const file of files) {
          const format = fileFormatOf(file.name);
          if (!format) throw new Error(`${file.name} is not a Parquet, CSV or JSON file.`);
          const name = tableNameOf(file.name);
          try {
            await wasm.engine(id).registerFile(name, new Uint8Array(await file.arrayBuffer()), format, { comment: `Added from ${file.name} in this browser` });
          } catch (error) {
            throw new Error(`${file.name} could not be read as ${format.toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`);
          }
          names.push(name);
        }
        wasm.refresh();
        discovery.refresh?.();
        return names;
      },
    },
    prepare,
  };
}

/** What the page is still loading, as one sentence, or nothing once everything asked for has arrived. */
export interface LoadingStatus {
  get(): string | undefined;
  set(text: string | undefined): void;
  subscribe(listener: () => void): () => void;
}

function loadingStatus(): LoadingStatus {
  let text: string | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => text,
    set(next) {
      if (next === text) return;
      text = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A data source that can be handed out before its engine has started: each call waits for the engine, and for the
 * source it names to be ready, then goes through.
 */
function waitingDataSource(target: Promise<DataSource>, ready: (sourceId: string) => Promise<void>): DataSource {
  const wait = async (request: unknown): Promise<DataSource> => {
    const sourceId = (request as { sourceId?: string } | undefined)?.sourceId ?? "";
    const [ds] = await Promise.all([target, ready(sourceId)]);
    return ds;
  };
  type Call = (request: never, options?: never) => Promise<unknown>;
  const unary = (name: keyof DataSource) =>
    ((request: never, options?: never) =>
      wait(request).then((ds) => {
        const method = ds[name] as Call | undefined;
        if (!method) throw new Error(`This source cannot ${String(name)}.`);
        return method.call(ds, request, options);
      })) as never;
  return {
    async *execute(request, options) {
      const ds = await wait(request);
      yield* ds.execute(request, options);
    },
    count: unary("count"),
    explain: unary("explain"),
    // Cancelling names a query that has started, so it waits for nothing.
    cancel: ((request: never, options?: never) => target.then((ds) => ds.cancel(request, options))) as never,
    listSources: unary("listSources"),
    testSource: unary("testSource"),
    listCatalogs: unary("listCatalogs"),
    listSchemas: unary("listSchemas"),
    listTables: unary("listTables"),
    describeTable: unary("describeTable"),
    listSnapshots: unary("listSnapshots"),
  };
}

const SEED_DIR = "../../../packages/seeds/data";
/** The seed Parquet files, served by the app's own build. */
const SEED_FILES = import.meta.glob("../../../packages/seeds/data/*/*.parquet", { query: "?url", import: "default", eager: true }) as Record<string, string>;

/** Rows held in the page, when DuckDB cannot start. */
function memorySource(): Omit<ActiveSource, "library" | "semantics"> {
  const dataSource = memoryDataSource({
    tables: {
      orders: sampleOrders(5000),
      customers: Array.from({ length: 37 }, (_, i) => ({ customer: `cust_${String(i).padStart(3, "0")}`, segment: ["Enterprise", "Mid-market", "Small business"][i % 3]!, signup_year: 2019 + (i % 7) })),
    },
  });
  // The same reference discovery backend the dev server uses, running in the page.
  // The sample rows are made up, so their values may be shown.
  return {
    dataSource,
    discovery: createDiscovery({ dataSource, allowSampleValues: ["memory"] }),
    sourceId: "memory",
    sampleId: "memory",
    sources: [{ id: "memory", label: "Sample orders", table: "orders", seed: false }],
    kind: "memory",
    prepare: async () => {},
  };
}

/**
 * Picks a backend: the dev server when it is running, then DuckDB in the
 * browser, then rows in memory. Components behave the same on all three:
 * they only see a DataSource.
 */
export async function chooseSource(): Promise<ActiveSource> {
  const server = PUBLISHED ? undefined : await serverSource();
  if (server) return { ...server, library: connectSurfaceLibrary({ baseUrl: SERVER }), semantics: connectSemantics({ baseUrl: SERVER }) };
  const library = memorySurfaceLibrary({ storage: browserStorage(), key: "surfaces.playground.library" });
  // Without a server, models are kept in this browser, starting from each seed's, and checked against the data in the page before a save.
  const local = (dataSource: DataSource) =>
    memorySemantics({
      storage: browserStorage(),
      key: "surfaces.playground.semantic",
      models: seeds.flatMap((seed) => seedSemanticModels(seed).map((json) => semanticModelFromJson(json as never))),
      check: (model) => semanticModelDataProblems(model, dataSource),
    });
  const browser = browserSource();
  const fallback = browser.started!.then(
    () => undefined,
    (error: unknown) => {
      console.warn("[playground] DuckDB could not start in this browser; using rows in memory.", error);
      browser.loading?.set(undefined);
      const memory = memorySource();
      return { ...memory, library, semantics: local(memory.dataSource) };
    },
  );
  return { ...browser, library, semantics: local(browser.dataSource), fallback };
}

/** The table an area opens on for the source it is given. */
export function firstTable(source: ActiveSource): string {
  return source.sources.find((s) => s.id === source.sourceId)?.table || "orders";
}

/**
 * True for a real source: one with no sample model and no table the demo
 * pages know (a warehouse, a person's database). The demo pages stay on
 * sample data; the composer, chat and data pages work on it as it is.
 */
export function isRealSource(source: ActiveSource): boolean {
  // Anything that is not one of the six sample models or the sample orders has no demo written for it: a warehouse, a database, a bucket.
  const option = source.sources.find((s) => s.id === source.sourceId);
  return !!option && !option.seed && option.id !== source.sampleId;
}

/** The same backend, pointed at sample data: the first sample model, or the sample orders. For pages written as demos. */
export function sampleSource(source: ActiveSource): ActiveSource {
  return { ...source, sourceId: source.sources.find((s) => s.seed)?.id ?? source.sampleId };
}

/** The table an area opens on, or "" when the source has none every login can read (Teradata). */
export function openingTable(source: ActiveSource): string {
  const option = source.sources.find((s) => s.id === source.sourceId);
  return option ? option.table : "orders";
}

/** The SQL the workbench starts on for the source it is given. */
export function startSql(source: ActiveSource): string {
  const option = source.sources.find((s) => s.id === source.sourceId);
  return option?.startSql ?? `SELECT * FROM ${option?.table || "orders"}`;
}

/** What the backend badge says for the source it is given. */
export function engineLabel(source: ActiveSource): string {
  if (source.kind === "memory") return "In memory";
  if (source.kind === "browser") return "DuckDB in this page";
  return source.sources.find((s) => s.id === source.sourceId)?.engine ?? "Dev server";
}
