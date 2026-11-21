import { type SurfaceComponent, analyticsCatalog } from "@surfaces-ui/spec";
import { type SeedIssue, type SeedPii, joinsOf, seedById, seedSemanticModels } from "@surfaces-ui/seeds";
import { type DataFocus, focusFor } from "./focus.js";
import { type ActiveSource, firstTable } from "./source.js";

/** How the sidebar groups the catalog. A component missing here is listed under "Other", so nothing is hidden. */
export const GROUPS: [string, string[]][] = [
  ["Layout and text", ["Text", "Row", "Column", "Grid", "Card", "Tabs", "Divider", "Badge", "KeyValue", "Stat", "Progress", "Link", "Markdown", "Message", "CodeBlock", "Table"]],
  ["Reports and exploring", ["ReportBuilder", "Explorer", "FilterBar"]],
  ["Data views", ["DataGrid", "RowList", "Chart", "PivotTable", "QueryResult", "Metric", "Sparkline", "BulletGraph", "QueryPlan", "SqlEditor"]],
  ["Discovery and modelling", ["DataSearch", "ObjectBrowser", "ObjectDetail", "RelationshipGraph", "NodeGraph", "ModelDiagram", "AskData", "ContextBuilder", "SourceList", "FileBrowser", "SemanticModelEditor"]],
  ["Inputs and forms", ["Form", "TextField", "NumberField", "ChoicePicker", "CheckBox", "DateTimeInput", "Slider", "Button"]],
  ["Decisions and review", ["DecisionCard", "Chips", "Checklist", "SqlProposal", "PlanReview", "PiiReview", "StepFlow"]],
  ["Pipelines", ["PipelineGraph", "PipelineView", "RunHistory", "ExpectationsPanel", "SchemaDiff", "StreamMetrics", "IngestWizard"]],
  ["Host", ["ThemeSwitch"]],
];

const PII_CATEGORY: Record<SeedPii, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  address: "address",
  birth_date: "date_of_birth",
  government_id: "government_id",
  account_number: "financial",
  health: "health",
  location: "location",
  device_id: "network",
};
const ISSUE_TITLE: Record<SeedIssue["kind"], string> = {
  nulls: "Fill or flag missing values",
  duplicates: "Remove repeated rows",
  orphans: "Drop rows that point at nothing",
  out_of_range: "Correct values out of range",
  inconsistent: "Make spellings consistent",
};

