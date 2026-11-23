import { AggregateFunction, SortDirection, TimeGrain } from "@surfaces-ui/proto";
import { Field, Float64, Int32, TimestampMillisecond, Utf8 } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { buildChartQuery } from "../chart/Chart.js";
import { type ExploreState, type Pill, addToShelf, exploreChart, exploreQuery, normalizeExplore, pillId, pillNumber, pillProblem, pillsFromFields, setPill, suggestDerived, suggestedView } from "./model.js";

const columns = [new Field("ordered_at", new TimestampMillisecond()), new Field("region", new Utf8()), new Field("order_id", new Int32()), new Field("line_amount", new Float64()), new Field("line_cost", new Float64()), new Field("refund_amount", new Float64()), new Field("quantity", new Int32())];
const generated = pillsFromFields(columns);
const state = (extra: Partial<ExploreState> = {}): ExploreState => ({ fields: [...generated, ...suggestDerived(generated)], rows: [], values: [], filters: [], ...extra });

describe("pills generated from columns", () => {
  it("sums a number whose name says it adds up, and averages a reading", () => {
    const pills = pillsFromFields([new Field("power_kw", new Float64()), new Field("energy_mwh", new Float64()), new Field("unit_price", new Float64()), new Field("downtime_hours", new Float64()), new Field("generating", new Int32()), new Field("cost_usd", new Float64())]);
    const of = (column: string) => pills.find((p) => p.column === column && p.kind === "metric");
    expect(of("power_kw")).toMatchObject({ aggregate: "avg", label: "Average power kw" });
    expect(of("unit_price")).toMatchObject({ aggregate: "avg", label: "Average unit price", format: "currency" });
    expect(of("generating")).toMatchObject({ aggregate: "avg" });
    expect(of("energy_mwh")).toMatchObject({ aggregate: "sum", label: "Energy mwh" });
    expect(of("downtime_hours")).toMatchObject({ aggregate: "sum" });
    expect(of("cost_usd")).toMatchObject({ aggregate: "sum", format: "currency" });
  });

  it("suggests a first view: a category, not an id or a date, by a measure, not a count of ids", () => {
    expect(suggestedView(generated)).toEqual({ rows: ["region"], values: ["line_amount"] });
    const onlyDates = pillsFromFields([new Field("ordered_at", new TimestampMillisecond()), new Field("order_id", new Int32())]);
    expect(suggestedView(onlyDates)).toEqual({ rows: ["ordered_at"], values: ["rows"] });
    expect(suggestedView([])).toEqual({ rows: [], values: [] });
  });

  it("makes attributes of text, dates and keys, metrics of numbers, and always a count of rows", () => {
    expect(generated.map((p) => [p.id, p.kind, p.aggregate ?? p.grain ?? ""])).toEqual([
      ["ordered_at", "attribute", "month"],
      ["region", "attribute", ""],
      ["order_id", "attribute", ""],
      ["order_id_count", "metric", "count_distinct"],
      ["line_amount", "metric", "sum"],
      ["line_cost", "metric", "sum"],
      ["refund_amount", "metric", "sum"],
      ["quantity", "metric", "sum"],
      ["rows", "metric", "count"],
    ]);
    expect(generated.find((p) => p.id === "line_amount")).toMatchObject({ label: "Line amount", format: "currency", by: "the columns" });
    expect(generated.every((p) => pillProblem(p, generated, columns.map((c) => c.name)) === undefined)).toBe(true);
  });

  it("suggests averages, a margin and a share from the names, once, and says they are suggestions", () => {
    const found = suggestDerived(generated);
    expect(found.map((p) => [p.label, p.expression, p.format])).toEqual([
      ["Line amount per row", "line_amount / rows", "currency"],
      ["Line cost per row", "line_cost / rows", "currency"],
      ["Refund amount per row", "refund_amount / rows", "currency"],
      ["Margin", "(line_amount - line_cost) / line_amount", "percent"],
      ["Refund amount share of line amount", "refund_amount / line_amount", "percent"],
    ]);
    expect(found.every((p) => p.by === "suggested from the columns" && pillProblem(p, [...generated, ...found]) === undefined)).toBe(true);
    expect(suggestDerived([...generated, ...found])).toEqual([]);
  });

  it("names a pill from its label, unlike any other", () => {
    expect([pillId("Refund rate"), pillId("2024 sales"), pillId("  "), pillId("Margin", ["margin", "margin_2"])]).toEqual(["refund_rate", "n2024_sales", "field", "margin_3"]);
  });
});

describe("a pill that cannot be used", () => {
  const all = state().fields;
  const check = (pill: Partial<Pill>) => pillProblem({ id: "x", kind: "derived", label: "X", ...pill } as Pill, [...all, { id: "x", kind: "derived", label: "X", ...pill } as Pill], columns.map((c) => c.name));
  it("says why", () => {
    expect(check({ expression: "refund_amount / line_amount" })).toBeUndefined();
    expect(check({ expression: "refund_amount / nothing" })).toMatch(/"nothing" is not a measure/);
    // A calculation is over metrics, never over another calculation, so it cannot depend on itself.
    expect(check({ expression: "margin * 2" })).toMatch(/"margin" is not a measure/);
    expect(check({ expression: "1; DROP TABLE orders" })).toMatch(/cannot be used here/);
    expect(check({ kind: "metric", aggregate: "sum" })).toMatch(/Only a count/);
    expect(check({ kind: "metric", aggregate: "sum", column: "missing" })).toMatch(/no column "missing"/);
    expect(check({ kind: "attribute" })).toMatch(/needs a column/);
    expect(check({ id: "2x", expression: "rows" })).toMatch(/must start with a letter/);
    expect(pillProblem(all[0]!, [...all, all[0]!])).toMatch(/already called/);
  });
});

