import { type DataSource, type Discovery, type Pipelines, collect, queryErrorInfo, toRows } from "@surfaces-ui/data";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { AggregateFunction, ConnectionKind, FilterOperator, ObjectKind, RelationKind, RunState, SortDirection, TimeGrain } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

/**
 * Runs the whole stack against a real Postgres database, reached through
 * DuckDB's Postgres extension. It needs a database, so it only runs when
 * told where one is:
 *
 *   SURFACES_TEST_POSTGRES="host=127.0.0.1 port=5432 dbname=shop user=reader"
 *   SURFACES_TEST_POSTGRES_PASSWORD=...
 *
 * The database must have the `sales` schema that scripts/seed-postgres.sql
 * creates. The same test works against Supabase or any hosted Postgres.
 */
const address = process.env.SURFACES_TEST_POSTGRES;
const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

describe.skipIf(!address)("Postgres through DuckDB", () => {
  let server: SurfacesServer;
  let data: DataSource;
  let discovery: Discovery;
  let pipelines: Pipelines;

  beforeAll(async () => {
    const engine = await createDuckDbEngine({
      tables: [],
      catalogs: [{ name: "pg", kind: "postgres", uri: address!, secret: "PGTEST" }],
      resolveSecret: (name) => (name === "PGTEST" ? { password: process.env.SURFACES_TEST_POSTGRES_PASSWORD } : undefined),
    });
    server = await createSurfacesServer({
      sources: [{ id: "shop", engine }],
      pipelines: [
        {
          id: "from-postgres",
          sourceId: "shop",
          datasets: [
            { name: "pg_orders", sql: "SELECT * FROM pg.sales.orders", expectations: [{ name: "has_status", constraint: "status IS NOT NULL", action: "drop" }] },
            { name: "pg_daily", sql: "SELECT CAST(ordered_at AS DATE) AS day, SUM(amount) AS revenue FROM pg_orders GROUP BY 1" },
          ],
        },
      ],
    });
    data = server.dataSource;
    discovery = server.discovery!;
    pipelines = server.pipelines!;
  }, 120_000);
  afterAll(() => server?.close());

  it("lists the database's schemas and tables, and names its connection without the user or password", async () => {
    expect((await data.listCatalogs({ sourceId: "shop" })).catalogs.map((c) => c.name)).toEqual(["memory", "pg"]);
    expect((await data.listSchemas({ sourceId: "shop", catalog: "pg" })).schemas.map((x) => x.name)).toEqual(["public", "sales"]);
    const tables = (await data.listTables({ sourceId: "shop", catalog: "pg", schema: "sales" })).tables.map((t) => t.ref?.table);
    expect(tables).toEqual(["customers", "open_orders", "orders", "regions"]);
    const [source] = (await data.listSources({})).sources;
    expect(source!.connections).toEqual([expect.objectContaining({ name: "pg", kind: ConnectionKind.POSTGRES, credentialsSecret: "PGTEST" })]);
    expect(source!.connections[0]!.scope).not.toMatch(/reader|user/);
    expect((await data.testSource!({ target: { case: "id", value: "shop" } })).checks).toEqual([expect.objectContaining({ name: "pg", ok: true })]);
  });

  it("describes Postgres types, finding a table by its bare name", async () => {
    const orders = (await data.describeTable({ sourceId: "shop", ref: { table: "orders" }, includeStats: true })).table!;
    expect(orders.summary?.ref).toMatchObject({ catalog: "pg", schema: "sales", table: "orders" });
    expect(orders.rowCount).toBe(20000n);
    expect(Object.fromEntries(orders.columns.map((c) => [c.name, c.nativeType]))).toEqual({
      order_id: "BIGINT",
      customer_id: "INTEGER",
      status: "VARCHAR",
      amount: "DECIMAL(12,2)",
      quantity: "SMALLINT",
      ordered_at: "TIMESTAMP WITH TIME ZONE",
      note: "VARCHAR",
    });
    const customers = (await data.describeTable({ sourceId: "shop", ref: { catalog: "pg", schema: "sales", table: "customers" } })).table!;
    expect(customers.columns.filter((c) => ["tags", "profile", "signed_up"].includes(c.name)).map((c) => c.nativeType)).toEqual(["DATE", "VARCHAR[]", "VARCHAR"]);
  });

  it("sorts, filters and pages a table in the database, and keeps a join's result", async () => {
    const page = await collect(
      data.execute({
        sourceId: "shop",
        query: {
          baseSql: "SELECT * FROM pg.sales.orders",
          filters: [{ column: "status", operator: FilterOperator.EQ, values: [s("pending")] }],
          sorts: [{ column: "amount", direction: SortDirection.DESC }, { column: "order_id" }],
          page: { limit: 25, offset: 50n },
        },
      }),
    );
    expect(page.header.stored).toBeUndefined();
    const rows = toRows(page.table);
    expect(rows).toHaveLength(25);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    expect((await data.count({ sourceId: "shop", query: { baseSql: "SELECT * FROM pg.sales.orders", filters: [{ column: "status", operator: FilterOperator.IS_NULL }] } })).rowCount).toBe(5000n);

    const joined = "SELECT r.name AS region, o.amount, o.order_id FROM pg.sales.orders o JOIN pg.sales.customers c USING (customer_id) JOIN pg.sales.regions r USING (region_id) WHERE o.amount > 900";
    const [first, second] = await Promise.all([0n, 20n].map((offset) => collect(data.execute({ sourceId: "shop", query: { baseSql: joined, page: { limit: 20, offset } } }))));
    expect(first!.header.stored?.createdAt).toBeTruthy();
    expect(second!.header.stored?.createdAt).toBe(first!.header.stored?.createdAt);
    expect((await data.count({ sourceId: "shop", query: { baseSql: joined } })).rowCount).toBe(first!.header.stored!.rowCount);
  });

  it("buckets a timestamptz by month in UTC, bins a numeric and computes statistics", async () => {
    const monthly = await collect(
      data.execute({
        sourceId: "shop",
        query: {
          baseSql: "SELECT * FROM pg.sales.orders",
          buckets: [{ column: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
          sorts: [{ column: "ordered_at" }],
        },
      }),
    );
    const months = toRows(monthly.table);
    // Orders are 20 minutes apart from 2026-01-01 00:20 UTC, so January holds exactly 2,231 wherever the server runs.
    expect(new Date(Number(months[0]!.ordered_at)).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(Number(months[0]!.n)).toBe(2231);
    expect(months.reduce((sum, r) => sum + Number(r.n), 0)).toBe(20000);

    const stats = await collect(
      data.execute({
        sourceId: "shop",
        query: {
          baseSql: "SELECT * FROM pg.sales.orders",
          buckets: [{ column: "amount", alias: "bin", by: { case: "binWidth", value: 250 } }],
          aggregates: [
            { function: AggregateFunction.COUNT, alias: "n" },
            { function: AggregateFunction.MEDIAN, column: "quantity", alias: "mid" },
            { function: AggregateFunction.PERCENTILE, column: "quantity", alias: "p90", percentile: 0.9 },
            { function: AggregateFunction.APPROX_COUNT_DISTINCT, column: "customer_id", alias: "customers" },
          ],
          sorts: [{ column: "bin" }],
        },
      }),
    );
    expect(toRows(stats.table).map((r) => Number(r.bin))).toEqual([0, 250, 500, 750]);
    const sample = await collect(data.execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM pg.sales.orders", columns: ["order_id"], sample: { rows: 200 } } }));
    expect(sample.table.numRows).toBe(200);
  });

  it("says where an error is, and refuses to write", async () => {
    const fail = async (baseSql: string) => {
      try {
        await collect(data.execute({ sourceId: "shop", query: { baseSql, page: { limit: 5 } } }));
      } catch (error) {
        return queryErrorInfo(error);
      }
      throw new Error("expected a failure");
    };
    expect(await fail("SELECT *\nFROM pg.sales.orders\nWHERE nope = 1")).toMatchObject({ code: "UNKNOWN_COLUMN", line: 3, column: 7 });
    expect(await fail("DELETE FROM pg.sales.orders")).toMatchObject({ code: "NOT_READ_ONLY" });
    // SQL cannot be handed straight to the database, where the read-only check would not see it.
    expect((await fail("SELECT * FROM postgres_query('pg', 'DELETE FROM sales.orders RETURNING 1')")).message).toMatch(/cannot send SQL straight/);
    expect((await fail("SELECT * FROM postgres_query('pg', 'SELECT pg_sleep(30)')")).message).toMatch(/cannot send SQL straight/);
    expect((await data.count({ sourceId: "shop", query: { baseSql: "SELECT * FROM pg.sales.orders" } })).rowCount).toBe(20000n);
  });

  it("indexes, profiles and relates the database's tables", async () => {
    const found = await discovery.search({ query: "customers", kinds: [ObjectKind.TABLE] });
    expect(found.hits[0]?.object?.name).toBe("customers");
    const profile = (await discovery.getObject({ ref: { sourceId: "shop", kind: ObjectKind.TABLE, table: "orders" }, includeProfile: true })).profile!;
    expect(profile.rowCount).toBe(20000n);
    const status = profile.columns.find((c) => c.name === "status")!;
    expect(status.nullCount).toBe(5000n);
    expect(status.distinctCount).toBe(3n);
    // Values stay withheld: this source is not listed in allowSampleValues.
    expect(status.topValues).toEqual([]);
    const joins = (await discovery.getRelated({ ref: { sourceId: "shop", kind: ObjectKind.TABLE, table: "orders" }, kinds: [RelationKind.JOIN] })).relations;
    expect(joins.map((j) => [j.object?.name, j.keys.map((k) => k.leftColumn)])).toContainEqual(["customers", ["customer_id"]]);
  });

  it("runs a pipeline that reads from the database and builds tables beside it", async () => {
    let run = (await pipelines.startRun({ pipelineId: "from-postgres" })).run!;
    for (let i = 0; i < 500 && run.state === RunState.RUNNING; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      run = (await pipelines.getRun({ pipelineId: "from-postgres", runId: run.id })).run!;
    }
    expect(run.state).toBe(RunState.COMPLETED);
    expect(run.datasetRuns.map((d) => [d.name, d.rowsWritten])).toEqual([
      ["pg_orders", 15000n],
      ["pg_daily", expect.any(BigInt)],
    ]);
    const daily = await collect(data.execute({ sourceId: "shop", query: { baseSql: "SELECT * FROM pg_daily", sorts: [{ column: "day" }], page: { limit: 2 } } }));
    expect(daily.table.numRows).toBe(2);
    // The database itself is untouched.
    expect((await data.count({ sourceId: "shop", query: { baseSql: "SELECT * FROM pg.sales.orders" } })).rowCount).toBe(20000n);
  });
});
