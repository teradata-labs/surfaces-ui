import { type DataSource, collect, parseMeasureExpression, writeMeasure } from "@surfaces-ui/data";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type { DataType } from "apache-arrow";
import { AggregateFunction, SortDirection, TimeGrain, type ViewQuerySchema } from "@surfaces-ui/proto";
import { defaultTheme, echartsTheme, resolveColors } from "@surfaces-ui/tokens";
import { BarChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { DataMessages } from "../data/messages.js";
import { chartValue, numericValue } from "../data/format.js";
import { label as text, numberFormat } from "../locale/locale.js";
import { type FilterInit, type TimeTravelInit, type ValueInit, messageOf } from "../data/useRowWindow.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";
import { type ChartShape, chartAdvice } from "./advice.js";
import { wheelScrollsThePage } from "./wheel.js";
import { type AxisFormat, type ChartOptionInput, type ChartType, type LegendPlacement, type SeriesType, buildChartOption, isOrdered, niceBinWidth, rowsWithoutX } from "./option.js";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartAggregate =
  | "sum"
  | "avg"
  | "count"
  | "count_distinct"
  | "min"
  | "max"
  | "median"
  | "stddev"
  | "variance"
  | "percentile";

export type ChartGrain = "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface ChartMeasure {
  /** Column to plot. Optional only for `count`, which then counts rows. */
  column?: string;
  /**
   * Summarise the column per x value in the engine. Without it the chart
   * plots raw rows: all of them when the result is small, otherwise a random
   * sample.
   */
  aggregate?: ChartAggregate;
  /** For `percentile`: a fraction from 0 to 1. Defaults to 0.9. */
  percentile?: number;
  /**
   * A calculation instead of a column: arithmetic over the measures named in
   * `terms`, such as `refunded / revenue`. The engine works it out after
   * summarising, so it is right for any number of rows and can be sorted by.
   */
  expression?: string;
  /** The measures an `expression` names, by the name it uses for them. */
  terms?: Record<string, { column?: string; aggregate: ChartAggregate; percentile?: number }>;
  /** Name for the legend. Defaults to e.g. "sum of amount". */
  label?: string;
  /** Draw this series differently from the chart's `type`, e.g. a line over bars. */
  type?: SeriesType;
  /** The y axis this series is measured on. Use "right" for a measure on another scale. Defaults to "left". */
  axis?: "left" | "right";
  /** Series with the same stack name are stacked on each other. */
  stack?: string;
  /**
   * Which of the theme's series colours to use, counting from 1. Give a
   * measure the same slot wherever it appears and it keeps its colour across
   * charts. Without it, series take the theme's colours in order.
   */
  slot?: number;
}

export interface ChartProps extends DataMessages {
  sourceId: string;
  /** The base SQL. Grouping and aggregation are applied around it by the backend. */
  sql: string;
  /** How series are drawn unless a measure sets its own `type`. */
  type: ChartType;
  /** Column for the x axis, or the slices of a pie. */
  x: string;
  /** Group a date or time x column into buckets of this size, so a time series has one point per bucket. */
  xGrain?: ChartGrain;
  /** Group a numeric x column into bins of this width (a histogram). */
  xBinWidth?: number;
  /** Group a numeric x column into about this many bins; the width is chosen from the column's range. */
  xBins?: number;
  /** One entry per series. */
  y: ChartMeasure[];
  /** Split each measure into one series per distinct value of this column. */
  splitBy?: string;
  /**
   * The theme colour slot for particular values of `splitBy`, by value, e.g.
   * `{ Europe: 1, "Asia Pacific": 2 }`. A value then keeps its colour when a
   * filter removes other values.
   */
  splitSlots?: Record<string, number>;
  /** Stack the series. */
  stacked?: boolean;
  /**
   * The order of bars. "value" (the default for a bar chart over categories)
   * puts the largest first, and with a row limit keeps the largest. "x" keeps
   * the order of the x column. Dates, bins and numbers always keep their own order.
   */
  sort?: "value" | "x";
  /** Show advice when the chart's shape is one that misleads or cannot be read. Defaults to true. */
  advice?: boolean;
  /** Where the legend goes. Defaults to "top" when there is more than one series. */
  legend?: LegendPlacement;
  /** Axis titles. */
  xTitle?: string;
  yTitle?: string;
  yRightTitle?: string;
  /**
   * Turn the bars on their side: categories down the left, largest at the
   * top, values along the bottom. Easier to read with long category names or
   * many of them. Only for bars on one scale; ignored otherwise.
   */
  horizontal?: boolean;
  /** How the left axis writes its numbers: "percent" for a rate (6%, not 0.06), "currency" for money. Labels only; the values are untouched. */
  yFormat?: AxisFormat;
  filters?: FilterInit[];
  parameters?: ValueInit[];
  timeTravel?: TimeTravelInit;
  /** ISO 8601 time of the run this chart belongs to; see `RowWindowQuery.notBefore`. */
  notBefore?: string;
  /** Most points fetched. Defaults to 5,000; the chart says when it was cut off or sampled. */
  limit?: number;
  /** Height in px. Defaults to 320. */
  height?: number;
  /**
   * Called when a point, bar or slice is clicked, with its x value and
   * series name. Use it to filter other views (cross-filtering).
   */
  onPointClick?(point: { x: string | number | null; series: string; value: number | null }): void;
  /** Adjust the generated ECharts option before it is applied. */
  option?(option: Record<string, unknown>): Record<string, unknown>;
  /** Accessible description of what the chart shows. */
  label?: string;
  dataSource?: DataSource;
  className?: string;
}

