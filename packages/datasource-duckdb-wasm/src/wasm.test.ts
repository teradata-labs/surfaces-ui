import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createDuckDB, NODE_RUNTIME, VoidLogger } from "@duckdb/duckdb-wasm/blocking";
import { QueryError, collect, toRows } from "@surfaces-ui/data";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { AggregateFunction, FilterOperator, SortDirection } from "@surfaces-ui/proto";
import { seedById } from "@surfaces-ui/seeds";
import { beforeAll, describe, expect, it } from "vitest";
import { type DuckDbWasmBindings, type DuckDbWasmDataSource, createDuckDbWasmDataSource, dropDuckDbFile, fileFormatOf, loadSeed, registerDuckDbFile, tableNameOf } from "./index.js";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm"));
const seedData = path.join(path.dirname(require.resolve("@surfaces-ui/seeds/package.json")), "data");
const retail = seedById("retail")!;
const fraud = seedById("fraud")!;

let wasm: DuckDbWasmDataSource;
let node: Awaited<ReturnType<typeof createDuckDB>>;

beforeAll(async () => {
  node = await createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: path.join(dist, "duckdb-node-mvp.worker.cjs") },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: path.join(dist, "duckdb-node-eh.worker.cjs") },
    },
    new VoidLogger(),
    NODE_RUNTIME,
  );
  const db = node;
  await db.instantiate();
  db.open({});
  wasm = await createDuckDbWasmDataSource({
    bindings: db,
    connect: () => db.connect().useUnsafe((_, id) => id),
    sources: [{ id: "retail", displayName: "Retail (sample)" }, { id: "fraud" }],
  });
  await loadSeed(wasm.engine("retail"), retail, { fetchTable: async (t) => new Uint8Array(fs.readFileSync(path.join(seedData, "retail", `${t}.parquet`))) });
}, 120_000);

const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

