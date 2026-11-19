import { DataType, type Field } from "apache-arrow";
import { numberFormat } from "../locale/locale.js";

export type ChartType = "bar" | "line" | "area" | "scatter" | "pie";
/** How one series is drawn. A chart whose series differ is a compound chart. */
export type SeriesType = Exclude<ChartType, "pie">;
export type LegendPlacement = "top" | "bottom" | "right" | "none";

export interface ChartSpecSeries {
  /** Output column holding the values. */
  column: string;
  /** Name shown in the legend and tooltip. */
  label: string;
  /** Draw this series as something other than the chart's type, e.g. a line over bars. */
  type?: SeriesType;
  /** The y axis this series is measured on. Defaults to "left". */
  axis?: "left" | "right";
  /** Series with the same stack name are stacked on each other. */
  stack?: string;
  /** Draw this series in this colour instead of the next one in the theme's order. */
  color?: string;
}

export interface ChartOptionInput {
  type: ChartType;
  /** Column for the x axis (or the slice names of a pie). */
  x: string;
  series: ChartSpecSeries[];
  /** Column whose distinct values split each measure into separate series. */
  splitBy?: string;
  fields: Field[];
  /** Rows as plain chart values, keyed by column. */
  rows: Record<string, string | number | null>[];
  /** Where the legend goes. Defaults to "top" when there is more than one series, otherwise "none". */
  legend?: LegendPlacement;
  /** Stack every series that has no stack name of its own. */
  stacked?: boolean;
  /** Colours for particular values of the split column, by value. */
  splitColors?: Record<string, string>;
  /** Axis titles. */
  xTitle?: string;
  yTitle?: string;
  yRightTitle?: string;
  /** How the left axis writes its numbers. Changes the labels only, never the values. */
  yFormat?: AxisFormat;
  /**
   * "value" puts categories in order of size, largest first, unless x is a
   * date or number, whose own order is kept. "x" keeps the rows as given.
   */
  sort?: "value" | "x";
  /**
   * Bars run across instead of up: the categories go down the left side,
   * largest at the top, and the values along the bottom. Applies only when
   * every series is a bar on one scale; otherwise it is ignored.
   */
  horizontal?: boolean;
}

/** True when a chart of this shape can be turned on its side: bars only, on one scale. */
export function canTurnSideways(type: ChartType, series: { type?: SeriesType; axis?: "left" | "right" }[]): boolean {
  return series.length > 0 && series.every((s) => (s.type ?? type) === "bar" && s.axis !== "right");
}

/** True when a column's values have an order of their own: dates, times and numbers. */
export function isOrdered(field: Field | undefined): boolean {
  if (!field) return false;
  return DataType.isTimestamp(field.type) || DataType.isDate(field.type) || DataType.isInt(field.type) || DataType.isFloat(field.type) || DataType.isDecimal(field.type);
}

/**
 * The order categories are drawn in when sorted by size: by the total of the
 * first measure across every series, largest first. Sorting by the total
 * keeps a stacked or grouped chart in one order for all its series.
 */
export function categoriesBySize(rows: Record<string, string | number | null>[], x: string, measure: string): string[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[x] ?? "null");
    totals.set(key, (totals.get(key) ?? 0) + (Number(row[measure]) || 0));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

type AxisType = "category" | "time" | "value";

function axisType(field: Field | undefined, scatter: boolean): AxisType {
  if (!field) return "category";
  if (DataType.isTimestamp(field.type) || DataType.isDate(field.type)) return "time";
  const numeric = DataType.isInt(field.type) || DataType.isFloat(field.type) || DataType.isDecimal(field.type);
  return numeric && scatter ? "value" : "category";
}

const compact = () => numberFormat({ notation: "compact", maximumFractionDigits: 1 });
const fraction = () => numberFormat({ maximumSignificantDigits: 2 });
/** A number on an axis: 12K, 1.5M, and for a value under one enough digits to tell the ticks apart (0.02, not 0). */
export const axisNumber = (value: number) => (value !== 0 && Math.abs(value) < 1 ? fraction().format(value) : compact().format(value));

export type AxisFormat = "number" | "compact" | "currency" | "percent";
const percent = () => numberFormat({ style: "percent", maximumSignificantDigits: 2 });
const money = () => numberFormat({ style: "currency", currency: "USD", notation: "compact", maximumSignificantDigits: 3 });
/** A number on an axis in a measure's own format: 6% rather than 0.06, $1.2M rather than 1.2M. */
export const axisFormatter = (format: AxisFormat | undefined): ((value: number) => string) =>
  format === "percent" ? (value) => percent().format(value) : format === "currency" ? (value) => money().format(value) : axisNumber;

