// @vitest-environment jsdom
import { type DataSource, collect, memoryDataSource } from "@surfaces-ui/data";
import { SortDirection } from "@surfaces-ui/proto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BulletGraph, bulletBand } from "./BulletGraph.js";
import { Sparkline, sparklinePoints } from "./Sparkline.js";
import { chartAdvice } from "./advice.js";
import { buildChartQuery, drawnShape } from "./Chart.js";
import { buildChartOption, categoriesBySize } from "./option.js";

const orders = [
  { amount: 10, at: new Date(Date.UTC(2026, 0, 5)) },
  { amount: 30, at: new Date(Date.UTC(2026, 1, 5)) },
  { amount: 5, at: new Date(Date.UTC(2026, 1, 9)) },
  { amount: 100, at: new Date(Date.UTC(2026, 2, 20)) },
];
const dataSource: DataSource = memoryDataSource({ tables: { orders } });
const sql = "SELECT * FROM orders";

afterEach(cleanup);

describe("chartAdvice", () => {
  const rules = (shape: Parameters<typeof chartAdvice>[0]) => chartAdvice(shape).map((a) => a.rule);
  it("passes a plain sorted bar chart", () => {
    expect(rules({ type: "bar", categories: 6, series: 1 })).toEqual([]);
  });
  it("flags what misleads or cannot be read", () => {
    expect(rules({ type: "pie", categories: 9 })).toEqual(["pie-slices"]);
    expect(rules({ type: "bar", categories: 4, rightAxis: true, truncatedAxis: true })).toEqual(["two-scales", "bar-baseline"]);
    expect(rules({ type: "line", series: 8, orderedX: false })).toEqual(["line-order", "too-many-lines"]);
    expect(rules({ type: "bar", stacked: true, series: 7, categories: 3 })).toEqual(["stack-depth"]);
    expect(rules({ type: "area", series: 3 })).toEqual(["overlapping-areas"]);
    expect(chartAdvice({ type: "pie", categories: 9 })[0]!.instead).toContain("bar chart");
  });
  it("flags bars over a long time series, a pie over ordered values and a legend for one series", () => {
    expect(rules({ type: "bar", categories: 36, orderedX: true })).toEqual(["bars-over-time"]);
    // A histogram's bins are bars by right, and a few periods are fine as bars.
    expect(rules({ type: "bar", categories: 36, orderedX: true, binned: true })).toEqual([]);
    expect(rules({ type: "bar", categories: 12, orderedX: true })).toEqual([]);
    expect(rules({ type: "pie", categories: 4, orderedX: true })).toEqual(["pie-in-order"]);
    expect(rules({ type: "line", series: 1, orderedX: true, legend: "top" })).toEqual(["one-series-legend"]);
    expect(rules({ type: "line", series: 1, orderedX: true, legend: "none" })).toEqual([]);
    expect(rules({ type: "line", series: 3, orderedX: true, legend: "right" })).toEqual([]);
    expect(rules({ type: "pie", categories: 4, legend: "right" })).toEqual([]);
  });
});

describe("Sparkline", () => {
  it("scales values into the box and leaves gaps for missing ones", () => {
    const points = sparklinePoints([0, null, 10], 100, 20, 0);
    expect(points).toEqual([{ x: 0, y: 20, value: 0 }, { x: 100, y: 0, value: 10 }]);
    expect(sparklinePoints([4, 4], 100, 20, 0).map((p) => p.y)).toEqual([10, 10]);
  });

  it("asks the backend for one value per bucket and says the trend in words", async () => {
    render(<Sparkline dataSource={dataSource} sourceId="memory" sql={sql} x="at" grain="month" column="amount" aggregate="sum" label="Revenue" />);
    const line = await waitFor(() => screen.getByRole("img", { name: /Revenue: 100 now, from 10; low 10, high 100 over 3 months\./ }));
    expect(line.querySelector("polyline")!.getAttribute("points")!.split(" ")).toHaveLength(3);
    expect(screen.getByText("100")).toBeTruthy();
  });
});

describe("BulletGraph", () => {
  const ranges = [{ to: 50, label: "Poor" }, { to: 120, label: "Fair" }, { to: 200, label: "Good" }];
  it("finds the band a value falls in", () => {
    expect(bulletBand(50, ranges)!.label).toBe("Poor");
    expect(bulletBand(51, ranges)!.label).toBe("Fair");
    expect(bulletBand(999, ranges)!.label).toBe("Good");
  });

  it("reads out the value, its band and whether the target is met", async () => {
    render(<BulletGraph dataSource={dataSource} sourceId="memory" sql={sql} column="amount" aggregate="sum" label="Revenue" target={160} ranges={ranges} />);
    await waitFor(() => screen.getByRole("img", { name: "Revenue: 145, good; target 160, not met." }));
    expect(document.querySelectorAll(".sf-bullet-range")).toHaveLength(3);
    expect((document.querySelector(".sf-bullet-bar") as HTMLElement).style.width).toBe("72.5%");
  });
});