/** A small, fixed number from a name, so made-up counts stay the same on every load. */
const spread = (text: string, max: number) => [...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % max;

/**
 * Examples built from the picked sample model: its first pipeline, its rules, its personal columns and its planted
 * problems. Undefined when the component is not one of these, or the source is not a sample model.
 */
function seedExample(name: string, props: Record<string, unknown>, sourceId: string): Record<string, unknown> | undefined {
  const seed = seedById(sourceId);
  if (!seed) return undefined;
  const pipeline = seed.pipelines[0];
  const built = new Set(pipeline?.datasets.map((d) => d.name) ?? []);
  switch (name) {
    case "PipelineGraph": {
      if (!pipeline) return undefined;
      const sources = [...new Set(pipeline.datasets.flatMap((d) => d.depends ?? []).filter((t) => !built.has(t)))];
      return {
        nodes: [
          ...sources.map((t) => ({ id: t, name: t, kind: "source" })),
          ...pipeline.datasets.map((d, i) => ({
            id: d.name,
            name: d.name,
            kind: d.kind === "view" ? "view" : "materializedView",
            ...(d.layer ? { layer: d.layer } : {}),
            status: i === pipeline.datasets.length - 1 ? "running" : "completed",
          })),
        ],
        edges: pipeline.datasets.flatMap((d) => (d.depends ?? []).map((from) => ({ from, to: d.name }))),
      };
    }
    case "RunHistory": {
      if (!pipeline) return undefined;
      const day = (n: number, minutes: number) => new Date(Date.UTC(2026, 10, 12 - n, 2, minutes)).toISOString();
      const names = pipeline.datasets.map((d) => d.name);
      return {
        runs: [
          { id: `${pipeline.id}-42`, state: "completed", startTime: day(0, 0), endTime: day(0, 1), trigger: "schedule", datasets: names },
          { id: `${pipeline.id}-41`, state: "failed", startTime: day(1, 0), endTime: day(1, 2), trigger: "schedule", datasets: names, errorMessage: `A check on ${names.at(-1)} failed.` },
          { id: `${pipeline.id}-40`, state: "completed", startTime: day(2, 0), endTime: day(2, 1), trigger: "manual", refreshKind: "fullRefresh", datasets: names },
        ],
      };
    }
    case "ExpectationsPanel": {
      const rules = (pipeline?.datasets ?? []).flatMap((d) => (d.expectations ?? []).map((e) => ({ ...e, dataset: d.name })));
      if (rules.length === 0) return undefined;
      return {
        expectations: rules.slice(0, 8).map((r) => {
          const failed = spread(r.name, 60);
          return { name: r.name, dataset: r.dataset, constraint: r.constraint, action: r.action ?? "warn", passedRecords: 1000 - failed, failedRecords: failed };
        }),
      };
    }
    case "PiiReview": {
      const table = seed.tables.find((t) => t.columns.some((c) => c.pii));
      if (!table) return undefined;
      return {
        ...props,
        table: table.name,
        columns: table.columns.slice(0, 12).map((c) => ({ name: c.name, type: c.type, ...(c.pii ? { category: PII_CATEGORY[c.pii], basis: "name" } : {}) })),
      };
    }
    case "PlanReview": {
      if (seed.issues.length === 0) return undefined;
      const tables = [...new Set(seed.issues.map((i) => i.table))];
      return {
        ...props,
        title: `Clean the ${seed.title.toLowerCase()} data`,
        summary: `${seed.issues.length} problems found in ${tables.join(", ")} before they feed a dashboard.`,
        steps: seed.issues.slice(0, 5).map((issue, i) => ({
          id: `step-${i + 1}`,
          title: `${ISSUE_TITLE[issue.kind]} in ${issue.table}${issue.column ? `.${issue.column}` : ""}`,
          detail: issue.description,
          kind: "Clean",
          affects: issue.table,
          sql: issue.sql,
          // Removing rows cannot be taken back once the dashboard reads them, so it starts unticked.
          ...(issue.kind === "duplicates" || issue.kind === "orphans" ? { risk: "high" } : {}),
        })),
      };
    }
    case "StepFlow":
      return {
        ...props,
        label: `Connect the ${seed.title.toLowerCase()} data`,
        steps: [
          { id: "find", title: `Find the ${seed.tables.length} tables`, status: "done" },
          { id: "secret", title: "Add the credential on the server", detail: "Set the secret's variables on the server, then tell me.", status: "waiting" },
          { id: "test", title: "Test the connection", status: "pending" },
        ],
      };
    case "PipelineView":
      return pipeline ? { ...props, pipelineId: pipeline.id } : undefined;
    case "DatasetReview": {
      const dataset = pipeline?.datasets.at(-1);
      if (!pipeline || !dataset) return undefined;
      return {
        ...props,
        pipeline: {
          id: pipeline.id,
          name: pipeline.name,
          sourceId,
          datasets: pipeline.datasets.map((d) => ({
            name: d.name,
            sql: d.sql,
            ...(d.depends ? { inputs: d.depends, inputsDeclared: true } : {}),
            ...(d.grain ? { grain: d.grain } : {}),
            ...(d.primaryKey ? { primaryKey: d.primaryKey } : {}),
            ...(d.columns ? { columns: d.columns } : {}),
          })),
        },
        dataset: dataset.name,
      };
    }
    default:
      return undefined;
  }
}

/**
 * The example's props without `id` and `component`, rewritten for the data
 * picked in the sidebar: the catalog's examples are written against the
 * sample orders, so their source, SQL and columns are swapped for the picked
 * dataset's own measures, breakdowns and tables.
 */
/**
 * Examples that hold no query but are worded for the sample orders (a heading, a headline figure, a block of SQL, a
 * proposal to a model, files to bring in), reworded from the picked model's own dashboard, tables and starter model.
 */
function wordedExample(name: string, props: Record<string, unknown>, f: DataFocus, sourceId: string): Record<string, unknown> | undefined {
  const seed = seedById(sourceId);
  if (!seed) return undefined;
  const b = f.breakdown;
  const grouped = `SELECT ${b.x}, COUNT(*) AS n\nFROM (${b.sql}) AS t\nGROUP BY ${b.x}\nORDER BY n DESC`;
  switch (name) {
    case "Text":
      return { ...props, text: f.title };
    case "Stat":
      return { label: f.measure.label, value: { "@path": "/revenue" }, delta: "+5.4% vs last quarter", tone: "positive" };
    case "SqlEditor":
      return { ...props, sql: `SELECT * FROM ${f.table}` };
    case "CodeBlock":
      return { ...props, code: grouped };
    case "IngestWizard":
      return { ...props, location: `s3://acme-lake/landing/${f.table}/*.parquet` };
    // The picked seed's own starter model; a proposal written for the retail model would name fields this one lacks.
    case "SemanticModelEditor": {
      const model = seedSemanticModels(seed)[0];
      return model ? (model.name === props.model ? props : { model: model.name, proposedBy: "the analytics agent" }) : props;
    }
    default:
      return undefined;
  }
}

/**
 * What a `RowList` example draws for each row: a card of the picked table's first columns, each read from the row
 * by a relative path. Undefined where the table's columns are not known here (a source that is not a sample model).
 */
export function rowTemplate(props: Record<string, unknown>): SurfaceComponent[] | undefined {
  const seed = typeof props.sourceId === "string" ? seedById(props.sourceId) : undefined;
  const table = seed?.tables.find((t) => typeof props.sql === "string" && props.sql.trim().endsWith(` ${t.name}`));
  if (!table || typeof props.child !== "string") return undefined;
  const [first, ...rest] = table.columns.slice(0, 5).map((c) => c.name);
  if (!first) return undefined;
  const id = props.child;
  return [
    { id, component: "Card", child: `${id}-body` },
    { id: `${id}-body`, component: "Column", children: [`${id}-title`, ...(rest.length > 0 ? [`${id}-facts`] : [])] },
    { id: `${id}-title`, component: "Text", variant: "h4", text: { "@call": "formatString", args: { value: `${first} \${${first}|–}` } } },
    ...(rest.length > 0 ? [{ id: `${id}-facts`, component: "KeyValue", items: rest.map((column) => ({ label: column, value: { "@call": "formatString", args: { value: `\${${column}|–}` } } })) }] : []),
  ];
}

export function exampleProps(name: string, source: ActiveSource, thirds?: { to: number; label: string }[]): Record<string, unknown> {
  // An app component has no catalog entry; its page starts from its own example.
  if (!analyticsCatalog.components[name]) return {};
  const { id: _id, component: _component, ...props } = analyticsCatalog.components[name]!.example;
  // Pipelines, quality rules, personal data and cleaning plans come from the picked model itself, not the catalog's
  // own example, so they change with the data picker as everything else does.
  const seeded = seedExample(name, props, source.sourceId);
  if (seeded) return seeded;
  const f = focusFor(source.sourceId, firstTable(source));
  const worded = wordedExample(name, props, f, source.sourceId);
  if (worded) return worded;
  if (!JSON.stringify(props).includes('"lake"')) return props;
  const sourceId = source.sourceId;
  const { measure: m, breakdown: b, trend: t, series } = f;
  const measure = { sql: m.sql, ...(m.column ? { column: m.column } : {}), aggregate: m.aggregate, label: m.label, ...(m.format ? { format: m.format } : {}) };
  const grouped = `SELECT ${b.x}, COUNT(*) AS n\nFROM (${b.sql}) AS t\nGROUP BY ${b.x}\nORDER BY n DESC`;
  const seed = seedById(sourceId);
  switch (name) {
    case "Metric":
      return { sourceId, ...measure };
    case "DataGrid":
    case "QueryResult":
      return { ...props, sourceId, sql: f.rowsSql };
    case "RowList":
      return { sourceId, sql: f.rowsSql, child: "row", label: f.table, pageSize: 6, layout: "grid" };
    case "Chart":
      return { sourceId, sql: b.sql, type: "bar", x: b.x, y: b.y, ...(b.yTitle ? { yTitle: b.yTitle } : {}), label: `${b.label}, largest first` };
    case "PivotTable":
      return series.splitBy
        ? { sourceId, sql: series.sql, rows: [series.splitBy], columns: [{ column: series.x, grain: "quarter" }], measures: series.y }
        : { sourceId, sql: b.sql, rows: [b.x], measures: b.y };
    case "Sparkline":
      return { sourceId, sql: t.sql, x: t.x, grain: "month", ...(t.column ? { column: t.column } : {}), aggregate: t.aggregate, label: t.label, ...(t.format ? { format: t.format } : {}) };
    case "BulletGraph": {
      const a = f.amount;
      if (!a.column || !thirds) return { ...props, sourceId: source.sampleId };
      return { sourceId, sql: a.sql, column: a.column, aggregate: "avg", label: `${a.label}, average per row`, ...(a.format ? { format: a.format } : {}), ranges: thirds };
    }
    case "SqlProposal":
      return { sourceId, title: b.label, sql: grouped };
    case "QueryPlan":
      return { sourceId, sql: grouped };
    case "ObjectDetail":
    case "RelationshipGraph":
      return { ...props, sourceId, table: f.table };
    case "ContextBuilder":
      return { ...props, name: f.title, tables: [{ sourceId, table: f.table }] };
    case "ModelDiagram": {
      if (!seed) return { ...props, sourceId };
      const names = seed.tables.filter((t) => t.name === f.table || (t.foreignKeys ?? []).some((k) => k.table === f.table) || seed.tables.find((x) => x.name === f.table)?.foreignKeys?.some((k) => k.table === t.name)).map((t) => t.name).slice(0, 4);
      return { ...props, sourceId, tables: names, joins: joinsOf(seed.tables, names) };
    }
    case "KeyValue":
      return { ...props, items: [{ label: "Source", value: sourceId }, { label: "Rows", value: { "@path": "/rows" } }] };
    // Pills are generated from the picked data's own columns, so nothing written for the sample orders is carried over.
    case "ReportBuilder":
      return { sourceId, sql: f.cross.sql, title: `${f.title} report`, tiles: [{ id: "headline", rows: [], values: [f.cross.measure.column, "rows"], span: 3 }, { id: "by-first", rows: [f.cross.dimensions[0]], values: [f.cross.measure.column], span: 3 }], draft: { rows: [f.cross.dimensions[0]], values: [f.cross.measure.column] } };
    case "Explorer":
      return { sourceId, sql: f.cross.sql, rows: [f.cross.dimensions[0]], values: [f.cross.measure.column] };
    case "FilterBar":
      return { sourceId, sql: f.cross.sql, filters: { "@path": "/filters" }, columns: [...f.cross.dimensions, f.cross.time] };
    case "FileBrowser":
      return { sourceId, local: true, height: 360 };
    default:
      return JSON.parse(JSON.stringify(props).replaceAll('"lake"', JSON.stringify(sourceId))) as Record<string, unknown>;
  }
}