describe("DuckDB in the browser", () => {
  it("lists the sources and their tables with descriptions", async () => {
    const { sources } = await wasm.dataSource.listSources({});
    expect(sources.map((x) => x.id)).toEqual(["retail", "fraud"]);
    const { tables } = await wasm.dataSource.listTables({ sourceId: "retail" });
    expect(tables.map((t) => t.ref?.table)).toEqual(retail.tables.map((t) => t.name).sort());
    expect(tables.find((t) => t.ref?.table === "orders")?.comment).toBe(retail.tables.find((t) => t.name === "orders")!.description);
    const { table } = await wasm.dataSource.describeTable({ sourceId: "retail", ref: { table: "orders" }, includeStats: true });
    expect(table?.columns.map((c) => c.name)).toEqual(retail.tables.find((t) => t.name === "orders")!.columns.map((c) => c.name));
    expect(Number(table?.rowCount)).toBeGreaterThan(0);
    // Parquet keeps no keys; the seed's declared ones come through.
    expect(table?.columns.find((c) => c.name === "order_id")?.primaryKey).toBe(true);
    expect(table?.columns.find((c) => c.name === "order_id")?.comment).not.toBe("");
    expect(table?.foreignKeys.map((fk) => [fk.columns.join(), fk.references?.table, fk.referencedColumns.join()])).toContainEqual(["customer_id", "customers", "customer_id"]);
  });

  it("gives the same grouped, filtered, sorted page as the server's DuckDB", async () => {
    const query = {
      baseSql: "SELECT o.*, s.region FROM orders o JOIN stores s USING (store_id)",
      filters: [{ column: "region", operator: FilterOperator.NOT_IN, values: [s("North")] }],
      groupBy: ["region"],
      aggregates: [{ column: "order_id", function: AggregateFunction.COUNT, alias: "orders" }],
      sorts: [{ column: "orders", direction: SortDirection.DESC }],
      page: { limit: 10, offset: 0n },
    };
    const inBrowser = toRows((await collect(wasm.dataSource.execute({ sourceId: "retail", query }))).table);
    const node = await createDuckDbEngine({
      tables: retail.tables.map((t) => ({ name: t.name, format: "parquet" as const, path: path.join(seedData, "retail", `${t.name}.parquet`) })),
    });
    const { createEngineServices } = await import("@surfaces-ui/engine-service");
    const server = await createEngineServices({ sources: [{ id: "retail", engine: node }] });
    const onServer = toRows((await collect(server.dataSource.execute({ sourceId: "retail", query }))).table);
    await node.close();
    expect(inBrowser.length).toBeGreaterThan(1);
    expect(inBrowser.map((r) => [r.region, Number(r.orders)])).toEqual(onServer.map((r) => [r.region, Number(r.orders)]));
  });

  it("draws a view unfiltered by a column its rows lack, says so, and keeps the filters it can take", async () => {
    // A page-wide filter by region over a total that has no region column.
    const total = "SELECT count(*) AS orders FROM orders";
    const all = await collect(wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: total } }));
    const filtered = await collect(
      wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: total, filters: [{ column: "region", operator: FilterOperator.EQ, values: [s("North")] }] } }),
    );
    expect(toRows(filtered.table)).toEqual(toRows(all.table));
    expect(filtered.header.notices.map((n) => [n.code, n.message])).toEqual([["FILTER_COLUMN_MISSING", "Not filtered by region: its rows have no region column."]]);
    const { rowCount } = await wasm.dataSource.count({ sourceId: "retail", query: { baseSql: total, filters: [{ column: "region", operator: FilterOperator.EQ, values: [s("North")] }] } });
    expect(rowCount).toBe(1n);

    // A view with region keeps that filter and drops only the one it cannot take.
    const stores = "SELECT store_id, region FROM stores";
    const north = await collect(
      wasm.dataSource.execute({
        sourceId: "retail",
        query: {
          baseSql: stores,
          filters: [
            { column: "REGION", operator: FilterOperator.EQ, values: [s("North")] },
            { column: "channel", operator: FilterOperator.EQ, values: [s("online")] },
          ],
        },
      }),
    );
    const rows = toRows(north.table);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.region === "North")).toBe(true);
    expect(north.header.notices.map((n) => n.code)).toEqual(["FILTER_COLUMN_MISSING"]);
    expect(north.header.notices[0]!.message).toMatch(/channel/);

    // Any other missing column still fails, with the engine's own words.
    await expect(collect(wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: "SELECT nope FROM stores", filters: [{ column: "region", operator: FilterOperator.EQ, values: [s("North")] }] } }))).rejects.toThrow(/nope/);
  });

  it("counts, binds text safely and refuses writes", async () => {
    const { rowCount } = await wasm.dataSource.count({ sourceId: "retail", query: { baseSql: "SELECT * FROM stores", filters: [{ column: "region", operator: FilterOperator.EQ, values: [s("x' OR '1'='1")] }] } });
    expect(rowCount).toBe(0n);
    await expect(collect(wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: "DROP TABLE orders" } }))).rejects.toBeInstanceOf(QueryError);
    await expect(collect(wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: "SELECT * FROM nowhere" } }))).rejects.toThrow(/nowhere/);
  });

  it("keeps sources apart and generates a seed from its SQL", async () => {
    await expect(collect(wasm.dataSource.execute({ sourceId: "fraud", query: { baseSql: "SELECT * FROM orders" } }))).rejects.toThrow();
    await loadSeed(wasm.engine("fraud"), fraud, { params: { scale: 0.1, seed: 7 } });
    const result = await collect(wasm.dataSource.execute({ sourceId: "fraud", query: { baseSql: "SELECT count(*) AS n FROM transactions" } }));
    expect(Number(toRows(result.table)[0]!.n)).toBeGreaterThan(0);
  }, 120_000);

  it("adds a person's CSV or JSON file as a table beside the seed's, and refuses one it cannot read", async () => {
    expect([fileFormatOf("Targets 2026.csv"), fileFormatOf("x.ndjson"), fileFormatOf("x.parquet"), fileFormatOf("x.xlsx")]).toEqual(["csv", "json", "parquet", undefined]);
    expect([tableNameOf("Targets 2026.csv"), tableNameOf("2026.csv")]).toEqual(["targets_2026", "t_2026"]);
    const csv = new TextEncoder().encode("store_id,target\n1,1000\n2,2500\n");
    await wasm.engine("retail").registerFile("targets", csv, "csv", { comment: "Uploaded" });
    wasm.refresh();
    const joined = await collect(wasm.dataSource.execute({ sourceId: "retail", query: { baseSql: "SELECT t.store_id, t.target, s.region FROM targets t JOIN stores s USING (store_id) ORDER BY t.store_id" } }));
    expect(toRows(joined.table).map((r) => Number(r.target))).toEqual([1000, 2500]);
    const json = new TextEncoder().encode('{"a":1}\n{"a":2}\n');
    await wasm.engine("retail").registerFile("notes", json, "json");
    const { tables } = await wasm.dataSource.listTables({ sourceId: "retail" });
    expect(tables.map((t) => t.ref?.table)).toEqual(expect.arrayContaining(["targets", "notes", "orders"]));
    await expect(wasm.engine("retail").registerFile("broken", new TextEncoder().encode("not parquet"), "parquet")).rejects.toThrow();
    expect((await wasm.dataSource.listTables({ sourceId: "retail" })).tables.map((t) => t.ref?.table)).not.toContain("broken");
    // Reading JSON can load DuckDB's json extension first, which took past the default 5 seconds on a CI runner.
  }, 60_000);

  it("explains a query", async () => {
    const plan = await wasm.dataSource.explain({ sourceId: "retail", query: { baseSql: "SELECT * FROM orders" } });
    expect(plan.planText.length).toBeGreaterThan(0);
  });
});

