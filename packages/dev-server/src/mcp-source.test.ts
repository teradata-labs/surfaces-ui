import { type DataSource, collect, queryErrorInfo, toRows } from "@surfaces-ui/data";
import { AggregateFunction, FilterOperator, SortDirection, SourceKind, TimeGrain } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openSources } from "./config.js";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

/**
 * Runs the whole stack against a real database reached through that
 * database's own MCP server: the source is configured as it would be in
 * `surfaces.config.ts`, and every query below goes out as SQL through the
 * server's query tool. It needs a database and a server, so each one runs
 * only when told how to start its server, as a JSON list of the command and
 * its arguments:
 *
 *   SURFACES_TEST_MCP_POSTGRES='["npx","-y","@modelcontextprotocol/server-postgres","postgresql://reader:…@127.0.0.1:54329/shop"]'
 *   SURFACES_TEST_MCP_DUCKDB='["uvx","mcp-server-motherduck","--db-path","/path/to/shop.duckdb"]'
 *   SURFACES_TEST_MCP_ENV='HTTPS_PROXY,UV_CACHE_DIR'   (optional: environment variables the server may see)
 *
 * The database must hold the `sales` schema of scripts/seed-postgres.sql
 * (for DuckDB, the same `regions`, `customers` and `orders` tables). Every
 * expected number below is worked out here from the rule that script
 * generates its rows by, never read back from the database under test.
 */
const servers = {
  postgres: process.env.SURFACES_TEST_MCP_POSTGRES,
  duckdb: process.env.SURFACES_TEST_MCP_DUCKDB,
} as const;
const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

/** The orders the seed script generates, as plain objects. */
const STATUS = ["shipped", "pending", "returned", null];
const orders = Array.from({ length: 20000 }, (_, i) => {
  const g = i + 1;
  return { order_id: g, status: STATUS[g % 4]!, amount: ((g * 7919) % 100000) / 100, quantity: 1 + (g % 9), ordered_at: Date.UTC(2026, 0, 1) + g * 20 * 60_000 };
});
const total = (rows: typeof orders) => Math.round(rows.reduce((sum, r) => sum + r.amount * 100, 0)) / 100;

