import { Field, Float64, TimestampMillisecond, Utf8 } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { AggregateFunction, TimeGrain } from "@surfaces-ui/proto";
import { buildChartQuery, measureOutputs } from "./Chart.js";
import { axisFormatter, axisNumber, buildChartOption, niceBinWidth, tooltipFormatter } from "./option.js";

const fields = [new Field("region", new Utf8()), new Field("day", new TimestampMillisecond()), new Field("total", new Float64())];
const rows = [
  { region: "EU", day: "2026-01-01T00:00:00.000Z", total: 10 },
  { region: "NA", day: "2026-01-01T00:00:00.000Z", total: 30 },
  { region: "EU", day: "2026-01-02T00:00:00.000Z", total: 20 },
];
type Option = { xAxis: { type: string }; series: Record<string, unknown>[]; dataset: unknown; dataZoom: unknown[]; legend: { show?: boolean } };

describe("buildChartOption", () => {
  it("labels every category it has room for", () => {
    const option = buildChartOption({ type: "bar", x: "region", series: [{ column: "total", label: "Revenue" }], fields, rows }) as { xAxis: { axisLabel: Record<string, unknown> } };
    expect(option.xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: true });
  });

  it("builds one series per measure over a category axis", () => {
    const option = buildChartOption({ type: "bar", x: "region", series: [{ column: "total", label: "Revenue" }], fields, rows }) as Option;
    expect(option.xAxis.type).toBe("category");
    expect(option.series).toEqual([{ type: "bar", name: "Revenue", encode: { x: "region", y: "total" }, tooltip: { valueFormatter: expect.any(Function) } }]);
    expect(option.dataset).toEqual({ source: rows });
    expect(option.dataZoom).toEqual([]);
    expect(option.legend.show).toBe(false);
  });

  it("uses a time axis for timestamps and splits by a column", () => {
    const option = buildChartOption({
      type: "area",
      x: "day",
      splitBy: "region",
      series: [{ column: "total", label: "Revenue" }],
      fields,
      rows,
    }) as Option;
    expect(option.xAxis.type).toBe("time");
    // Buckets are midnight UTC; drawn in local time a month would read as the last day of the month before.
    expect((option as { useUTC?: boolean }).useUTC).toBe(true);
    expect(option.series.map((s) => [s.name, s.type, s.datasetIndex])).toEqual([
      ["EU", "line", 0],
      ["NA", "line", 1],
    ]);
    expect(option.series[0]!.areaStyle).toBeTruthy();
    expect((option.dataset as { source: unknown[] }[]).map((d) => d.source.length)).toEqual([2, 1]);
    // A few points need no zoom bar; many do.
    expect(option.dataZoom.length).toBe(0);
    const many = Array.from({ length: 80 }, (_, i) => ({ ...rows[0]!, [Object.keys(rows[0]!)[0]!]: i }));
    expect((buildChartOption({ type: "line", x: Object.keys(rows[0]!)[0]!, series: [{ column: Object.keys(rows[0]!).at(-1)!, label: "v" }], fields: [], rows: many }) as { dataZoom: unknown[] }).dataZoom.length).toBe(2);
  });

  it("builds a pie from names and values", () => {
    const option = buildChartOption({ type: "pie", x: "region", series: [{ column: "total", label: "Revenue" }], fields, rows }) as unknown as {
      series: { data: unknown[] }[];
    };
    expect(option.series[0]!.data[1]).toEqual({ name: "NA", value: 30 });
  });
});

describe("measureOutputs", () => {
  it("names aggregate outputs safely and labels them readably", () => {
    expect(
      measureOutputs([{ column: "order amt", aggregate: "sum" }, { aggregate: "count" }, { column: "price" }]).map((o) => [o.column, o.label]),
    ).toEqual([
      ["sum_order_amt_0", "sum of order amt"],
      ["count_rows_1", "count"],
      ["price", "price"],
    ]);
  });
});