/** The contract's function for each aggregate name. */
export const AGGREGATE_FUNCTIONS: Record<ChartAggregate, AggregateFunction> = {
  sum: AggregateFunction.SUM,
  avg: AggregateFunction.AVG,
  count: AggregateFunction.COUNT,
  count_distinct: AggregateFunction.COUNT_DISTINCT,
  min: AggregateFunction.MIN,
  max: AggregateFunction.MAX,
  median: AggregateFunction.MEDIAN,
  stddev: AggregateFunction.STDDEV,
  variance: AggregateFunction.VARIANCE,
  percentile: AggregateFunction.PERCENTILE,
};

/** The contract's grain for each grain name. */
export const TIME_GRAINS: Record<ChartGrain, TimeGrain> = {
  minute: TimeGrain.MINUTE,
  hour: TimeGrain.HOUR,
  day: TimeGrain.DAY,
  week: TimeGrain.WEEK,
  month: TimeGrain.MONTH,
  quarter: TimeGrain.QUARTER,
  year: TimeGrain.YEAR,
};

interface Loaded extends Pick<ChartOptionInput, "fields" | "rows"> {
  /** "first": more points existed than the limit. "sample": the rows are a random sample. */
  cut: "first" | "sample" | undefined;
  /** How the categories were ordered, so the drawing and the notes agree with the query. */
  sort: "value" | "x";
}

/** Output column and label for each measure. */
export function measureOutputs(y: ChartMeasure[]): { column: string; label: string; measure: ChartMeasure }[] {
  return y.map((measure, i) => {
    if (measure.expression) return { column: `calc_${i}`, label: measure.label ?? measure.expression, measure };
    if (!measure.aggregate) return { column: measure.column ?? "", label: measure.label ?? measure.column ?? "", measure };
    const subject = measure.column ?? "rows";
    const name =
      measure.aggregate === "percentile" ? `p${Math.round((measure.percentile ?? 0.9) * 100)}` : measure.aggregate.replace("_", " ");
    return {
      column: `${measure.aggregate}_${measure.column ?? "rows"}_${i}`.replace(/\W+/g, "_"),
      label: measure.label ?? (measure.aggregate === "count" && !measure.column ? "count" : `${name} of ${subject}`),
      measure,
    };
  });
}

/** A calculation with each name given a prefix, so its terms are its own. One that cannot be read is sent as it is, and the engine says why. */
function termExpression(expression: string, prefix: string): string {
  try {
    return writeMeasure(parseMeasureExpression(expression), { name: (name) => `${prefix}_${name}`, divide: (left, right) => `(${left} / ${right})` });
  } catch {
    return expression;
  }
}

export type ChartQueryInput = Pick<ChartProps, "sql" | "type" | "x" | "xGrain" | "y" | "splitBy" | "filters" | "parameters" | "sort"> & {
  /** Bin width for a numeric x, already resolved from `xBinWidth` or `xBins`. */
  binWidth?: number;
  limit: number;
};

