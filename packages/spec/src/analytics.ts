import { z } from "zod";
import { basicComponents } from "./basics.js";
import { type ComponentDefinition, type EventDefinition, defineCatalog, withMinHeight } from "./catalog.js";
import { action, childId, dataBinding, dynamicNumber, dynamicString } from "./dynamic.js";

const tone = z.enum(["neutral", "positive", "negative", "warning"]);
const AGGREGATES = ["sum", "avg", "count", "count_distinct", "min", "max", "median", "stddev", "variance", "percentile"] as const;
const STATUS = z.enum(["idle", "starting", "running", "completed", "failed", "cancelled", "skipped"]);
const FILTER_LIST = z
  .array(
    z.strictObject({
      column: z.string(),
      op: z.enum(["eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "between", "contains", "starts_with", "ends_with", "is_null", "is_not_null", "since"]),
      values: z
        .array(z.union([z.string(), z.number(), z.boolean()]))
        .max(1000)
        .optional()
        .describe(
          'None for is_null and is_not_null, two for between, otherwise one (several for in and not_in). For since, one relative range: "7d", "4w", "3m", "1y", or "week", "month", "quarter", "year" for the start of this one. Use since for anything like "the last 30 days": it is worked out when the query runs, so it does not go stale.',
        ),
    }),
  )
  .max(20);
const FILTERS = z
  .union([FILTER_LIST, dataBinding])
  .describe(
    "Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ \"@path\": \"/filters\" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.",
  );
/** A field as a pill: an attribute, a metric or a derived metric. */
const PILL = z.strictObject({
              id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).describe("Its name in calculations and on the shelves. Unique."),
              kind: z.enum(["attribute", "metric", "derived"]),
              label: z.string(),
              column: z.string().optional().describe("Attributes and metrics: the column. A metric without one counts rows."),
              grain: z.enum(["minute", "hour", "day", "week", "month", "quarter", "year"]).optional().describe("A date or time attribute: the size of its buckets."),
              aggregate: z.enum(["sum", "avg", "count", "count_distinct", "min", "max", "median"]).optional().describe("Metrics: how the column is summarised."),
              expression: z.string().max(400).optional().describe("Derived metrics: arithmetic over metric ids, e.g. \"refund_amount / line_amount\"."),
              format: z.enum(["number", "compact", "currency", "percent"]).optional(),
              description: z.string().optional(),
              by: z.string().optional().describe("Who made it. Put your own name here for fields you write; it is shown on the pill."),
              model: z.string().optional().describe("Set by the component on a field that is the semantic model's own. Do not set it yourself."),
            });

const JOIN_TYPE = z
  .enum(["inner", "left", "right", "full"])
  .describe('Which rows it keeps, read from `left` to `right`: "left" every row of the left table, "inner" only rows that match, "right" every row of the right table, "full" every row of both.');

const SEMANTIC_JOIN = z.strictObject({
  left: z.string().describe("A table of the model."),
  right: z.string().describe("Another table of the model."),
  keys: z
    .array(z.strictObject({ leftColumn: z.string(), rightColumn: z.string() }))
    .min(1)
    .max(4)
    .describe("The columns that match, a column of `left` with one of `right`."),
  type: JOIN_TYPE.optional().describe('Which rows it keeps, read from `left` to `right`. Put the table nearer the first on the left and leave this out: "left", so adding detail never drops one of the model\'s rows. "inner" drops rows with no match; "right" and "full" add rows that are not the first table\'s.'),
});

const CHART_KIND = z.enum(["bar", "line", "area"]);
/** How a view's shelves are drawn: the same shape as `ExploreChartSettings` in components. */
const EXPLORE_CHART = z
  .strictObject({
    type: CHART_KIND.optional().describe("How measures are drawn unless one says otherwise. Left out: a line over time, bars otherwise."),
    swap: z.boolean().optional().describe("Turn bars on their side: the breakdown down the left, the measure along the bottom. Bars on one scale only; ignored otherwise."),
    measures: z
      .record(z.string(), z.strictObject({ type: CHART_KIND.optional(), axis: z.enum(["left", "right"]).optional() }))
      .optional()
      .describe("Per measure, by pill id: its own type (a line over bars) and `axis: \"right\"` for a second scale. Use a second scale only for two measures of very different sizes; the chart says beneath itself that two scales can mislead."),
  })
  .describe("How the chart is drawn. Left out, it is chosen from what is on the shelves.");

const SEMANTIC_ROWS = z
  .strictObject({
    grain: z.string().max(200).optional().describe('What one row is, in a sentence: "One order line."'),
    primaryKey: z.array(z.string()).max(8).optional().describe("The columns that make a row unique. The engine checks it before the model is saved."),
    tables: z.array(z.string()).max(8).optional().describe("The tables, the first being the one whose rows are the model's rows. The query is generated from them and `joins`."),
    joins: z.array(SEMANTIC_JOIN).max(12).optional().describe("Joins that add one row of detail to each row of the first table: a line's order, product or store. A join that repeats rows makes the key fail."),
    sql: z.string().max(8000).optional().describe("A single read-only SELECT, in place of tables and joins, when the rows need more than joins (a computed column, a filter, a union)."),
    dataset: z
      .strictObject({ pipeline: z.string().describe("The pipeline's id."), dataset: z.string().describe("The dataset's name.") })
      .optional()
      .describe("A dataset a pipeline builds, in place of tables, joins and a query: the model reads its table. Prefer it when a pipeline already builds the rows. Give the dataset's grain and primaryKey from describe_pipeline (the pipeline checks that key after every build) and fields from its columns. The editor shows when it was last built and how its checks went."),
  })
  .describe("What one row is and where the rows come from. Parts left out stay as they are.");

const MODEL_NAME = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/)
  .describe(
    "The name of a semantic model (list them with list_semantic_models). Its dimensions, measures and metrics become the pills, marked as the model's, so a metric means what the model defines; its source and query are used when `sourceId` and `sql` are left out. Prefer it to writing `fields` whenever a model covers the data. A person can add a field they make to the model.",
  );

const SORTS = z
  .array(z.strictObject({ column: z.string(), desc: z.boolean().optional() }))
  .max(8)
  .describe("Sort order, most important first. An empty list clears it.");
const COLUMNS = z
  .strictObject({
    order: z.array(z.string()).max(500).optional().describe("Column names in display order; the rest follow in the query's order."),
    hidden: z.array(z.string()).max(500).optional(),
    widths: z.record(z.string(), z.number().min(60).max(1200)).optional().describe("Widths in px by column name."),
    labels: z.record(z.string(), z.string().max(120)).optional().describe('Headers to show in place of column names, by column name ("Starts" for starts_at).'),
  })
  .describe("Which columns show, in what order, how wide, and under what headers.");
const DIMENSION = z.union([
  z.string(),
  z.strictObject({
    column: z.string(),
    grain: z.enum(["minute", "hour", "day", "week", "month", "quarter", "year"]).optional().describe("Group a date or time column by this size."),
    label: z.string().optional(),
  }),
]);

/**
 * What each interactive component adds to its event, keyed by what the
 * person does. Kept beside the catalog so docs, the prompt and the
 * playground can list them.
 */
const str = (about: string) => z.string().describe(about);

/**
 * What a data component says to the people using the page when its query answers with no rows or fails,
 * written by whoever designs the page. Spread into each data component's props.
 */
const MESSAGES = {
  emptyMessage: dynamicString
    .optional()
    .describe("What the people using the page read when the query answers with no rows, in place of the component's own empty text. Say what is missing and what to try: \"No orders this week yet.\""),
  errorMessage: dynamicString
    .optional()
    .describe("What the people using the page read when the query fails, in place of the database's error text, which is kept for developers. Say what went wrong in their terms and what to do."),
};

/** Catalog navigation that works inside a saved surface, with no agent: opening a table writes its name to the surface's own data. */
const OPENED_NOTE =
  "Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.";
