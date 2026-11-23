import type { MessageInitShape } from "@bufbuild/protobuf";
import { measureExpressionProblem, measureNames, parseMeasureExpression } from "@surfaces-ui/data";
import { SortDirection, type ViewQuerySchema } from "@surfaces-ui/proto";
import { DataType, type Field } from "apache-arrow";
import { AGGREGATE_FUNCTIONS, type ChartAggregate, type ChartGrain, type ChartMeasure, TIME_GRAINS } from "../chart/Chart.js";
import { type ChartType, canTurnSideways } from "../chart/option.js";
import { type FilterSpec, filtersFromSpec } from "@surfaces-ui/data";
import { isNumeric } from "../data/format.js";
import { numberFormat } from "../locale/locale.js";

export type PillKind = "attribute" | "metric" | "derived";
export type PillFormat = "number" | "compact" | "currency" | "percent";
export type PillAggregate = Exclude<ChartAggregate, "percentile">;

/**
 * A field as a pill: something a person or an agent can put on a shelf.
 * An attribute is a column to break down by, a metric is a column
 * summarised, and a derived metric is arithmetic over metrics. Pills are
 * plain data and nothing about them is fixed in advance: they are generated
 * from a query's columns, suggested, written by an agent, or made and
 * edited by hand.
 */
export interface Pill {
  /** Its name in calculations: letters, digits and underscores, starting with a letter. Unique in the list. */
  id: string;
  kind: PillKind;
  label: string;
  /** Attributes and metrics: the column. A metric without one counts rows. */
  column?: string;
  /** A date or time attribute: the size of its buckets. */
  grain?: ChartGrain;
  /** Metrics: how the column is summarised. */
  aggregate?: PillAggregate;
  /** Derived metrics: arithmetic over metric ids, e.g. `refunded / revenue`. */
  expression?: string;
  format?: PillFormat;
  description?: string;
  /** Who made it: "the columns" when it was generated from them, a model's name, or "you". Always shown. */
  by?: string;
  /**
   * The semantic model it comes from, when it is that model's field as the
   * model defines it. A pill changed by hand loses this until it is added
   * to the model again.
   */
  model?: string;
}

/** What is on the shelves. Plain JSON, so a page, a URL or an agent can hold and set it. */
/** How a view's measures are drawn. A measure's own type or axis wins over the chart's. */
export type ExploreChartType = "bar" | "line" | "area";
export interface ExploreMeasureStyle {
  /** Draw this measure as bars, a line or an area, whatever the rest are. */
  type?: ExploreChartType;
  /** "right" puts this measure on a second scale at the right; for two measures of different sizes. */
  axis?: "left" | "right";
}
export interface ExploreChartSettings {
  /** How measures are drawn unless one says otherwise. Defaults to a line over time and bars otherwise. */
  type?: ExploreChartType;
  /** Turn bars on their side: the breakdown down the left, the measure along the bottom. Bars on one scale only. */
  swap?: boolean;
  /** Per measure, by pill id. */
  measures?: Record<string, ExploreMeasureStyle>;
}

export interface ExploreState {
  fields: Pill[];
  /** Attributes to break down by, by pill id. The first is the x axis. */
  rows: string[];
  /** An attribute whose values become separate series. */
  split?: string;
  /** Metrics and derived metrics to show, by pill id. */
  values: string[];
  filters: FilterSpec[];
  view?: "chart" | "table";
  /** How the chart draws the shelves. Left out, the chart is chosen from what is on them. */
  chart?: ExploreChartSettings;
}

const CHART_TYPES: readonly string[] = ["bar", "line", "area"];

