import { type MessageInitShape, create } from "@bufbuild/protobuf";
import {
  AggregateFunction,
  FilterOperator,
  NullOrder,
  RewriteMode,
  SortDirection,
  SqlDialect,
  TimeGrain,
  type ViewQuery,
  ViewQuerySchema,
} from "@surfaces-ui/proto";
import { beforeAll, describe, expect, it } from "vitest";
import { SqlError, assertReadOnly, columnsQuery, countQuery, guardText, hasViewState, initSql, isPlainScan, numberPlaceholders, parses, rewriteQuery, withoutMissingFilters } from "./index.js";

const TD = SqlDialect.TERADATA;
const DUCK = SqlDialect.DUCKDB;
const s = (stringValue: string) => ({ kind: { case: "stringValue" as const, value: stringValue } });
const n = (intValue: number) => ({ kind: { case: "intValue" as const, value: BigInt(intValue) } });
const view = (baseSql: string, rest: MessageInitShape<typeof ViewQuerySchema> = {}): ViewQuery =>
  create(ViewQuerySchema, { baseSql, ...rest });

const sortAmt = [{ column: "amt", direction: SortDirection.DESC }];
const filterCust = [{ column: "cust_id", operator: FilterOperator.GTE, values: [n(10)] }];

beforeAll(initSql);

