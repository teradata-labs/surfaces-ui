import type { ConversationScript, SurfaceComponent } from "@surfaces-ui/spec";
import { type ChartSpec, type DashboardSpec, joinsOf, pipelineGraph } from "../starters.js";
import type { SeedPipeline, SeedTable } from "../types.js";

/** What a model needs for its overview conversation; every seed has it. */
export interface OverviewInput {
  id: string;
  title: string;
  tables: SeedTable[];
  pipelines: SeedPipeline[];
  dashboard: DashboardSpec;
}

/** The tables a query reads, by name, in the order the model lists them. */
const readBy = (tables: SeedTable[], sql: string) => tables.filter((t) => new RegExp(`\\b${t.name}\\b`, "i").test(sql)).map((t) => t.name);

/**
 * The tables the dashboard reads, and the tables they point at, up to five: what a person needs to see to trust the
 * numbers. The first is the table the headline number reads.
 */
function modelTables(input: OverviewInput): string[] {
  const { tables, dashboard } = input;
  const read = [...new Set([dashboard.metrics, [dashboard.trend], dashboard.charts].flat().flatMap((spec) => readBy(tables, spec.sql)))];
  const pointed = read.flatMap((name) => (tables.find((t) => t.name === name)?.foreignKeys ?? []).map((fk) => fk.table));
  return [...new Set([...read, ...pointed])].slice(0, 5);
}

/** A description card for one table: what a row is, its key and what it points at, from the model's own descriptions. */
function tableCards(tables: SeedTable[], names: string[]): SurfaceComponent[] {
  return names.flatMap((name) => {
    const table = tables.find((t) => t.name === name);
    if (!table) return [];
    const keys = table.primaryKey.map((k) => `\`${k}\``).join(" + ");
    const links = (table.foreignKeys ?? []).filter((fk) => names.includes(fk.table)).map((fk) => `\`${fk.column}\` → ${fk.table}`);
    const text = [`**${table.name}**`, table.description, `One row: ${table.grain}. Key: ${keys || "none declared"}.`, ...(links.length ? [`Points at: ${links.join(", ")}`] : [])].join("\n\n");
    return [
      { id: `card-${name}`, component: "Card", child: `about-${name}` },
      { id: `about-${name}`, component: "Markdown", text },
    ];
  });
}

/**
 * "What is in the <industry> data?": a conversation written from a model's own dashboard spec, so every model has one
 * about its own tables and measures. The agent shows the tables and how they join, the headline numbers against their
 * trend, the breakdowns, the rows and the pipeline, and ends with a dashboard to keep. It states no figure in its text:
 * every number on screen is worked out by the database from the queries the model's dashboard is tested with.
 */
