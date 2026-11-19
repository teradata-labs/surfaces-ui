import { type PageDocument, type SurfaceComponent, analyticsCatalog } from "@surfaces-ui/spec";
import type { SeedForm, SeedPipeline, SeedStarter, SeedTable } from "./types.js";

export interface MetricSpec {
  label: string;
  sql: string;
  column?: string;
  aggregate: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median";
  format?: "number" | "compact" | "currency" | "percent";
}

export interface ChartSpec {
  label: string;
  sql: string;
  type: "bar" | "line" | "area" | "scatter";
  x: string;
  xGrain?: "day" | "week" | "month" | "quarter";
  xBins?: number;
  y: { column?: string; aggregate: MetricSpec["aggregate"]; label?: string }[];
  splitBy?: string;
  yTitle?: string;
}

export interface DashboardSpec {
  title: string;
  description: string;
  metrics: MetricSpec[];
  /** A trend beside the headline numbers, so they are read against something. */
  trend: { label: string; sql: string; x: string; column?: string; aggregate: MetricSpec["aggregate"]; format?: MetricSpec["format"] };
  charts: ChartSpec[];
}

export interface StarterSpec {
  sourceId: string;
  title: string;
  dashboard: DashboardSpec;
  /** The table a data explorer opens on, and the query it starts with. */
  explore: { table: string; sql: string; sorts?: { column: string; desc?: boolean }[] };
  /** Tables the model diagram starts with. */
  model: string[];
  tables: SeedTable[];
  form: SeedForm;
  /** Shown beside the form: what is being decided. */
  formContext: string;
  pipeline: SeedPipeline;
}

const page = (id: string, title: string, description: string, components: SurfaceComponent[], data?: unknown): PageDocument => ({
  id,
  title,
  description,
  catalogId: analyticsCatalog.id,
  components,
  ...(data === undefined ? {} : { data }),
});

/** A pipeline's datasets and the tables they read, as `PipelineGraph` nodes and edges. Drawn from the definition: nothing has run. */
export function pipelineGraph(tables: SeedTable[], pipeline: SeedPipeline) {
  const inputs = new Set<string>();
  for (const dataset of pipeline.datasets) for (const t of tables) if (new RegExp(`\\b${t.name}\\b`).test(dataset.sql)) inputs.add(t.name);
  const nodes = [
    ...[...inputs].map((name) => ({ id: name, name, kind: "source" as const })),
    ...pipeline.datasets.map((dataset) => ({ id: dataset.name, name: dataset.name, kind: dataset.kind === "view" ? ("view" as const) : ("table" as const), ...(dataset.layer ? { layer: dataset.layer } : {}) })),
  ];
  const known = [...inputs, ...pipeline.datasets.map((x) => x.name)];
  const edges = pipeline.datasets.flatMap((dataset) => known.filter((from) => from !== dataset.name && new RegExp(`\\b${from}\\b`).test(dataset.sql)).map((from) => ({ from, to: dataset.name })));
  return { nodes, edges };
}