describe("rewriteQuery", () => {
  it("leaves the query alone when there is no view state", () => {
    const r = rewriteQuery(view("SELECT a FROM t ORDER BY a;"), DUCK);
    expect(r.sql).toBe("SELECT a FROM t ORDER BY a");
    expect(r.mode).toBe(RewriteMode.NONE);
  });

  it("applies filter, sort and paging for DuckDB", () => {
    const r = rewriteQuery(
      view("SELECT * FROM orders ORDER BY id", { filters: filterCust, sorts: sortAmt, page: { limit: 50, offset: 100n } }),
      DUCK,
    );
    expect(r.sql).toBe(
      'SELECT * FROM (SELECT * FROM orders) AS "_sf" WHERE "cust_id" >= ? ORDER BY "amt" DESC LIMIT 50 OFFSET 100',
    );
    expect(r.params).toEqual([10n]);
    expect(r.mode).toBe(RewriteMode.PARSED);
    expect(r.notices).toEqual([]);
  });

  it("uses TOP for the first Teradata page and ROW_NUMBER after it", () => {
    const first = rewriteQuery(view("SELECT * FROM sales.orders", { sorts: sortAmt, page: { limit: 50 } }), TD);
    expect(first.sql).toBe('SELECT TOP 50 * FROM (SELECT * FROM sales.orders) AS "_sf" ORDER BY "amt" DESC');
    const later = rewriteQuery(
      view("SELECT * FROM sales.orders", { sorts: sortAmt, page: { limit: 50, offset: 100n } }),
      TD,
    );
    expect(later.sql).toBe(
      'SELECT * FROM (SELECT * FROM sales.orders) AS "_sf" QUALIFY ROW_NUMBER() OVER (ORDER BY "amt" DESC) BETWEEN 101 AND 150 ORDER BY "amt" DESC',
    );
    expect(later.sql).not.toMatch(/LIMIT|OFFSET/);
  });

  it("hoists WITH and drops a trailing ORDER BY", () => {
    const sql =
      "WITH big AS (SELECT cust_id, SUM(amt) AS amt FROM sales.orders GROUP BY 1) SELECT * FROM big ORDER BY amt DESC";
    for (const dialect of [TD, DUCK]) {
      const r = rewriteQuery(view(sql, { filters: filterCust, page: { limit: 10 } }), dialect);
      expect(r.sql.startsWith("WITH big AS (")).toBe(true);
      expect(r.sql).toContain('FROM (SELECT * FROM big) AS "_sf"');
      expect(parses(r.sql, dialect)).toBe(true);
    }
  });

  it("keeps ORDER BY when the base query has TOP, and keeps a LOCKING prefix", () => {
    const top = rewriteQuery(view("SELECT TOP 5 a FROM t ORDER BY a DESC", { sorts: [{ column: "a" }] }), TD);
    expect(top.sql).toContain("(SELECT TOP 5 a FROM t ORDER BY a DESC)");
    const lock = rewriteQuery(view("LOCKING ROW FOR ACCESS SELECT * FROM t", { page: { limit: 5 } }), TD);
    expect(lock.sql.startsWith("LOCKING ROW FOR ACCESS SELECT TOP 5 * FROM (SELECT * FROM t)")).toBe(true);
  });

  it("warns when paging has no sort", () => {
    const r = rewriteQuery(view("SELECT * FROM t", { page: { limit: 10, offset: 20n } }), TD);
    expect(r.notices.map((x) => x.code)).toEqual(["UNSTABLE_PAGE_ORDER"]);
    expect(r.sql).toContain("ROW_NUMBER() OVER (ORDER BY 1) BETWEEN 21 AND 30");
  });

  it("binds every filter value and escapes LIKE patterns", () => {
    const r = rewriteQuery(
      view("SELECT * FROM t WHERE x = ?", {
        parameters: [s("base")],
        filters: [
          { column: "name", operator: FilterOperator.CONTAINS, values: [s("50%_off'; DROP TABLE t; --")] },
          { column: "region", operator: FilterOperator.IN, values: [s("NA"), s("EU")] },
          { column: "amt", operator: FilterOperator.BETWEEN, values: [n(1), n(9)] },
          { column: "note", operator: FilterOperator.IS_NULL },
        ],
        columns: ["name", 'we"ird'],
        sorts: [{ column: "name", nulls: NullOrder.LAST }],
      }),
      DUCK,
    );
    expect(r.params).toEqual(["base", "%50\\%\\_off'; DROP TABLE t; --%", "NA", "EU", 1n, 9n]);
    expect(r.sql).not.toContain("DROP");
    expect(r.sql).toContain(`SELECT "name", "we""ird" FROM`);
    expect(r.sql).toContain(`"region" IN (?, ?) AND "amt" BETWEEN ? AND ? AND "note" IS NULL ORDER BY "name" ASC NULLS LAST`);
  });

  it("rejects malformed view state", () => {
    const bad = view("SELECT 1", { filters: [{ column: "a", operator: FilterOperator.BETWEEN, values: [n(1)] }] });
    expect(() => rewriteQuery(bad, DUCK)).toThrow(/needs 2 values/);
    expect(() => rewriteQuery(view("SELECT 1", { sorts: [{ column: "" }] }), DUCK)).toThrow(SqlError);
  });

  it("falls back to wrapping for Teradata syntax the parser cannot read", () => {
    const r = rewriteQuery(
      view("SELECT amt (FORMAT 'ZZ9.99') (TITLE 'Amount') FROM sales.orders", { page: { limit: 10 } }),
      TD,
    );
    expect(r.mode).toBe(RewriteMode.WRAPPED);
    expect(r.notices.map((x) => x.code)).toContain("REWRITE_FALLBACK");
    expect(r.sql.startsWith("SELECT TOP 10 * FROM (SELECT amt (FORMAT")).toBe(true);
  });
});

