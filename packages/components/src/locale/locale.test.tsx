// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, render, screen } from "@testing-library/react";
import { Float64, Table, Utf8, vectorFromArray } from "apache-arrow";
import { afterEach, describe, expect, it } from "vitest";
import { formatCell } from "../data/format.js";
import { DataGrid } from "../grid/DataGrid.js";
import { formatMetric } from "../metric/Metric.js";
import { QueryResult } from "../result/QueryResult.js";
import { SurfacesText } from "./SurfacesText.js";
import { defaultLabels, getLocale, label, numberFormat, resetLabels, setLabels, setLocale } from "./locale.js";

afterEach(() => {
  cleanup();
  setLocale("en-US");
  resetLabels();
});

const source = () =>
  memoryDataSource({
    tables: {
      sales: new Table({
        region: vectorFromArray(["North", null], new Utf8()),
        amount: vectorFromArray([1234.5, 20], new Float64()),
      }),
    },
  });

describe("locale", () => {
  it("writes numbers in the locale that is set, and takes a later change", () => {
    expect(getLocale()).toBe("en-US");
    expect(numberFormat().format(1234.5)).toBe("1,234.5");
    expect(formatCell(1234.5, new Float64()).text).toBe("1,234.5");
    setLocale("de_DE"); // as a phone writes it
    expect(getLocale()).toBe("de-DE");
    expect(getLocale()).toBe("de-DE");
    expect(numberFormat().format(1234.5)).toBe("1.234,5");
    expect(formatCell(1234.5, new Float64()).text).toBe("1.234,5");
    expect(formatMetric(0.125, "percent")).toMatch(/^12,5\s%$/);
    setLocale("en-US");
    expect(formatCell(1234.5, new Float64()).text).toBe("1,234.5");
  });

  it("fills placeholders, replaces words and resets to English", () => {
    expect(label("grid.rows", { count: "1,234" })).toBe("1,234 rows");
    expect(label("plan.approved", { count: 2, total: 3 })).toBe("Approved 2 of 3 steps.");
    // A marker with no value is left as written.
    expect(label("chart.sampleNote")).toBe("Showing a random sample of {count} rows.");
    setLabels({ "grid.copyValue": "Copy", "grid.rows": "{count} lines" });
    expect(label("grid.copyValue")).toBe("Copy");
    expect(label("grid.rows", { count: 5 })).toBe("5 lines");
    expect(label("grid.sortAscending")).toBe("Sort ascending");
    resetLabels();
    expect(label("grid.copyValue")).toBe(defaultLabels["grid.copyValue"]);
    expect(label("grid.rows", { count: 5 })).toBe("5 rows");
  });

  it("draws a grid in the locale and words SurfacesText gives", async () => {
    render(
      <SurfacesText locale="de-DE" labels={{ "grid.rows": "{count} Zeilen", "cell.null": "–" }}>
        <DataGrid dataSource={source()} sourceId="memory" sql="SELECT * FROM sales" height={300} rowHeight={20} />
      </SurfacesText>,
    );
    await screen.findByText("2 Zeilen");
    expect(await screen.findByText("1.234,5")).toBeTruthy();
    expect(screen.getByText("–").getAttribute("data-null")).toBe("true");
  });

  it("shows plain words in a query result", async () => {
    render(
      <SurfacesText labels={{ "result.sqlSent": "The question as the computer asked it", "result.tabTable": "List" }}>
        <QueryResult dataSource={source()} sourceId="memory" sql="SELECT * FROM sales" />
      </SurfacesText>,
    );
    expect(await screen.findByRole("tab", { name: "List" })).toBeTruthy();
    expect(await screen.findByText("The question as the computer asked it")).toBeTruthy();
    expect(screen.queryByText("SQL sent to the engine")).toBeNull();
  });
});