describe("compound charts, axes and legends", () => {
  it("draws each series with its own type and y axis", () => {
    const option = buildChartOption({
      type: "bar",
      x: "region",
      series: [
        { column: "total", label: "Revenue" },
        { column: "rate", label: "Margin", type: "line", axis: "right" },
      ],
      fields,
      rows,
      legend: "bottom",
      yTitle: "Revenue",
      yRightTitle: "Margin %",
    }) as unknown as { series: Record<string, unknown>[]; yAxis: Record<string, unknown>[]; legend: Record<string, unknown> };
    expect(option.series.map((s) => [s.type, s.yAxisIndex])).toEqual([
      ["bar", 0],
      ["line", 1],
    ]);
    expect(option.yAxis.map((a) => [a.name, a.position])).toEqual([
      ["Revenue", "left"],
      ["Margin %", "right"],
    ]);
    expect(option.legend).toMatchObject({ bottom: 0 });
  });

  it("stacks series and can hide the legend", () => {
    const option = buildChartOption({
      type: "bar",
      x: "day",
      splitBy: "region",
      series: [{ column: "total", label: "Revenue" }],
      fields,
      rows,
      stacked: true,
      legend: "none",
    }) as unknown as { series: Record<string, unknown>[]; legend: Record<string, unknown> };
    expect(new Set(option.series.map((s) => s.stack)).size).toBe(1);
    expect(option.legend).toEqual({ show: false });
  });
});

describe("buildChartQuery", () => {
  const base = { sql: "SELECT * FROM orders", type: "line" as const, limit: 5000 };

  it("buckets a time axis by grain instead of grouping by exact value", () => {
    const query = buildChartQuery({ ...base, x: "ordered_at", xGrain: "month", y: [{ column: "amount", aggregate: "sum" }], splitBy: "region" });
    expect(query.groupBy).toEqual(["region"]);
    expect(query.buckets).toEqual([{ column: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }]);
    expect(query.sample).toBeUndefined();
  });

  it("bins a numeric axis and passes percentiles", () => {
    const query = buildChartQuery({ ...base, x: "amount", binWidth: 50, y: [{ aggregate: "count" }, { column: "amount", aggregate: "percentile", percentile: 0.95 }] });
    expect(query.buckets).toEqual([{ column: "amount", by: { case: "binWidth", value: 50 } }]);
    expect(query.aggregates?.map((a) => [a.function, a.percentile])).toEqual([
      [AggregateFunction.COUNT, 0],
      [AggregateFunction.PERCENTILE, 0.95],
    ]);
    expect(measureOutputs([{ column: "amount", aggregate: "percentile", percentile: 0.95 }])[0]!.label).toBe("p95 of amount");
  });

  it("asks for a random sample when plotting raw rows", () => {
    const query = buildChartQuery({ ...base, type: "scatter", x: "qty", y: [{ column: "amount" }] });
    expect(query.sample).toEqual({ rows: 5000 });
    expect(query.columns).toEqual(["qty", "amount"]);
    expect(query.page).toBeUndefined();
  });

  it("chooses round bin widths", () => {
    expect(niceBinWidth(0, 1000, 20)).toBe(50);
    expect(niceBinWidth(3, 97, 10)).toBe(10);
    expect(niceBinWidth(5, 5, 10)).toBe(1);
  });
});

describe("axisNumber", () => {
  it("keeps ticks under one apart instead of rounding them all to 0 and 0.1", () => {
    expect([0, 0.02, 0.04, 0.060000000000000005, 0.1, 0.12].map(axisNumber)).toEqual(["0", "0.02", "0.04", "0.06", "0.1", "0.12"]);
    expect([-0.005, 1, 1500, 2_500_000].map(axisNumber)).toEqual(["-0.005", "1", "1.5K", "2.5M"]);
  });

  it("writes a rate as a percent and money as money, on the left axis only", () => {
    expect([0, 0.02, 0.055, 0.1].map(axisFormatter("percent"))).toEqual(["0%", "2%", "5.5%", "10%"]);
    expect([0, 1500, 2_500_000].map(axisFormatter("currency"))).toEqual(["$0", "$1.5K", "$2.5M"]);
    const option = buildChartOption({ type: "bar", x: "c", series: [{ column: "rate", label: "Rate" }], fields: [], rows: [{ c: "a", rate: 0.05 }], yFormat: "percent" }) as { yAxis: { axisLabel: { formatter(v: number): string } } };
    expect(option.yAxis.axisLabel.formatter(0.05)).toBe("5%");
  });
});

describe("tooltipFormatter", () => {
  it("writes a value in full, rounded, in the measure's own format", () => {
    expect(tooltipFormatter("percent")(0.061234)).toBe("6.1%");
    expect(tooltipFormatter("currency")(1234.5)).toBe("$1,234.50");
    expect(tooltipFormatter(undefined)(1234.5678)).toBe("1,234.57");
    expect(tooltipFormatter(undefined)(0.012345)).toBe("0.012");
    expect(tooltipFormatter(undefined)(null)).toBe("–");
  });
});