/** The five starter surfaces every seed has: a dashboard, a form, a pipeline graph, a data explorer and a metadata explorer. */
export function starters(spec: StarterSpec): SeedStarter[] {
  const { sourceId: s, dashboard: d } = spec;
  const metricIds = d.metrics.map((_, i) => `metric-${i + 1}`);
  const chartIds = d.charts.map((_, i) => `chart-${i + 1}`);
  const dashboard = page(`${s}-dashboard`, d.title, d.description, [
    { id: "root", component: "Column", children: ["title", "numbers", "charts"] },
    { id: "title", component: "Text", variant: "h2", text: d.title },
    { id: "numbers", component: "Grid", columns: Math.min(4, d.metrics.length + 1), children: [...metricIds, "trend"] },
    ...d.metrics.map((m, i) => ({ id: metricIds[i]!, component: "Metric", sourceId: s, sql: m.sql, aggregate: m.aggregate, label: m.label, ...(m.column ? { column: m.column } : {}), ...(m.format ? { format: m.format } : {}) })),
    { id: "trend", component: "Sparkline", sourceId: s, sql: d.trend.sql, x: d.trend.x, grain: "month", aggregate: d.trend.aggregate, label: d.trend.label, ...(d.trend.column ? { column: d.trend.column } : {}), ...(d.trend.format ? { format: d.trend.format } : {}) },
    { id: "charts", component: "Grid", columns: 2, children: chartIds },
    ...d.charts.map((c, i) => ({
      id: chartIds[i]!,
      component: "Chart",
      sourceId: s,
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
    })),
  ]);

  const form = page(
    `${s}-form`,
    spec.form.title,
    spec.form.description,
    [
      { id: "root", component: "Column", children: ["context", "form"] },
      { id: "context", component: "Text", variant: "body", text: spec.formContext },
      { id: "form", component: "Form", formId: spec.form.id, title: spec.form.title, description: spec.form.description, fields: spec.form.fields, values: { "@path": "/form" }, submitLabel: "Submit", action: { event: { name: "submitted" } } },
    ],
    { form: {} },
  );

  const { nodes, edges } = pipelineGraph(spec.tables, spec.pipeline);
  const dag = page(`${s}-pipeline`, spec.pipeline.name, spec.pipeline.description, [
    { id: "root", component: "Column", children: ["title", "about", "graph"] },
    { id: "title", component: "Text", variant: "h2", text: spec.pipeline.name },
    { id: "about", component: "Text", variant: "body", text: `${spec.pipeline.description} Running it needs a backend with pipelines; the graph is drawn from the definition.` },
    { id: "graph", component: "PipelineGraph", nodes, edges, height: 360 },
  ]);

  const explorer = page(`${s}-explore`, `${spec.title}: ${spec.explore.table}`, `The ${spec.explore.table} table, to sort, filter and chart.`, [
    { id: "root", component: "Column", children: ["result"] },
    { id: "result", component: "QueryResult", sourceId: s, sql: spec.explore.sql, ...(spec.explore.sorts ? { sorts: spec.explore.sorts } : {}) },
  ]);

  // Search, the tree, the detail's related tables and the graph all write the opened table to /table, and the detail and graph read it, so the page works on its own.
  const opened = { "@path": "/table" };
  const metadata = page(
    `${s}-catalog`,
    `${spec.title} catalog`,
    "Find tables by name or meaning, see what each holds and how they join.",
    [
      { id: "root", component: "Column", children: ["title", "search", "panes", "around", "model"] },
      { id: "title", component: "Text", variant: "h2", text: `${spec.title} catalog` },
      { id: "search", component: "DataSearch", sourceId: s, opened, action: { event: { name: "open_table" } } },
      { id: "panes", component: "Grid", columns: 2, children: ["browser", "detail"] },
      { id: "browser", component: "ObjectBrowser", sourceId: s, height: 420, opened, action: { event: { name: "select" } } },
      { id: "detail", component: "ObjectDetail", sourceId: s, table: opened, opened, action: { event: { name: "open_table" } } },
      { id: "around", component: "RelationshipGraph", sourceId: s, table: opened, opened, action: { event: { name: "open_table" } } },
      { id: "model", component: "ModelDiagram", sourceId: s, tables: spec.model, joins: joinsOf(spec.tables, spec.model), height: 420 },
    ],
    { table: spec.explore.table },
  );

  return [
    { kind: "dashboard", page: dashboard },
    { kind: "form", page: form },
    { kind: "dag", page: dag },
    { kind: "data-explorer", page: explorer },
    { kind: "metadata-explorer", page: metadata },
  ];
}

/** The declared joins among these tables, as ModelDiagram joins. They are the model's keys, so not inferred. */
/** A chart under a visible title: the column `id` holds a heading and the chart, whose `label` names it for assistive technology. */
export function titledChart(id: string, title: string, chart: Record<string, unknown>): SurfaceComponent[] {
  return [
    { id, component: "Column", children: [`${id}-title`, `${id}-chart`] },
    { id: `${id}-title`, component: "Text", variant: "h4", text: title },
    { ...chart, id: `${id}-chart`, component: "Chart" },
  ];
}

export function joinsOf(tables: SeedTable[], names: string[]) {
  return tables
    .filter((t) => names.includes(t.name))
    .flatMap((t) => (t.foreignKeys ?? []).filter((fk) => names.includes(fk.table)).map((fk) => ({ left: t.name, right: fk.table, keys: [{ leftColumn: fk.column, rightColumn: fk.references }] })));
}

/** A seed's starter surfaces, and the dashboard they were built from, which says what the data is about (its measures, trend and breakdowns). */
export function withStarters(spec: StarterSpec): { starters: SeedStarter[]; dashboard: DashboardSpec } {
  return { starters: starters(spec), dashboard: spec.dashboard };
}
