import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AdbcDatabase } from "@apache-arrow/adbc-driver-manager";
import { create } from "@bufbuild/protobuf";
import type { Engine } from "@surfaces-ui/engine";
import { FileEntryKind, TableFormat, TableRefSchema, TimeTravelSchema } from "@surfaces-ui/proto";
import type { RecordBatch } from "apache-arrow";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDuckDbEngine, duckDbLibraryPath, isRemotePath, secretSql } from "./index.js";

const lake = path.resolve(import.meta.dirname, "../../../fixtures/lake");
let engine: Engine;

beforeAll(async () => {
  engine = await createDuckDbEngine({
    tables: [
      { name: "orders", format: "parquet", path: `${lake}/orders.parquet`, comment: "Sample orders" },
      { name: "delta_orders", format: "delta", path: `${lake}/delta_orders` },
      { name: "iceberg_orders", format: "iceberg", path: `${lake}/iceberg_orders` },
    ],
  });
}, 120_000);
afterAll(() => engine?.close());

async function run(sql: string, params: (string | number | bigint | boolean)[] = [], at?: Parameters<typeof create<typeof TimeTravelSchema>>[1]) {
  const result = await engine.execute(sql, params, at ? { timeTravel: create(TimeTravelSchema, at) } : {});
  const batches: RecordBatch[] = [];
  for await (const batch of result.batches) batches.push(batch);
  const rows = batches.flatMap((b) => b.toArray().map((r) => r.toJSON() as Record<string, unknown>));
  return { schema: result.schema, rows, batches: batches.length };
}
const count = async (table: string, at?: Parameters<typeof run>[2]) =>
  Number((await run(`SELECT COUNT(*) AS n FROM ${table}`, [], at)).rows[0]!.n);
const ref = (table: string) => create(TableRefSchema, { table });