for (const dialect of ["postgres", "duckdb"] as const) {
  const command = servers[dialect];
  describe.skipIf(!command)(`${dialect} through its MCP server`, () => {
    let server: SurfacesServer;
    let data: DataSource;
    const base = "SELECT * FROM sales.orders";

    beforeAll(async () => {
      const [program, ...args] = JSON.parse(command!) as string[];
      const sources = await openSources({ sources: [{ id: "shop", engine: "mcp", dialect, server: { command: program!, args, env: (process.env.SURFACES_TEST_MCP_ENV ?? "").split(",").filter(Boolean) } }] }, process.cwd());
      server = await createSurfacesServer({ sources });
      data = server.dataSource;
    }, 180_000);
    afterAll(() => server?.close());

    it("lists the source and what is in it, without showing how it connects", async () => {
      const [source] = (await data.listSources({})).sources;
      expect(source!.kind).toBe(dialect === "postgres" ? SourceKind.POSTGRES : SourceKind.DUCKDB);
      // The command line can hold a connection string; only the program is shown.
      expect(JSON.stringify(source!.connections)).not.toMatch(/reader|postgresql:|shop\.duckdb/);
      expect((await data.testSource!({ target: { case: "id", value: "shop" } })).checks).toEqual([expect.objectContaining({ ok: true })]);
      expect((await data.listSchemas({ sourceId: "shop", catalog: "" })).schemas.map((x) => x.name)).toContain("sales");
      const tables = (await data.listTables({ sourceId: "shop", catalog: "", schema: "sales" })).tables.map((t) => t.ref?.table);
      expect(tables).toEqual(expect.arrayContaining(["customers", "orders", "regions"]));
      expect((await data.listTables({ sourceId: "shop", catalog: "", schema: "", search: "ORD" })).tables.map((t) => t.ref?.table)).toContain("orders");
    });

    it("describes a table: types, the row count and, where the database declares them, its keys", async () => {
      const table = (await data.describeTable({ sourceId: "shop", ref: { table: "orders" }, includeStats: true })).table!;
      expect(table.summary?.ref).toMatchObject({ schema: "sales", table: "orders" });
      expect(table.rowCount).toBe(20000n);
      expect(table.columns.map((c) => c.name)).toEqual(["order_id", "customer_id", "status", "amount", "quantity", "ordered_at", "note"]);
      const arrow = Object.fromEntries(table.columns.map((c) => [c.name, c.arrowType]));
      expect(arrow.order_id).toBe("Int64");
      expect(arrow.status).toBe("Utf8");
      expect(arrow.ordered_at).toMatch(/^Timestamp/);
      if (dialect === "postgres") {
        expect(table.columns.find((c) => c.name === "order_id")?.primaryKey).toBe(true);
        expect(table.summary?.comment).toBe("One row per order");
        expect(table.foreignKeys).toEqual([expect.objectContaining({ columns: ["customer_id"], referencedColumns: ["customer_id"] })]);
      }
    });

    it("sorts, filters and pages in the database", async () => {
      const page = await collect(
        data.execute({
          sourceId: "shop",
          query: { baseSql: base, filters: [{ column: "status", operator: FilterOperator.EQ, values: [s("pending")] }], sorts: [{ column: "amount", direction: SortDirection.DESC }, { column: "order_id" }], page: { limit: 25, offset: 50n } },
        }),
      );
      const expected = orders.filter((r) => r.status === "pending").sort((a, b) => b.amount - a.amount || a.order_id - b.order_id).slice(50, 75);
      const rows = toRows(page.table);
      expect(rows.map((r) => Number(r.order_id))).toEqual(expected.map((r) => r.order_id));
      expect(rows.every((r) => r.status === "pending")).toBe(true);
      expect(page.header.executedSql).toMatch(/LIMIT 25/);
      expect((await data.count({ sourceId: "shop", query: { baseSql: base, filters: [{ column: "status", operator: FilterOperator.IS_NULL }] } })).rowCount).toBe(5000n);
    });

    it("summarises in the database: totals by group, the same numbers as the rows give", async () => {
      const grouped = await collect(
        data.execute({
          sourceId: "shop",
          query: { baseSql: base, groupBy: ["status"], aggregates: [{ function: AggregateFunction.SUM, column: "amount", alias: "total" }, { function: AggregateFunction.COUNT, alias: "n" }, { function: AggregateFunction.AVG, column: "quantity", alias: "q" }], sorts: [{ column: "total", direction: SortDirection.DESC }] },
        }),
      );
      const type = grouped.table.schema.fields.find((f) => f.name === "total")!.type;
      const read = (value: unknown) => (String(type).startsWith("Decimal") ? Number(value) / 10 ** (type as { scale: number }).scale : Number(value));
      const got = toRows(grouped.table).map((r) => ({ status: r.status ?? null, total: read(r.total), n: Number(r.n) }));
      const want = STATUS.map((status) => ({ status, total: total(orders.filter((r) => r.status === status)), n: 5000 })).sort((a, b) => b.total - a.total);
      expect(got).toEqual(want);
    });

    it("buckets a time by month, takes a relative date as a value, and works out a median and a percentile", async () => {
      const monthly = await collect(
        data.execute({ sourceId: "shop", query: { baseSql: base, buckets: [{ column: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }], aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }], sorts: [{ column: "ordered_at" }] } }),
      );
      const months = toRows(monthly.table);
      const inMonth = (m: number) => orders.filter((r) => new Date(r.ordered_at).getUTCMonth() === m && new Date(r.ordered_at).getUTCFullYear() === 2026).length;
      expect(new Date(Number(months[0]!.ordered_at)).toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(Number(months[0]!.n)).toBe(inMonth(0));
      expect(Number(months[1]!.n)).toBe(inMonth(1));
      expect(months.reduce((sum, r) => sum + Number(r.n), 0)).toBe(20000);

      // A date arrives as text, as a filter bar sends it, and must compare with a timestamp column.
      const since = await data.count({ sourceId: "shop", query: { baseSql: base, filters: [{ column: "ordered_at", operator: FilterOperator.GTE, values: [s("2026-06-01")] }] } });
      expect(since.rowCount).toBe(BigInt(orders.filter((r) => r.ordered_at >= Date.UTC(2026, 5, 1)).length));

      const stats = await collect(
        data.execute({
          sourceId: "shop",
          query: { baseSql: base, aggregates: [{ function: AggregateFunction.MEDIAN, column: "quantity", alias: "mid" }, { function: AggregateFunction.PERCENTILE, column: "quantity", alias: "p90", percentile: 0.9 }, { function: AggregateFunction.MAX, column: "amount", alias: "top" }] },
        }),
      );
      const [row] = toRows(stats.table);
      expect(Number(row!.mid)).toBe(5);
      expect(Number(row!.p90)).toBe(9);
      const sample = await collect(data.execute({ sourceId: "shop", query: { baseSql: base, columns: ["order_id"], sample: { rows: 200 } } }));
      expect(sample.table.numRows).toBe(200);
    });

    it("takes a value that tries to end the statement as a value", async () => {
      for (const value of ["x'; DROP TABLE sales.orders; --", "a\\' OR 1=1 --", "$v$ $$ $1 ?", "gift; fragile"]) {
        const found = await data.count({ sourceId: "shop", query: { baseSql: base, filters: [{ column: "note", operator: FilterOperator.EQ, values: [s(value)] }] } });
        expect(found.rowCount).toBe(value === "gift; fragile" ? 400n : 0n);
      }
      expect((await data.count({ sourceId: "shop", query: { baseSql: base } })).rowCount).toBe(20000n);
    });

    it("gives the columns of a result with no rows, so a filter bar can still be drawn", async () => {
      const empty = await collect(data.execute({ sourceId: "shop", query: { baseSql: base, filters: [{ column: "status", operator: FilterOperator.EQ, values: [s("nothing")] }], page: { limit: 10 } } }));
      expect(empty.table.numRows).toBe(0);
      expect(empty.table.schema.fields.map((f) => f.name)).toEqual(["order_id", "customer_id", "status", "amount", "quantity", "ordered_at", "note"]);
      expect(String(empty.table.schema.fields[0]!.type)).toBe("Int64");
    });

    it("reads a join across tables, and says which column or table is unknown", async () => {
      const joined = "SELECT r.name AS region, SUM(o.amount) AS revenue FROM sales.orders o JOIN sales.customers c ON c.customer_id = o.customer_id JOIN sales.regions r ON r.region_id = c.region_id GROUP BY r.name";
      const regions = toRows((await collect(data.execute({ sourceId: "shop", query: { baseSql: joined, sorts: [{ column: "region" }] } }))).table);
      expect(regions.map((r) => r.region)).toEqual(["Asia Pacific", "Europe", "Latin America", "North America"]);
      const fail = async (baseSql: string) => {
        try {
          await collect(data.execute({ sourceId: "shop", query: { baseSql, page: { limit: 5 } } }));
        } catch (error) {
          return queryErrorInfo(error);
        }
        return undefined;
      };
      expect((await fail("SELECT nope FROM sales.orders"))?.code).toBe("UNKNOWN_COLUMN");
      expect((await fail("SELECT * FROM sales.nope"))?.code).toBe("UNKNOWN_TABLE");
      expect((await fail("DELETE FROM sales.orders"))?.code).toBeTruthy();
      expect((await data.count({ sourceId: "shop", query: { baseSql: base } })).rowCount).toBe(20000n);
    });
  });
}
