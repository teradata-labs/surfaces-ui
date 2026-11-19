import { SALES_LINES } from "@surfaces-ui/seeds";
import { seedById } from "@surfaces-ui/seeds";
import { type PageDocument, type SurfaceComponent, analyticsCatalog } from "@surfaces-ui/spec";
import type { DataFocus } from "./focus.js";

type Metric = DataFocus["metrics"][number];
type ChartSpec = DataFocus["charts"][number];

/** A headline number from a metric spec, over that spec's own query. */
const metric = (focus: DataFocus, id: string, m: Metric, overrides: Partial<Metric> = {}): SurfaceComponent => {
  const spec = { ...m, ...overrides };
  return {
    id,
    component: "Metric",
    sourceId: focus.sourceId,
    sql: spec.sql,
    aggregate: spec.aggregate,
    label: spec.label,
    ...(spec.column && spec.aggregate !== "count" ? { column: spec.column } : {}),
    ...(spec.format ? { format: spec.format } : {}),
  };
};

/** A chart from a chart spec, over that spec's own query and columns. */
const chart = (focus: DataFocus, id: string, c: ChartSpec, extra: Record<string, unknown> = {}): SurfaceComponent => ({
  id,
  component: "Chart",
  sourceId: focus.sourceId,
  sql: c.sql,
  type: c.type,
  x: c.x,
  y: c.y,
  label: c.label,
  height: 280,
  ...(c.xGrain ? { xGrain: c.xGrain } : {}),
  ...(c.xBins ? { xBins: c.xBins } : {}),
  ...(c.splitBy ? { splitBy: c.splitBy } : {}),
  ...(c.yTitle ? { yTitle: c.yTitle } : {}),
  ...extra,
});

/** The trend as a sparkline: the comparison every headline number needs beside it. */
const trend = (focus: DataFocus, id: string): SurfaceComponent => ({
  id,
  component: "Sparkline",
  sourceId: focus.sourceId,
  sql: focus.trend.sql,
  x: focus.trend.x,
  grain: "month",
  aggregate: focus.trend.aggregate,
  label: focus.trend.label,
  ...(focus.trend.column ? { column: focus.trend.column } : {}),
  ...(focus.trend.format ? { format: focus.trend.format } : {}),
});

/** True when a measure reads a number column (so it can be binned or ranked). */
const numeric = (m: Metric) => !!m.column && m.aggregate !== "count" && m.aggregate !== "count_distinct";

/**
 * Example pages over whichever dataset is picked, each a plain JSON document
 * built from the dataset's focus: a dashboard, an analysis view, a review
 * view and an exploration page. Every view uses its own spec's query and
 * columns, so a spec over another table stays correct.
 */