describe("DuckDB engine", () => {
  it("streams typed Arrow batches with bound parameters", async () => {
    const r = await run(
      `SELECT * FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = ? AND "amount" >= ? ORDER BY "amount" DESC LIMIT 3`,
      ["Europe", 900],
    );
    expect(r.rows).toHaveLength(3);
    expect(r.rows.every((x) => x.region === "Europe" && (x.amount as number) >= 900)).toBe(true);
    expect(r.schema.fields.map((f) => `${f.name}:${f.type}`)).toEqual([
      "order_id:Int64",
      "customer:Utf8",
      "region:Utf8",
      "status:Utf8",
      "amount:Float64",
      "quantity:Int32",
      "ordered_at:Timestamp<MICROSECOND>",
    ]);
    const all = await run("SELECT * FROM orders");
    expect(all.rows).toHaveLength(5000);
    expect(all.batches).toBeGreaterThan(1);
  });

  it("returns a schema for an empty result", async () => {
    const r = await run("SELECT order_id, amount FROM orders WHERE order_id < 0");
    expect(r.rows).toEqual([]);
    expect(r.schema.fields.map((f) => f.name)).toEqual(["order_id", "amount"]);
  });

  it("reads Delta and Iceberg at the latest and at earlier points", async () => {
    expect(await count("delta_orders")).toBe(1750);
    expect(await count("delta_orders", { at: { case: "version", value: 0n } })).toBe(1000);
    expect(await count("delta_orders", { at: { case: "version", value: 1n }, table: "delta_orders" })).toBe(1500);
    expect(await count("iceberg_orders")).toBe(1750);
    const snapshots = await engine.listSnapshots(ref("iceberg_orders"));
    expect(snapshots).toHaveLength(3);
    const oldest = snapshots.at(-1)!;
    expect(oldest.id).toMatch(/^\d{15,}$/);
    expect(await count("iceberg_orders", { at: { case: "snapshotId", value: oldest.id! }, table: "iceberg_orders" })).toBe(1000);
    // Pinning one table leaves the others at their latest.
    expect(await count("delta_orders", { at: { case: "snapshotId", value: oldest.id! }, table: "iceberg_orders" })).toBe(1750);
    // A pin on one connection does not leak into the next query.
    expect(await count("delta_orders")).toBe(1750);
  });

  it("lists Delta versions newest first", async () => {
    const versions = await engine.listSnapshots(ref("delta_orders"));
    expect(versions.map((v) => v.id)).toEqual(["2", "1", "0"]);
    expect(versions[0]!.operation).toBe("WRITE");
    expect(await engine.listSnapshots(ref("orders"))).toEqual([]);
  });

  it("describes the catalog", async () => {
    const tables = await engine.listTables({ catalog: "", schema: "", search: "ORD" });
    expect(tables.map((t) => [t.ref?.table, t.format])).toEqual([
      ["delta_orders", TableFormat.DELTA],
      ["iceberg_orders", TableFormat.ICEBERG],
      ["orders", TableFormat.PARQUET],
    ]);
    const detail = await engine.describeTable(ref("orders"), true);
    expect(detail.rowCount).toBe(5000n);
    expect(detail.columns?.[4]).toMatchObject({ name: "amount", nativeType: "DOUBLE", arrowType: "Float64", ordinal: 5 });
    await expect(engine.describeTable(ref("nope"), false)).rejects.toThrow(/Table not found/);
  });

  it("explains a query and reports engine errors plainly", async () => {
    const plan = await engine.explain("SELECT region, SUM(amount) FROM orders GROUP BY 1", []);
    expect(plan.planText).toMatch(/HASH_GROUP_BY|GROUP/i);
    expect(() => JSON.parse(plan.planJson)).not.toThrow();
    await expect(run("SELECT * FROM missing_table")).rejects.toMatchObject({ code: "UNKNOWN_TABLE" });
    await expect(run("SELECT nope FROM orders")).rejects.toThrow(/nope/);
  });

  it("cannot read files outside the registered tables", async () => {
    await expect(run("SELECT * FROM read_csv('/etc/passwd')")).rejects.toThrow();
    await expect(run(`SELECT * FROM read_parquet('${lake}/../../package.json')`)).rejects.toThrow();
  });

  it("lists its storage: the places it may read, what a folder holds, and nothing outside them", async () => {
    const roots = await engine.listFiles!("");
    // The Delta and Iceberg folders sit inside the folder of the Parquet file, so there is one place to start from.
    expect(roots.entries.map((e) => e.path)).toEqual([lake]);
    const inside = await engine.listFiles!(lake);
    expect(inside.entries.map((e) => [e.name, e.kind, e.format, e.table])).toEqual([
      ["delta_orders", FileEntryKind.FOLDER, TableFormat.DELTA, "delta_orders"],
      ["iceberg_orders", FileEntryKind.FOLDER, TableFormat.ICEBERG, "iceberg_orders"],
      ["orders.parquet", FileEntryKind.FILE, TableFormat.PARQUET, "orders"],
    ]);
    const file = inside.entries.at(-1)!;
    expect(Number(file.sizeBytes)).toBeGreaterThan(0);
    expect(file.modifiedAt).toMatch(/^\d{4}-/);
    expect((await engine.listFiles!(`${lake}/delta_orders`)).entries.some((e) => e.name === "_delta_log")).toBe(true);
    // `..`, an absolute path elsewhere and a file are all refused.
    await expect(engine.listFiles!(`${lake}/../..`)).rejects.toThrow(/outside/);
    await expect(engine.listFiles!("/etc")).rejects.toThrow(/outside/);
    await expect(engine.listFiles!(`${lake}/orders.parquet`)).rejects.toThrow(/file, not a folder/);
    await expect(engine.listFiles!("s3://somewhere-else/data")).rejects.toThrow(/outside/);
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    const result = await engine.execute("SELECT * FROM range(10000000)", [], { signal: controller.signal });
    let seen = 0;
    await expect(
      (async () => {
        for await (const batch of result.batches) {
          seen += batch.numRows;
          controller.abort();
        }
      })(),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(seen).toBeLessThan(10_000_000);
  });
});

describe("connections and catalogs", () => {
  it("writes credentials as engine secrets scoped to the connection", () => {
    expect(
      secretSql(
        { name: "lake", kind: "s3", scope: "s3://acme-lake/sales", secret: "LAKE", region: "eu-west-1", endpoint: "minio.internal:9000", urlStyle: "path", useSsl: false },
        { keyId: "AKIA", secret: "it's" },
      ),
    ).toBe(
      `CREATE OR REPLACE SECRET "sf_lake" (TYPE s3, KEY_ID 'AKIA', SECRET 'it''s', REGION 'eu-west-1', ENDPOINT 'minio.internal:9000', URL_STYLE 'path', USE_SSL false, SCOPE 's3://acme-lake/sales')`,
    );
    // No credentials, but a store that is not AWS: where it is still has to reach the engine, or the engine asks AWS for the bucket.
    expect(secretSql({ name: "open", kind: "s3", scope: "s3://public/data", endpoint: "127.0.0.1:9100", urlStyle: "path", useSsl: false }, undefined)).toBe(
      `CREATE OR REPLACE SECRET "sf_open" (TYPE s3, ENDPOINT '127.0.0.1:9100', URL_STYLE 'path', USE_SSL false, SCOPE 's3://public/data')`,
    );
    // Nothing to say about a public bucket on AWS itself: no secret is made.
    expect(secretSql({ name: "plain", kind: "s3", scope: "s3://public/data" }, undefined)).toBeUndefined();
    expect(secretSql({ name: "role", kind: "s3", scope: "s3://b", ambientCredentials: true, region: "us-east-1" }, undefined)).toBe(
      `CREATE OR REPLACE SECRET "sf_role" (TYPE s3, PROVIDER credential_chain, REGION 'us-east-1', SCOPE 's3://b')`,
    );
    expect(secretSql({ name: "az", kind: "azure", scope: "az://c" }, { connectionString: "AccountName=x" })).toContain("CONNECTION_STRING 'AccountName=x'");
    // Public data needs no secret at all.
    expect(secretSql({ name: "open", kind: "s3", scope: "s3://public" }, undefined)).toBeUndefined();
    expect(isRemotePath("s3://b/k")).toBe(true);
    expect(isRemotePath("/data/file.parquet")).toBe(false);
  });

  it("keeps working when a remote table cannot be reached, and says which one", async () => {
    const remote = await createDuckDbEngine({
      tables: [
        { name: "orders", format: "parquet", path: `${lake}/orders.parquet` },
        { name: "events", format: "parquet", path: "http://127.0.0.1:9/lake/events.parquet" },
      ],
      connections: [{ name: "web", kind: "http", scope: "http://127.0.0.1:9/lake" }],
    });
    try {
      const checks = await remote.check!();
      expect(checks.map((c) => [c.name, c.ok])).toEqual([["events", false], ["orders", true]]);
      expect(checks[0]!.message).not.toBe("");
      expect(remote.connections).toEqual([expect.objectContaining({ name: "web", scope: "http://127.0.0.1:9/lake", credentialsSecret: "" })]);
      // Locations outside the connection's scope stay closed.
      await expect(remote.execute("SELECT * FROM read_parquet('http://127.0.0.1:9/other/x.parquet')", [])).rejects.toThrow(/disabled|Permission/i);
      await expect(remote.execute("SELECT * FROM duckdb_secrets()", [])).rejects.toThrow(/secrets/);
    } finally {
      await remote.close();
    }
  }, 120_000);

  it("refuses to start when a named secret is not set", async () => {
    await expect(
      createDuckDbEngine({ tables: [], connections: [{ name: "lake", kind: "s3", scope: "s3://b", secret: "LAKE" }], resolveSecret: () => undefined }),
    ).rejects.toThrow('The secret "LAKE" is not set on the server.');
  }, 120_000);

  it("lists and queries the tables of an attached catalog, read-only", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-catalog-"));
    const file = path.join(dir, "warehouse.duckdb");
    const database = new AdbcDatabase({ driver: duckDbLibraryPath(), entrypoint: "duckdb_adbc_init", databaseOptions: { path: file } });
    const setup = await database.connect();
    await setup.query("CREATE SCHEMA sales");
    await setup.query("CREATE TABLE sales.customers AS SELECT range AS customer_id, 'c' || range AS name FROM range(25)");
    await setup.query("CREATE TABLE sales.regions AS SELECT 1 AS region_id");
    await setup.close();
    await database.close();

    const attached = await createDuckDbEngine({ tables: [{ name: "orders", format: "parquet", path: `${lake}/orders.parquet` }], catalogs: [{ name: "warehouse", kind: "duckdb", uri: file }] });
    try {
      expect((await attached.listCatalogs()).map((c) => c.name)).toEqual(["memory", "warehouse"]);
      expect((await attached.listSchemas("warehouse")).map((s) => s.name)).toContain("sales");
      const found = await attached.listTables({ catalog: "warehouse", schema: "sales", search: "cust" });
      expect(found.map((t) => t.ref)).toEqual([{ catalog: "warehouse", schema: "sales", table: "customers" }]);
      expect((await attached.listTables({ catalog: "", schema: "", search: "" })).map((t) => t.ref?.table)).toEqual(["orders", "customers", "regions"]);
      const detail = await attached.describeTable(create(TableRefSchema, { catalog: "warehouse", schema: "sales", table: "customers" }), true);
      expect(detail.columns?.map((c) => c.name)).toEqual(["customer_id", "name"]);
      expect(detail.rowCount).toBe(25n);
      const result = await attached.execute("SELECT COUNT(*) AS n FROM warehouse.sales.customers c JOIN orders o ON o.order_id = c.customer_id", []);
      for await (const batch of result.batches) expect(Number(batch.getChildAt(0)?.get(0))).toBe(24);
      await expect(attached.execute("DELETE FROM warehouse.sales.customers", [])).rejects.toThrow(/read-only/i);
      expect((await attached.check!()).every((c) => c.ok)).toBe(true);
    } finally {
      await attached.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("pass-through functions", () => {
  it("refuses SQL that would be run as written by an attached database", async () => {
    for (const sql of ["SELECT * FROM postgres_query('pg', 'DELETE FROM t RETURNING 1')", "CALL postgres_execute('pg', 'DROP TABLE t')", "SELECT * FROM mysql_query('m', 'SELECT 1')", "select * from POSTGRES_SCAN ('dbname=x', 'public', 't')"]) {
      await expect(engine.execute(sql, [])).rejects.toThrow(/cannot send SQL straight/);
    }
    // A column or table that merely has a similar name is fine.
    const result = await engine.execute("SELECT 1 AS postgres_query_count", []);
    for await (const batch of result.batches) expect(batch.numRows).toBe(1);
  });
});