const exactPercent = () => numberFormat({ style: "percent", maximumFractionDigits: 1 });
const exactMoney = () => numberFormat({ style: "currency", currency: "USD", maximumFractionDigits: 2 });
const exact = () => numberFormat({ maximumFractionDigits: 2 });
/**
 * A value in a tooltip, where a person reads one number closely: in full rather than compact, rounded to what can be
 * told apart (6.1%, $1,234.50, 1,234.57, 0.0123), in the measure's own format. Changes the text only, never the value.
 */
export const tooltipFormatter =
  (format: AxisFormat | undefined) =>
  (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (value == null || value === "" || !Number.isFinite(n)) return value == null ? "–" : String(value);
    if (format === "percent") return exactPercent().format(n);
    if (format === "currency") return exactMoney().format(n);
    return n !== 0 && Math.abs(n) < 1 ? fraction().format(n) : exact().format(n);
  };

function legendOption(placement: LegendPlacement): Record<string, unknown> {
  if (placement === "none") return { show: false };
  if (placement === "right") return { type: "scroll", orient: "vertical", right: 0, top: "middle" };
  return { type: "scroll", [placement]: 0 };
}

/**
 * True when the last points of every series are far enough apart for a label
 * at each end to be read. Lines that finish close together keep the legend.
 */
function endsApart(series: Record<string, unknown>[], dataset: unknown, rows: Record<string, string | number | null>[]): boolean {
  const sets = Array.isArray(dataset) ? (dataset as { source?: Record<string, string | number | null>[] }[]) : undefined;
  const ends: number[] = [];
  let low = Infinity;
  let high = -Infinity;
  for (const item of series) {
    const column = (item.encode as { y: string }).y;
    const source = sets ? (sets[item.datasetIndex as number]?.source ?? []) : rows;
    const values = source.map((row) => Number(row[column])).filter((v) => Number.isFinite(v));
    if (values.length === 0) return false;
    ends.push(values.at(-1)!);
    low = Math.min(low, ...values);
    high = Math.max(high, ...values);
  }
  const room = (high - Math.min(low, 0)) * 0.08;
  const sorted = [...ends].sort((a, b) => a - b);
  return sorted.every((value, i) => i === 0 || value - sorted[i - 1]! >= room);
}

/**
 * Builds an ECharts option from query rows. Pure, so it can be tested and
 * reused on a server or by an agent. Colours and fonts come from the theme
 * passed to `echarts.init`, not from here.
 */
