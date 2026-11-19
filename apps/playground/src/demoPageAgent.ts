import { type AgentBackend, agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { type DataSource, collect } from "@surfaces-ui/data";
import { A2UI_VERSION, type SurfaceComponent } from "@surfaces-ui/spec";
import type { DataFocus } from "./focus.js";

const AGGREGATES: [RegExp, string][] = [
  [/\b(average|avg|mean)\b/, "avg"],
  [/\bmedian\b/, "median"],
  [/\b(count|number of|how many)\b/, "count"],
  [/\b(max|maximum|largest|highest)\b/, "max"],
  [/\b(min|minimum|smallest|lowest)\b/, "min"],
  [/\b(distinct|unique)\b/, "count_distinct"],
];
const GRAINS = ["day", "week", "month", "quarter", "year"];
const CHART_TYPES = ["bar", "line", "area", "pie", "scatter"];
const KIND: Record<string, string> = { chart: "Chart", graph: "Chart", table: "DataGrid", grid: "DataGrid", pivot: "PivotTable", metric: "Metric", number: "Metric", kpi: "Metric", tile: "Metric" };

/**
 * The query the agent works on and the columns it defaults to: the dataset's
 * wide query (its fact table joined to what gives it categories), so "revenue
 * by month" means the same here as on the dashboards.
 */
function focusColumns(focus: DataFocus) {
  const { cross } = focus;
  return { sql: cross.sql, measure: cross.measure.column, measureLabel: cross.measure.label, format: cross.measure.format, dimensions: cross.dimensions, time: cross.time };
}

/** Column names and Arrow type names of a query, read from a result with no rows. */
async function queryColumns(dataSource: DataSource, sourceId: string, sql: string): Promise<{ name: string; nativeType: string }[]> {
  const { table } = await collect(dataSource.execute({ sourceId, query: { baseSql: sql, page: { limit: 0, offset: 0n } } }));
  return table.schema.fields.map((f) => ({ name: f.name, nativeType: String(f.type) }));
}

/** One-press instructions that fit the picked dataset. */
export function demoPageStarters(focus: DataFocus): string[] {
  const { measure, dimensions } = focusColumns(focus);
  const word = (name: string) => name.replace(/_/g, " ");
  const m = measure ? focus.cross.measure.label.toLowerCase() : "rows";
  const [a, b] = dimensions.map(word);
  return [
    measure ? `Add a line chart of ${m} by month` : "Add a line chart by month",
    a ? `Add a pivot of ${m} by ${a}${b ? ` and ${b}` : ""}` : "Add a pivot table",
    measure ? `Add a number for average ${m}` : "Add a number for the count",
    "Make it a bar chart",
    "Remove the table",
  ];
}

/**
 * A stand-in for an agent that edits pages. It is not a model: it follows a
 * small set of phrasings by matching words, and answers in the same A2UI
 * messages a real agent would. It exists so the page studio can be tried
 * with nothing installed. It works on the picked dataset's main table, and
 * reads the focus for the measure, breakdowns and time column it defaults to.
 */
export function demoPageAgent(dataSource: DataSource, focus: DataFocus): AgentBackend {
  const known = focusColumns(focus);
  const { sourceId } = focus;
  const { sql } = known;
  const table = "the query";
  return scriptedAgent(async function* (request) {
    const prompt = request.input?.case === "text" ? request.input.value : "";
    const instruction = (/^Instruction: (.*)$/m.exec(prompt)?.[1] ?? "").trim();
    const said = instruction.toLowerCase();
    const surfaceId = /Change the page "([^"]+)"/.exec(prompt)?.[1] ?? "page";
    const page = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1) || "[]") as SurfaceComponent[];
    const columns = await queryColumns(dataSource, sourceId, sql).catch(async () => (await dataSource.describeTable({ sourceId, ref: { table: focus.table } })).table?.columns ?? []);
    const numeric = (name: string) => /int|double|float|decimal|numeric|real/i.test(columns.find((c) => c.name === name)?.nativeType ?? "");
    const temporal = (name: string) => /time|date/i.test(columns.find((c) => c.name === name)?.nativeType ?? "");
    const timeColumn = known.time ?? columns.find((c) => temporal(c.name))?.name;
    const defaultMeasure = known.measure ?? columns.find((c) => numeric(c.name) && !/(^|_)id$/.test(c.name))?.name;
    const defaultDimension = known.dimensions[0] ?? columns.find((c) => !numeric(c.name) && !temporal(c.name) && !/(^|_)id$/.test(c.name))?.name;
    // The focus's own label for its measure ("revenue") is how people say its column.
    const measureWords = known.measure ? known.measureLabel.toLowerCase().replace(/[^\w\s]/g, "").trim() : "";
    let words = said;
    if (measureWords && known.measure) words = words.replace(new RegExp(`\\b${measureWords}\\b`, "g"), known.measure);
    if (timeColumn) words = words.replace(/\bmonthly|by month\b/g, `by ${timeColumn} month`).replace(/\b(time|date)\b/g, timeColumn);
    const mentioned = columns.map((c) => c.name).filter((name) => new RegExp(`\\b${name.replace(/_/g, "[ _]")}s?\\b`).test(words)).sort((a, b) => words.indexOf(a.replace(/_/g, " ")) - words.indexOf(b.replace(/_/g, " ")));
    const aggregate = AGGREGATES.find(([pattern]) => pattern.test(said))?.[1] ?? (defaultMeasure ? "sum" : "count");
    const measure = mentioned.find(numeric) ?? defaultMeasure;
    const counting = aggregate === "count" || !measure;
    const dimensions = mentioned.filter((name) => name !== measure);
    const grain = GRAINS.find((g) => new RegExp(`\\b${g}(ly|s)?\\b`).test(words));
    const root = page.find((c) => c.id === "root");
    const last = (component: string) => page.filter((c) => c.component === component).at(-1);
    const fresh = (prefix: string) => {
      let n = 1;
      while (page.some((c) => c.id === `${prefix}-${n}`)) n++;
      return `${prefix}-${n}`;
    };
    const send = (components: SurfaceComponent[]) => agentEvent.surface({ version: A2UI_VERSION, updateComponents: { surfaceId, components } as never });
    const append = (component: SurfaceComponent, container = root) => [{ ...container!, children: [...((container!.children as string[]) ?? []), component.id] }, component];
    const named = measure === known.measure ? known.measureLabel.toLowerCase() : measure?.replace(/_/g, " ");
    const label = counting ? "Count" : aggregate === "sum" ? (measure === known.measure ? known.measureLabel : `Total ${named}`) : `${aggregate.replace("_", " ")} ${named}`;
    const y = [counting ? { aggregate: "count", label: "Count" } : { column: measure, aggregate, label }];
    const format = !counting && measure === known.measure && known.format ? known.format : "number";

    if (!root) {
      yield agentEvent.text("This page has no top-level container, so I cannot change it.");
    } else if (/\b(remove|delete|drop|take away)\b/.test(said)) {
      const kind = Object.entries(KIND).find(([word]) => said.includes(word))?.[1];
      const target = kind ? last(kind) : page.filter((c) => c.id !== "root" && !Array.isArray(c.children)).at(-1);
      const parent = target && page.find((c) => Array.isArray(c.children) && (c.children as string[]).includes(target.id));
      if (target && parent) {
        yield send([{ ...parent, children: (parent.children as string[]).filter((id) => id !== target.id) }]);
        yield agentEvent.text(`Removed the ${target.component === "DataGrid" ? "table" : target.component.toLowerCase()}.`);
      } else yield agentEvent.text("I could not find that on the page.");
    } else if (/\b(add|show|include|insert|put)\b/.test(said)) {
      if (/\bpivot\b/.test(said)) {
        const [rows = defaultDimension, across] = dimensions;
        if (!rows) {
          yield agentEvent.text(`I could not find a column of ${table} to group by. Name one in the instruction.`);
          yield agentEvent.done("demo-pages", "scripted demo (not a model)");
          return;
        }
        const dim = (name: string) => (temporal(name) ? { column: name, grain: grain ?? "month" } : name);
        yield send(append({ id: fresh("pivot"), component: "PivotTable", sourceId, sql, rows: [dim(rows)], columns: across ? [dim(across)] : [], measures: y, height: 260 }));
        yield agentEvent.text(`Added a pivot of ${label.toLowerCase()} by ${[rows, across].filter(Boolean).join(" and ")}.`);
      } else if (/\b(table|grid|rows)\b/.test(said)) {
        yield send(append({ id: fresh("table"), component: "DataGrid", sourceId, sql, height: 260 }));
        yield agentEvent.text("Added a table of the rows.");
      } else if (/\b(metric|number|kpi|tile|total|figure)\b/.test(said) && !/\bchart|graph|plot\b/.test(said)) {
        const tiles = page.find((c) => c.component === "Grid" && (c.children as string[]).some((id) => page.find((p) => p.id === id)?.component === "Metric"));
        const metric = { id: fresh("metric"), component: "Metric", sourceId, sql, ...(counting ? {} : { column: measure }), aggregate: counting ? "count" : aggregate, label, format };
        yield send(append(metric, tiles ?? root));
        yield agentEvent.text(`Added a number for ${metric.label.toLowerCase()}.`);
      } else {
        const x = dimensions[0] ?? (/\b(line|trend|over time|month|week|day|quarter|year)\b/.test(words) && timeColumn ? timeColumn : defaultDimension);
        if (!x) {
          yield agentEvent.text(`I could not find a column of ${table} to chart along. Name one in the instruction.`);
          yield agentEvent.done("demo-pages", "scripted demo (not a model)");
          return;
        }
        const type = CHART_TYPES.find((t) => said.includes(t)) ?? (temporal(x) ? "line" : "bar");
        const chart = { id: fresh("chart"), component: "Chart", sourceId, sql, type, x, ...(temporal(x) ? { xGrain: grain ?? "month" } : {}), ...(dimensions[1] && type !== "pie" ? { splitBy: dimensions[1] } : {}), y, height: 280 };
        yield send(append(chart));
        yield agentEvent.text(`Added a ${type} chart of ${label.toLowerCase()} by ${x}${temporal(x) ? `, grouped by ${chart.xGrain}` : ""}.`);
      }
    } else if (/\b(title|rename|call it|name it)\b/.test(said)) {
      yield agentEvent.text("This demo cannot rename a page: the title is not part of the components an A2UI reply can change.");
    } else {
      const chart = last("Chart");
      const type = CHART_TYPES.find((t) => new RegExp(`\\b${t}\\b`).test(said));
      const change: Record<string, unknown> = {};
      if (type) change.type = type;
      if (grain) change.xGrain = grain;
      if (/\bstack/.test(said)) change.stacked = !/\b(un|not |no )stack/.test(said);
      if (/\blegend\b/.test(said)) change.legend = (["top", "bottom", "right"].find((p) => said.includes(p)) ?? (/\b(hide|no|remove)\b/.test(said) ? "none" : "top"));
      const columnsWanted = /\b(one|two|three|four|1|2|3|4) columns?\b/.exec(said)?.[1];
      const grid = last("Grid");
      if (chart && Object.keys(change).length > 0) {
        yield send([{ ...chart, ...change }]);
        yield agentEvent.text(`Changed the last chart: ${Object.entries(change).map(([key, value]) => `${key} is now ${String(value)}`).join(", ")}.`);
      } else if (grid && columnsWanted) {
        const n = { one: 1, two: 2, three: 3, four: 4 }[columnsWanted] ?? Number(columnsWanted);
        yield send([{ ...grid, columns: n }]);
        yield agentEvent.text(`The last grid now has ${n} columns.`);
      } else {
        yield agentEvent.text(
          `I am a scripted demo and only follow a few phrasings, such as ${demoPageStarters(focus).slice(0, 3).map((s) => `"${s.toLowerCase()}"`).join(", ")}, "add a table", "make it a bar chart", "group by week", "stack it" and "remove the table".`,
        );
      }
    }
    yield agentEvent.done("demo-pages", "scripted demo (not a model)");
  }, 40);
}