describe("filters on columns a view lacks", () => {
  const byRegion = { column: "region", operator: FilterOperator.EQ, values: [s("North")] };
  const byCust = { column: "CUST_ID", operator: FilterOperator.GTE, values: [n(10)] };

  it("drops each filter on a missing column with a notice, and keeps the rest", () => {
    const query = view("SELECT cust_id, amt FROM orders", { filters: [byRegion, byCust], sorts: sortAmt });
    const { query: kept, notices } = withoutMissingFilters(query, ["cust_id", "amt"]);
    expect(kept.filters.map((f) => f.column)).toEqual(["CUST_ID"]);
    expect(kept.sorts).toEqual(query.sorts);
    expect(query.filters).toHaveLength(2);
    expect(notices.map((x) => [x.code, x.message])).toEqual([["FILTER_COLUMN_MISSING", "Not filtered by region: its rows have no region column."]]);
  });

  it("changes nothing when every column is there", () => {
    const query = view("SELECT * FROM orders", { filters: [byRegion] });
    const result = withoutMissingFilters(query, ["Region", "amt"]);
    expect(result.query).toBe(query);
    expect(result.notices).toEqual([]);
  });

  it("asks for the base query's columns with no rows, its parameters bound", () => {
    const r = columnsQuery(view("SELECT * FROM orders WHERE amt > ? ORDER BY amt", { parameters: [n(5)], filters: [byRegion], page: { limit: 10 } }), DUCK);
    expect(r.sql).toMatch(/^SELECT \* FROM \(SELECT \* FROM orders WHERE amt > \? ?\) AS "_sf" WHERE 1 = 0$/);
    expect(r.sql).not.toMatch(/region|LIMIT|ORDER BY/i);
    expect(r.params).toHaveLength(1);
    const td = columnsQuery(view("SELECT a FROM t"), TD);
    expect(td.sql).toBe('SELECT * FROM (SELECT a FROM t) AS "_sf" WHERE 1 = 0');
  });
});

describe("aggregation", () => {
  const grouped = {
    filters: filterCust,
    groupBy: ["region"],
    aggregates: [
      { function: AggregateFunction.SUM, column: "amt", alias: "total" },
      { function: AggregateFunction.COUNT, alias: "orders" },
    ],
    sorts: [{ column: "total", direction: SortDirection.DESC }],
    page: { limit: 10, offset: 10n },
  };

  it("groups in a derived table, filtering before and sorting after", () => {
    const r = rewriteQuery(view("SELECT * FROM sales ORDER BY 1", grouped), DUCK);
    expect(r.sql).toBe(
      'SELECT * FROM (SELECT "region", SUM("amt") AS "total", COUNT(*) AS "orders" FROM (SELECT * FROM sales) AS "_sf" WHERE "cust_id" >= ? GROUP BY "region") AS "_ag" ORDER BY "total" DESC LIMIT 10 OFFSET 10',
    );
  });

  it("works a derived measure out from the aggregates, in the engine, in each dialect", () => {
    const rate = { ...grouped, derived: [{ alias: "per_order", expression: "total / orders" }, { alias: "share", expression: "(total - 10) / total * 100" }], sorts: [{ column: "per_order", direction: SortDirection.DESC }] };
    const duck = rewriteQuery(view("SELECT * FROM sales", rate), DUCK);
    expect(duck.sql).toBe(
      'SELECT * FROM (SELECT "region", SUM("amt") AS "total", COUNT(*) AS "orders", (CAST((SUM("amt")) AS DOUBLE) / NULLIF((COUNT(*)), 0)) AS "per_order", ((CAST(((SUM("amt")) - 10) AS DOUBLE) / NULLIF((SUM("amt")), 0)) * 100) AS "share" FROM (SELECT * FROM sales) AS "_sf" WHERE "cust_id" >= ? GROUP BY "region") AS "_ag" ORDER BY "per_order" DESC LIMIT 10 OFFSET 10',
    );
    const td = rewriteQuery(view("SELECT * FROM sales", rate), TD);
    // Teradata divides whole numbers as whole numbers, so the division is done in floating point.
    expect(td.sql).toContain('(CAST((SUM("amt")) AS FLOAT) / NULLIF((COUNT(*)), 0)) AS "per_order"');
    expect(td.sql).toContain('QUALIFY ROW_NUMBER() OVER (ORDER BY "per_order" DESC) BETWEEN 11 AND 20');
    expect(parses(td.sql, TD)).toBe(true);
    expect(parses(duck.sql, DUCK)).toBe(true);
  });

  it("refuses a calculation that is not arithmetic over this query's aggregates", () => {
    const bad = (expression: string, alias = "x") => () => rewriteQuery(view("SELECT * FROM sales", { ...grouped, derived: [{ alias, expression }] }), DUCK);
    expect(bad("total / missing")).toThrow(/"missing", which is not an aggregate/);
    expect(bad("total; DROP TABLE sales")).toThrow(/cannot be read/);
    expect(bad("(SELECT 1)")).toThrow(/cannot be read|not an aggregate/);
    expect(bad("total / 'x'")).toThrow(/cannot be read/);
    expect(bad("total /")).toThrow(/stops too soon/);
    expect(bad("total", "TOTAL")).toThrow(/different names/);
    expect(bad("total", "")).toThrow(/needs a name/);
    expect(() => rewriteQuery(view("SELECT * FROM sales", { derived: [{ alias: "x", expression: "1 + 1" }] }), DUCK)).toThrow(/has none/);
  });

  it("pages grouped rows on Teradata and counts groups", () => {
    const r = rewriteQuery(view("SELECT * FROM sales", grouped), TD);
    expect(r.sql).toContain('GROUP BY "region") AS "_ag" QUALIFY ROW_NUMBER() OVER (ORDER BY "total" DESC) BETWEEN 11 AND 20');
    expect(parses(r.sql, TD)).toBe(true);
    const c = countQuery(view("SELECT * FROM sales", grouped), TD);
    expect(c.sql).toBe(
      'SELECT COUNT(*) AS "row_count" FROM (SELECT "region", SUM("amt") AS "total", COUNT(*) AS "orders" FROM (SELECT * FROM sales) AS "_sf" WHERE "cust_id" >= ? GROUP BY "region") AS "_ag"',
    );
  });

  it("allows a total with no groups and rejects bad aggregates", () => {
    const total = rewriteQuery(
      view("SELECT * FROM t", { aggregates: [{ function: AggregateFunction.AVG, column: "amt", alias: "avg_amt" }] }),
      DUCK,
    );
    expect(total.sql).toBe('SELECT * FROM (SELECT AVG("amt") AS "avg_amt" FROM (SELECT * FROM t) AS "_sf") AS "_ag"');
    const bad = (aggregates: object[], groupBy: string[] = []) => () =>
      rewriteQuery(view("SELECT * FROM t", { aggregates, groupBy } as never), DUCK);
    expect(bad([{ function: AggregateFunction.SUM, alias: "x" }])).toThrow(/needs a column/);
    expect(bad([{ function: AggregateFunction.SUM, column: "a" }])).toThrow(/needs a name/);
    expect(bad([{ function: AggregateFunction.COUNT, alias: "Region" }], ["region"])).toThrow(/different names/);
  });
});

