import { AggregateFunction, TimeGrain } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { collect, pageDataSource, pageTables, plainRows, toRows } from "./index.js";

const data = {
  tables: {
    bills: [
      { name: "Power", due: "2026-01-05", amount: 80 },
      { name: "Water", due: "2026-01-20", amount: 30, note: "autopay" },
      { name: "Power", due: "2026-02-05", amount: 95 },
    ],
  },
};

describe("page data", () => {
  it("gives every row every column", () => {
    const rows = plainRows([{ a: 1 }, { b: "x" }]);
    expect(rows).toEqual([
      { a: 1, b: null },
      { a: null, b: "x" },
    ]);
  });

  it("turns a column of ISO dates into dates, and leaves mixed text alone", () => {
    const rows = plainRows([
      { at: "2026-03-01", label: "2026-03-01" },
      { at: "2026-03-02T09:30:00Z", label: "soon" },
      { at: null, label: null },
    ]);
    expect(rows[0]!.at).toBeInstanceOf(Date);
    expect((rows[1]!.at as Date).toISOString()).toBe("2026-03-02T09:30:00.000Z");
    expect(rows[2]!.at).toBeNull();
    expect(rows[0]!.label).toBe("2026-03-01");
  });

  it("finds tables at a path, and none when the path is empty", () => {
    expect(Object.keys(pageTables({ page: { data: data.tables } }, "page/data"))).toEqual(["bills"]);
    expect(pageTables({})).toEqual({});
  });

  it("names a table that is not a list of rows", () => {
    expect(() => pageTables({ tables: { bills: "nope" } })).toThrow(/"bills"/);
    expect(() => pageTables({ tables: { bills: [1, 2] } })).toThrow(/"bills"/);
    expect(() => pageTables({ tables: [] })).toThrow(/"tables"/);
  });

  it("serves the page's rows to queries, grouping text dates by month", async () => {
    const source = pageDataSource(data);
    const all = await collect(source.execute({ sourceId: "page", query: { baseSql: "SELECT * FROM bills" } }));
    expect(all.table.numRows).toBe(3);

    const monthly = await collect(
      source.execute({
        sourceId: "page",
        query: {
          baseSql: "SELECT * FROM bills",
          buckets: [{ column: "due", alias: "month", by: { case: "grain", value: TimeGrain.MONTH } }],
          aggregates: [{ function: AggregateFunction.SUM, column: "amount", alias: "total" }],
          sorts: [{ column: "month" }],
        },
      }),
    );
    expect(toRows(monthly.table).map((r) => Number(r.total))).toEqual([110, 95]);
  });
});