describe("the shelves", () => {
  it("take a pill where it belongs and drop what cannot be drawn", () => {
    let s = addToShelf(state(), "region");
    s = addToShelf(s, "line_amount");
    s = addToShelf(s, "ordered_at", "split");
    expect([s.rows, s.split, s.values]).toEqual([["region"], "ordered_at", ["line_amount"]]);
    // An attribute is on one shelf at a time.
    const moved = addToShelf(s, "ordered_at", "rows");
    expect([moved.rows, moved.split]).toEqual([["region", "ordered_at"], undefined]);
    expect(normalizeExplore({ ...s, rows: ["line_amount", "nope", "region"], values: ["region", "margin"], split: "region" })).toMatchObject({ rows: ["region"], values: ["margin"] });
  });

  it("follow a rename into calculations, and a removal off the shelves", () => {
    const s = state({ rows: ["region"], values: ["line_amount", "margin"] });
    const renamed = setPill(s, "line_amount", { ...s.fields.find((p) => p.id === "line_amount")!, id: "revenue", label: "Revenue" });
    expect(renamed.values).toEqual(["revenue", "margin"]);
    expect(renamed.fields.find((p) => p.id === "margin")?.expression).toBe("(revenue - line_cost) / revenue");
    expect(setPill(s, "margin", undefined)).toMatchObject({ values: ["line_amount"] });
    expect(setPill(s, "new_one", { id: "new_one", kind: "metric", label: "New", aggregate: "count" }).fields.at(-1)?.id).toBe("new_one");
  });
});

describe("what the shelves ask the engine for", () => {
  it("groups by the attributes, summarises the metrics a calculation names, and sorts so a limit keeps the largest", () => {
    const query = exploreQuery(state({ rows: ["region"], values: ["margin", "rows"], filters: [{ column: "region", op: "neq", values: ["EU"] }] }), "SELECT * FROM lines", 50);
    expect(query.groupBy).toEqual(["region"]);
    expect(query.aggregates).toEqual([
      { function: AggregateFunction.SUM, column: "line_amount", alias: "line_amount" },
      { function: AggregateFunction.SUM, column: "line_cost", alias: "line_cost" },
      { function: AggregateFunction.COUNT, column: "", alias: "rows" },
    ]);
    expect(query.derived).toEqual([{ alias: "margin", expression: "(line_amount - line_cost) / line_amount" }]);
    expect(query.sorts).toEqual([{ column: "margin", direction: SortDirection.DESC }]);
    expect(query.page).toEqual({ limit: 50 });
    expect(query.filters).toHaveLength(1);
  });

  it("buckets a date and puts time in order", () => {
    const query = exploreQuery(state({ rows: ["ordered_at"], values: ["line_amount"] }), "SELECT * FROM lines");
    expect(query.buckets).toEqual([{ column: "ordered_at", alias: "ordered_at", by: { case: "grain", value: TimeGrain.MONTH } }]);
    expect(query.groupBy).toEqual([]);
    expect(query.sorts).toEqual([{ column: "ordered_at", direction: SortDirection.ASC }]);
  });

  it("draws a line over time and bars over categories, with a calculation carrying its own terms", () => {
    expect(exploreChart(state({ values: ["rows"] }))).toBeUndefined();
    expect(exploreChart(state({ rows: ["ordered_at"], values: ["line_amount"] }))).toMatchObject({ type: "line", x: "ordered_at", xGrain: "month" });
    const chart = exploreChart(state({ rows: ["region"], split: "order_id", values: ["margin"] }))!;
    expect(chart).toMatchObject({ type: "bar", x: "region", splitBy: "order_id", xTitle: "Region" });
    expect(chart.y).toEqual([{ expression: "(line_amount - line_cost) / line_amount", terms: { line_amount: { column: "line_amount", aggregate: "sum" }, line_cost: { column: "line_cost", aggregate: "sum" } }, label: "Margin" }]);
    // The chart's own query: the terms as aggregates named after the calculation, and the calculation over them.
    const query = buildChartQuery({ sql: "SELECT * FROM lines", type: "bar", x: "region", y: chart.y, limit: 100 });
    expect(query.aggregates?.map((a) => a.alias)).toEqual(["calc_0_line_amount", "calc_0_line_cost"]);
    expect(query.derived).toEqual([{ alias: "calc_0", expression: "((calc_0_line_amount - calc_0_line_cost) / calc_0_line_amount)" }]);
    expect(query.sorts).toEqual([{ column: "calc_0", direction: SortDirection.DESC }]);
    // Two values: the series are the values, so there is no split.
    expect(exploreChart(state({ rows: ["region"], split: "order_id", values: ["margin", "rows"] }))?.splitBy).toBeUndefined();
  });

  it("writes numbers as a pill's format says", () => {
    expect([pillNumber(0.0523, "percent"), pillNumber(1234.5, "currency"), pillNumber(7_900_000, "currency"), pillNumber(20933, "compact"), pillNumber(null, "number"), pillNumber(3.14159, undefined)]).toEqual(["5.2%", "$1,234.50", "$7.9M", "20.9K", "–", "3.14"]);
  });
});
