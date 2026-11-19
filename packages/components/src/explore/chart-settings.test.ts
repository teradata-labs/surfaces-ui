import { Field, Float64, Int32, TimestampMillisecond, Utf8 } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { buildChartOption } from "../chart/option.js";
import { type ExploreState, addToShelf, exploreChart, movePill, normalizeExplore, pillsFromFields, setChartSettings, setMeasureStyle, swapProblem } from "./model.js";
import { draftState, editTile, keepDraft, normalizeReport, withDraft } from "./report.js";

const columns = [new Field("ordered_at", new TimestampMillisecond()), new Field("region", new Utf8()), new Field("line_amount", new Float64()), new Field("quantity", new Int32())];
const fields = pillsFromFields(columns);
const state = (extra: Partial<ExploreState> = {}): ExploreState => ({ fields, rows: ["region"], values: ["line_amount"], filters: [], ...extra });

describe("chart settings on the shelves", () => {
  it("draws the chosen type, and each measure in its own type and on its own scale", () => {
    let next = setChartSettings(state({ values: ["line_amount", "quantity"] }), { type: "bar" });
    next = setMeasureStyle(next, "quantity", { type: "line", axis: "right" });
    const chart = exploreChart(next)!;
    expect(chart.type).toBe("bar");
    expect(chart.y.map((m) => [m.label, m.type ?? "", m.axis ?? ""])).toEqual([
      ["Line amount", "", ""],
      ["Quantity", "line", "right"],
    ]);
    // Two scales are each named, so a reader knows which measure is read against which.
    expect(chart).toMatchObject({ yTitle: "Line amount", yRightTitle: "Quantity" });
  });

  it("treats every measure on the right as one scale, drawn on the left", () => {
    const next = setMeasureStyle(state(), "line_amount", { axis: "right" });
    expect(exploreChart(next)!.y[0]!.axis).toBeUndefined();
    expect(exploreChart(next)!.yRightTitle).toBeUndefined();
  });

  it("turns bars on their side only when they are bars on one scale, and says why not otherwise", () => {
    expect(exploreChart(setChartSettings(state(), { swap: true }))!.horizontal).toBe(true);
    expect(swapProblem(state())).toBeUndefined();
    const line = setChartSettings(state(), { type: "line", swap: true });
    expect(exploreChart(line)!.horizontal).toBeUndefined();
    expect(swapProblem(line)).toMatch(/Only bars on one scale/);
    const twoScales = setMeasureStyle(state({ values: ["line_amount", "quantity"] }), "quantity", { axis: "right" });
    expect(swapProblem(twoScales)).toMatch(/Only bars on one scale/);
    expect(swapProblem(state({ rows: [] }))).toMatch(/no chart/);
  });

  it("keeps only settings that can apply, whatever sent them", () => {
    const sent = { ...state(), chart: { type: "pie", swap: false, measures: { line_amount: { type: "donut", axis: "middle" }, gone: { axis: "right" } } } } as unknown as ExploreState;
    expect(normalizeExplore(sent).chart).toBeUndefined();
    const kept = normalizeExplore({ ...state(), chart: { type: "area", measures: { line_amount: { type: "line" } } } });
    expect(kept.chart).toEqual({ type: "area", measures: { line_amount: { type: "line" } } });
    // Taking a measure off the shelf drops its style.
    expect(normalizeExplore({ ...kept, values: [] }).chart).toEqual({ type: "area" });
  });

  it("goes with a report tile when it is kept, and comes back when the tile is changed", () => {
    let report = withDraft({ fields, filters: [], tiles: [] }, setChartSettings(state(), { swap: true }));
    report = keepDraft(report);
    expect(report.tiles[0]!.chart).toEqual({ swap: true });
    expect(normalizeReport(report).tiles[0]!.chart).toEqual({ swap: true });
    expect(draftState(editTile(report, report.tiles[0]!.id)).chart).toEqual({ swap: true });
  });
});

describe("bars on their side", () => {
  const input = {
    type: "bar" as const,
    x: "region",
    fields: [new Field("region", new Utf8()), new Field("total", new Float64())],
    rows: [
      { region: "EU", total: 10 },
      { region: "NA", total: 30 },
    ],
    series: [{ column: "total", label: "Total" }],
    sort: "value" as const,
    xTitle: "Region",
    yTitle: "Total",
  };

  it("puts the categories down the side, largest at the top, and the values along the bottom", () => {
    const option = buildChartOption({ ...input, horizontal: true }) as Record<string, any>;
    expect(option.yAxis).toMatchObject({ type: "category", inverse: true, data: ["NA", "EU"], name: "Region" });
    expect(option.xAxis).toMatchObject({ type: "value", name: "Total" });
    expect(option.series[0].encode).toEqual({ x: "total", y: "region" });
  });

  it("stays upright when a series is not a bar or has its own scale", () => {
    const line = buildChartOption({ ...input, horizontal: true, series: [{ column: "total", label: "Total", type: "line" as const }] }) as Record<string, any>;
    expect(line.xAxis.type).toBe("category");
    const right = buildChartOption({ ...input, horizontal: true, series: [{ column: "total", label: "Total" }, { column: "total", label: "Again", axis: "right" as const }] }) as Record<string, any>;
    expect(right.xAxis.type).toBe("category");
  });
});

describe("the order on a shelf", () => {
  it("puts a pill at a place among the others, and moves one a place at a time", () => {
    const three = state({ values: ["line_amount", "quantity"] });
    expect(addToShelf(three, "quantity", "values", 0).values).toEqual(["quantity", "line_amount"]);
    expect(addToShelf(three, "line_amount", "values", 5).values).toEqual(["quantity", "line_amount"]);
    expect(movePill(three, "quantity", -1).values).toEqual(["quantity", "line_amount"]);
    // At an end nothing changes, and the same state comes back.
    expect(movePill(three, "line_amount", -1)).toBe(three);
    // The first measure is the first series.
    expect(exploreChart(movePill(three, "quantity", -1))!.y.map((m) => m.label)).toEqual(["Quantity", "Line amount"]);
  });
});
