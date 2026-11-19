// @vitest-environment jsdom
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { FilterOperator } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Field, Float64, TimestampMillisecond, Utf8 } from "apache-arrow";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { csvField, exportCsv } from "../data/export.js";
import { formatCellAs } from "../data/format.js";
import type { FilterInit } from "../data/useRowWindow.js";
import { FilterBar } from "../filter/FilterBar.js";
import { DataGrid } from "../grid/DataGrid.js";
import { QueryPlan, parsePlan } from "../plan/QueryPlan.js";
import { QueryResult } from "./QueryResult.js";

afterEach(cleanup);

const rows = [
  { id: 1, region: "Europe", note: "=SUM(A1)", amount: 1234.5, share: 0.125, at: new Date(Date.UTC(2026, 0, 5, 9, 30)) },
  { id: 2, region: "Asia, Pacific", note: 'say "hi"', amount: 80, share: 0.5, at: new Date(Date.UTC(2026, 1, 1)) },
  { id: 3, region: "Europe", note: null, amount: 7, share: 0.375, at: new Date(Date.UTC(2026, 1, 2)) },
];
const dataSource: DataSource = memoryDataSource({ tables: { orders: rows } });
const sql = "SELECT * FROM orders";

describe("export", () => {
  it("writes the whole result as CSV, quoting what needs it and defusing formulas", async () => {
    const result = await exportCsv(dataSource, { sourceId: "memory", query: { baseSql: sql, columns: ["id", "region", "note", "amount"], sorts: [{ column: "id" }] } });
    expect(result.rows).toBe(3);
    expect((await result.blob.text()).replace("﻿", "")).toBe('id,region,note,amount\r\n1,Europe,\'=SUM(A1),1234.5\r\n2,"Asia, Pacific","say ""hi""",80\r\n3,Europe,,7\r\n');
    expect(csvField("-5", false)).toBe("-5");
    expect(csvField("-5", true)).toBe("'-5");
  });

  it("honours filters, so the file matches what is on screen", async () => {
    const result = await exportCsv(dataSource, {
      sourceId: "memory",
      query: { baseSql: sql, columns: ["id"], filters: [{ column: "region", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "Europe" } }] }] },
    });
    expect(result.rows).toBe(2);
  });
});

describe("column formats", () => {
  it("writes numbers and dates as asked, and leaves the rest alone", () => {
    const number = new Float64();
    expect(formatCellAs(1234.5, number, { kind: "currency", decimals: 2 }).text).toBe("$1,234.50");
    expect(formatCellAs(0.125, number, { kind: "percent" }).text).toBe("12.5%");
    expect(formatCellAs(1_250_000, number, { kind: "compact" }).text).toBe("1.3M");
    expect(formatCellAs(Date.UTC(2026, 0, 5, 9, 30), new TimestampMillisecond(), { kind: "date" }).text).toBe("2026-01-05");
    expect(formatCellAs("abc", new Utf8(), { kind: "currency" }).text).toBe("abc");
    expect(formatCellAs(null, number, { kind: "currency" }).isNull).toBe(true);
  });

  it("applies a format to a grid column", async () => {
    render(<DataGrid dataSource={dataSource} sourceId="memory" sql={sql} formats={{ amount: { kind: "currency", decimals: 2 }, share: { kind: "percent" } }} height={300} rowHeight={30} />);
    expect(await screen.findByText("$1,234.50")).toBeTruthy();
    expect(screen.getByText("12.5%")).toBeTruthy();
  });
});