export function overviewConversation(input: OverviewInput): ConversationScript {
  const { id: source, title, tables, dashboard } = input;
  const pipeline = input.pipelines[0];
  const names = modelTables(input);
  const subject = title.toLowerCase();
  const metric = (spec: DashboardSpec["metrics"][number], id: string): SurfaceComponent => ({
    id,
    component: "Metric",
    sourceId: source,
    sql: spec.sql,
    ...(spec.column && spec.aggregate !== "count" ? { column: spec.column } : {}),
    aggregate: spec.aggregate,
    label: spec.label,
    ...(spec.format ? { format: spec.format } : {}),
  });
  const metrics = dashboard.metrics.slice(0, 3).map((spec, i) => metric(spec, `metric-${i + 1}`));
  const t = dashboard.trend;
  const trend: SurfaceComponent = {
    id: "trend",
    component: "Sparkline",
    sourceId: source,
    sql: t.sql,
    x: t.x,
    grain: "month",
    ...(t.column && t.aggregate !== "count" ? { column: t.column } : {}),
    aggregate: t.aggregate,
    label: t.label,
    ...(t.format ? { format: t.format } : {}),
  };
  const chart = (spec: ChartSpec, id: string): SurfaceComponent => ({
    id,
    component: "Chart",
    sourceId: source,
    sql: spec.sql,
    type: spec.type,
    x: spec.x,
    ...(spec.xGrain ? { xGrain: spec.xGrain } : {}),
    ...(spec.xBins ? { xBins: spec.xBins } : {}),
    y: spec.y,
    ...(spec.splitBy ? { splitBy: spec.splitBy } : {}),
    ...(spec.yTitle ? { yTitle: spec.yTitle } : {}),
    height: 280,
    label: spec.label,
  });
  const charts = dashboard.charts.slice(0, 4).map((spec, i) => chart(spec, `chart-${i + 1}`));
  const first = names[0] ?? tables[0]!.name;
  const rows: SurfaceComponent = { id: "rows", component: "DataGrid", sourceId: source, sql: `SELECT * FROM ${first}`, height: 320, label: `The rows of ${first}` };
  const numbers = (id: string): SurfaceComponent => ({ id, component: "Grid", columns: Math.min(4, metrics.length + 1), children: [...metrics.map((m) => m.id), "trend"] });
  const chartGrid = (id: string): SurfaceComponent => ({ id, component: "Grid", columns: 2, children: charts.map((c) => c.id) });
  const graph = pipeline ? pipelineGraph(tables, pipeline) : undefined;

  return {
    id: `${source}-overview`,
    title: `What is in the ${subject} data?`,
    description: `A first look at the ${subject} sample: its tables and how they join, the headline numbers against their trend, the breakdowns and the rows, then a dashboard to keep.`,
    answeredBy: "a written sample (not a model)",
    turns: [
      {
        say: `What is in the ${subject} data?`,
        reply: [
          {
            steps: [
              { title: "List the tables", tool: "list_tables", detail: `${source}: ${tables.map((table) => table.name).join(", ")}` },
              { title: `Read the keys of ${names.join(", ")}`, tool: "describe_table", detail: "Names, types, keys and descriptions only. No values were read." },
            ],
          },
          { text: `${dashboard.description.replace(/\s*Synthetic data\.?$/, "")} The numbers start from \`${first}\`; these are the tables they read and how they join, from the keys the source declares:` },
          {
            surface: {
              id: "model",
              components: [
                { id: "root", component: "Column", children: ["diagram", "cards"] },
                { id: "diagram", component: "ModelDiagram", sourceId: source, tables: names, joins: joinsOf(tables, names), height: 380 },
                { id: "cards", component: "Grid", columns: 3, children: names.map((name) => `card-${name}`) },
                ...tableCards(tables, names),
              ],
            },
          },
          { text: "Every join here is one the source declares, so none is a guess. Drag a column onto another to try a join of your own." },
        ],
        suggestions: ["Show me the headline numbers"],
      },
      {
        say: "Show me the headline numbers",
        reply: [
          { steps: [{ title: "Work out the headline numbers", tool: "query", detail: dashboard.metrics.slice(0, 3).map((m) => `${m.label}: ${m.aggregate.replace("_", " ")}`).join("; ") }] },
          { text: `The headline numbers, with ${t.label.toLowerCase()} beside them so each is read against something. The database works out every figure; nothing is summed in the browser.` },
          { surface: { id: "totals", components: [numbers("root"), ...metrics, trend] } },
        ],
        suggestions: ["Break it down"],
      },
      {
        say: "Break it down",
        reply: [
          { text: "The breakdowns, largest first where there is no order of their own. Each is summarised by the database, so the bars stay right however many rows sit behind them." },
          { surface: { id: "breakdown", components: [chartGrid("root"), ...charts] } },
        ],
        suggestions: ["Show me the rows behind it"],
      },
      {
        say: "Show me the rows behind it",
        reply: [
          { text: `The rows of \`${first}\`. Sorting, filtering and paging run in the database: click a heading to sort, or open a column's menu to filter.` },
          { surface: { id: "rows", components: [{ ...rows, id: "root" }] } },
        ],
        suggestions: graph ? ["Is there a pipeline that builds this?"] : ["Make this a dashboard I can keep"],
      },
      ...(graph && pipeline
        ? [
            {
              say: "Is there a pipeline that builds this?",
              reply: [
                { steps: [{ title: "Read the pipelines", tool: "list_pipelines", detail: `${pipeline.name}: ${pipeline.datasets.map((d) => d.name).join(", ")}` }] },
                { text: `**${pipeline.name}**: ${pipeline.description} This is its definition; nothing has been run here.` },
                { surface: { id: "pipeline", components: [{ id: "root", component: "PipelineGraph", nodes: graph.nodes, edges: graph.edges, height: 320 }] } },
              ],
              suggestions: ["Make this a dashboard I can keep"],
            },
          ]
        : []),
      {
        say: "Make this a dashboard I can keep",
        reply: [
          { text: "Here it is as one surface: the headline numbers with their trend, the breakdowns and the rows. It is a page document like any other, so it can be saved to the library, opened in the Playground and rearranged by hand or by asking." },
          {
            surface: {
              id: "dashboard",
              components: [
                { id: "root", component: "Column", children: ["title", "numbers", "charts", "rows"] },
                { id: "title", component: "Text", variant: "h2", text: dashboard.title },
                numbers("numbers"),
                ...metrics,
                trend,
                chartGrid("charts"),
                ...charts,
                rows,
              ],
            },
          },
          { text: "Nothing has been saved: saving is yours to do." },
        ],
        suggestions: [],
      },
    ],
  };
}