describe("Teradata corpus", () => {
  const corpus = [
    "SELECT region, SUM(revenue) AS rev FROM sales.orders GROUP BY 1",
    "SEL TOP 10 * FROM sales.orders",
    "SELECT TOP 5 WITH TIES cust_id, amt FROM sales.orders ORDER BY amt DESC",
    "SELECT cust_id, amt FROM sales.orders QUALIFY ROW_NUMBER() OVER (PARTITION BY cust_id ORDER BY order_dt DESC) = 1",
    "SELECT * FROM sales.orders SAMPLE 100",
    "WITH RECURSIVE org (emp_id, mgr_id, lvl) AS (SELECT emp_id, mgr_id, 0 FROM hr.emp WHERE mgr_id IS NULL UNION ALL SELECT e.emp_id, e.mgr_id, o.lvl + 1 FROM hr.emp e JOIN org o ON e.mgr_id = o.emp_id) SELECT * FROM org",
    "SELECT order_id FROM sales.orders WHERE order_dt BETWEEN DATE '2026-01-01' AND DATE '2026-01-01' + INTERVAL '30' DAY",
    "SELECT CAST(order_dt AS FORMAT 'YYYY-MM') AS ym, COUNT(*) AS c FROM sales.orders GROUP BY 1",
    "SELECT ZEROIFNULL(discount) AS d, amt / NULLIFZERO(qty) AS unit FROM sales.orders",
    "SELECT cust_id FROM sales.orders_2025 UNION ALL SELECT cust_id FROM sales.orders_2026 ORDER BY 1",
    "SELECT DatabaseName, TableName FROM DBC.TablesV WHERE TableKind IN ('T','V')",
    "LOCKING ROW FOR ACCESS SELECT * FROM sales.orders WHERE order_id = 42",
  ];
  it.each(corpus)("rewrites and re-parses: %s", (sql) => {
    const r = rewriteQuery(view(sql, { filters: filterCust, sorts: sortAmt, page: { limit: 50, offset: 100n } }), TD);
    expect(r.mode).toBe(RewriteMode.PARSED);
    expect(parses(r.sql, TD)).toBe(true);
    expect(parses(countQuery(view(sql, { filters: filterCust }), TD).sql, TD)).toBe(true);
  });
});