export function examplePages(focus: DataFocus): PageDocument[] {
  const base = { catalogId: analyticsCatalog.id };
  const { sourceId, measure, breakdown, secondBreakdown } = focus;
  const prefix = (id: string) => `${sourceId}-${id}`;
  const pages: PageDocument[] = [];

  // A dashboard: headline numbers with their trend, then every chart, then the rows.
  const metricIds = focus.metrics.map((_, i) => `metric-${i + 1}`);
  const chartIds = focus.charts.map((_, i) => `chart-${i + 1}`);
  pages.push({
    ...base,
    id: prefix("overview"),
    title: `${focus.title} overview`,
    description: "A dashboard: headline numbers with their trend beside them, then the breakdown and the rows.",
    components: [
      { id: "root", component: "Column", children: ["tiles", "charts", "table"] },
      { id: "tiles", component: "Grid", columns: Math.min(4, metricIds.length + 1), children: [...metricIds, "trend"] },
      ...focus.metrics.map((m, i) => metric(focus, metricIds[i]!, m)),
      trend(focus, "trend"),
      { id: "charts", component: "Grid", columns: 2, children: chartIds },
      ...focus.charts.map((c, i) => chart(focus, chartIds[i]!, c)),
      { id: "table", component: "DataGrid", sourceId, sql: focus.rowsSql, height: 260 },
    ],
  });

  // A filtered dashboard: one list of filters in the page's data that every view reads. The bar keeps it, a click on a bar adds to it.
  const { cross } = focus;
  const shared = { "@path": "/filters" };
  const bars = cross.dimensions.map((_, i) => `by-${i + 1}`);
  pages.push({
    ...base,
    id: prefix("filtered"),
    title: `${focus.title}: filter everything at once`,
    description: "Page-wide filters: a filter bar and bars you can click, with every number, chart and row following one list of filters kept in the page's own data.",
    components: [
      { id: "root", component: "Column", children: ["how", "filters", "tiles", "bars", "over-time", "rows"] },
      { id: "how", component: "Markdown", text: "Add a filter, pick a quick date range, or **click a bar**. Everything below follows; click the bar again to clear it. A bar chart leaves out the filter on its own column, so the bars you click stay." },
      { id: "filters", component: "FilterBar", sourceId, sql: cross.sql, filters: shared, columns: [...cross.dimensions, cross.time, cross.measure.column] },
      { id: "tiles", component: "Grid", columns: 3, children: ["total", "count", "trend"] },
      { id: "total", component: "Metric", sourceId, sql: cross.sql, column: cross.measure.column, aggregate: "sum", label: cross.measure.label, filters: shared, ...(cross.measure.format ? { format: cross.measure.format } : {}) },
      { id: "count", component: "Metric", sourceId, sql: cross.sql, aggregate: "count", label: cross.rows, format: "number", filters: shared },
      { id: "trend", component: "Sparkline", sourceId, sql: cross.sql, x: cross.time, grain: "month", column: cross.measure.column, aggregate: "sum", label: `${cross.measure.label} by month`, filters: shared, ...(cross.measure.format ? { format: cross.measure.format } : {}) },
      { id: "bars", component: "Grid", columns: Math.min(3, Math.max(1, bars.length)), children: bars },
      ...cross.dimensions.map((dimension, i) => ({
        id: bars[i]!,
        component: "Chart",
        sourceId,
        sql: cross.sql,
        type: "bar",
        x: dimension,
        y: [{ column: cross.measure.column, aggregate: "sum", label: cross.measure.label }],
        xTitle: dimension,
        height: 260,
        filters: shared,
        select: shared,
        label: `${cross.measure.label} by ${dimension}; click a bar to filter the page`,
      })),
      { id: "over-time", component: "Chart", sourceId, sql: cross.sql, type: "line", x: cross.time, xGrain: "month", y: [{ column: cross.measure.column, aggregate: "sum", label: cross.measure.label }], height: 240, filters: shared, label: `${cross.measure.label} by month` },
      { id: "rows", component: "DataGrid", sourceId, sql: cross.sql, filters: shared, height: 260 },
    ],
    data: { filters: [] },
  });

  // A report built from pills: the fields once, the views as tiles, one set of filters. Starts with two views so there is something to see.
  const reportMeasure = sourceId === "retail" ? "line_amount" : cross.measure.column;
  pages.push({
    ...base,
    id: prefix("report"),
    title: `${focus.title}: build a report`,
    description: "A report builder: pills generated from the columns, views made on the shelves and kept as tiles, all following one set of filters.",
    components: [
      { id: "root", component: "Column", children: ["report"] },
      {
        id: "report",
        component: "ReportBuilder",
        sourceId,
        sql: sourceId === "retail" ? SALES_LINES : cross.sql,
        title: `${focus.title} report`,
        tiles: [
          { id: "headline", rows: [], values: [reportMeasure, "rows"], span: 3 },
          { id: "by-first", rows: [cross.dimensions[0]!], values: [reportMeasure] },
          { id: "over-time", rows: [cross.time], values: [reportMeasure], span: 2 },
        ],
        draft: { rows: [cross.dimensions[1] ?? cross.dimensions[0]!], values: [reportMeasure] },
        action: { event: { name: "ask" } },
      },
    ],
  });

  // Exploring with pills: fields generated from the query's columns, calculations suggested or made, shelves a person or an agent sets.
  const wide = sourceId === "retail" ? SALES_LINES : cross.sql;
  pages.push({
    ...base,
    id: prefix("explore-pills"),
    title: `${focus.title}: explore with pills`,
    description: "Fields as pills, generated from the columns: attributes, metrics and calculations you can add, edit and drag onto shelves, or ask for in words.",
    components: [
      { id: "root", component: "Column", children: ["how", "explore"] },
      {
        id: "how",
        component: "Markdown",
        text: "Every pill here was **generated from the query's columns** when the page opened. Press one to use it, drag it to a shelf, or press ✎ to change it. **Suggest calculations** adds rates and averages worked out from the names; **+** makes your own. Or ask in the box: with a model picked, it writes the pills and sets the shelves.",
      },
      { id: "explore", component: "Explorer", sourceId, sql: wide, rows: [cross.dimensions[0]!], values: [sourceId === "retail" ? "line_amount" : cross.measure.column], action: { event: { name: "ask" } } },
    ],
  });

  // An analysis view: a pivot of the breakdown, and the distribution of the main measure.
  const sameQuery = secondBreakdown && secondBreakdown.sql === breakdown.sql ? secondBreakdown : undefined;
  const analysis: SurfaceComponent[] = [
    {
      id: "intro",
      component: "Markdown",
      text: `${breakdown.y[0]?.label ?? "The measure"} by **${breakdown.x}**${sameQuery ? ` and **${sameQuery.x}**` : ""}. Totals are worked out by the database, so averages and medians stay correct.`,
    },
    { id: "pivot", component: "PivotTable", sourceId, sql: breakdown.sql, rows: [breakdown.x], columns: sameQuery ? [sameQuery.x] : [], measures: breakdown.y, height: 240 },
  ];
  const lower: string[] = [];
  if (numeric(measure)) {
    analysis.push({ id: "histogram", component: "Chart", sourceId, sql: measure.sql, type: "bar", x: measure.column, xBins: 20, y: [{ aggregate: "count", label: "Rows" }], xTitle: measure.label, height: 260 });
    lower.push("histogram");
  }
  if (sameQuery) {
    analysis.push(chart(focus, "stacked", { ...breakdown, label: `${breakdown.label} by ${sameQuery.x}` }, { splitBy: sameQuery.x, stacked: true, height: 260 }));
    lower.push("stacked");
  } else {
    analysis.push(chart(focus, "breakdown", breakdown, { height: 260 }));
    lower.push("breakdown");
  }
  analysis.push({ id: "charts", component: "Grid", columns: 2, children: lower });
  pages.push({
    ...base,
    id: prefix("analysis"),
    title: `${focus.title}: analysis`,
    description: "An analysis view: a pivot and the distribution behind it.",
    components: [{ id: "root", component: "Column", children: ["intro", "pivot", "charts"] }, ...analysis],
  });

  // A review view: the largest rows first, beside the numbers that frame them.
  if (numeric(measure)) {
    pages.push({
      ...base,
      id: prefix("review"),
      title: `${focus.title}: review desk`,
      description: "An operations view: the largest rows to look at first, and what to do next.",
      components: [
        { id: "root", component: "Column", children: ["tiles", "queue-title", "queue", "next"] },
        { id: "tiles", component: "Grid", columns: 3, children: ["largest", "median", "trend"] },
        metric(focus, "largest", measure, { aggregate: "max", label: `Largest ${measure.column}` }),
        metric(focus, "median", measure, { aggregate: "median", label: `Median ${measure.column}` }),
        trend(focus, "trend"),
        { id: "queue-title", component: "Text", text: `Rows by ${measure.column}, largest first`, variant: "h3" },
        { id: "queue", component: "DataGrid", sourceId, sql: measure.sql, sorts: [{ column: measure.column!, desc: true }], mode: "pages", height: 280 },
        { id: "next", component: "Checklist", items: [{ label: "Check the ten largest rows", done: true }, { label: "Agree a threshold with the owner" }] },
      ],
    });
  }

  // An exploration page: the table in the model, and its rows to query.
  pages.push({
    ...base,
    id: prefix("explore"),
    title: `Explore ${focus.table}`,
    description: "An exploration page: model and query.",
    components: [
      { id: "root", component: "Column", children: ["model", "result"] },
      { id: "model", component: "ModelDiagram", sourceId, tables: [focus.table], height: 300 },
      { id: "result", component: "QueryResult", sourceId, sql: focus.rowsSql, height: 320 },
    ],
  });

  return pages;
}

/** The seed's own starter pages (dashboard, form, pipeline, explorer, catalog), when the dataset is a seed. */
export function starterPages(sourceId: string): PageDocument[] {
  return seedById(sourceId)?.starters.map((s) => s.page) ?? [];
}

/**
 * The pages to offer for a dataset: a seed's own starters, plus only those
 * generated examples that show something the starters do not. A seed's
 * dashboard and data explorer are built from the same spec as the generated
 * overview and explorer, so offering both shows the same page twice.
 */
export function pagesFor(focus: DataFocus): PageDocument[] {
  const starters = seedById(focus.sourceId)?.starters ?? [];
  const has = new Set(starters.map((s) => s.kind));
  const generated = examplePages(focus).filter(
    (p) => !(has.has("dashboard") && p.id.endsWith("-overview")) && !(has.has("data-explorer") && p.id.endsWith("-explore")),
  );
  return [...starters.map((s) => s.page), ...generated];
}
