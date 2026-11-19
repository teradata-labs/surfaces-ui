import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createDuckDB, NODE_RUNTIME, VoidLogger } from "@duckdb/duckdb-wasm/blocking";
import { QueryError, collect, toRows } from "@surfaces-ui/data";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { AggregateFunction, FilterOperator, SortDirection } from "@surfaces-ui/proto";
import { seedById } from "@surfaces-ui/seeds";
import { beforeAll, describe, expect, it } from "vitest";
import { type DuckDbWasmDataSource, createDuckDbWasmDataSource, fileFormatOf, loadSeed, tableNameOf } from "./index.js";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm"));
const seedData = path.join(path.dirname(require.resolve("@surfaces-ui/seeds/package.json")), "data");
const retail = seedById("retail")!;
const fraud = seedById("fraud")!;

let wasm: DuckDbWasmDataSource;

beforeAll(async () => {
  const db = await createDuckDB(
    {
      mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: path.join(dist, "duckdb-node-mvp.worker.cjs") },
      eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: path.join(dist, "duckdb-node-eh.worker.cjs") },
    },
    new VoidLogger(),
    NODE_RUNTIME,
  );
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
