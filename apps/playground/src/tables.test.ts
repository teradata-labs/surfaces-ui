import { describe, expect, it } from "vitest";
import { type WorkingTable, columnLabel, columnPart, onboarding, tableParts, tableProps, tableSqlName, tablesOutline } from "./tables.js";

const orders: WorkingTable = {
  schema: "sales",
  table: "fct_orders",
  columns: [
    { name: "order_key", nativeType: "INTEGER", primaryKey: true },
    { name: "customer_name", nativeType: "VARCHAR(100)" },
    { name: "product_category", nativeType: "VARCHAR(50)" },
    { name: "payment_method", nativeType: "VARCHAR(50)" },
    { name: "store_id", nativeType: "INTEGER" },
    { name: "total_amount", nativeType: "DECIMAL(15,2)" },
    { name: "order_date", nativeType: "DATE" },
    { name: "payload", nativeType: "JSON" },
  ],
};
/** A table with numbers and a date only: no text to group by. */
const daily: WorkingTable = { schema: "sales", table: "daily_summary", columns: [{ name: "day", nativeType: "DATE" }, { name: "txn_count", nativeType: "BIGINT" }] };
/** A table with nothing to chart. */
const codes: WorkingTable = { table: "Code List", columns: [{ name: "code_id", nativeType: "INTEGER" }] };

describe("working tables", () => {
  it("reads a column's part from its type name", () => {
    expect(["BIGINT", "decimal(12,2)", "FLOAT", "TIMESTAMP(0) WITH TIME ZONE", "date", "CHAR(3)", "varchar", "BLOB", "JSON"].map(columnPart)).toEqual(["number", "number", "number", "date", "date", "text", "text", "other", "other"]);
  });

  it("guesses a measure that is not a key, the first date, and categories before names", () => {
    expect(tableParts(orders.columns)).toEqual({ measure: "total_amount", date: "order_date", categories: ["product_category", "payment_method"] });
    expect(tableParts(codes.columns)).toEqual({ measure: undefined, date: undefined, categories: [] });
  });

  it("names a table with its database, quoting only what needs it", () => {
    expect(tableSqlName(orders)).toBe("sales.fct_orders");
    expect(tableSqlName(codes)).toBe('"Code List"');
    expect(columnLabel("customer_lifetime_value")).toBe("Customer lifetime value");
  });

  it("draws any table as a grid, and other components only from what the table has", () => {
    expect(tableProps("QueryResult", "td", codes)).toEqual({ props: { sourceId: "td", sql: 'SELECT * FROM "Code List"' } });
    expect(tableProps("Chart", "td", orders)).toMatchObject({ props: { sql: "SELECT * FROM sales.fct_orders", type: "bar", x: "product_category", y: [{ column: "total_amount", aggregate: "sum" }] } });
    // No text column: a line over the date instead of bars.
    expect(tableProps("Chart", "td", daily)).toMatchObject({ props: { type: "line", x: "day", xGrain: "month" } });
    expect(tableProps("Chart", "td", codes)).toMatchObject({ missing: expect.stringContaining("no text or date column") });
    expect(tableProps("Sparkline", "td", codes)).toMatchObject({ missing: expect.stringContaining("no date or time column") });
    expect(tableProps("PivotTable", "td", daily)).toMatchObject({ missing: expect.stringContaining("no text column") });
    expect(tableProps("Metric", "td", codes)).toMatchObject({ props: { aggregate: "count", label: "Rows" } });
  });

  it("asks for a table before a data component, and leaves the rest to the catalog's examples", () => {
    expect(tableProps("Chart", "td", undefined)).toMatchObject({ missing: expect.stringContaining("Pick a table first") });
    expect(tableProps("Text", "td", undefined)).toBeUndefined();
    expect(tableProps("DecisionCard", "td", orders)).toBeUndefined();
  });

  it("tells the agent the tables in use by name and type, and how to look when there are none", () => {
    const outline = tablesOutline("td", "Teradata", [orders]);
    expect(outline).toContain('Source "td" (Teradata SQL)');
    expect(outline).toContain("- sales.fct_orders(order_key INTEGER key, customer_name VARCHAR(100)");
    expect(tablesOutline("td", "Teradata", [])).toContain("has not picked tables yet");
  });

  it("offers ways to start that look before drawing and never read values", () => {
    const starts = onboarding("Teradata", "td", []);
    expect(starts.map((s) => s.label)).toEqual(["Show me what is here", "Build a starter dashboard", "Model how tables join"]);
    for (const start of starts) {
      expect(start.instruction).toContain("list_tables");
      expect(start.instruction).toContain("never values");
    }
    expect(onboarding("Teradata", "td", [orders])[0]!.instruction).toContain("Start from the tables in use (sales.fct_orders)");
  });
});