const openedBinding = dataBinding.optional().describe("Where the opened table's name is written in this surface's data model.");
const joinShape = z.object({ left: z.string(), right: z.string(), keys: z.array(z.object({ leftColumn: z.string(), rightColumn: z.string() })), inferred: z.boolean().optional(), declared: z.boolean().optional() });
const EVENTS: Record<string, Record<string, EventDefinition>> = {
  Chips: { choose: { description: "When a chip is pressed.", context: { value: str("the chip's value: its text, unless the item sets a value") } } },
  DecisionCard: { choose: { description: "When an option is chosen.", context: { choice: str("the option's id"), label: str("the option's label") } } },
  SqlProposal: { run: { description: "When a person presses Run.", context: { sql: str("the SQL as run") } } },
  SqlEditor: { run: { description: "When a person runs the SQL.", context: { sql: str("the SQL as written") } } },
  ObjectBrowser: { select: { description: "When a table, column or join is picked.", context: { table: str("table name"), column: str("column name, or empty") } } },
  ReportBuilder: { ask: { description: "When a person asks for a field, a view or a whole report in words. Answer by updating this component's `fields`, `tiles`, `filters` and `draft`.", context: { text: str("what they asked for") } } },
  Explorer: { ask: { description: "When a person asks for a field or a view in words. Answer by updating this component's `fields`, `rows`, `split` and `values`.", context: { text: str("what they asked for") } } },
  SemanticModelEditor: {
    save: {
      description: "When a person saves the draft as the model's next version, or a new model as version 1. Every report on the model now uses it.",
      context: {
        model: str("the model's name"),
        version: z.number().describe("the version saved"),
        changes: z.record(z.string(), z.string()).describe("each changed field's name and whether it was added, changed or removed; a part of the rows appears as (grain), (primaryKey), (joins), (sql) or (dataset)"),
      },
    },
    ask: { description: "When a person asks for a change, or for a new model, in words. Answer by updating this component's `proposed` (and `create`).", context: { text: str("what they asked for") } },
  },
  FilterBar: { change: { description: "When a person adds or removes a filter.", context: { filters: z.array(z.unknown()).describe("the whole filter list, as the `filters` prop takes it") } } },
  Chart: { select: { description: "When a person clicks a bar or point.", context: { column: str("the x column"), value: str("the clicked x value"), series: str("the series clicked") } } },
  FileBrowser: {
    open: {
      description: "When a person opens a file (Enter or a double click).",
      context: { path: str("the file's path in its place"), name: str("the file's name"), place: str("the source id, or local:<folder> for a folder on their computer"), format: str("parquet, csv, json, delta or iceberg, or empty") },
    },
  },
  ModelDiagram: {
    use: {
      description: "When a person presses Use as query.",
      context: { sql: str("the generated SELECT"), tables: z.array(z.string()).describe("the tables"), joins: z.array(joinShape).describe("the joins kept") },
    },
  },
  DataSearch: { open: { description: "When a result is opened.", context: { table: str("table name"), column: str("column name, or empty") } } },
  RelationshipGraph: { open: { description: "When a related table is opened.", context: { table: str("table name") } } },
  NodeGraph: { select: { description: "When a node is opened, on the graph or in the list beside it.", context: { node: str("the node's id") } } },
  ObjectDetail: { open: { description: "When a related table is opened.", context: { table: str("table name") } } },
  PipelineGraph: { select: { description: "When a node is chosen.", context: { id: str("node id"), name: str("node name") } } },
  PipelineView: {
    started: { description: "When a person starts a run here.", context: { event: str("started"), runId: str("the run"), state: str("running, or how it already ended") } },
    finished: {
      description: "When a run a person started here ends.",
      context: {
        event: str("finished"),
        runId: str("the run"),
        state: str("completed, failed or cancelled"),
        built: z.number().describe("datasets built"),
        failed: z.array(z.string()).describe("datasets that failed"),
        failedChecks: z.array(z.string()).describe("checks that failed, as dataset.check"),
      },
    },
  },
  DatasetReview: {
    decide: {
      description: "When the person approves (and the page saved it) or rejects the dataset.",
      context: {
        approved: z.boolean().describe("whether it was approved"),
        version: z.number().optional().describe("the version saved, when approved and saved"),
        approvedBy: z.string().optional().describe("who approved it"),
        digest: z.string().optional().describe("the digest of the pipeline as approved"),
        note: z.string().optional().describe("the person's note, if any"),
      },
    },
  },
  PlanReview: {
    decide: {
      description: "When the plan is approved or rejected.",
      context: { approved: z.boolean().describe("whether the plan was approved"), stepIds: z.array(z.string()).describe("the steps left ticked"), note: z.string().optional().describe("the person's note, if any") },
    },
  },
  ActionReceipt: { undo: { description: "When a person asks to undo what ran. Ask again before undoing; this is a request, not an approval." } },
  PiiReview: {
    decide: {
      description: "When the review is confirmed.",
      context: {
        table: str("table name"),
        columns: z.array(z.object({ name: z.string(), category: z.string().optional(), action: z.string() })).describe("each column's category and treatment"),
        confirmed: z.boolean().describe("true when the person confirmed they may decide this"),
      },
    },
  },
};

function withEvents<K extends string>(components: Record<K, ComponentDefinition>): Record<K, ComponentDefinition> {
  return Object.fromEntries(Object.entries<ComponentDefinition>(components).map(([name, definition]) => [name, EVENTS[name] ? { ...definition, events: EVENTS[name] } : definition])) as Record<K, ComponentDefinition>;
}

/**
 * The Surfaces analytics catalog: the basic components (`basicsCatalog`), plus summary, data, discovery,
 * modelling, pipeline and conversation components bound to queries.
 */
