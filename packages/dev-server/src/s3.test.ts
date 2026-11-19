import { type DataSource, collect, toRows } from "@surfaces-ui/data";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { AggregateFunction, FileEntryKind, SortDirection, TableFormat } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

/**
 * Runs the stack against an S3-compatible object store: tables read from a
 * bucket, summarised with a derived measure, and the bucket's folders and
 * files listed for a file browser. It needs a store, so it only runs when
 * told where one is:
 *
 *   SURFACES_TEST_S3=127.0.0.1:9100          (host and port, no scheme)
 *   SURFACES_TEST_S3_BUCKET=acme-lake        (default)
 *   SURFACES_TEST_S3_KEY_ID / SURFACES_TEST_S3_SECRET   (any value for a mock)
 *
 * The bucket must hold the retail seed's files as this test expects them:
 *   sales/retail/orders.parquet, order_items.parquet, stores.parquet
 *   sales/retail/reference/products.parquet
 *   private/customers.parquet               (outside the connection's scope)
 * A local stand-in is enough, for example the adobe/s3mock container; real
 * S3, GCS and Azure have still not been run.
 */
const endpoint = process.env.SURFACES_TEST_S3;
const bucket = process.env.SURFACES_TEST_S3_BUCKET ?? "acme-lake";
const scope = `s3://${bucket}/sales`;

describe.skipIf(!endpoint)("an S3-compatible object store through DuckDB", () => {
  let server: SurfacesServer;
  let data: DataSource;

  beforeAll(async () => {
    const engine = await createDuckDbEngine({
      connections: [{ name: "lake", kind: "s3", scope, secret: "S3TEST", region: "us-east-1", endpoint: endpoint!, urlStyle: "path", useSsl: false }],
      tables: [
        { name: "orders", format: "parquet", path: `${scope}/retail/orders.parquet` },
        { name: "order_items", format: "parquet", path: `${scope}/retail/order_items.parquet` },
        { name: "stores", format: "parquet", path: `${scope}/retail/stores.parquet` },
        { name: "products", format: "parquet", path: `${scope}/retail/reference/products.parquet` },
      ],
      // Named, never written in config: the server resolves it.
      resolveSecret: (name) => (name === "S3TEST" ? { keyId: process.env.SURFACES_TEST_S3_KEY_ID ?? "test", secret: process.env.SURFACES_TEST_S3_SECRET ?? "test" } : undefined),
    });
    server = await createSurfacesServer({ sources: [{ id: "lake", engine }] });
    data = server.dataSource;
  }, 120_000);
  afterAll(() => server?.close());

  it("reaches every table, and says so", async () => {
    const test = await data.testSource!({ target: { case: "id", value: "lake" } });
    expect(test.checks.filter((c) => !c.ok)).toEqual([]);
    expect(test.checks.map((c) => c.name).sort()).toEqual(expect.arrayContaining(["order_items", "orders", "products", "stores"]));
    const { rowCount } = await data.count({ sourceId: "lake", query: { baseSql: "SELECT * FROM orders" } });
    expect(Number(rowCount)).toBeGreaterThan(1000);
  });

  it("joins tables in the bucket and works a derived measure out in the engine", async () => {
    const result = await collect(
      data.execute({
        sourceId: "lake",
        query: {
          baseSql: "SELECT s.region, i.line_amount, i.quantity FROM order_items i JOIN orders o ON o.order_id = i.order_id JOIN stores s ON s.store_id = o.store_id",
          groupBy: ["region"],
          aggregates: [
            { function: AggregateFunction.SUM, column: "line_amount", alias: "revenue" },
            { function: AggregateFunction.SUM, column: "quantity", alias: "units" },
          ],
          derived: [{ alias: "per_unit", expression: "revenue / units" }],
          sorts: [{ column: "per_unit", direction: SortDirection.DESC }],
          page: { limit: 10 },
        },
      }),
    );
    const rows = toRows(result.table);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((r) => typeof r.per_unit === "number" && (r.per_unit as number) > 0)).toBe(true);
    // Sorted by the derived measure, in the engine.
    expect(rows.map((r) => r.per_unit)).toEqual([...rows.map((r) => r.per_unit as number)].sort((a, b) => b - a));
  });

  it("lists the bucket as folders and files, with the table that reads each", async () => {
    const top = await data.listFiles!({ sourceId: "lake", path: "" });
    expect(top.entries.map((e) => [e.path, e.kind])).toEqual([[scope, FileEntryKind.FOLDER]]);
    const sales = await data.listFiles!({ sourceId: "lake", path: scope });
    expect(sales.entries.map((e) => [e.name, e.kind])).toEqual([["retail", FileEntryKind.FOLDER]]);
    const retail = await data.listFiles!({ sourceId: "lake", path: `${scope}/retail` });
    expect(retail.entries.map((e) => [e.name, e.kind, e.format, e.table])).toEqual([
      ["reference", FileEntryKind.FOLDER, TableFormat.UNSPECIFIED, ""],
      ["order_items.parquet", FileEntryKind.FILE, TableFormat.PARQUET, "order_items"],
      ["orders.parquet", FileEntryKind.FILE, TableFormat.PARQUET, "orders"],
      ["stores.parquet", FileEntryKind.FILE, TableFormat.PARQUET, "stores"],
    ]);
    expect((await data.listFiles!({ sourceId: "lake", path: `${scope}/retail/reference` })).entries.map((e) => [e.name, e.table])).toEqual([["products.parquet", "products"]]);
    // A trailing slash is the same folder.
    expect((await data.listFiles!({ sourceId: "lake", path: `${scope}/retail/` })).entries).toHaveLength(4);
  });

  it("reads a store anonymously when no secret is named, still from that store", async () => {
    const engine = await createDuckDbEngine({
      connections: [{ name: "open", kind: "s3", scope, endpoint: endpoint!, urlStyle: "path", useSsl: false }],
      tables: [{ name: "stores", format: "parquet", path: `${scope}/retail/stores.parquet` }],
    });
    try {
      // Without the endpoint the engine would ask AWS for this bucket and be refused.
      expect((await engine.check?.())?.filter((c) => !c.ok) ?? []).toEqual([]);
      expect((await engine.listFiles!(`${scope}/retail`)).entries.map((e) => e.name)).toContain("stores.parquet");
    } finally {
      await engine.close();
    }
  });

  it("keeps to the connection's scope: the rest of the bucket cannot be listed or read", async () => {
    await expect(data.listFiles!({ sourceId: "lake", path: `s3://${bucket}/private` })).rejects.toThrow(/outside what this source may read/);
    await expect(data.listFiles!({ sourceId: "lake", path: `s3://${bucket}` })).rejects.toThrow(/outside/);
    await expect(data.listFiles!({ sourceId: "lake", path: `${scope}-other` })).rejects.toThrow(/outside/);
    await expect(collect(data.execute({ sourceId: "lake", query: { baseSql: `SELECT * FROM read_parquet('s3://${bucket}/private/customers.parquet')` } }))).rejects.toThrow();
  });
});