/** The shape of a loaded chart, in the terms `chartAdvice` checks. Nothing drawn gives no advice. */
export function drawnShape(input: Pick<ChartProps, "type" | "x" | "y" | "stacked"> & Pick<ChartOptionInput, "fields" | "rows"> & { seriesCount: number; binned: boolean }): ChartShape {
  if (input.rows.length === 0) return { type: input.type, categories: 0, series: 0 };
  return {
    type: input.type,
    categories: new Set(input.rows.map((row) => row[input.x])).size,
    series: input.type === "pie" ? 1 : input.seriesCount,
    stacked: input.stacked,
    rightAxis: input.y.some((m) => m.axis === "right"),
    orderedX: input.binned || isOrdered(input.fields.find((f) => f.name === input.x)),
  };
}

/** How a chart's categories are ordered when not told: bars by size, everything else along x. */
export function chartSort(input: Pick<ChartQueryInput, "type" | "xGrain" | "binWidth" | "sort" | "y">): "value" | "x" {
  if (input.xGrain || input.binWidth) return "x";
  return input.sort ?? (input.type === "bar" && input.y.every((m) => (m.type ?? "bar") === "bar") ? "value" : "x");
}

/**
 * The query a chart sends. With aggregated measures the engine groups by x
 * (bucketed by time grain or bin width when asked) and by the split column;
 * otherwise it returns a random sample of raw rows.
 */
export function buildChartQuery(input: ChartQueryInput): MessageInitShape<typeof ViewQuerySchema> {
  const { sql, type, x, y, splitBy, filters, parameters, limit } = input;
  const outputs = measureOutputs(y);
  const aggregated = outputs.filter((o) => o.measure.aggregate || o.measure.expression);
  if (aggregated.length === 0) {
    const columns = [...new Set([x, ...(splitBy ? [splitBy] : []), ...outputs.map((o) => o.column)])];
    return { baseSql: sql, filters, parameters, columns, sample: { rows: limit } };
  }
  const bucket = input.xGrain
    ? { column: x, by: { case: "grain" as const, value: TIME_GRAINS[input.xGrain] } }
    : input.binWidth
      ? { column: x, by: { case: "binWidth" as const, value: input.binWidth } }
      : undefined;
  return {
    baseSql: sql,
    filters,
    parameters,
    groupBy: [...(bucket ? [] : [x]), ...(splitBy ? [splitBy] : [])],
    buckets: bucket ? [bucket] : [],
    aggregates: aggregated.flatMap((o) =>
      o.measure.expression
        ? // A calculation's terms are aggregates of their own, named after the calculation so two calculations cannot collide.
          Object.entries(o.measure.terms ?? {}).map(([name, term]) => ({
            function: AGGREGATE_FUNCTIONS[term.aggregate],
            column: term.column ?? "",
            alias: `${o.column}_${name}`,
            percentile: term.aggregate === "percentile" ? (term.percentile ?? 0.9) : 0,
          }))
        : [
            {
              function: AGGREGATE_FUNCTIONS[o.measure.aggregate!],
              column: o.measure.column ?? "",
              alias: o.column,
              percentile: o.measure.aggregate === "percentile" ? (o.measure.percentile ?? 0.9) : 0,
            },
          ],
    ),
    derived: aggregated.filter((o) => o.measure.expression).map((o) => ({ alias: o.column, expression: termExpression(o.measure.expression!, o.column) })),
    // By size, the engine keeps the largest when the limit cuts the result; a split chart is put in order from its totals afterwards.
    sorts:
      type === "pie" || (chartSort(input) === "value" && !splitBy)
        ? [{ column: aggregated[0]!.column, direction: SortDirection.DESC }]
        : [{ column: x, direction: SortDirection.ASC }],
    page: { limit },
  };
}

/**
 * An ECharts chart bound to a query. With aggregated measures the engine
 * groups the data, so the chart receives one row per point however large the
 * table is. Each measure is a series and can have its own type and y axis,
 * which makes compound charts (bars with a line, two scales). Colours, fonts
 * and radius follow the theme.
 */
/** The columns a range query returns, as Arrow gives them: each column's values and its type. */
interface RangeTable {
  schema: { fields: { name: string; type: DataType }[] };
  getChild(name: string): { get(index: number): unknown } | null;
}

/**
 * The bin width for `bins` bins over the lowest and highest values the engine
 * found (`lo` and `hi`). Read with the column's type: a DECIMAL arrives as its
 * digits without the point, and read as a plain number it widens the range a
 * hundredfold or more, putting every value in one bin.
 */
