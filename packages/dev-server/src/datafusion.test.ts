import { type DataSource, type Discovery, collect, queryErrorInfo, toRows } from "@surfaces-ui/data";
import { createDataFusionEngine } from "@surfaces-ui/engine-datafusion";
import { AggregateFunction, Engine, FilterOperator, ObjectKind, SortDirection, SqlDialect, TimeGrain } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

/**
 * Runs the whole stack on a real Apache DataFusion server. It needs one, so
 * it only runs when told where it is:
 *
 *   SURFACES_TEST_DATAFUSION=http://127.0.0.1:8089
 *
 * The server must serve fixtures/lake/orders.parquet as the table `orders`
 * over ROAPI's HTTP SQL endpoint, for example:
 *
 *   docker run -d --platform linux/amd64 -v "$PWD/fixtures/lake:/data:ro" -p 127.0.0.1:8089:8080 \
 *     ghcr.io/roapi/roapi:v0.12.6 --addr-http 0.0.0.0:8080 --table "orders=/data/orders.parquet"
 */
const address = process.env.SURFACES_TEST_DATAFUSION;
const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });
const base = "SELECT * FROM orders";

describe.skipIf(!address)("DataFusion", () => {
  let server: SurfacesServer;
  let data: DataSource;
  let discovery: Discovery;

  beforeAll(async () => {
    server = await createSurfacesServer({ sources: [{ id: "df", engine: await createDataFusionEngine({ baseUrl: address! }) }] });
    data = server.dataSource;
    discovery = server.discovery!;
  }, 120_000);
  afterAll(() => server?.close());

  const fail = async (baseSql: string) => {
    try {
      await collect(data.execute({ sourceId: "df", query: { baseSql, page: { limit: 5 } } }));
    } catch (error) {
      return queryErrorInfo(error);
    }
    throw new Error("expected a failure");
  };

  it("describes itself and its catalog", async () => {
    const [source] = (await data.listSources({})).sources;
    expect(source).toMatchObject({ id: "df", engine: Engine.DATAFUSION, dialect: SqlDialect.DATAFUSION, readOnly: true });
    expect(source!.capabilities).toMatchObject({ explain: true, timeTravel: false, storedResults: false });
    expect((await data.listTables({ sourceId: "df" })).tables.map((t) => t.ref?.table)).toEqual(["orders"]);
    const detail = (await data.describeTable({ sourceId: "df", ref: { table: "orders" }, includeStats: true })).table!;
    expect(detail.columns.map((c) => c.name)).toEqual(["order_id", "customer", "region", "status", "amount", "quantity", "ordered_at"]);
    expect(detail.rowCount).toBe(5000n);
    const test = await data.testSource!({ target: { case: "id", value: "df" } });
    expect(test).toMatchObject({ ok: true });
    expect(test.engineVersion).toMatch(/DataFusion/);
  });

  it("sorts, filters and pages with numbered placeholders, returning typed Arrow", async () => {
    const page = await collect(
      data.execute({
        sourceId: "df",
        query: {
          baseSql: base,
          filters: [
            { column: "region", operator: FilterOperator.EQ, values: [s("Europe")] },
            { column: "amount", operator: FilterOperator.GTE, values: [{ kind: { case: "doubleValue", value: 100 } }] },
          ],
          sorts: [{ column: "amount", direction: SortDirection.DESC }, { column: "order_id" }],
          columns: ["order_id", "region", "amount"],
          page: { limit: 25, offset: 50n },
        },
      }),
    );
    expect(page.header.executedSql).toBe(
      'SELECT "order_id", "region", "amount" FROM (SELECT * FROM orders) AS "_sf" WHERE "region" = $1 AND "amount" >= $2 ORDER BY "amount" DESC, "order_id" ASC LIMIT 25 OFFSET 50',
    );
    const rows = toRows(page.table);
    expect(rows).toHaveLength(25);
    expect(rows.every((r) => r.region === "Europe" && Number(r.amount) >= 100)).toBe(true);
    const amounts = rows.map((r) => Number(r.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(String(page.table.schema.fields[0]!.type)).toBe("Int64");
    // Without a store on this engine, views run live.
    expect(page.header.stored).toBeUndefined();

    expect((await data.count({ sourceId: "df", query: { baseSql: base, filters: [{ column: "status", operator: FilterOperator.IS_NULL }] } })).rowCount).toBe(1250n);
    const contains = { baseSql: base, filters: [{ column: "region", operator: FilterOperator.CONTAINS, values: [s("eur")] }] };
    expect((await data.count({ sourceId: "df", query: contains })).rowCount).toBe(1250n);
    const between = { baseSql: base, filters: [{ column: "ordered_at", operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue" as const, value: "2026-03-01" } }] }] };
    expect((await data.count({ sourceId: "df", query: between })).rowCount).toBeGreaterThan(0n);
  });

  it("buckets time, bins numbers, samples and computes statistics", async () => {
    const monthly = await collect(
      data.execute({
        sourceId: "df",
        query: {
          baseSql: base,
          buckets: [{ column: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
          sorts: [{ column: "ordered_at" }],
        },
      }),
    );
    const months = toRows(monthly.table);
    expect(months.length).toBeGreaterThan(1);
    expect(months.reduce((sum, r) => sum + Number(r.n), 0)).toBe(5000);

    const stats = await collect(
      data.execute({
        sourceId: "df",
        query: {
          baseSql: base,
          buckets: [{ column: "amount", alias: "bin", by: { case: "binWidth", value: 250 } }],
          aggregates: [
            { function: AggregateFunction.COUNT, alias: "n" },
            { function: AggregateFunction.MEDIAN, column: "quantity", alias: "mid" },
            { function: AggregateFunction.PERCENTILE, column: "quantity", alias: "p90", percentile: 0.9 },
            { function: AggregateFunction.STDDEV, column: "amount", alias: "sd" },
            { function: AggregateFunction.APPROX_COUNT_DISTINCT, column: "customer", alias: "customers" },
          ],
          sorts: [{ column: "bin" }],
        },
      }),
    );
    expect(toRows(stats.table).map((r) => Number(r.bin))).toEqual([0, 250, 500, 750]);
    const sample = await collect(data.execute({ sourceId: "df", query: { baseSql: base, columns: ["order_id"], sample: { rows: 300 } } }));
    expect(sample.table.numRows).toBe(300);
    expect(Math.max(...toRows(sample.table).map((r) => Number(r.order_id)))).toBeGreaterThan(2500);
  });

  it("treats hostile filter values as data", async () => {
    for (const hostile of ["' OR 1=1 --", "\\' OR 1=1 --", "Europe'; DROP TABLE orders; --", "$1"]) {
      const query = { baseSql: base, filters: [{ column: "region", operator: FilterOperator.EQ, values: [s(hostile)] }] };
      expect((await data.count({ sourceId: "df", query })).rowCount).toBe(0n);
    }
    expect((await data.count({ sourceId: "df", query: { baseSql: base } })).rowCount).toBe(5000n);
  });

  it("reports errors with a code, explains a query, and refuses to write", async () => {
    expect(await fail("SELECT * FROM orders WHERE nope = 1")).toMatchObject({ code: "UNKNOWN_COLUMN" });
    expect(await fail("SELECT * FROM missing")).toMatchObject({ code: "UNKNOWN_TABLE" });
    expect(await fail("DROP TABLE orders")).toMatchObject({ code: "NOT_READ_ONLY" });
    expect(await fail("SELECT 1; SELECT 2")).toMatchObject({ code: "MULTIPLE_STATEMENTS" });
    const plan = await data.explain({ sourceId: "df", query: { baseSql: "SELECT region, COUNT(*) FROM orders GROUP BY region" } });
    expect(plan.planText).toMatch(/Aggregate/);
    await expect(collect(data.execute({ sourceId: "df", query: { baseSql: base, page: { limit: 1 } }, timeTravel: { at: { case: "version", value: 1n } } }))).rejects.toThrow(/earlier time/);
  });

  it("indexes and profiles its tables", async () => {
    const found = await discovery.search({ query: "orders", kinds: [ObjectKind.TABLE] });
    expect(found.hits[0]?.object?.name).toBe("orders");
    const profile = (await discovery.getObject({ ref: { sourceId: "df", kind: ObjectKind.TABLE, table: "orders" }, includeProfile: true })).profile!;
    expect(profile.rowCount).toBe(5000n);
    expect(profile.columns.find((c) => c.name === "status")).toMatchObject({ nullCount: 1250n, distinctCount: 3n });
  });
});
