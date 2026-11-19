import { AggregateFunction, FilterOperator, SortDirection, TimeGrain } from "@surfaces-ui/proto";
import { tableFromArrays } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { QueryError, collect, decodeStream, encodeSchema, encodeTable, memoryDataSource, queryErrorInfo, toRows } from "./index.js";

const rows = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  region: ["NA", "EU", "APAC"][i % 3]!,
  amt: i % 5 === 0 ? null : (i * 7) % 40,
}));
const source = memoryDataSource({ tables: { orders: rows } });
const s = (value: string) => ({ kind: { case: "stringValue" as const, value } });

describe("ipc", () => {
  it("round-trips a table split into batches", () => {
    const table = tableFromArrays({ a: Int32Array.from([1, 2, 3, 4, 5]), b: ["v", "w", "x", "y", "z"] });
    const encoded = encodeTable(table, 2);
    expect(encoded.batches.map((b) => b.rows)).toEqual([2, 2, 1]);
    const back = decodeStream(encoded.schema, encoded.batches.map((b) => b.bytes));
    expect(toRows(back)).toEqual(toRows(table));
    expect(String(back.schema)).toBe(String(table.schema));
  });

  it("decodes a result with no rows", () => {
    const table = tableFromArrays({ a: Int32Array.from([1]) });
    const empty = decodeStream(encodeSchema(table.schema), []);
    expect(empty.numRows).toBe(0);
    expect(empty.schema.fields.map((f) => f.name)).toEqual(["a"]);
  });
});

describe("memoryDataSource", () => {
  it("filters, sorts, selects columns and pages", async () => {
    const result = await collect(
      source.execute({
        sourceId: "memory",
        batchRows: 2,
        query: {
          baseSql: "SELECT * FROM orders",
          filters: [{ column: "region", operator: FilterOperator.IN, values: [s("NA"), s("EU")] }],
          sorts: [{ column: "amt", direction: SortDirection.DESC }, { column: "id" }],
          columns: ["id", "amt"],
          page: { limit: 5, offset: 2n },
        },
      }),
    );
    const expected = rows
      .filter((r) => r.region !== "APAC")
      .sort((a, b) => (a.amt == null ? 1 : b.amt == null ? -1 : b.amt - a.amt || a.id - b.id))
      .slice(2, 7)
      .map(({ id, amt }) => ({ id, amt }));
    expect(toRows(result.table)).toEqual(expected);
    expect(result.header.columns.map((c) => c.name)).toEqual(["id", "amt"]);
    expect(result.footer.totalRowsReturned).toBe(5n);
    expect(result.footer.truncated).toBe(true);
  });

  it("counts with filters and describes its catalog", async () => {
    const count = await source.count({
      query: { baseSql: "SELECT * FROM orders", filters: [{ column: "amt", operator: FilterOperator.IS_NULL }] },
    });
    expect(count.rowCount).toBe(5n);
    expect((await source.listTables({ search: "ord" })).tables[0]?.ref?.table).toBe("orders");
    const detail = await source.describeTable({ ref: { table: "orders" } });
    expect(detail.table?.columns.map((c) => c.name)).toEqual(["id", "region", "amt"]);
    expect(detail.table?.rowCount).toBe(25n);
  });

  it("groups and aggregates", async () => {
    const query = {
      baseSql: "SELECT * FROM orders",
      groupBy: ["region"],
      aggregates: [
        { function: AggregateFunction.COUNT, alias: "n" },
        { function: AggregateFunction.SUM, column: "amt", alias: "total" },
        { function: AggregateFunction.MAX, column: "id", alias: "last_id" },
      ],
      sorts: [{ column: "total", direction: SortDirection.DESC }],
    };
    const result = await collect(source.execute({ query }));
    const sum = (region: string) => rows.filter((r) => r.region === region).reduce((a, r) => a + (r.amt ?? 0), 0);
    const expected = ["NA", "EU", "APAC"]
      .map((region) => ({
        region,
        n: rows.filter((r) => r.region === region).length,
        total: sum(region),
        last_id: Math.max(...rows.filter((r) => r.region === region).map((r) => r.id)),
      }))
      .sort((a, b) => b.total - a.total);
    expect(toRows(result.table)).toEqual(expected);
    expect((await source.count({ query })).rowCount).toBe(3n);
  });

  it("buckets, samples and computes statistics", async () => {
    const events = memoryDataSource({
      tables: {
        events: Array.from({ length: 90 }, (_, i) => ({ at: new Date(Date.UTC(2026, 0, 1 + i)), value: i })),
      },
    });
    const monthly = await collect(
      events.execute({
        query: {
          baseSql: "SELECT * FROM events",
          buckets: [{ column: "at", alias: "month", by: { case: "grain", value: TimeGrain.MONTH } }],
          aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
          sorts: [{ column: "month" }],
        },
      }),
    );
    expect(toRows(monthly.table).map((r) => Number(r.n))).toEqual([31, 28, 31]);

    const binned = await collect(
      events.execute({
        query: {
          baseSql: "SELECT * FROM events",
          buckets: [{ column: "value", alias: "bin", by: { case: "binWidth", value: 30 } }],
          aggregates: [
            { function: AggregateFunction.COUNT, alias: "n" },
            { function: AggregateFunction.MEDIAN, column: "value", alias: "mid" },
            { function: AggregateFunction.PERCENTILE, column: "value", alias: "top", percentile: 1 },
          ],
          sorts: [{ column: "bin" }],
        },
      }),
    );
    expect(toRows(binned.table)).toEqual([
      { bin: 0, n: 30, mid: 14.5, top: 29 },
      { bin: 30, n: 30, mid: 44.5, top: 59 },
      { bin: 60, n: 30, mid: 74.5, top: 89 },
    ]);

    const sample = async () => toRows((await collect(events.execute({ query: { baseSql: "SELECT * FROM events", sample: { rows: 10 } } }))).table);
    const picked = await sample();
    expect(picked).toHaveLength(10);
    expect(await sample()).toEqual(picked);
    expect(Math.max(...picked.map((r) => Number(r.value)))).toBeGreaterThan(30);
  });

  it("reports what is known about an error", () => {
    expect(queryErrorInfo(new QueryError("Unknown column", { code: "UNKNOWN_COLUMN", line: 3, column: 7 }))).toEqual({
      message: "Unknown column",
      code: "UNKNOWN_COLUMN",
      line: 3,
      column: 7,
    });
    expect(queryErrorInfo(new Error("[invalid_argument] nope")).message).toBe("nope");
    expect(queryErrorInfo(new QueryError("Object 'x' does not exist.", { code: "UNKNOWN_TABLE", engineCode: "3807" }))).toMatchObject({ code: "UNKNOWN_TABLE", engineCode: "3807" });
  });

  it("refuses SQL it cannot run", async () => {
    await expect(collect(source.execute({ query: { baseSql: "SELECT id FROM orders WHERE id > 3" } }))).rejects.toThrow(
      /only runs/,
    );
  });
});