describe("FilterBar", () => {
  const fields = [new Field("region", new Utf8()), new Field("at", new TimestampMillisecond()), new Field("amount", new Float64())];
  function Harness(props: { onFilters(filters: FilterInit[]): void; loadValues?: (column: string) => Promise<string[]> }) {
    const [filters, setFilters] = useState<FilterInit[]>([]);
    return (
      <FilterBar
        fields={fields}
        filters={filters}
        loadValues={props.loadValues}
        now={() => new Date(Date.UTC(2026, 1, 15))}
        onChange={(next) => {
          setFilters(next);
          props.onFilters(next);
        }}
      />
    );
  }

  it("offers a column's values to pick from, asking the backend once per column", async () => {
    const loadValues = vi.fn(async () => ["Europe", "Asia, Pacific"]);
    const onFilters = vi.fn();
    render(<Harness onFilters={onFilters} loadValues={loadValues} />);
    await waitFor(() => expect(document.querySelectorAll("datalist option")).toHaveLength(2));
    expect(loadValues).toHaveBeenCalledWith("region");
    expect(screen.getByLabelText("Value").getAttribute("list")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "amount" } });
    // Numbers are typed, not picked.
    expect(screen.getByLabelText("Value").getAttribute("list")).toBeNull();
    expect(loadValues).toHaveBeenCalledTimes(1);
  });

  it("uses a date picker and quick ranges for date columns", () => {
    const onFilters = vi.fn();
    render(<Harness onFilters={onFilters} />);
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "at" } });
    expect(screen.getByLabelText("Value").getAttribute("type")).toBe("date");
    fireEvent.change(screen.getByLabelText("Quick date range"), { target: { value: "30d" } });
    expect(onFilters).toHaveBeenLastCalledWith([{ column: "at", operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue", value: "2026-01-16" } }] }]);
    // Choosing another range replaces the first instead of stacking.
    fireEvent.change(screen.getByLabelText("Quick date range"), { target: { value: "year" } });
    expect(onFilters.mock.lastCall![0]).toEqual([{ column: "at", operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue", value: "2026-01-01" } }] }]);
  });
});

describe("QueryPlan", () => {
  it("reads structured plans from DuckDB and Postgres, and ignores what it does not recognise", () => {
    expect(parsePlan('[{"name":"PROJECTION","children":[{"name":"SEQ_SCAN","extra_info":{"Table":"orders","Estimated Cardinality":"5000"},"children":[]}],"extra_info":{}}]')).toEqual([
      { name: "PROJECTION", details: [], children: [{ name: "SEQ_SCAN", details: [["Table", "orders"], ["Estimated Cardinality", "5000"]], children: [] }] },
    ]);
    expect(parsePlan('[{"Plan":{"Node Type":"Seq Scan","Relation Name":"orders","Plan Rows":10}}]')[0]).toMatchObject({ name: "Seq Scan", details: [["Relation Name", "orders"], ["Plan Rows", "10"]] });
    expect(parsePlan("not json")).toEqual([]);
  });

  it("shows the steps as a tree and falls back to the engine's text", async () => {
    const planned: DataSource = {
      ...dataSource,
      explain: async () => ({ planText: "SEQ_SCAN orders", planJson: '[{"name":"SEQ_SCAN","extra_info":{"Table":"orders"},"children":[]}]', executedSql: sql }) as never,
    };
    render(<QueryPlan dataSource={planned} sourceId="memory" sql={sql} />);
    expect(await screen.findByText("SEQ SCAN")).toBeTruthy();
    expect(screen.getByText("Table: orders")).toBeTruthy();
    cleanup();
    render(<QueryPlan dataSource={dataSource} sourceId="memory" sql={sql} />);
    expect(await screen.findByText("In-memory scan")).toBeTruthy();
  });
});

describe("QueryResult tools", () => {
  it("downloads the filtered result, formats a column and asks for the plan only when opened", async () => {
    const saved: Blob[] = [];
    URL.createObjectURL = (blob: Blob) => (saved.push(blob), "blob:test");
    URL.revokeObjectURL = () => {};
    const explain = vi.fn(dataSource.explain);
    render(<QueryResult dataSource={{ ...dataSource, explain }} sourceId="memory" sql={sql} height={300} exportName="orders" />);
    await screen.findByText("1,234.5");

    fireEvent.change(screen.getByLabelText("Column to format"), { target: { value: "amount" } });
    fireEvent.change(screen.getByLabelText("How to show amount"), { target: { value: "currency" } });
    expect(await screen.findByText("$1,234.50")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(await screen.findByText("Saved 3 rows.")).toBeTruthy();
    expect((await saved[0]!.text()).split("\r\n")[0]).toContain("id,region,note,amount");

    expect(explain).not.toHaveBeenCalled();
    const plan = screen.getByText("How the engine will run it").closest("details")!;
    plan.open = true;
    fireEvent(plan, new Event("toggle"));
    expect(await screen.findByText("In-memory scan")).toBeTruthy();
    expect(explain).toHaveBeenCalledTimes(1);
  });

  it("lets a person cancel a query that is taking too long", async () => {
    const slow: DataSource = {
      ...dataSource,
      execute(request, options) {
        if (request.query?.page?.limit === 1) return dataSource.execute(request, options);
        return (async function* () {
          await new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
        })() as never;
      },
    };
    render(<QueryResult dataSource={slow} sourceId="memory" sql={sql} height={300} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel query" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Cancelled.");
    expect(screen.queryByRole("button", { name: "Cancel query" })).toBeNull();
  });
});