export function buildChartOption(input: ChartOptionInput): Record<string, unknown> {
  const { type, x, splitBy } = input;
  const xField = input.fields.find((f) => f.name === x);
  // A date or number axis is drawn in its own order, whatever order the rows arrived in.
  const byX = type !== "pie" && isOrdered(xField) && input.sort === "value";
  // A missing category is drawn under its own name rather than dropped from the axis.
  const named = type !== "pie" && input.sort === "value" && !isOrdered(xField) ? input.rows.map((row) => (row[x] == null ? { ...row, [x]: "null" } : row)) : input.rows;
  const rows = byX ? [...input.rows].sort((a, b) => (typeof a[x] === "number" && typeof b[x] === "number" ? a[x] - b[x] : String(a[x]).localeCompare(String(b[x])))) : named;

  if (type === "pie") {
    const measure = input.series[0];
    return {
      tooltip: { trigger: "item", valueFormatter: tooltipFormatter(input.yFormat) },
      legend: legendOption(input.legend ?? "bottom"),
      series: [
        {
          type: "pie",
          name: measure?.label ?? "",
          radius: ["45%", "72%"],
          center: ["50%", "45%"],
          label: { show: rows.length <= 8 },
          data: measure ? rows.map((row) => ({ name: String(row[x] ?? "null"), value: row[measure.column] })) : [],
        },
      ],
    };
  }

  const kinds = input.series.map((s) => s.type ?? type);
  const xType = axisType(xField, kinds.every((k) => k === "scatter"));
  const sideways = !!input.horizontal && canTurnSideways(type, input.series);
  // On its side, the category axis is the vertical one and the value axis the horizontal one.
  const at = (category: string, value: string) => (sideways ? { x: value, y: category } : { x: category, y: value });
  const large = rows.length > 2000 ? { large: true, sampling: "lttb", showSymbol: false } : {};
  const hasRight = input.series.some((s) => s.axis === "right");
  const shape = (measure: ChartSpecSeries): Record<string, unknown> => {
    const kind = measure.type ?? type;
    const stack = measure.stack ?? (input.stacked && kind !== "scatter" ? `stack-${measure.axis ?? "left"}-${kind}` : undefined);
    return {
      type: kind === "area" ? "line" : kind,
      ...(kind === "area" ? { areaStyle: { opacity: 0.18 }, showSymbol: false } : {}),
      ...(stack ? { stack } : {}),
      ...(hasRight ? { yAxisIndex: measure.axis === "right" ? 1 : 0 } : {}),
      tooltip: { valueFormatter: tooltipFormatter(measure.axis === "right" ? undefined : input.yFormat) },
      ...large,
    };
  };
  const painted = (color: string | undefined) => (color ? { itemStyle: { color }, lineStyle: { color } } : {});

  let series: Record<string, unknown>[];
  let dataset: Record<string, unknown> | Record<string, unknown>[];
  if (splitBy) {
    // One dataset per distinct value of the split column, one series per (value, measure).
    const groups = new Map<string, Record<string, string | number | null>[]>();
    for (const row of rows) {
      const key = String(row[splitBy] ?? "null");
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    const keys = [...groups.keys()];
    dataset = keys.map((key) => ({ source: groups.get(key) }));
    series = keys.flatMap((key, datasetIndex) =>
      input.series.map((measure) => ({
        ...shape(measure),
        ...painted(input.splitColors?.[key]),
        name: input.series.length > 1 ? `${key} · ${measure.label}` : key,
        datasetIndex,
        encode: at(x, measure.column),
      })),
    );
  } else {
    dataset = { source: rows };
    series = input.series.map((measure) => ({ ...shape(measure), ...painted(measure.color), name: measure.label, encode: at(x, measure.column) }));
  }

  // Up to four lines are named at their ends, where the eye already is, instead of in a legend.
  const direct =
    input.legend === undefined && series.length >= 2 && series.length <= 4 && kinds.every((k) => k === "line") && !input.stacked && !hasRight && endsApart(series, dataset, rows);
  if (direct) series = series.map((s) => ({ ...s, endLabel: { show: true, formatter: "{a}", distance: 6 }, labelLayout: { moveOverlap: "shiftY" } }));
  const legend = input.legend ?? (direct ? "none" : series.length > 1 ? "top" : "none");
  const categories = input.sort === "value" && !isOrdered(xField) && input.series[0] ? categoriesBySize(rows, x, input.series[0].column) : undefined;
  // A zoom bar earns its space only when there are too many points to read at once.
  const zoom = new Set(rows.map((row) => row[x])).size > 60;
  const valueAxis = (name: string | undefined, right: boolean) => ({
    type: "value",
    name,
    nameLocation: "middle",
    nameGap: 48,
    position: right ? "right" : "left",
    // A second axis has its own scale, so its grid lines would not line up with the first.
    splitLine: { show: !right },
    axisLabel: { formatter: right ? axisNumber : axisFormatter(input.yFormat) },
  });
  return {
    // Times come from the engine in UTC (a month bucket is midnight UTC on the 1st). Drawn in the
    // viewer's own zone they would land on the last day of the month before.
    useUTC: true,
    dataset,
    grid: {
      left: !sideways && input.yTitle ? 28 : 8,
      right: legend === "right" ? 140 : direct ? 96 : input.yRightTitle ? 36 : 16,
      top: (legend === "top" ? 36 : 16) + (sideways && input.xTitle ? 16 : 0),
      bottom: (zoom && !sideways ? 40 : 8) + (legend === "bottom" ? 28 : 0) + ((sideways ? input.yTitle : input.xTitle) ? 20 : 0),
      containLabel: true,
    },
    tooltip: { trigger: kinds.every((k) => k === "scatter") ? "item" : "axis" },
    legend: legendOption(legend),
    ...(sideways
      ? {
          // The largest bar at the top, where reading starts; the values along the bottom from zero.
          yAxis: { type: xType, ...(xType === "category" && categories ? { data: categories } : {}), inverse: true, name: input.xTitle, nameLocation: "start", nameGap: 8, axisLabel: { hideOverlap: true, ...(xType === "category" ? { interval: 0 } : {}) } },
          xAxis: { ...valueAxis(input.yTitle, false), position: "bottom", nameGap: 28 },
        }
      : {
          xAxis: {
            type: xType,
            ...(xType === "category" && categories ? { data: categories } : {}),
            name: input.xTitle ?? (xType === "value" ? x : undefined),
            nameLocation: "middle",
            nameGap: 28,
            // A category axis tries every label (ECharts otherwise skips some on a guess) and hides only those that collide.
            axisLabel: { hideOverlap: true, ...(xType === "category" ? { interval: 0 } : {}) },
          },
          yAxis: hasRight ? [valueAxis(input.yTitle, false), valueAxis(input.yRightTitle, true)] : valueAxis(input.yTitle, false),
        }),
    dataZoom: !zoom ? [] : sideways ? [{ type: "inside", yAxisIndex: 0 }, { type: "slider", yAxisIndex: 0, width: 18, right: 8 }] : [{ type: "inside" }, { type: "slider", height: 18, bottom: legend === "bottom" ? 32 : 8 }],
    series,
  };
}

/** A round bin width that splits [min, max] into about `bins` bins. */
export function niceBinWidth(min: number, max: number, bins: number): number {
  const span = max - min;
  if (!(span > 0) || !(bins > 0)) return 1;
  const rough = span / bins;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= rough) ?? 10;
  return step * power;
}