describe("read-only", () => {
  it.each([
    ["DELETE FROM t", "NOT_READ_ONLY"],
    ["INSERT INTO t SELECT * FROM u", "NOT_READ_ONLY"],
    ["DROP TABLE t", "NOT_READ_ONLY"],
    ["CREATE TABLE x AS SELECT 1", "NOT_READ_ONLY"],
    ["SELECT 1; DROP TABLE t", "MULTIPLE_STATEMENTS"],
    ["", "SYNTAX"],
  ])("rejects %s", (sql, code) => {
    for (const dialect of [TD, DUCK]) {
      try {
        assertReadOnly(sql, dialect);
        expect.unreachable();
      } catch (e) {
        expect((e as SqlError).code).toBe(code);
      }
    }
  });

  it("text guard ignores keywords inside strings and comments, and catches them outside", () => {
    expect(() => guardText("SELECT 'DROP TABLE x; DELETE' AS a -- INSERT\nFROM t /* UPDATE */")).not.toThrow();
    expect(() => guardText("SELECT 1 FROM t; DELETE FROM t")).toThrow(/one statement/);
    expect(() => guardText("WITH x AS (SELECT 1) DELETE FROM t")).toThrow(/DELETE/);
    expect(() => guardText("EXPLAIN SELECT 1")).toThrow(SqlError);
  });

  it("counts with filters but without sort or paging", () => {
    const r = countQuery(view("SELECT * FROM t ORDER BY a", { filters: filterCust, sorts: sortAmt, page: { limit: 5 } }), DUCK);
    expect(r.sql).toBe('SELECT COUNT(*) AS "row_count" FROM (SELECT * FROM t) AS "_sf" WHERE "cust_id" >= ?');
  });
});