describe("a file from disk", () => {
  const csv = "id,name\n1,Ada\n2,Grace\n";

  it("registers bytes under a name, reads them, and drops them again", async () => {
    const engine = wasm.engine("fraud");
    await engine.registerFile("people", new TextEncoder().encode(csv), "csv");
    const page = await collect(wasm.dataSource.execute({ sourceId: "fraud", query: { baseSql: "SELECT name FROM people ORDER BY id" } }));
    expect(toRows(page.table).map((row) => row.name)).toEqual(["Ada", "Grace"]);
    await engine.dropFile("people");
    await expect(collect(wasm.dataSource.execute({ sourceId: "fraud", query: { baseSql: "SELECT * FROM people" } }))).rejects.toThrow(/people/);
    // A second drop of what is already gone is not an error.
    await engine.dropFile("people");
  });

  it("registers a File through the browser file reader, and falls back to reading it when the bindings lack one", async () => {
    const file = new File([csv], "people.csv", { type: "text/csv" });
    const calls: string[] = [];
    const handle = { ...fakeBindings(calls), registerFileHandle: (name: string, given: unknown, protocol: number, directIO: boolean) => calls.push(`handle ${name} ${given === file} ${protocol} ${directIO}`) };
    await registerDuckDbFile(handle, "people.csv", file);
    expect(calls).toEqual(["handle people.csv true 2 true"]);
    calls.length = 0;
    await registerDuckDbFile(fakeBindings(calls), "people.csv", file);
    expect(calls).toEqual([`buffer people.csv ${csv.length}`]);
    calls.length = 0;
    await registerDuckDbFile(fakeBindings(calls), "bytes.csv", new Uint8Array([1, 2]));
    expect(calls).toEqual(["buffer bytes.csv 2"]);
    await dropDuckDbFile({ ...fakeBindings(calls), dropFile: (name: string) => calls.push(`drop ${name}`) }, "people.csv");
    await dropDuckDbFile(fakeBindings(calls), "people.csv");
    expect(calls.at(-1)).toBe("drop people.csv");
  });

  it("reads a File into the database when the bindings have no browser file reader, and lets go of it with its table", async () => {
    // Node's DuckDB cannot open a browser File by handle (that needs a browser), so these bindings lack the call and the File is read whole.
    const bindings: DuckDbWasmBindings = {
      runQuery: (c, t) => node.runQuery(c, t),
      createPrepared: (c, t) => node.createPrepared(c, t),
      runPrepared: (c, p, v) => node.runPrepared(c, p, v),
      closePrepared: (c, p) => node.closePrepared(c, p),
      cancelPendingQuery: (c) => node.cancelPendingQuery(c),
      registerFileBuffer: (n, b) => node.registerFileBuffer(n, b),
      dropFile: (n) => node.dropFile(n),
      getVersion: () => node.getVersion(),
    };
    const source = await createDuckDbWasmDataSource({ bindings, connect: () => node.connect().useUnsafe((_c, id) => id), sources: [{ id: "from_disk" }] });
    const engine = source.engine("from_disk");
    await engine.registerFile("people", new File([csv], "people.csv"), "csv", { comment: "From disk" });
    const page = await collect(source.dataSource.execute({ sourceId: "from_disk", query: { baseSql: "SELECT COUNT(*) AS n FROM people" } }));
    expect(Number(toRows(page.table)[0]!.n)).toBe(2);
    await engine.dropFile("people");
    await expect(collect(source.dataSource.execute({ sourceId: "from_disk", query: { baseSql: "SELECT * FROM people" } }))).rejects.toThrow(/people/);
  });

  it("says a file cannot be read, and does not leave it registered", async () => {
    await expect(wasm.engine("fraud").registerFile("broken", new File(["\u0000\u0001not parquet"], "broken.parquet"), "parquet")).rejects.toThrow();
    expect((await wasm.dataSource.listTables({ sourceId: "fraud" })).tables.map((t) => t.ref?.table)).not.toContain("broken");
  });
});

function fakeBindings(calls: string[]): DuckDbWasmBindings {
  const never = () => {
    throw new Error("not used");
  };
  return {
    runQuery: never,
    createPrepared: never,
    runPrepared: never,
    closePrepared: never,
    cancelPendingQuery: never,
    getVersion: () => "test",
    registerFileBuffer: (name, buffer) => {
      calls.push(`buffer ${name} ${buffer.length}`);
    },
  };
}