export const analyticsCatalog = defineCatalog({
  id: "urn:surfaces:catalog:analytics:v1",
  title: "Surfaces analytics",
  description: "Layout, summary, data, discovery and conversation components for dashboards, query results and chat.",
  components: withMinHeight(withEvents({
    Text: basicComponents.Text,
    Row: basicComponents.Row,
    Column: basicComponents.Column,
    Grid: basicComponents.Grid,
    Card: basicComponents.Card,
    Divider: basicComponents.Divider,
    Workspace: {
      description:
        "Several children side by side as panels a person can arrange: drag a panel by its heading to another column or to an edge for a column of its own, resize with the dividers, and hide or show panels from a rail. " +
        "`layout.columns` says where the panels are: a list of columns from left to right, each a list of panel ids from top to bottom, so search on the left and a map on the right is `[[\"search\"], [\"map\"]]`. " +
        "To rearrange, send the component again with a new `layout`; how a person left it comes back to you in the surface's controls as `layout`. Panels not placed are added to the last column. Each panel shows on a rail as an icon, with its name in a tooltip and, when a person turns names on, a short name under it: keep titles to a few words, and give `short` and `icon` so the rail reads well. Use it when a person will work across several views at once; use Grid or Row for a fixed arrangement.",
      props: {
        label: z.string().optional().describe("What the workspace is, for assistive technology."),
        panels: z
          .array(
            z.strictObject({
              id: z.string(),
              title: z.string().describe("The panel's heading: one to three words."),
              short: z.string().max(14).optional().describe("A shorter name for the rail, which has room for about ten characters a line. Give one when the title is longer than that."),
              icon: z.enum(["surface", "agent", "components", "table", "code", "data", "history", "save", "search", "map", "chart", "grid", "settings", "note", "folder", "person", "bell", "people"]).optional().describe("The rail's icon. Left out, the title's first letter."),
              child: childId,
            }),
          )
          .min(1)
          .max(12),
        layout: z
          .strictObject({
            columns: z.array(z.array(z.string())).max(4).describe("Panel ids: one list per column, left to right; each list top to bottom."),
            columnWidths: z.array(z.number().positive()).optional().describe("One share per column; they are scaled to add up to 1. Left out, columns are equal."),
            rowHeights: z.array(z.array(z.number().positive())).optional().describe("One share per panel of each column. Left out, panels are equal."),
            hidden: z.array(z.string()).optional().describe("Panels that exist but are not shown; the rail brings them back."),
            collapsed: z.array(z.string()).optional().describe("Panels folded to their heading. A column always keeps one open."),
            places: z
              .record(z.string(), z.strictObject({ column: z.number().int().min(0), row: z.number().int().min(0), sole: z.boolean().optional() }))
              .optional()
              .describe("Where hidden panels were, so they come back to the same place. Reported back to you; you need not set it."),
          })
          .optional(),
        rail: z.enum(["left", "right", "none"]).optional().describe("Where the rail of panel toggles sits. Defaults to right."),
        railLabels: z.boolean().optional().describe("Whether the rail shows a short name under each icon. Left out, the rail is icons only and each name shows in a tooltip; a person can turn names on."),
        height: z.number().int().min(240).max(1600).optional().describe("How tall the workspace is, in pixels. Panels scroll inside it. Defaults to 520."),
      },
      example: {
        id: "explore",
        component: "Workspace",
        label: "Explore the catalog",
        panels: [
          { id: "search", title: "Table search", short: "Search", icon: "search", child: "search" },
          { id: "map", title: "Relationship map", short: "Map", icon: "map", child: "map" },
        ],
        layout: { columns: [["search"], ["map"]], columnWidths: [0.4, 0.6] },
        height: 520,
      },
    },
    SideNav: basicComponents.SideNav,
    Tabs: basicComponents.Tabs,
    Button: basicComponents.Button,
    TextField: basicComponents.TextField,
    NumberField: basicComponents.NumberField,
    ChoicePicker: basicComponents.ChoicePicker,
    CheckBox: basicComponents.CheckBox,
    DateTimeInput: basicComponents.DateTimeInput,
    Slider: basicComponents.Slider,
    Form: basicComponents.Form,
    Stat: {
      description: "One headline number with a label, and optionally how it changed.",
      props: {
        label: dynamicString,
        value: z.union([dynamicString, dynamicNumber]),
        delta: dynamicString.optional().describe('Change text, e.g. "+5.4% vs last quarter".'),
        tone: tone.optional().describe("Colour of the change text."),
      },
      example: { id: "revenue", component: "Stat", label: "Revenue", value: { "@path": "/revenue" }, delta: "+5.4% vs last quarter", tone: "positive" },
    },
    KeyValue: {
      description: "A short list of labelled facts.",
      props: { items: z.array(z.strictObject({ label: dynamicString, value: z.union([dynamicString, dynamicNumber]) })).min(1) },
      example: { id: "facts", component: "KeyValue", items: [{ label: "Source", value: "lake" }, { label: "Rows", value: { "@path": "/rows" } }] },
    },
    Metric: {
      description: "One headline number worked out by the database from a query: a total, an average, a count. Use it for dashboard figures; use Stat only for a number you already have.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement."),
        filters: FILTERS.optional(),
        column: z.string().optional(),
        aggregate: z.enum(AGGREGATES),
        percentile: z.number().min(0).max(1).optional(),
        label: dynamicString,
        format: z.enum(["number", "compact", "currency", "percent"]).optional(),
        currency: z.string().length(3).optional(),
        ...MESSAGES,
      },
      example: { id: "revenue", component: "Metric", sourceId: "lake", sql: "SELECT * FROM orders", column: "amount", aggregate: "sum", label: "Revenue", format: "currency" },
    },
    Badge: {
      description: "A small status label.",
      props: { text: dynamicString, tone: tone.optional() },
      example: { id: "status", component: "Badge", text: "Up to date", tone: "positive" },
    },
    Progress: {
      description: "Progress toward a total.",
      props: { value: dynamicNumber, max: dynamicNumber.optional(), label: dynamicString.optional() },
      example: { id: "load", component: "Progress", value: 42, max: 100, label: "Rows loaded" },
    },
    DataGrid: {
      description:
        "A table over a SQL query, for any number of rows. Sorting and paging run in the database. Use it to show rows; use Chart to show a trend or comparison.",
      props: {
        sourceId: dynamicString.describe("The data source to query."),
        sql: dynamicString.describe("A single read-only SELECT statement."),
        mode: z.enum(["scroll", "pages"]).optional(),
        sorts: SORTS.optional(),
        filters: FILTERS.optional(),
        columns: COLUMNS.optional(),
        height: z.number().int().min(160).max(1200).optional(),
        label: z.string().optional().describe("Accessible name for the table."),
        ...MESSAGES,
      },
      example: { id: "table", component: "DataGrid", sourceId: "lake", sql: "SELECT * FROM orders", height: 360 },
    },
    Chart: {
      description:
        "A chart over a SQL query. Give each measure an aggregate so the database summarises the data; without one the chart plots a random sample of rows. Each entry in y is a series; give series their own type and axis for a compound chart. Choose the form from the comparison: bars for amounts across categories (they are sorted largest first and start at zero), a line with xGrain for change over time, xBins for a distribution, scatter for two measures. Avoid a pie beyond five slices, more than five lines, and a second y scale (use two charts on the same x instead); the chart shows advice when its shape is hard to read.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement."),
        filters: FILTERS.optional(),
        type: z.enum(["bar", "line", "area", "scatter", "pie"]),
        x: z.string().describe("Column for the x axis, or the slices of a pie."),
        xGrain: z
          .enum(["minute", "hour", "day", "week", "month", "quarter", "year"])
          .optional()
          .describe("Group a date or time x column into buckets of this size. Use it for every time series."),
        xBins: z.number().int().min(2).max(200).optional().describe("Group a numeric x column into about this many bins, for a histogram."),
        y: z
          .array(
            z.strictObject({
              column: z.string().optional(),
              aggregate: z.enum(AGGREGATES).optional(),
              percentile: z.number().min(0).max(1).optional().describe("For the percentile aggregate, e.g. 0.9."),
              expression: z
                .string()
                .max(400)
                .optional()
                .describe("A calculation instead of a column: arithmetic (+ - * / and parentheses) over the names in `terms`, e.g. \"refunded / revenue\". The database works it out after summarising. Use it for any rate, share, margin or average of sums; never divide in SQL per row."),
              terms: z
                .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), z.strictObject({ column: z.string().optional(), aggregate: z.enum(AGGREGATES) }))
                .optional()
                .describe("The measures an expression names: each a column and how it is summarised."),
              label: z.string().optional(),
              type: z.enum(["bar", "line", "area", "scatter"]).optional().describe("Draw this series differently from the chart type, e.g. a line over bars."),
              axis: z.enum(["left", "right"]).optional().describe("Use the right axis for a measure on a different scale."),
              slot: z.number().int().min(1).max(12).optional().describe("Which of the theme's series colours to use, from 1. Give a measure the same slot in every chart so it keeps its colour. Never name a colour: the theme chooses them."),
            }),
          )
          .min(1)
          .max(8)
          .describe("One entry per series."),
        splitBy: z.string().optional().describe("Column whose values become separate series."),
        stacked: z.boolean().optional(),
        select: dataBinding
          .optional()
          .describe(
            "Makes the chart a filter: the path of a shared filter list (the one its `filters` and a FilterBar use). A click on a bar filters the page to that x value, a click on it again clears it, and this chart ignores filters on its own x column so the bars a person clicks stay. Only for a category x (no xGrain or xBins).",
          ),
        sort: z.enum(["value", "x"]).optional().describe("Order of bars. Bars over categories are sorted largest first unless you say \"x\". Dates, bins and numbers keep their own order."),
        legend: z.enum(["top", "bottom", "right", "none"]).optional().describe("Leave out: up to four lines are labelled at their ends, and one series needs no legend."),
        xTitle: z.string().optional(),
        yTitle: z.string().optional(),
        yRightTitle: z.string().optional(),
        yFormat: z.enum(["number", "compact", "currency", "percent"]).optional().describe("How the left axis writes its numbers: \"percent\" for a rate (6%, not 0.06), \"currency\" for money. Labels only."),
        height: z.number().int().min(160).max(1200).optional(),
        action: action.optional(),
        label: z.string().optional().describe("Accessible description of what the chart shows."),
        ...MESSAGES,
      },
      example: {
        id: "chart",
        component: "Chart",
        sourceId: "lake",
        sql: "SELECT * FROM orders",
        type: "bar",
        x: "region",
        y: [{ column: "amount", aggregate: "sum", label: "Revenue" }],
        yTitle: "Revenue",
        label: "Revenue by region, largest first",
      },
    },
    PivotTable: {
      description:
        "A pivot table over a SQL query: row values down the side, column values across the top, summarised measures in the cells, with totals. The database does the grouping. Use it to compare a measure across two dimensions.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement."),
        filters: FILTERS.optional(),
        rows: z.array(DIMENSION).min(1).max(4).describe("Columns whose values become the rows."),
        columns: z.array(DIMENSION).max(2).optional().describe("Columns whose values become the columns. Choose ones with few distinct values."),
        measures: z
          .array(
            z.strictObject({
              column: z.string().optional(),
              aggregate: z.enum(AGGREGATES),
              percentile: z.number().min(0).max(1).optional(),
              label: z.string().optional(),
            }),
          )
          .min(1)
          .max(6),
        totals: z.boolean().optional(),
        height: z.number().int().min(160).max(1200).optional(),
        label: z.string().optional().describe("Accessible name for the table."),
        ...MESSAGES,
      },
      example: {
        id: "pivot",
        component: "PivotTable",
        sourceId: "lake",
        sql: "SELECT * FROM orders",
        rows: ["region"],
        columns: [{ column: "ordered_at", grain: "quarter" }],
        measures: [{ column: "amount", aggregate: "sum", label: "Revenue" }],
      },
    },
    QueryResult: {
      description:
        "A query result a person can explore: filters; a table, a chart and a pivot of the same query; and the SQL that ran. Set `view`, `filters`, `sorts` and `columns` to put its controls in a given state; update them to change what a person sees, and they can go on changing them by hand.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString,
        view: z.enum(["grid", "chart", "pivot"]).optional(),
        filters: FILTERS.optional(),
        sorts: SORTS.optional(),
        columns: COLUMNS.optional(),
        height: z.number().int().min(160).max(1200).optional(),
        ...MESSAGES,
      },
      example: { id: "explore", component: "QueryResult", sourceId: "lake", sql: "SELECT * FROM orders" },
    },
    Message: {
      description:
        "One turn of a conversation, for a page that is laid out as a chat: who spoke, what they said (Markdown), and when. Put the turns in a Column, oldest first. " +
        "`side: \"end\"` sets the person's own turns apart from everyone else's; the speaker is always written, so the side is never the only sign. " +
        "Offer replies with Chips after the last turn, and take a typed one with a TextField and a Button. It shows a conversation; it does not run one.",
      props: {
        speaker: dynamicString.describe("Who spoke: a name or a role."),
        text: dynamicString.describe("What they said, as Markdown."),
        side: z.enum(["start", "end"]).optional().describe("\"end\" for the person's own turns. Defaults to \"start\"."),
        time: dynamicString.optional().describe("When, as it should read: \"10:42\" or \"Yesterday\"."),
      },
      example: { id: "turn-1", component: "Message", speaker: "Assistant", text: "Which table holds the articles?", time: "10:42" },
    },
    RowList: {
      description:
        "One component drawn once for each row of a SQL query: a feed of posts, a list of cards, rows that each carry their own buttons. " +
        "`child` is the component drawn per row, usually a Card. Inside it, and in everything it holds, a relative path reads the row's column of that name (`{ \"@path\": \"author\" }`; `formatString` with `${author}` too), " +
        "and a Button's event carries the row's key the same way (`\"context\": { \"post_id\": { \"@path\": \"post_id\" } }`), so you learn which row was acted on. Absolute paths still read the surface's data model. " +
        "The database sorts, filters and pages; a person asks for more rows, up to 200. An input inside a row must bind an absolute path. For plain rows in columns use DataGrid.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement. One row of it is one item."),
        child: childId.describe("ID of the component drawn for each row."),
        label: z.string().describe("What the items are, for assistive technology: \"Posts\"."),
        sorts: SORTS.optional(),
        filters: FILTERS.optional(),
        pageSize: z.number().int().min(1).max(100).optional().describe("Rows fetched at a time. Defaults to 20."),
        rowKey: z.string().optional().describe("A column that tells rows apart, such as the key."),
        layout: z.enum(["list", "grid"]).optional().describe("\"list\" stacks the rows; \"grid\" lays them out as cards, as many across as fit."),
        ...MESSAGES,
      },
      example: { id: "feed", component: "RowList", sourceId: "lake", sql: "SELECT * FROM orders", child: "order-card", label: "Orders", sorts: [{ column: "ordered_at", desc: true }], rowKey: "order_id", pageSize: 10 },
    },
    Markdown: basicComponents.Markdown,
    CodeBlock: {
      description: "Code with a copy button. For SQL a person should be able to run, use SqlProposal instead.",
      props: { code: dynamicString, language: z.string().optional() },
      example: { id: "snippet", component: "CodeBlock", language: "sql", code: "SELECT region, SUM(amount) FROM orders GROUP BY region" },
    },
    Table: {
      description: "A small table of values you already have (at most 100 rows). For query results use DataGrid, which pages in the database.",
      props: {
        columns: z.array(z.string()).min(1).max(12),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(100),
        caption: z.string().optional(),
      },
      example: { id: "top", component: "Table", columns: ["Region", "Revenue"], rows: [["Europe", 1200], ["Asia Pacific", 950]], caption: "Top regions" },
    },
    Link: basicComponents.Link,
    Checklist: {
      description: "A list of steps showing which are done.",
      props: { items: z.array(z.strictObject({ label: dynamicString, done: z.boolean().optional() })).min(1).max(30) },
      example: { id: "plan", component: "Checklist", items: [{ label: "Find the tables", done: true }, { label: "Check the join" }] },
    },
    Chips: {
      description:
        "Short choices a person can pick with one press, such as follow-up questions or tables to look at. The chosen chip is sent back in the event context as `value`. " +
        "An item is its text, or `{ label, value }` when what is sent differs from what is shown. " +
        "Give `selected` a data path and a press also writes the chip's value there, inside the surface; bind another component's prop to the same path and it follows at once, with no agent: " +
        "chips of table names whose values are SELECT statements switch a QueryResult whose `sql` is bound to that path. Set the path in the data model to the value that starts selected.",
      props: {
        items: z.array(z.union([z.string(), z.strictObject({ label: z.string(), value: z.string() })])).min(1).max(12),
        selected: dataBinding.optional().describe("Where the pressed chip's value is written in this surface's data model. The chip holding the value there is shown as pressed."),
        action,
      },
      example: { id: "next", component: "Chips", items: ["Break down by region", "Show last year"], action: { event: { name: "choose" } } },
    },
    DecisionCard: {
      description:
        "Asks a person to choose between options before you continue. Mark the option you recommend. The chosen option's id is sent back in the event context as `choice`.",
      props: {
        title: dynamicString,
        detail: dynamicString.optional(),
        options: z
          .array(z.strictObject({ id: z.string(), label: z.string(), description: z.string().optional(), recommended: z.boolean().optional() }))
          .min(2)
          .max(6),
        action,
      },
      example: {
        id: "grain",
        component: "DecisionCard",
        title: "Which revenue should I use?",
        detail: "The two tables disagree for March.",
        options: [
          { id: "ledger", label: "Finance ledger", description: "Certified, updated nightly.", recommended: true },
          { id: "orders", label: "Orders table", description: "Live, but includes returns." },
        ],
        action: { event: { name: "decide" } },
      },
    },
    Sparkline: {
      description:
        "A word-sized trend line beside its latest value, worked out by the database: no axes, grid or legend. Use it in a table of figures or beside a Metric to show direction; use Chart when the values themselves must be read.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement."),
        filters: FILTERS.optional(),
        x: z.string().describe("The date or time column the line runs along."),
        grain: z.enum(["minute", "hour", "day", "week", "month", "quarter", "year"]),
        column: z.string().optional(),
        aggregate: z.enum(AGGREGATES),
        label: dynamicString,
        format: z.enum(["number", "compact", "currency", "percent"]).optional(),
        currency: z.string().length(3).optional(),
        points: z.number().int().min(2).max(120).optional(),
        ...MESSAGES,
      },
      example: { id: "trend", component: "Sparkline", sourceId: "lake", sql: "SELECT * FROM orders", x: "ordered_at", grain: "month", column: "amount", aggregate: "sum", label: "Revenue", format: "currency" },
    },
    BulletGraph: {
      description:
        "One measure against a target and named bands (poor, fair, good), as a bar from zero. Use it instead of a gauge or a traffic light when a number needs judging against a goal.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement."),
        filters: FILTERS.optional(),
        column: z.string().optional(),
        aggregate: z.enum(AGGREGATES),
        label: dynamicString,
        target: z.number().optional(),
        ranges: z.array(z.strictObject({ to: z.number(), label: z.string() })).min(1).max(5).describe("Where each band ends, lowest first. The last end is the end of the scale."),
        format: z.enum(["number", "compact", "currency", "percent"]).optional(),
        currency: z.string().length(3).optional(),
        ...MESSAGES,
      },
      example: {
        id: "goal",
        component: "BulletGraph",
        sourceId: "lake",
        sql: "SELECT * FROM orders",
        column: "amount",
        aggregate: "sum",
        label: "Revenue",
        format: "currency",
        target: 2000000,
        ranges: [{ to: 1000000, label: "Poor" }, { to: 1800000, label: "Fair" }, { to: 3000000, label: "Good" }],
      },
    },
    StepFlow: {
      description:
        "Where multi-step work stands: onboarding, connecting a source, a cleaning or transformation run. Give a step the status `waiting` when the work has stopped for the person, and say in `detail` what you need from them.",
      props: {
        label: dynamicString,
        steps: z
          .array(z.strictObject({ id: z.string(), title: z.string(), detail: z.string().optional(), status: z.enum(["done", "current", "waiting", "pending", "failed", "skipped"]) }))
          .min(1)
          .max(20),
      },
      example: {
        id: "flow",
        component: "StepFlow",
        label: "Connect the sales lake",
        steps: [
          { id: "find", title: "Find the tables", status: "done" },
          { id: "secret", title: "Add the credential on the server", detail: "Set LAKE_KEY_ID and LAKE_SECRET, then tell me.", status: "waiting" },
          { id: "test", title: "Test the connection", status: "pending" },
        ],
      },
    },
    PlanReview: {
      description:
        "A plan a person must approve before you act: cleaning steps, transformations, a connection to set up. List every step with what it changes; mark anything that removes or overwrites data or widens access as `risk: \"high\"` (it starts unticked). The event context carries `approved`, the ticked `stepIds` and any `note`. Do only the approved steps.",
      props: {
        title: dynamicString,
        summary: dynamicString.optional(),
        proposedBy: z.string().optional().describe("Your name, so the person knows who wrote the plan."),
        steps: z
          .array(
            z.strictObject({
              id: z.string(),
              title: z.string(),
              detail: z.string().optional(),
              sql: z.string().optional().describe("What the step would run, for review only."),
              kind: z.string().optional(),
              affects: z.string().optional(),
              risk: z.enum(["low", "medium", "high"]).optional(),
              required: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(20),
        action,
      },
      example: {
        id: "clean",
        component: "PlanReview",
        title: "Clean the orders table",
        summary: "Three fixes before it feeds the revenue dashboard.",
        proposedBy: "Analyst agent",
        steps: [
          { id: "trim", title: "Trim spaces from region", kind: "Clean", affects: "412 of 58,000 rows", sql: "SELECT TRIM(region) AS region FROM orders" },
          { id: "dedupe", title: "Remove repeated order IDs", kind: "Clean", affects: "37 rows removed", risk: "high" },
        ],
        action: { event: { name: "plan_decided" } },
      },
    },
    ActionReceipt: {
      description:
        "What happened after a person approved something: the outcome, who approved it and why, what ran, what changed, and whether it can be undone. Send one after every approved action that changed something, including a failed one. Give `undo` only when undoing is really possible, with `until` when it stops being; leave it out and the receipt says it cannot be undone. The `undo` event is a request: confirm it with the person before acting.",
      props: {
        title: dynamicString,
        outcome: z.enum(["done", "partial", "failed"]),
        summary: dynamicString.optional(),
        ranAt: z.string().optional().describe("ISO time it ran."),
        ranBy: z.string().optional().describe("What ran it: you, a pipeline, a service."),
        approvedBy: z.array(z.strictObject({ by: z.string(), at: z.string().optional(), reason: z.string().optional() })).max(10).optional(),
        sql: z.string().optional().describe("What ran, for the record. Never run from the receipt."),
        changes: z.array(z.strictObject({ label: z.string(), before: z.string().optional(), after: z.string() })).max(20).optional(),
        undo: z.strictObject({ label: z.string(), description: z.string().optional(), until: z.string().optional() }).optional(),
        action: action.optional(),
      },
      example: {
        id: "receipt",
        component: "ActionReceipt",
        title: "Rebuilt orders_clean",
        outcome: "done",
        summary: "58,000 rows replaced with 57,963 after removing repeated order IDs.",
        ranAt: "2026-11-13T10:04:00Z",
        ranBy: "sales pipeline",
        approvedBy: [{ by: "Ada", at: "2026-11-13T10:02:00Z", reason: "Counts checked against finance" }],
        changes: [{ label: "Rows", before: "58,000", after: "57,963" }],
        undo: { label: "Restore the previous version", description: "Restores the table as it was at 10:03. Rows added since then are lost.", until: "2026-11-20T10:04:00Z" },
        action: { event: { name: "undo_requested" } },
      },
    },
    PiiReview: {
      description:
        "A review of a table's columns for personal data before it is shared, charted or sent to a model. Flag a column with the kind of data you suspect and how you know (`basis`); the person chooses the treatment and confirms. The event context carries `table`, `columns` (name, category, action) and `confirmed`. Never treat your own flags as the decision.",
      props: {
        table: z.string(),
        purpose: dynamicString.optional(),
        columns: z
          .array(
            z.strictObject({
              name: z.string(),
              type: z.string().optional(),
              category: z
                .enum(["name", "email", "phone", "address", "government_id", "financial", "date_of_birth", "network", "location", "credential", "health", "demographic"])
                .optional(),
              basis: z.enum(["name", "values", "person"]).optional(),
              action: z.enum(["keep", "mask", "hash", "generalize", "drop"]).optional(),
            }),
          )
          .min(1)
          .max(200),
        action,
      },
      example: {
        id: "pii",
        component: "PiiReview",
        table: "customers",
        purpose: "Before sharing with the marketing workspace.",
        columns: [
          { name: "customer_id", type: "BIGINT" },
          { name: "email", type: "VARCHAR", category: "email", basis: "name" },
          { name: "birth_date", type: "DATE", category: "date_of_birth", basis: "name" },
        ],
        action: { event: { name: "pii_decided" } },
      },
    },
    ThemeSwitch: basicComponents.ThemeSwitch,
    SqlProposal: {
      description:
        "SQL you propose, shown for review. It never runs on its own: a person presses Run, and the result appears beneath it. The event, if given, is sent with `sql` when they do.",
      props: { sourceId: dynamicString, sql: dynamicString, title: z.string().optional(), action: action.optional() },
      example: { id: "proposal", component: "SqlProposal", sourceId: "lake", title: "Revenue by region", sql: "SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region" },
    },
    SqlEditor: {
      description: "An editor for a person to write or change SQL. The event is sent with `sql` when they run it.",
      props: { sql: dynamicString.optional(), dialect: z.enum(["standard", "duckdb", "teradata", "postgres"]).optional(), action: action.optional() },
      example: { id: "editor", component: "SqlEditor", sql: "SELECT * FROM orders", action: { event: { name: "run" } } },
    },
    ObjectBrowser: {
      description:
        "A tree of the source's catalogs, schemas, tables and columns, with the tables each one joins. Use it when a person needs to look around. The event is sent with `table` (and `column`) when they pick something. " + OPENED_NOTE,
      props: { sourceId: dynamicString, height: z.number().int().min(200).max(1200).optional(), opened: openedBinding, action: action.optional() },
      example: { id: "browse", component: "ObjectBrowser", sourceId: "lake", height: 360 },
    },
    ReportBuilder: {
      description:
        "A report built from pills: the dashboard pattern. `fields` are the report's pills (attributes, metrics, derived metrics), defined once so a metric means the same in every view. `tiles` are the views, each a set of shelves (`rows`, `split`, `values`, by pill id) drawn as a chart, a table, or headline numbers when there is nothing to break down by. Every tile follows `filters`, and a click on a bar filters the whole report. In build mode a person makes a view on the shelves and keeps it as a tile, edits pills, retitles, resizes and reorders; in view mode it is the dashboard alone with its filter bar. To write a report yourself, send `fields` and `tiles`; to leave it to the person, send only `sql` and pills are generated from its columns. What they change comes back as this component's controls, so read those first. Give `action` to show a box where they ask in words. Use it for anything with several views over one table or join; use separate Chart and Metric components only when the views read different queries.",
      props: {
        model: MODEL_NAME.optional(),
        sourceId: dynamicString.optional().describe("Where the query runs. Left out with `model`, the model's."),
        sql: dynamicString.optional().describe("A single read-only SELECT statement, wide enough for every view: a table, or a join. Left out with `model`, the model's."),
        title: z.string().optional(),
        fields: z.array(PILL).max(200).optional().describe("The report's pills. Left out, they are generated from the query's columns."),
        filters: FILTER_LIST.optional().describe("Filters every tile follows."),
        tiles: z
          .array(
            z.strictObject({
              id: z.string(),
              title: z.string().optional().describe("Left out, the shelves are read out: \"Refund rate by Category\"."),
              rows: z.array(z.string()).max(3).describe("Attributes to break down by, by pill id. Empty for headline numbers."),
              split: z.string().optional(),
              values: z.array(z.string()).min(1).max(6).describe("Metrics and derived metrics, by pill id."),
              view: z.enum(["chart", "table"]).optional(),
              chart: EXPLORE_CHART.optional(),
              span: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe("How many of the report's three columns it takes."),
            }),
          )
          .max(24)
          .optional(),
        draft: z
          .strictObject({ rows: z.array(z.string()).max(3), split: z.string().optional(), values: z.array(z.string()).max(6), view: z.enum(["chart", "table"]).optional(), chart: EXPLORE_CHART.optional() })
          .optional()
          .describe("What is on the builder's shelves: a view you propose, for the person to add."),
        mode: z.enum(["build", "view"]).optional().describe("Leave out to let the person switch. \"view\" shows the dashboard alone."),
        action: action.optional(),
      },
      example: {
        id: "report",
        component: "ReportBuilder",
        sourceId: "lake",
        sql: "SELECT * FROM orders",
        title: "Orders",
        fields: [
          { id: "region", kind: "attribute", label: "Region", column: "region" },
          { id: "ordered_at", kind: "attribute", label: "Month", column: "ordered_at", grain: "month" },
          { id: "amount", kind: "metric", label: "Revenue", column: "amount", aggregate: "sum", format: "currency" },
          { id: "orders", kind: "metric", label: "Orders", aggregate: "count" },
          { id: "per_order", kind: "derived", label: "Revenue per order", expression: "amount / orders", format: "currency" },
        ],
        tiles: [
          { id: "headline", rows: [], values: ["amount", "orders", "per_order"], span: 3 },
          { id: "by-region", rows: ["region"], values: ["amount"] },
          { id: "over-time", rows: ["ordered_at"], values: ["per_order"], span: 2 },
        ],
      },
    },
    SemanticModelEditor: {
      description:
        "A semantic model, to create, read and change: what one row is (the grain) and the columns that make it unique, where the rows come from (tables and joins, or a written query), and its dimensions (ways to break rows down), measures (a column summarised) and metrics (arithmetic over measures), each with who defined it. Every Explorer and ReportBuilder given this `model` takes its fields from it, so a change here changes every report on it. To propose a change, send `proposed` with the fields to add or replace (in the pill form: an attribute is a dimension, a metric a measure, a derived metric a metric), the names to remove and any change to the rows, and `proposedBy` with your name; read the model with describe_semantic_model first. To propose a new model, send `create` with its label and source and `proposed` with its rows and fields; read the tables with describe_table first and join from the table whose rows the model counts to tables that add one row of detail each. Either way it is shown as a draft, marked part by part and checked as it is made, and a person can change the joins, the grain, the key and every field before saving; nothing is kept until they save. What the person changes comes back as `proposed` in this component's controls. Give `action` to receive the `save` event, and the `ask` event with `text` when the person asks for something in words.",
      props: {
        model: MODEL_NAME.describe("The semantic model to show, or with `create` the name of the one to make."),
        create: z
          .strictObject({
            label: z.string().max(80).describe("Its name for people."),
            description: z.string().max(400).optional().describe("What it is for."),
            sourceId: z.string().describe("The source its rows come from."),
          })
          .optional()
          .describe("Propose a new model named `model`. Its rows and fields go in `proposed`. When a model of that name exists, the proposal is shown as a change to it instead."),
        proposed: z
          .strictObject({
            add: z.array(PILL).max(60).optional().describe("Fields to add, or to put in place of the field of the same id."),
            remove: z.array(z.string()).max(60).optional().describe("Names of fields to take out."),
            rows: SEMANTIC_ROWS.optional(),
          })
          .optional()
          .describe("A change you propose, or a new model's rows and fields. Shown as a draft for a person to read, change and save, or drop."),
        proposedBy: z.string().optional().describe("Who proposed it: your name. Shown above the changes."),
        action: action.optional(),
      },
      example: {
        id: "model",
        component: "SemanticModelEditor",
        model: "sales_lines",
        proposed: {
          add: [{ id: "cost_share", kind: "derived", label: "Cost share", expression: "cost / revenue", format: "percent", description: "Cost as a share of revenue." }],
          remove: ["brand"],
        },
        proposedBy: "the analytics agent",
        action: { event: { name: "model.saved" } },
      },
    },
    Explorer: {
      description:
        "Exploring a query with pills, as a person would in a BI tool but with nothing defined in advance. Each field is a pill: an attribute to break down by, a metric (a column summarised) or a derived metric (arithmetic over metrics: a rate, a margin). Leave `fields` out and pills are generated from the query's columns; send `fields` to add your own metrics and calculations, which a person can then edit. `rows`, `split` and `values` are what is on the shelves, by pill id, and draw a chart and the numbers behind it, worked out by the database. A person drags, presses and edits; what they did comes back as this component's controls, so read those before changing it. Give `action` to show a box where they ask in words, sent as the event with `text`. Use it when someone wants to look around a table or a join themselves; use Chart when you already know the view.",
      props: {
        model: MODEL_NAME.optional(),
        sourceId: dynamicString.optional().describe("Where the query runs. Left out with `model`, the model's."),
        sql: dynamicString.optional().describe("A single read-only SELECT statement: a table, or a join. Every pill is a column of it or a calculation over them. Left out with `model`, the model's."),
        fields: z.array(PILL).max(200).optional().describe("The pills. Left out, they are generated from the query's columns."),
        rows: z.array(z.string()).max(3).optional().describe("Attributes to break down by, by pill id. The first is the x axis."),
        split: z.string().optional().describe("An attribute whose values become separate series."),
        values: z.array(z.string()).max(6).optional().describe("Metrics and derived metrics to show, by pill id."),
        filters: FILTER_LIST.optional(),
        view: z.enum(["chart", "table"]).optional(),
        chart: EXPLORE_CHART.optional(),
        action: action.optional(),
      },
      example: {
        id: "explore",
        component: "Explorer",
        sourceId: "lake",
        sql: "SELECT * FROM orders",
        fields: [
          { id: "region", kind: "attribute", label: "Region", column: "region" },
          { id: "amount", kind: "metric", label: "Revenue", column: "amount", aggregate: "sum", format: "currency" },
          { id: "orders", kind: "metric", label: "Orders", aggregate: "count" },
          { id: "per_order", kind: "derived", label: "Revenue per order", expression: "amount / orders", format: "currency" },
        ],
        rows: ["region"],
        values: ["per_order"],
      },
    },
    FilterBar: {
      description:
        "Filters for a whole page: active filters as removable chips and a form to add one, with each column's values offered from the database and quick date ranges that stay relative. It writes the list to `filters`, a path in the surface's data model; give every Chart, Metric, Sparkline, DataGrid and PivotTable on the page `filters: { \"@path\": \"/filters\" }` with the same path and they all follow it. The views should read the same columns as `sql`, since a filter on a column a view does not have fails. Put the starting filters in the data model with updateDataModel. The event, if given, is sent with `filters` on every change.",
      props: {
        sourceId: dynamicString,
        sql: dynamicString.describe("A single read-only SELECT statement whose columns can be filtered."),
        filters: dataBinding.describe("Where the filter list is kept in the surface's data model, e.g. { path: \"/filters\" }."),
        columns: z.array(z.string()).max(50).optional().describe("Offer only these columns."),
        action: action.optional(),
      },
      example: { id: "filters", component: "FilterBar", sourceId: "lake", sql: "SELECT * FROM orders", filters: { "@path": "/filters" }, columns: ["region", "status", "ordered_at"] },
    },
    FileBrowser: {
      description:
        "A tree of folders and files: a source's storage (only the places it may read) and, with `local`, folders the person opens from their own computer, which their browser reads and nothing uploads. It shows names, sizes, dates and which table reads a file, never what a file holds. Use it when the data a person means is still files: to find what to bring in, or to see what a table reads. The event is sent with `path`, `name`, `place` and `format` when they open a file. You cannot read a local file; ask the person to load it.",
      props: {
        sourceId: dynamicString.optional().describe("List this source's storage. Leave out to offer only folders on the person's computer."),
        local: z.boolean().optional().describe("Offer \"Open a folder on this computer\"."),
        height: z.number().int().min(200).max(1200).optional(),
        action: action.optional(),
      },
      example: { id: "files", component: "FileBrowser", sourceId: "lake", local: true, height: 360, action: { event: { name: "open_file" } } },
    },
    ModelDiagram: {
      description:
        "A relationship diagram: tables as cards with their columns and lines between the columns that join. A person can drag columns together to add joins. Use it to show or agree how tables relate. The event is sent with `sql`, `tables` and `joins` when they press Use as query.",
      props: {
        sourceId: dynamicString,
        tables: z.array(z.string()).min(1).max(12).describe("Tables to show."),
        joins: z
          .array(
            z.strictObject({
              left: z.string(),
              right: z.string(),
              keys: z.array(z.strictObject({ leftColumn: z.string(), rightColumn: z.string() })).min(1),
              inferred: z.boolean().optional().describe("True when you are guessing the join; it is then labelled Inferred."),
              declared: z.boolean().optional().describe("True when the backend reports it as a foreign key; it is then labelled Declared."),
              type: JOIN_TYPE.optional().describe("Which rows it keeps, read from `left` to `right`. Left out, only rows that match."),
            }),
          )
          .optional(),
        rowsFrom: z
          .boolean()
          .optional()
          .describe("The first table's rows are the result's rows: it is marked, the rest are laid out as its detail, and each join says whether it adds one row or can repeat rows. Use it to show which tables can be joined without double counting."),
        suggest: z
          .boolean()
          .optional()
          .describe("False to leave out joins the backend would guess from column names; the joins you send and those the source declares are still shown. Default true."),
        height: z.number().int().min(200).max(1200).optional(),
        action: action.optional(),
      },
      example: {
        id: "model",
        component: "ModelDiagram",
        sourceId: "lake",
        tables: ["orders", "customers"],
        joins: [{ left: "orders", right: "customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }], inferred: true }],
        action: { event: { name: "use_model" } },
      },
    },
    DataSearch: {
      description: `A search box over tables and columns, by name or meaning. The event is sent with \`table\` when a person opens a result. ${OPENED_NOTE}`,
      props: {
        sourceId: dynamicString.optional(),
        opened: openedBinding,
        height: z.number().int().min(160).max(1200).optional().describe("How tall the search is, in pixels. The results scroll inside it. Left out, the list is as long as its results."),
        action: action.optional(),
      },
      example: { id: "find", component: "DataSearch", sourceId: "lake", opened: { "@path": "/table" }, height: 420 },
    },
    ObjectDetail: {
      description: `Everything known about one table: description, certification, columns with statistics and related tables. Bind \`table\` to a path (\`{ "@path": "/table" }\`) to show whichever table a search or graph in the same surface opened. ${OPENED_NOTE}`,
      props: { sourceId: dynamicString, table: dynamicString, opened: openedBinding, action: action.optional() },
      example: { id: "about", component: "ObjectDetail", sourceId: "lake", table: "orders" },
    },
    RelationshipGraph: {
      description: `A small map of one table and the tables it joins with or resembles. For several tables and their columns, use ModelDiagram. ${OPENED_NOTE}`,
      props: { sourceId: dynamicString, table: dynamicString, opened: openedBinding, action: action.optional() },
      example: { id: "around", component: "RelationshipGraph", sourceId: "lake", table: "orders" },
    },
    NodeGraph: {
      description:
        "Things and the links between them, drawn as a graph with the same things listed beside it: concepts in a glossary, tables in a model, systems and what they feed. You give the nodes and links; it reads no data. `group` is what kind of thing a node is (each group takes a colour and is named in the legend); `level` is how far along it is (drawn as how full the node is). Give `selected` a data path to mark the open node and to write the node a person opens there. Past 300 nodes it shows what is around the open node and says how many it left out. For tables and their joins use ModelDiagram; for a pipeline use PipelineGraph.",
      props: {
        label: z.string().describe("What the graph shows, for assistive technology."),
        nodes: z
          .array(z.object({ id: z.string().min(1), label: z.string(), description: z.string().optional(), group: z.string().optional(), level: z.enum(["full", "half", "outline"]).optional() }))
          .max(2000),
        links: z.array(z.object({ source: z.string(), target: z.string(), label: z.string().optional() })).max(8000),
        selected: z.union([z.string(), dataBinding]).optional().describe("The open node's id, or a data path that holds it and is written when a person opens a node."),
        groups: z.array(z.string()).max(12).optional().describe("The order groups take colours and appear in the legend."),
        levels: z.object({ full: z.string().optional(), half: z.string().optional(), outline: z.string().optional() }).optional().describe("What each level means, in words."),
        noun: z.string().optional().describe("What a node is called: \"term\" gives \"7 terms\"."),
        height: z.number().int().min(200).max(1200).optional(),
        action: action.optional(),
      },
      example: {
        id: "concepts",
        component: "NodeGraph",
        label: "Terms and how they are linked",
        noun: "term",
        nodes: [
          { id: "order", label: "Order", level: "full" },
          { id: "customer", label: "Customer", level: "half" },
          { id: "store", label: "Store", level: "outline" },
        ],
        links: [
          { source: "order", target: "customer", label: "placed by" },
          { source: "order", target: "store", label: "taken at" },
        ],
        levels: { full: "Certified", half: "Partly certified", outline: "Not certified" },
        selected: { "@path": "/term" },
        height: 360,
      },
    },
    AskData: {
      description: "A question box that answers from the catalog and cites the tables it used.",
      props: { sourceId: dynamicString.optional(), contextPackId: z.string().optional() },
      example: { id: "ask", component: "AskData", sourceId: "lake" },
    },
    ContextBuilder: {
      description: "Lets a person assemble the tables, columns and notes an agent should work from, and preview exactly what the agent will receive.",
      props: { name: z.string().optional(), tables: z.array(z.strictObject({ sourceId: z.string(), table: z.string() })).max(30).optional() },
      example: { id: "context", component: "ContextBuilder", name: "Sales analysis", tables: [{ sourceId: "lake", table: "orders" }] },
    },
    QueryPlan: {
      description: "How the database intends to run a query, without running it: the steps as a tree and the engine's own plan text. Use it to explain why a query is slow.",
      props: { sourceId: dynamicString, sql: dynamicString.describe("A single read-only SELECT statement.") },
      example: { id: "plan", component: "QueryPlan", sourceId: "lake", sql: "SELECT region, SUM(amount) FROM orders GROUP BY region" },
    },
    SourceList: {
      description: "The data sources available, how each connects (by secret name only) and a button to test that its tables can be reached.",
      props: {},
      example: { id: "sources", component: "SourceList" },
    },
    PipelineGraph: {
      description:
        "A pipeline as a graph of sources, tables, views and sinks with the flows between them and each one's latest status. You supply the nodes and edges as the pipeline engine reported them. The event is sent with `id` and `name` when a node is chosen.",
      props: {
        nodes: z
          .array(
            z.strictObject({
              id: z.string(),
              name: z.string(),
              kind: z.enum(["source", "table", "view", "streamingTable", "materializedView", "temporaryView", "sink"]),
              status: STATUS.optional(),
              layer: z.enum(["bronze", "silver", "gold"]).optional(),
              rowsWritten: z.number().optional(),
              expectationsFailed: z.number().optional().describe("records that broke a row rule"),
              checksFailed: z.number().optional().describe("checks over the whole dataset that failed"),
            }),
          )
          .min(1)
          .max(200),
        edges: z.array(z.strictObject({ from: z.string(), to: z.string(), flowName: z.string().optional(), mode: z.enum(["streaming", "batch"]).optional() })).max(600),
        height: z.number().int().min(160).max(1200).optional(),
        action: action.optional(),
      },
      example: {
        id: "pipeline",
        component: "PipelineGraph",
        nodes: [
          { id: "files", name: "landing files", kind: "source" },
          { id: "raw", name: "orders_raw", kind: "streamingTable", layer: "bronze", status: "completed", rowsWritten: 12000 },
          { id: "daily", name: "daily_revenue", kind: "materializedView", layer: "gold", status: "running" },
        ],
        edges: [
          { from: "files", to: "raw", mode: "streaming" },
          { from: "raw", to: "daily" },
        ],
      },
    },
    PipelineView: {
      description:
        "A pipeline the backend runs, live: its datasets and how they feed one another, its runs, and for each dataset its query, grain, key, columns, row rules and checks with the latest results, with buttons to run, check or rebuild it. Give `action` to hear when a person's run starts and ends (`started`, `finished`). Use PipelineGraph instead when you only have a description of a pipeline to draw.",
      props: { pipelineId: dynamicString, action: action.optional() },
      example: { id: "sales-pipeline", component: "PipelineView", pipelineId: "sales" },
    },
    DatasetReview: {
      description:
        "A new or changed pipeline dataset for a person to approve: its query, what it reads, its grain and key, columns and checks, and what changes from the saved version. Give it exactly what `propose_dataset` returned: `pipeline`, `dataset`, `expectedVersion` and `digest`. The person may change the grain, descriptions and checks, names themselves, and approves or rejects. Approving saves it on the server, which checks it again; it builds nothing, so run the pipeline afterwards if they want it built. The `decide` event says what they chose.",
      props: {
        pipeline: z.record(z.string(), z.unknown()).describe("The whole pipeline as it would be, as propose_dataset returned it."),
        dataset: z.string().describe("The dataset under review."),
        expectedVersion: z.number().int().min(0),
        digest: z.string().optional(),
        proposedBy: z.string().optional().describe("Your name, so the person knows who proposed it."),
        action: action.optional(),
      },
      example: {
        id: "review",
        component: "DatasetReview",
        pipeline: {
          id: "sales",
          name: "Sales",
          sourceId: "lake",
          datasets: [
            { name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL", grain: "one row per order", primaryKey: ["order_id"] },
            {
              name: "region_revenue",
              sql: "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region",
              inputs: ["orders_clean"],
              inputsDeclared: true,
              grain: "one row per region",
              primaryKey: ["region"],
              columns: [{ name: "region", type: "VARCHAR" }, { name: "revenue", type: "DOUBLE", description: "Sum of amount." }],
              checks: [{ name: "relationships_region", kind: "CHECK_KIND_RELATIONSHIPS", columns: ["region"], toTable: "orders_clean", toColumn: "region" }],
            },
          ],
        },
        dataset: "region_revenue",
        expectedVersion: 1,
        proposedBy: "Analyst agent",
        action: { event: { name: "dataset_decided" } },
      },
    },
    IngestWizard: {
      description: "Steps a person through bringing new files in: where they are, what the engine finds there, and which columns to keep, rename and retype. It writes configuration to review; it loads nothing.",
      props: { sourceId: dynamicString, location: z.string().optional().describe("Where the files are, to start from."), format: z.enum(["parquet", "delta", "iceberg", "csv", "json"]).optional() },
      example: { id: "ingest", component: "IngestWizard", sourceId: "lake", format: "parquet", location: "s3://acme-lake/landing/orders/*.parquet" },
    },
    RunHistory: {
      description: "The runs of a pipeline, newest first: how each ended, how long it took, what it refreshed and why it failed.",
      props: {
        runs: z
          .array(
            z.strictObject({
              id: z.string(),
              state: STATUS,
              startTime: z.string().describe("ISO 8601."),
              endTime: z.string().optional(),
              trigger: z.string().optional(),
              refreshKind: z.enum(["default", "refresh", "fullRefresh"]).optional(),
              datasets: z.array(z.string()).optional(),
              errorMessage: z.string().optional(),
            }),
          )
          .max(200),
      },
      example: {
        id: "runs",
        component: "RunHistory",
        runs: [{ id: "update-42", state: "completed", startTime: "2026-11-12T02:00:00Z", endTime: "2026-11-12T02:01:05Z", trigger: "schedule" }],
      },
    },
    ExpectationsPanel: {
      description: "Data quality rules for a pipeline with how many records passed and failed each, worst first. Counts come from the engine.",
      props: {
        expectations: z
          .array(
            z.strictObject({
              name: z.string(),
              dataset: z.string(),
              constraint: z.string(),
              action: z.enum(["warn", "drop", "fail"]),
              passedRecords: z.number().min(0),
              failedRecords: z.number().min(0),
            }),
          )
          .max(200),
      },
      example: {
        id: "quality",
        component: "ExpectationsPanel",
        expectations: [{ name: "valid_amount", dataset: "orders_clean", constraint: "amount >= 0", action: "drop", passedRecords: 960, failedRecords: 40 }],
      },
    },
    SchemaDiff: {
      description: "How incoming data differs from the table it loads into: new, missing and retyped columns.",
      props: {
        changes: z.array(z.strictObject({ column: z.string(), change: z.enum(["added", "removed", "typeChanged"]), before: z.string().optional(), after: z.string().optional() })).max(500),
        rescuedCount: z.number().min(0).optional(),
        mode: z.string().optional().describe("How new columns are treated, e.g. addNewColumns, rescue, failOnNewColumns."),
      },
      example: { id: "drift", component: "SchemaDiff", mode: "rescue", rescuedCount: 12, changes: [{ column: "coupon_code", change: "added", after: "string" }] },
    },
    StreamMetrics: {
      description: "How a streaming query is keeping up: input and processing rates, batch size and duration, with recent trends. Give the progress reports oldest first, as reported.",
      props: {
        progress: z
          .array(
            z.strictObject({
              timestamp: z.string(),
              numInputRows: z.number(),
              inputRowsPerSecond: z.number(),
              processedRowsPerSecond: z.number(),
              batchDurationMs: z.number(),
              stateRows: z.number().optional(),
            }),
          )
          .min(1)
          .max(500),
      },
      example: {
        id: "stream",
        component: "StreamMetrics",
        progress: [{ timestamp: "2026-11-12T10:00:00Z", numInputRows: 500, inputRowsPerSecond: 50, processedRowsPerSecond: 80, batchDurationMs: 900 }],
      },
    },
  })),
});