describe("buckets, samples and statistics", () => {
  const monthly = {
    buckets: [{ column: "ordered_at", by: { case: "grain" as const, value: TimeGrain.MONTH } }],
    aggregates: [{ function: AggregateFunction.SUM, column: "amt", alias: "total" }],
    sorts: [{ column: "ordered_at", direction: SortDirection.ASC }],
  };

  it("truncates a time column to a grain in DuckDB", () => {
    const r = rewriteQuery(view("SELECT * FROM orders", monthly), DUCK);
    expect(r.sql).toBe(
      'SELECT * FROM (SELECT DATE_TRUNC(\'month\', "ordered_at") AS "ordered_at", SUM("amt") AS "total" FROM (SELECT * FROM orders) AS "_sf" GROUP BY DATE_TRUNC(\'month\', "ordered_at")) AS "_ag" ORDER BY "ordered_at" ASC',
    );
    expect(parses(r.sql, DUCK)).toBe(true);
  });

  it("truncates a time column in Teradata without DATE_TRUNC", () => {
    const r = rewriteQuery(view("SELECT * FROM sales.orders", monthly), TD);
    expect(r.sql).toContain(`TRUNC(CAST("ordered_at" AS DATE), 'MM') AS "ordered_at"`);
    expect(r.sql).not.toMatch(/DATE_TRUNC/);
    expect(parses(r.sql, TD)).toBe(true);
    const hourly = rewriteQuery(
      view("SELECT * FROM sales.orders", { ...monthly, buckets: [{ column: "ordered_at", by: { case: "grain", value: TimeGrain.HOUR } }] }),
      TD,
    );
    expect(hourly.sql).toContain(`CAST(TO_CHAR("ordered_at", 'YYYY-MM-DD HH24') || ':00:00' AS TIMESTAMP(0))`);
    expect(parses(hourly.sql, TD)).toBe(true);
  });

  it("bins a number for a histogram", () => {
    const histogram = {
      buckets: [{ column: "amt", alias: "bin", by: { case: "binWidth" as const, value: 25 } }],
      aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
    };
    expect(rewriteQuery(view("SELECT * FROM orders", histogram), DUCK).sql).toContain('FLOOR("amt" / 25) * 25 AS "bin", COUNT(*) AS "n"');
    const td = rewriteQuery(view("SELECT * FROM orders", histogram), TD);
    expect(td.sql).toContain('FLOOR(CAST("amt" AS FLOAT) / 25) * 25 AS "bin"');
    expect(parses(td.sql, TD)).toBe(true);
    expect(() =>
      rewriteQuery(view("SELECT * FROM orders", { buckets: [{ column: "amt", by: { case: "binWidth", value: 0 } }] }), DUCK),
    ).toThrow(/greater than zero/);
  });

  it("writes statistics in each dialect", () => {
    const stats = {
      aggregates: [
        { function: AggregateFunction.MEDIAN, column: "amt", alias: "mid" },
        { function: AggregateFunction.STDDEV, column: "amt", alias: "sd" },
        { function: AggregateFunction.PERCENTILE, column: "amt", alias: "p90", percentile: 0.9 },
        { function: AggregateFunction.APPROX_COUNT_DISTINCT, column: "cust_id", alias: "customers" },
      ],
    };
    const duck = rewriteQuery(view("SELECT * FROM orders", stats), DUCK);
    expect(duck.sql).toContain('MEDIAN("amt") AS "mid", STDDEV_SAMP("amt") AS "sd", QUANTILE_CONT("amt", 0.9) AS "p90", APPROX_COUNT_DISTINCT("cust_id") AS "customers"');
    const td = rewriteQuery(view("SELECT * FROM orders", stats), TD);
    expect(td.sql).toContain('PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY "amt") AS "p90", COUNT(DISTINCT "cust_id") AS "customers"');
    expect(parses(td.sql, TD)).toBe(true);
    expect(() =>
      rewriteQuery(view("SELECT * FROM t", { aggregates: [{ function: AggregateFunction.PERCENTILE, column: "a", alias: "p", percentile: 90 }] }), DUCK),
    ).toThrow(/between 0 and 1/);
  });

  it("samples filtered rows", () => {
    const sampled = { filters: filterCust, columns: ["amt", "qty"], sample: { rows: 5000 } };
    const duck = rewriteQuery(view("SELECT * FROM orders", sampled), DUCK);
    expect(duck.sql).toBe(
      'SELECT "amt", "qty" FROM (SELECT * FROM (SELECT * FROM orders) AS "_sf" WHERE "cust_id" >= ?) AS "_sf" USING SAMPLE reservoir(5000 ROWS) REPEATABLE (1)',
    );
    expect(duck.notices).toEqual([]);
    const td = rewriteQuery(view("SELECT * FROM orders", { ...sampled, page: { limit: 1000 } }), TD);
    expect(td.sql).toBe('SELECT "amt", "qty" FROM (SELECT * FROM orders) AS "_sf" WHERE "cust_id" >= ? SAMPLE 1000');
    expect(() => rewriteQuery(view("SELECT * FROM orders", { sample: { rows: 10 }, groupBy: ["a"] }), DUCK)).toThrow(/sample/);
    expect(countQuery(view("SELECT * FROM orders", sampled), DUCK).sql).not.toMatch(/SAMPLE/);
  });

  it("recognises plain table scans and view state", () => {
    expect(isPlainScan("select * from orders;")).toBe(true);
    expect(isPlainScan('SELECT * FROM sales."Order Lines"')).toBe(true);
    expect(isPlainScan("SELECT * FROM orders WHERE a = 1")).toBe(false);
    expect(isPlainScan("SELECT * FROM a, b")).toBe(false);
    expect(hasViewState(view("SELECT 1"))).toBe(false);
    expect(hasViewState(view("SELECT 1", { page: { limit: 10 } }))).toBe(true);
  });
});