describe("chart defaults follow the rules", () => {
  const regions = [
    { region: "B", status: "open", amount: 5, year: 2025 },
    { region: "A", status: "open", amount: 1, year: 2026 },
    { region: "C", status: "open", amount: 9, year: 2024 },
    { region: "A", status: "done", amount: 30, year: 2026 },
  ];
  const source: DataSource = memoryDataSource({ tables: { regions } });
  const y = [{ column: "amount", aggregate: "sum" as const, label: "Amount" }];

  it("asks the engine for bars largest first, and for time, bins and lines in their own order", () => {
    const base = { sql: "SELECT * FROM regions", x: "region", y, limit: 100 };
    expect(buildChartQuery({ ...base, type: "bar" }).sorts).toEqual([{ column: "sum_amount_0", direction: SortDirection.DESC }]);
    expect(buildChartQuery({ ...base, type: "bar", sort: "x" }).sorts).toEqual([{ column: "region", direction: SortDirection.ASC }]);
    expect(buildChartQuery({ ...base, type: "line" }).sorts).toEqual([{ column: "region", direction: SortDirection.ASC }]);
    expect(buildChartQuery({ ...base, type: "bar", xGrain: "month" }).sorts).toEqual([{ column: "region", direction: SortDirection.ASC }]);
    expect(buildChartQuery({ ...base, type: "bar", binWidth: 10 }).sorts).toEqual([{ column: "region", direction: SortDirection.ASC }]);
    // A split chart cannot be put in order by one sort; its totals do that after.
    expect(buildChartQuery({ ...base, type: "bar", splitBy: "status" }).sorts).toEqual([{ column: "region", direction: SortDirection.ASC }]);
  });

  it("orders a split chart by each category's total", () => {
    expect(categoriesBySize(regions, "region", "amount")).toEqual(["A", "C", "B"]);
  });

  it("names up to four lines at their ends instead of in a legend", async () => {
    const fields = (await collect(source.execute({ sourceId: "memory", query: { baseSql: "SELECT * FROM regions" } }))).table.schema.fields;
    const input = { x: "year", fields, rows: regions, series: [{ column: "amount", label: "Amount" }], splitBy: "status" };
    const lines = buildChartOption({ ...input, type: "line" }) as { series: { endLabel?: { show: boolean } }[]; legend: { show?: boolean } };
    expect(lines.series.every((s) => s.endLabel?.show)).toBe(true);
    expect(lines.legend.show).toBe(false);
    const bars = buildChartOption({ ...input, type: "bar" }) as { series: { endLabel?: unknown }[] };
    expect(bars.series.some((s) => s.endLabel)).toBe(false);
    // A numeric x keeps its own order even when the rows arrive by size.
    const byYear = buildChartOption({ ...input, type: "bar", splitBy: undefined, sort: "value" }) as { dataset: { source: { year: number }[] } };
    expect(byYear.dataset.source.map((r) => r.year)).toEqual([2024, 2025, 2026, 2026]);
  });

  it("works out advice from what was drawn", async () => {
    const fields = (await collect(source.execute({ sourceId: "memory", query: { baseSql: "SELECT * FROM regions" } }))).table.schema.fields;
    const twoScales = [{ column: "amount", aggregate: "sum" as const }, { aggregate: "count" as const, type: "line" as const, axis: "right" as const }];
    const shape = drawnShape({ type: "bar", x: "region", y: twoScales, seriesCount: 2, binned: false, fields, rows: regions });
    expect(shape).toEqual({ type: "bar", categories: 3, series: 2, stacked: undefined, rightAxis: true, orderedX: false });
    expect(chartAdvice(shape).map((a) => a.rule)).toEqual(["two-scales"]);
    expect(drawnShape({ type: "line", x: "year", y, seriesCount: 1, binned: false, fields, rows: regions }).orderedX).toBe(true);
    expect(chartAdvice(drawnShape({ type: "pie", x: "region", y, seriesCount: 1, binned: false, fields, rows: [] }))).toEqual([]);
    // Bars over months are told to be a line; bars over numeric bins (a histogram) are not.
    const months = Array.from({ length: 30 }, (_, i) => ({ ...regions[0], year: 2000 + i }));
    expect(chartAdvice(drawnShape({ type: "bar", x: "year", y, seriesCount: 1, binned: true, fields, rows: months })).map((a) => a.rule)).toEqual(["bars-over-time"]);
    expect(chartAdvice(drawnShape({ type: "bar", x: "year", y, seriesCount: 1, binned: true, histogram: true, fields, rows: months }))).toEqual([]);
    expect(chartAdvice(drawnShape({ type: "line", x: "year", y, legend: "bottom", seriesCount: 1, binned: false, fields, rows: regions })).map((a) => a.rule)).toEqual(["one-series-legend"]);
  });
});