/** The chart settings with anything that cannot apply left out: unknown types, and measures not on the shelf. */
export function normalizeChartSettings(chart: ExploreChartSettings | undefined, values: string[]): ExploreChartSettings | undefined {
  if (!chart || typeof chart !== "object") return undefined;
  const measures = Object.fromEntries(
    Object.entries(chart.measures ?? {})
      .filter(([id]) => values.includes(id))
      .map(([id, style]): [string, ExploreMeasureStyle] => [
        id,
        {
          ...(style?.type && CHART_TYPES.includes(style.type) ? { type: style.type } : {}),
          ...(style?.axis === "right" ? { axis: "right" as const } : {}),
        },
      ])
      .filter(([, style]) => Object.keys(style).length > 0),
  );
  const out: ExploreChartSettings = {
    ...(chart.type && CHART_TYPES.includes(chart.type) ? { type: chart.type } : {}),
    ...(chart.swap ? { swap: true } : {}),
    ...(Object.keys(measures).length > 0 ? { measures } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A measure's style on the chart, changed; an empty style clears it. */
export function setMeasureStyle(state: ExploreState, id: string, style: ExploreMeasureStyle): ExploreState {
  const measures = { ...(state.chart?.measures ?? {}), [id]: { ...(state.chart?.measures?.[id] ?? {}), ...style } };
  return { ...state, chart: normalizeChartSettings({ ...state.chart, measures }, state.values) };
}

/** The chart settings changed: its type, or whether it is turned on its side. */
export function setChartSettings(state: ExploreState, change: Omit<ExploreChartSettings, "measures">): ExploreState {
  return { ...state, chart: normalizeChartSettings({ ...state.chart, ...change }, state.values) };
}

export const emptyExplore: ExploreState = { fields: [], rows: [], values: [], filters: [] };

const ID = /^[A-Za-z][A-Za-z0-9_]*$/;
const MONEY = /(amount|price|cost|revenue|sales|total|refund|paid|charge|fee|balance|margin|spend|value)/i;
const KEY = /(^id$|_id$|_key$|_no$|_number$|^sku$|code$)/i;
/**
 * A number whose name says it adds up: money taken or spent, a count, a
 * quantity, time spent, energy used. Any other number is read as a reading
 * (a temperature, a speed, a price, a score, a level, a 0 or 1), which is
 * averaged: summing a reading over many rows gives a number nobody means.
 */
const ADDS_UP = /(amount|cost|revenue|sales|total|refund|paid|charge|fee|spend|income|profit|count|qty|quantity|units|orders|items|hours|minutes|seconds|days|kwh|mwh|energy|volume|clicks|views|visits|sessions|downloads|bytes|calls|tickets|^n_|^num_)/i;

/** A pill id from a label, unlike any already taken: "Refund rate" becomes refund_rate. */
export function pillId(label: string, taken: Iterable<string> = []): string {
  const have = new Set(taken);
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "n$1")
      .slice(0, 40) || "field";
  let id = base;
  for (let n = 2; have.has(id); n++) id = `${base}_${n}`;
  return id;
}

const words = (column: string) => column.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * Pills generated from a query's columns: text, true/false and dates become
 * attributes (a date by month), numbers become metrics (summed when their
 * name says they add up, averaged otherwise), and a
 * column that names things (an id, a code) becomes an attribute with a
 * count of its distinct values. There is always a count of rows. This is a
 * reading of names and types only; nothing is looked up in the data.
 */
export function pillsFromFields(fields: Pick<Field, "name" | "type">[], by = "the columns"): Pill[] {
  const pills: Pill[] = [];
  const taken = () => pills.map((p) => p.id);
  for (const field of fields) {
    const { name, type } = field;
    if (DataType.isList(type) || DataType.isStruct(type) || DataType.isMap(type) || DataType.isBinary(type)) continue;
    if (DataType.isTimestamp(type) || DataType.isDate(type)) {
      pills.push({ id: pillId(name, taken()), kind: "attribute", label: `${words(name)} (month)`, column: name, grain: "month", by });
    } else if (isNumeric(type) && !KEY.test(name)) {
      const sums = ADDS_UP.test(name);
      pills.push({ id: pillId(name, taken()), kind: "metric", label: sums ? words(name) : `Average ${words(name).toLowerCase()}`, column: name, aggregate: sums ? "sum" : "avg", format: MONEY.test(name) ? "currency" : sums ? "compact" : "number", by });
    } else {
      pills.push({ id: pillId(name, taken()), kind: "attribute", label: words(name), column: name, by });
      if (KEY.test(name)) pills.push({ id: pillId(`${name}_count`, taken()), kind: "metric", label: `Distinct ${words(name).toLowerCase()}`, column: name, aggregate: "count_distinct", format: "compact", by });
    }
  }
  pills.push({ id: pillId("rows", taken()), kind: "metric", label: "Rows", aggregate: "count", format: "compact", by });
  return pills;
}

/**
 * Calculations worth offering from the metrics there are: each summed
 * metric per row (an average that follows the filters), a margin when there
 * is something sold and something it cost, and one money metric as a share
 * of another. They are suggestions from names, labelled as such, and a
 * person keeps, edits or removes them.
 */
export function suggestDerived(pills: Pill[], by = "suggested from the columns"): Pill[] {
  const out: Pill[] = [];
  const taken = () => [...pills, ...out].map((p) => p.id);
  const has = (expression: string) => [...pills, ...out].some((p) => p.kind === "derived" && p.expression?.replace(/\s+/g, "") === expression.replace(/\s+/g, ""));
  const add = (label: string, expression: string, format: PillFormat, description: string) => {
    if (!has(expression)) out.push({ id: pillId(label, taken()), kind: "derived", label, expression, format, description, by });
  };
  const sums = pills.filter((p) => p.kind === "metric" && p.aggregate === "sum");
  const rows = pills.find((p) => p.kind === "metric" && p.aggregate === "count" && !p.column);
  if (rows) for (const metric of sums.slice(0, 3)) add(`${metric.label} per row`, `${metric.id} / ${rows.id}`, metric.format === "currency" ? "currency" : "number", `${metric.label} divided by the number of rows.`);
  const sold = sums.find((p) => /(revenue|sales|amount|price|total)/i.test(p.column ?? ""));
  const cost = sums.find((p) => /cost/i.test(p.column ?? ""));
  if (sold && cost && sold !== cost) add("Margin", `(${sold.id} - ${cost.id}) / ${sold.id}`, "percent", `What is left of ${sold.label.toLowerCase()} after ${cost.label.toLowerCase()}, as a share.`);
  const money = sums.filter((p) => p.format === "currency");
  const part = money.find((p) => /(refund|discount|fee|tax|return)/i.test(p.column ?? ""));
  const whole = money.find((p) => p !== part && /(revenue|sales|amount|total|price)/i.test(p.column ?? ""));
  if (part && whole) add(`${part.label} share of ${whole.label.toLowerCase()}`, `${part.id} / ${whole.id}`, "percent", `${part.label} divided by ${whole.label.toLowerCase()}.`);
  return out;
}

/** Why a pill cannot be used, or undefined when it can. `columns`, when given, are the query's own. */
export function pillProblem(pill: Pill, all: Pill[], columns?: string[]): string | undefined {
  if (!ID.test(pill.id)) return "Its name in calculations must start with a letter and use only letters, digits and underscores.";
  if (all.filter((p) => p.id === pill.id).length > 1) return `Another field is already called "${pill.id}".`;
  if (!pill.label.trim()) return "It needs a label.";
  const known = (column: string | undefined) => !columns || (column !== undefined && columns.includes(column));
  if (pill.kind === "attribute") return !pill.column ? "An attribute needs a column." : known(pill.column) ? undefined : `There is no column "${pill.column}" in this query.`;
  if (pill.kind === "metric") {
    if (!pill.aggregate) return "A metric needs a way to summarise: sum, average, count.";
    if (!pill.column) return pill.aggregate === "count" ? undefined : "Only a count can do without a column.";
    return known(pill.column) ? undefined : `There is no column "${pill.column}" in this query.`;
  }
  // A calculation is over metrics only, so one can never depend on itself.
  return measureExpressionProblem(pill.expression ?? "", all.filter((p) => p.kind === "metric").map((p) => p.id));
}

/** The state with anything that cannot be drawn taken off the shelves: ids that are not fields, an attribute among the values. */
export function normalizeExplore(state: ExploreState): ExploreState {
  const kind = new Map(state.fields.map((p) => [p.id, p.kind]));
  const rows = [...new Set(state.rows)].filter((id) => kind.get(id) === "attribute").slice(0, 3);
  const split = state.split && kind.get(state.split) === "attribute" && !rows.includes(state.split) ? state.split : undefined;
  const values = [...new Set(state.values)].filter((id) => kind.get(id) === "metric" || kind.get(id) === "derived").slice(0, 6);
  const chart = normalizeChartSettings(state.chart, values);
  return { fields: state.fields, rows, ...(split ? { split } : {}), values, filters: state.filters, ...(state.view ? { view: state.view } : {}), ...(chart ? { chart } : {}) };
}

/** Where a pill goes when it is simply chosen: an attribute breaks the view down, a metric is measured. */
export function addToShelf(state: ExploreState, id: string, shelf?: "rows" | "split" | "values", at?: number): ExploreState {
  const pill = state.fields.find((p) => p.id === id);
  if (!pill) return state;
  const target = shelf ?? (pill.kind === "attribute" ? "rows" : "values");
  // At a place among the others (counted without this pill), or at the end.
  const insert = (list: string[]) => {
    const others = list.filter((item) => item !== id);
    const place = at === undefined ? others.length : Math.max(0, Math.min(others.length, at));
    return [...others.slice(0, place), id, ...others.slice(place)];
  };
  if (target === "split") return normalizeExplore({ ...state, rows: state.rows.filter((r) => r !== id), split: id });
  if (target === "rows") return normalizeExplore({ ...state, rows: insert(state.rows), ...(state.split === id ? { split: undefined } : {}) });
  return normalizeExplore({ ...state, values: insert(state.values) });
}

/** A pill moved one place earlier (-1) or later (1) on its shelf: the first breakdown is the x axis, the first measure the first series. At an end, nothing changes. */
export function movePill(state: ExploreState, id: string, by: -1 | 1): ExploreState {
  const shelf = state.rows.includes(id) ? "rows" : state.values.includes(id) ? "values" : undefined;
  if (!shelf) return state;
  const from = state[shelf].indexOf(id);
  const to = from + by;
  if (to < 0 || to >= state[shelf].length) return state;
  return addToShelf(state, id, shelf, to);
}

export function removeFromShelf(state: ExploreState, id: string, shelf: "rows" | "split" | "values"): ExploreState {
  if (shelf === "split") return { ...state, split: undefined };
  return { ...state, [shelf]: state[shelf].filter((item) => item !== id) };
}

/** A pill changed, added (when its id is new) or, with `undefined`, removed, along with what that does to the shelves and to calculations that named it. */
export function setPill(state: ExploreState, id: string, next: Pill | undefined): ExploreState {
  const exists = state.fields.some((p) => p.id === id);
  let fields = next ? (exists ? state.fields.map((p) => (p.id === id ? next : p)) : [...state.fields, next]) : state.fields.filter((p) => p.id !== id);
  const renamed = next && next.id !== id ? next.id : undefined;
  if (renamed) {
    // Calculations follow a rename.
    fields = fields.map((p) => (p.kind === "derived" && p.expression ? { ...p, expression: p.expression.replace(new RegExp(`\\b${id}\\b`, "g"), renamed) } : p));
  }
  const swap = (item: string) => (item === id ? renamed : item);
  const keep = (list: string[]) => list.map((item) => (item === id ? (next ? (renamed ?? id) : undefined) : item)).filter((item): item is string => item !== undefined);
  return normalizeExplore({ ...state, fields, rows: keep(state.rows), values: keep(state.values), split: state.split === id ? (next ? (swap(id) ?? id) : undefined) : state.split });
}

const pillOf = (state: ExploreState, id: string) => state.fields.find((p) => p.id === id);

/** The metrics a set of values needs summarised: the metrics themselves and those their calculations name. */
function metricsNeeded(state: ExploreState): Pill[] {
  const ids: string[] = [];
  for (const id of state.values) {
    const pill = pillOf(state, id);
    if (pill?.kind === "metric") ids.push(id);
    if (pill?.kind === "derived") {
      try {
        ids.push(...measureNames(parseMeasureExpression(pill.expression ?? "")));
      } catch {
        // Reported where the pill is shown.
      }
    }
  }
  return [...new Set(ids)].map((id) => pillOf(state, id)).filter((p): p is Pill => p?.kind === "metric");
}

/**
 * The query for the table of what is on the shelves: one row per
 * combination of the attributes, a column per metric and calculation, all
 * worked out by the engine. Sorted by time when the first attribute is a
 * date, by the first value otherwise, so a row limit keeps the largest.
 */
export function exploreQuery(state: ExploreState, sql: string, limit = 200, now?: Date): MessageInitShape<typeof ViewQuerySchema> {
  const attributes = [...state.rows, ...(state.split ? [state.split] : [])].map((id) => pillOf(state, id)).filter((p): p is Pill => p?.kind === "attribute");
  const plain = attributes.filter((p) => !p.grain);
  const timed = attributes.filter((p) => p.grain);
  const derived = state.values.map((id) => pillOf(state, id)).filter((p): p is Pill => p?.kind === "derived");
  const first = attributes[0];
  return {
    baseSql: sql,
    filters: filtersFromSpec(state.filters, now),
    groupBy: plain.map((p) => p.column!),
    buckets: timed.map((p) => ({ column: p.column!, alias: p.id, by: { case: "grain" as const, value: TIME_GRAINS[p.grain!] } })),
    aggregates: metricsNeeded(state).map((p) => ({ function: AGGREGATE_FUNCTIONS[p.aggregate ?? "count"], column: p.column ?? "", alias: p.id })),
    derived: derived.map((p) => ({ alias: p.id, expression: p.expression ?? "" })),
    sorts: first?.grain ? [{ column: first.id, direction: SortDirection.ASC }] : state.values[0] ? [{ column: state.values[0], direction: SortDirection.DESC }] : [],
    page: { limit },
  };
}

/** The name a pill's values come back under in `exploreQuery`'s result. */
export const pillColumn = (pill: Pill): string => (pill.kind === "attribute" && !pill.grain ? pill.column! : pill.id);

export interface ExploreChart {
  type: ChartType;
  x: string;
  xGrain?: ChartGrain;
  splitBy?: string;
  y: ChartMeasure[];
  xTitle: string;
  /** The measures on each scale, named, when there are two scales. */
  yTitle?: string;
  yRightTitle?: string;
  /** The left scale's format, when its measures share one: the axis writes it. */
  yFormat?: PillFormat;
  /** Bars on their side. Set only when the settings ask for it and the chart is bars on one scale. */
  horizontal?: boolean;
}

/** Why the bars cannot be turned on their side now, or undefined when they can. */
export function swapProblem(state: ExploreState): string | undefined {
  const chart = exploreChart({ ...state, chart: { ...state.chart, swap: false } });
  if (!chart) return "There is no chart to turn yet.";
  if (!canTurnSideways(chart.type, chart.y)) return "Only bars on one scale can be turned on their side.";
  return undefined;
}

/**
 * The chart for what is on the shelves, or undefined when there is nothing
 * to draw one from (no attribute, or no value). A date is a line over time;
 * categories are bars, largest first. A second attribute, or the split,
 * becomes the series when one value is shown.
 */
export function exploreChart(state: ExploreState): ExploreChart | undefined {
  const rows = state.rows.map((id) => pillOf(state, id)).filter((p): p is Pill => p?.kind === "attribute");
  const values = state.values.map((id) => pillOf(state, id)).filter((p): p is Pill => !!p && p.kind !== "attribute");
  const x = rows[0];
  if (!x || values.length === 0) return undefined;
  const split = (state.split ? pillOf(state, state.split) : rows[1]) ?? undefined;
  const type: ExploreChartType = state.chart?.type ?? (x.grain ? "line" : "bar");
  // A second scale needs a measure on each; all of them on the right is one scale, drawn on the left.
  const right = new Set(values.filter((p) => state.chart?.measures?.[p.id]?.axis === "right").map((p) => p.id));
  if (right.size === values.length) right.clear();
  const style = (pill: Pill): Pick<ChartMeasure, "type" | "axis"> => {
    const own = state.chart?.measures?.[pill.id]?.type;
    return { ...(own && own !== type ? { type: own } : {}), ...(right.has(pill.id) ? { axis: "right" as const } : {}) };
  };
  const y = values.map((pill): ChartMeasure => {
    if (pill.kind === "metric") return { ...(pill.column ? { column: pill.column } : {}), aggregate: pill.aggregate ?? "count", label: pill.label, ...style(pill) };
    let names: string[] = [];
    try {
      names = measureNames(parseMeasureExpression(pill.expression ?? ""));
    } catch {
      // The chart reports a calculation it cannot read.
    }
    const terms = Object.fromEntries(
      names
        .map((name) => pillOf(state, name))
        .filter((p): p is Pill => p?.kind === "metric")
        .map((p) => [p.id, { ...(p.column ? { column: p.column } : {}), aggregate: p.aggregate ?? ("count" as const) }]),
    );
    return { expression: pill.expression ?? "", terms, label: pill.label, ...style(pill) };
  });
  const left = values.filter((p) => !right.has(p.id));
  const onRight = values.filter((p) => right.has(p.id));
  const sideways = !!state.chart?.swap && canTurnSideways(type, y);
  return {
    type,
    x: x.column!,
    ...(x.grain ? { xGrain: x.grain } : {}),
    // Series come from one place: a split when one value is shown, the values themselves otherwise.
    ...(split?.column && !split.grain && values.length === 1 ? { splitBy: split.column } : {}),
    y,
    xTitle: x.label,
    // With two scales each is named, so a reader knows which line is read against which.
    ...(onRight.length > 0 ? { yTitle: left.map((p) => p.label).join(", "), yRightTitle: onRight.map((p) => p.label).join(", ") } : {}),
    // An axis writes one format; measures in different ones keep plain numbers.
    ...(left[0]?.format && left.every((p) => p.format === left[0]!.format) ? { yFormat: left[0].format } : {}),
    ...(sideways ? { horizontal: true } : {}),
  };
}

/** A number as a pill's format writes it. */
export function pillNumber(value: unknown, format: PillFormat | undefined): string {
  if (value == null) return "–";
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (format === "percent") return numberFormat({ style: "percent", maximumFractionDigits: 1 }).format(n);
  if (format === "currency") return numberFormat({ style: "currency", currency: "USD", notation: Math.abs(n) >= 100_000 ? "compact" : "standard", maximumFractionDigits: Math.abs(n) >= 100_000 ? 1 : 2 }).format(n);
  if (format === "compact") return numberFormat({ notation: "compact", maximumFractionDigits: 1 }).format(n);
  return numberFormat({ maximumFractionDigits: 2 }).format(n);
}

/**
 * A first view to start from, so there is something drawn before anyone
 * presses a pill: the first category (not an id, not a date) broken down
 * by the first measure (not a count of ids). A date stands in when there is
 * no category, and a count of rows when there is no measure.
 */
export function suggestedView(fields: Pill[]): Pick<ExploreState, "rows" | "values"> {
  const attributes = fields.filter((p) => p.kind === "attribute");
  const by = attributes.find((p) => !p.grain && !KEY.test(p.column ?? "")) ?? attributes.find((p) => p.grain);
  const metrics = fields.filter((p) => p.kind === "metric");
  const measure = metrics.find((p) => p.column && p.aggregate !== "count_distinct") ?? metrics.find((p) => !p.column) ?? metrics[0];
  return by && measure ? { rows: [by.id], values: [measure.id] } : { rows: [], values: [] };
}