describe("DataFusion and Postgres", () => {
  const DF = SqlDialect.DATAFUSION;
  const PG = SqlDialect.POSTGRES;

  it("numbers the placeholders in the order the values are bound", () => {
    const r = rewriteQuery(
      view("SELECT * FROM orders WHERE region = ? AND note <> 'why?'", {
        parameters: [s("Europe")],
        filters: [...filterCust, { column: "status", operator: FilterOperator.IN, values: [s("a"), s("b")] }],
        sorts: sortAmt,
        page: { limit: 50, offset: 100n },
      }),
      DF,
    );
    expect(r.sql).toBe(
      "SELECT * FROM (SELECT * FROM orders WHERE region = $1 AND note <> 'why?') AS \"_sf\" WHERE \"cust_id\" >= $2 AND \"status\" IN ($3, $4) ORDER BY \"amt\" DESC LIMIT 50 OFFSET 100",
    );
    expect(r.params).toEqual(["Europe", 10n, "a", "b"]);
    expect(parses(r.sql, DF)).toBe(true);
    expect(countQuery(view("SELECT * FROM orders", { filters: filterCust }), PG).sql).toBe(
      'SELECT COUNT(*) AS "row_count" FROM (SELECT * FROM orders) AS "_sf" WHERE "cust_id" >= $1',
    );
    expect(numberPlaceholders("SELECT '?' AS \"a?\", ? -- really?\n, ?")).toBe("SELECT '?' AS \"a?\", $1 -- really?\n, $2");
    // DuckDB and Teradata keep question marks.
    expect(rewriteQuery(view("SELECT * FROM t", { filters: filterCust }), DUCK).sql).toContain("?");
  });

  it("writes buckets, statistics and samples the way each engine spells them", () => {
    const summary = {
      buckets: [{ column: "ordered_at", by: { case: "grain" as const, value: TimeGrain.WEEK } }],
      aggregates: [
        { function: AggregateFunction.MEDIAN, column: "amt", alias: "mid" },
        { function: AggregateFunction.PERCENTILE, column: "amt", alias: "p90", percentile: 0.9 },
        { function: AggregateFunction.APPROX_COUNT_DISTINCT, column: "cust_id", alias: "customers" },
      ],
    };
    const df = rewriteQuery(view("SELECT * FROM orders", summary), DF);
    expect(df.sql).toContain("DATE_TRUNC('week', \"ordered_at\")");
    // DataFusion's approx_distinct rejects floats and timestamps (found on DataFusion 47), so it counts exactly.
    expect(df.sql).toContain('MEDIAN("amt") AS "mid", APPROX_PERCENTILE_CONT("amt", 0.9) AS "p90", COUNT(DISTINCT "cust_id") AS "customers"');
    expect(parses(df.sql, DF)).toBe(true);
    const pg = rewriteQuery(view("SELECT * FROM orders", summary), PG);
    expect(pg.sql).toContain('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "amt") AS "mid"');
    expect(pg.sql).toContain('COUNT(DISTINCT "cust_id") AS "customers"');
    expect(parses(pg.sql, PG)).toBe(true);
    const sampled = rewriteQuery(view("SELECT * FROM orders", { filters: filterCust, sample: { rows: 500 } }), DF);
    expect(sampled.sql).toBe(
      'SELECT * FROM (SELECT * FROM (SELECT * FROM orders) AS "_sf" WHERE "cust_id" >= $1 ORDER BY RANDOM() LIMIT 500) AS "_sf"',
    );
    const binned = rewriteQuery(
      view("SELECT * FROM orders", { buckets: [{ column: "amt", by: { case: "binWidth", value: 25 } }], aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }] }),
      DF,
    );
    expect(binned.sql).toContain('FLOOR(CAST("amt" AS DOUBLE PRECISION) / 25) * 25');
    expect(parses(binned.sql, DF)).toBe(true);
  });
});