export function rangeBinWidth(table: RangeTable, bins: number): number {
  const read = (name: string) => {
    const field = table.schema.fields.find((f) => f.name === name);
    const value = table.getChild(name)?.get(0);
    return field ? numericValue(value, field.type) : null;
  };
  const lo = read("lo");
  const hi = read("hi");
  return lo === null || hi === null ? 1 : niceBinWidth(lo, hi, bins);
}

export function Chart(props: ChartProps) {
  const { sourceId, sql, type, x, xGrain, xBinWidth, xBins, y, splitBy, filters, parameters, timeTravel, notBefore, limit = 5000, height = 320 } = props;
  const dataSource = useDataSource(props.dataSource);
  const theme = useOptionalTheme();
  const element = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ loaded?: Loaded; error?: string; loading: boolean }>({ loading: true });

  const outputs = useMemo(() => measureOutputs(y), [JSON.stringify(y)]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify([sourceId, sql, type, x, xGrain, xBinWidth, xBins, y, splitBy, filters, parameters, timeTravel, notBefore, limit, props.sort], (_, v) =>
    typeof v === "bigint" ? `${v}n` : v,
  );

  useEffect(() => {
    const controller = new AbortController();
    const call = { signal: controller.signal };
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    const aggregated = outputs.some((o) => o.measure.aggregate || o.measure.expression);
    const load = async (): Promise<Loaded> => {
      let binWidth = xGrain ? undefined : xBinWidth;
      if (aggregated && !xGrain && !binWidth && xBins) {
        // The bin width comes from the column's range, which the engine works out.
        const range = await collect(
          dataSource.execute(
            {
              sourceId,
              timeTravel,
              notBefore,
              query: {
                baseSql: sql,
                filters,
                parameters,
                aggregates: [
                  { function: AggregateFunction.MIN, column: x, alias: "lo" },
                  { function: AggregateFunction.MAX, column: x, alias: "hi" },
                ],
              },
            },
            call,
          ),
        );
        binWidth = rangeBinWidth(range.table, xBins);
      }
      const sort = chartSort({ type, xGrain, binWidth, sort: props.sort, y });
      const query = buildChartQuery({ sql, type, x, xGrain, binWidth, y, splitBy, filters, parameters, limit, sort });
      const result = await collect(dataSource.execute({ sourceId, timeTravel, notBefore, query }, call));
      const fields = result.table.schema.fields;
      const columns = fields.map((_, i) => result.table.getChildAt(i)!);
      const rows = Array.from({ length: result.table.numRows }, (_, r) =>
        Object.fromEntries(fields.map((f, c) => [f.name, chartValue(columns[c]!.get(r), f.type)])),
      );
      return { fields, rows, sort, cut: rows.length < limit ? undefined : aggregated ? "first" : "sample" };
    };
    load()
      .then((loaded) => {
        if (!controller.signal.aborted) setState({ loaded, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ error: messageOf(error), loading: false });
      });
    return () => controller.abort();
  }, [dataSource, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointClick = useRef(props.onPointClick);
  onPointClick.current = props.onPointClick;
  const mode = theme?.resolvedMode ?? "light";
  const themeDocument = theme?.theme ?? defaultTheme;
  const { stacked, legend, xTitle, yTitle, yRightTitle, yFormat, splitSlots, horizontal } = props;
  const palette = useMemo(() => resolveColors(themeDocument[mode], themeDocument.charts?.[mode]).series, [themeDocument, mode]);
  const slotsKey = JSON.stringify(splitSlots ?? null);
  const option = useMemo(() => {
    if (!state.loaded) return undefined;
    const slotColor = (slot: number | undefined) => (slot === undefined ? undefined : palette[slot - 1]);
    const base = buildChartOption({
      type,
      x,
      splitBy,
      series: outputs.map((o) => ({ column: o.column, label: o.label, type: o.measure.type, axis: o.measure.axis, stack: o.measure.stack, color: slotColor(o.measure.slot) })),
      splitColors: splitSlots ? Object.fromEntries(Object.entries(splitSlots).map(([value, slot]) => [value, slotColor(slot) ?? ""]).filter(([, color]) => color !== "")) : undefined,
      fields: state.loaded.fields,
      rows: state.loaded.rows,
      sort: state.loaded.sort,
      stacked,
      legend,
      xTitle,
      yTitle,
      yRightTitle,
      yFormat,
      horizontal,
    });
    // People who ask for less motion get none: the chart appears in place.
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const withAria = { aria: { enabled: true }, ...(still ? { animation: false } : {}), ...base };
    return props.option ? props.option(withAria) : withAria;
  }, [state.loaded, type, x, splitBy, outputs, props.option, stacked, legend, xTitle, yTitle, yRightTitle, yFormat, horizontal, palette, slotsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const seriesCount = type !== "pie" && Array.isArray((option as { series?: unknown[] } | undefined)?.series) ? (option as { series: unknown[] }).series.length : 0;

  useEffect(() => {
    if (!element.current || !option) return;
    const chart = echarts.init(element.current, echartsTheme(themeDocument, mode));
    chart.setOption(option);
    chart.on("click", (event: { seriesName?: string; name?: string; data?: unknown; value?: unknown }) => {
      const row = event.data !== null && typeof event.data === "object" ? (event.data as Record<string, string | number | null>) : undefined;
      // Pie slices carry a name; other series carry the dataset row.
      const at = row && x in row ? row[x]! : (event.name ?? null);
      const amount = row && typeof row.value === "number" ? row.value : typeof event.value === "number" ? event.value : null;
      onPointClick.current?.({ x: at, series: event.seriesName ?? "", value: amount });
    });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => chart.resize());
    observer?.observe(element.current);
    const unwheel = wheelScrollsThePage(element.current);
    return () => {
      unwheel();
      observer?.disconnect();
      chart.dispose();
    };
  }, [option, themeDocument, mode]);

  // Advice is worked out from what was actually drawn, so it follows filters and the data.
  const advice = props.advice === false || !state.loaded ? [] : chartAdvice(drawnShape({ type, x, y, stacked, seriesCount, binned: Boolean(xGrain || xBinWidth || xBins), fields: state.loaded.fields, rows: state.loaded.rows }));

  // Rows a time or number axis cannot place are left out, and the chart says so with what they hold.
  const unplaced = state.loaded ? rowsWithoutX({ type, x, series: outputs.map((o) => ({ column: o.column, label: o.label, type: o.measure.type })), fields: state.loaded.fields, rows: state.loaded.rows }) : [];
  const unplacedDetail =
    unplaced.length === 1
      ? ` (${outputs.map((o) => `${o.label}: ${typeof unplaced[0]![o.column] === "number" ? numberFormat().format(unplaced[0]![o.column] as number) : String(unplaced[0]![o.column] ?? "–")}`).join(", ")})`
      : "";
  const nothingDrawn = !!state.loaded && state.loaded.rows.length === unplaced.length;

  const description = props.label ?? text("chart.description", { type, measures: outputs.map((o) => o.label).join(", "), x });
  return (
    <figure className={["sf-chart", props.className].filter(Boolean).join(" ")} aria-busy={state.loading}>
      {state.error ? (
        <p className="sf-chart-message" role="alert" data-error={state.error} style={{ minHeight: height }}>
          {props.errorMessage ?? state.error}
        </p>
      ) : nothingDrawn ? (
        <p className="sf-chart-message" style={{ minHeight: height }}>
          {props.emptyMessage ?? text("chart.empty")}
        </p>
      ) : (
        <div ref={element} className="sf-chart-canvas" role="img" aria-label={description} style={{ height }} />
      )}
      {unplaced.length > 0 && <figcaption className="sf-chart-note">{text("chart.missingX", { x, detail: unplacedDetail })}</figcaption>}
      {seriesCount > palette.length && (
        <figcaption className="sf-chart-note">
          {text("chart.coloursRepeat", { count: seriesCount, colours: palette.length })}
        </figcaption>
      )}
      {advice.map((item) => (
        <figcaption key={item.rule} className="sf-chart-note sf-chart-advice" role="note">
          {text("chart.advice", { message: item.message, instead: item.instead })}
        </figcaption>
      ))}
      {state.loaded?.cut && (
        <figcaption className="sf-chart-note">
          {state.loaded.cut === "sample"
            ? text("chart.sampleNote", { count: numberFormat().format(limit) })
            : text(state.loaded.sort === "value" ? "chart.largestNote" : "chart.firstNote", { count: numberFormat().format(limit) })}
        </figcaption>
      )}
    </figure>
  );
}
