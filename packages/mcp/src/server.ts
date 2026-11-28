import { create, fromJson, toJson } from "@bufbuild/protobuf";
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { pipelineTools, runSummary } from "@surfaces-ui/agent";
import type { DataSource, Discovery, Pipelines } from "@surfaces-ui/data";
import { type ExecuteRequest, PagingSchema, RefreshKind, RunState, type StartRunRequest, ViewQuerySchema } from "@surfaces-ui/proto";
import { type Catalog, type JsonRenderSpec, analyticsCatalog, catalogDocs, catalogPrompt, fromJsonRender } from "@surfaces-ui/spec";
import { z } from "zod";
import { APP_RESOURCE_URI, type AppView, PIPELINE_RPC, PIPELINE_RPC_TOOL, RPC, RPC_TOOL, isPipelineRpcMethod, isRpcMethod } from "./protocol.js";

export interface SurfacesAppsOptions {
  /** Where data comes from. Queries stay on this side; the app page receives only the rows it shows. */
  dataSource: DataSource;
  /** The single-file app page (HTML), or a function that returns it. See `readAppHtml` in `@surfaces-ui/mcp/node`. */
  appHtml: string | (() => string | Promise<string>);
  /** The catalog search backend. With it the model gets `search_data`, which finds tables and columns by words or meaning. */
  discovery?: Pick<Discovery, "search">;
  /**
   * The pipeline backend. With it the model gets `list_pipelines`,
   * `describe_pipeline`, `check_pipeline`, `get_run`, `show_pipeline`,
   * `propose_dataset` and `run_pipeline`. `show_pipeline` and
   * `propose_dataset` draw the pipeline and the proposal for review in the
   * app page, filled in here so the model never copies a definition.
   * `run_pipeline` is marked destructive, so the host asks the person before
   * it runs. A full refresh is not offered anywhere in this channel.
   */
  pipelines?: Pipelines;
  /** Source used when a tool call does not name one. Defaults to the first source. */
  defaultSourceId?: string;
  /** Catalog agents may use with `render_surface`. Defaults to the analytics catalog. */
  catalog?: Catalog;
  /** Most rows the app's data tool returns per request. Defaults to 1,000. */
  maxRowsPerRequest?: number;
}

/** A tool that only reads says so both ways: a host decides what to ask a person about from these, and a directory review asks for each one. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false } as const;

const ui = { ui: { resourceUri: APP_RESOURCE_URI } };
const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (value: string) => ({ ...text(value), isError: true });
const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^\[[a-z_]+\]\s*/i, "");

const sqlArg = z.string().describe("A single read-only SELECT statement. Do not add LIMIT for paging; the table pages by itself.");
const sourceArg = z.string().optional().describe("Data source ID. Omit to use the default source.");

/**
 * Adds the Surfaces tools and app page to an MCP server.
 *
 * Tools the model can call show a view (table, chart, explorer, editor,
 * schema, or an A2UI surface) in the host's UI. One further tool, hidden
 * from the model, lets the app page fetch data. SQL is checked before a view
 * is shown, so a mistake comes back to the model as an error it can fix.
 */
export function registerSurfacesApps(server: McpServer, options: SurfacesAppsOptions): void {
  const { dataSource } = options;
  const catalog = options.catalog ?? analyticsCatalog;
  const maxRows = options.maxRowsPerRequest ?? 1000;

  const sourceOf = async (requested: string | undefined): Promise<string> => {
    if (requested) return requested;
    if (options.defaultSourceId) return options.defaultSourceId;
    const first = (await dataSource.listSources({})).sources[0];
    if (!first) throw new Error("No data sources are configured.");
    return first.id;
  };
  const show = (view: AppView, summary: string) => ({ ...text(summary), structuredContent: view as unknown as Record<string, unknown> });
  /** Runs the query once, cheaply, so a bad query is reported to the model instead of to the person. */
  const GRAINS = ["minute", "hour", "day", "week", "month", "quarter", "year"] as const;
  const AGGREGATES = ["sum", "avg", "count", "count_distinct", "min", "max", "median", "stddev", "variance", "percentile"] as const;
  const dimensionArg = z.union([z.string(), z.object({ column: z.string(), grain: z.enum(GRAINS).optional(), label: z.string().optional() })]);

  const checked = async <T extends AppView>(view: T & { sourceId: string; sql: string }, describe: (rows: bigint) => string) => {
    try {
      const { rowCount } = await dataSource.count({ sourceId: view.sourceId, query: { baseSql: view.sql } });
      return show(view, describe(rowCount));
    } catch (error) {
      return failure(`The query did not run: ${message(error)}`);
    }
  };

  registerAppResource(server, "Surfaces app", APP_RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE, description: "Interactive data views." }, async () => ({
    contents: [{ uri: APP_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: typeof options.appHtml === "string" ? options.appHtml : await options.appHtml() }],
  }));

  registerAppTool(
    server,
    "show_data_grid",
    {
      title: "Show a table",
      description: "Shows the rows of a SQL query in an interactive table the person can scroll and sort. Use for looking at records.",
      inputSchema: { sql: sqlArg, sourceId: sourceArg, title: z.string().optional() },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sql, sourceId, title }) =>
      checked({ view: "grid", sourceId: await sourceOf(sourceId), sql, title }, (rows) => `Showing a table of ${rows} rows.`),
  );

  registerAppTool(
    server,
    "show_chart",
    {
      title: "Show a chart",
      description:
        "Charts a SQL query. Give each y measure an aggregate so the database summarises by x; without one the chart plots a random sample of rows. Set xGrain for a time series and xBins for a histogram. Each y entry is a series: give one its own type and axis for a compound chart (bars with a line on a second scale). Choose the form from the comparison: bars for amounts across categories (they are sorted largest first and start at zero), a line with xGrain for change over time, xBins for a distribution, scatter for two measures. Avoid a pie beyond five slices, more than five lines, and a second y scale (use two charts on the same x instead); the chart shows advice when its shape is hard to read.",
      inputSchema: {
        sql: sqlArg,
        type: z.enum(["bar", "line", "area", "scatter", "pie"]),
        x: z.string().describe("Column for the x axis, or the slices of a pie."),
        xGrain: z.enum(GRAINS).optional().describe("Group a date or time x column into buckets of this size."),
        xBins: z.number().int().min(2).max(200).optional().describe("Group a numeric x column into about this many bins."),
        y: z
          .array(
            z.object({
              column: z.string().optional(),
              aggregate: z.enum(AGGREGATES).optional(),
              percentile: z.number().min(0).max(1).optional(),
              label: z.string().optional(),
              type: z.enum(["bar", "line", "area", "scatter"]).optional().describe("Draw this series differently from the chart type."),
              axis: z.enum(["left", "right"]).optional().describe("Use the right axis for a measure on a different scale."),
            }),
          )
          .min(1),
        splitBy: z.string().optional().describe("Column whose values become separate series."),
        stacked: z.boolean().optional(),
        legend: z.enum(["top", "bottom", "right", "none"]).optional(),
        sourceId: sourceArg,
        title: z.string().optional(),
      },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sql, type, x, xGrain, xBins, y, splitBy, stacked, legend, sourceId, title }) =>
      checked(
        { view: "chart", sourceId: await sourceOf(sourceId), sql, type, x, xGrain, xBins, y, splitBy, stacked, legend, title },
        (rows) => `Showing a ${type} chart over ${rows} rows.`,
      ),
  );

  registerAppTool(
    server,
    "show_pivot_table",
    {
      title: "Show a pivot table",
      description:
        "Shows a pivot table over a SQL query: row values down the side, column values across the top, summarised measures in the cells, with totals. The database does the grouping. Choose columns with few distinct values.",
      inputSchema: {
        sql: sqlArg,
        rows: z.array(dimensionArg).min(1).max(4).describe("Columns whose values become the rows."),
        columns: z.array(dimensionArg).max(2).optional().describe("Columns whose values become the columns."),
        measures: z
          .array(z.object({ column: z.string().optional(), aggregate: z.enum(AGGREGATES), percentile: z.number().min(0).max(1).optional(), label: z.string().optional() }))
          .min(1)
          .max(6),
        sourceId: sourceArg,
        title: z.string().optional(),
      },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sql, rows, columns, measures, sourceId, title }) =>
      checked({ view: "pivot", sourceId: await sourceOf(sourceId), sql, rows, columns, measures, title }, (count) => `Showing a pivot table over ${count} rows.`),
  );

  registerAppTool(
    server,
    "show_query_result",
    {
      title: "Explore a query",
      description: "Shows a query the person can explore themselves: filters, a table and a chart of the same result, and the SQL that ran.",
      inputSchema: { sql: sqlArg, sourceId: sourceArg, title: z.string().optional() },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sql, sourceId, title }) =>
      checked({ view: "result", sourceId: await sourceOf(sourceId), sql, title }, (rows) => `Showing an explorable result of ${rows} rows.`),
  );

  registerAppTool(
    server,
    "open_sql_editor",
    {
      title: "Open the SQL editor",
      description: "Opens a SQL editor with autocomplete for the source's tables, where the person can write and run queries.",
      inputSchema: { sql: z.string().optional().describe("SQL to start with."), sourceId: sourceArg },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sql, sourceId }) => show({ view: "editor", sourceId: await sourceOf(sourceId), sql: sql ?? "" }, "Opened the SQL editor."),
  );

  registerAppTool(
    server,
    "show_schema_explorer",
    {
      title: "Browse tables",
      description: "Shows a searchable tree of the source's tables and their columns.",
      inputSchema: { sourceId: sourceArg },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ sourceId }) => show({ view: "schema", sourceId: await sourceOf(sourceId) }, "Showing the tables in this source."),
  );

  const render = (messages: unknown[]) => {
    const issues = messages.flatMap((m, index) => catalog.validateMessage(m).map((issue) => `message ${index}${issue.path}: ${issue.message}`));
    if (issues.length > 0) return failure(`The surface was not shown because it does not match the catalog:\n${issues.slice(0, 20).join("\n")}`);
    return show({ view: "surface", messages }, "Showing the surface.");
  };

  registerAppTool(
    server,
    "render_surface",
    {
      title: "Show a custom view",
      description: `Shows a custom layout (a dashboard, a summary) described as A2UI messages using catalog ${catalog.id}. Call get_component_docs first to learn the components.`,
      inputSchema: { messages: z.array(z.record(z.string(), z.unknown())).min(1).describe("A2UI messages: createSurface, then updateComponents, then optionally updateDataModel.") },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ messages }) => render(messages),
  );

  registerAppTool(
    server,
    "show_dashboard",
    {
      title: "Show a dashboard",
      description: "Shows a dashboard described as a json-render spec ({ root, elements, state }). Prefer render_surface for new work.",
      inputSchema: {
        spec: z.object({
          root: z.string(),
          elements: z.record(z.string(), z.object({ type: z.string(), props: z.record(z.string(), z.unknown()).optional(), children: z.array(z.string()).optional() })),
          state: z.record(z.string(), z.unknown()).optional(),
        }),
      },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ spec }) => render(fromJsonRender(spec as JsonRenderSpec, catalog)),
  );

  server.registerTool(
    "get_component_docs",
    {
      title: "Component documentation",
      description: "Explains how to build a custom view: the message format and every component with its props and an example. Pass a component name for just that one.",
      inputSchema: { component: z.string().optional() },
      annotations: READ_ONLY,
    },
    async ({ component }) => {
      if (!component) return text(catalogPrompt(catalog));
      const docs = catalogDocs(catalog);
      return Object.hasOwn(docs, component) ? text(docs[component]!) : failure(`No component named ${component}. Available: ${Object.keys(docs).join(", ")}.`);
    },
  );

  /** A table's name as SQL writes it. A schema with no catalog above it is a database (Teradata) and is part of the name. */
  const tableName = (ref: { catalog?: string; schema?: string; table?: string } | undefined) => (!ref?.catalog && ref?.schema ? `${ref.schema}.${ref.table ?? ""}` : (ref?.table ?? ""));
  const columnsOf = async (sourceId: string, ref: { catalog?: string; schema?: string; table?: string } | undefined) =>
    (await dataSource.describeTable({ sourceId, ref: { catalog: ref?.catalog, schema: ref?.schema, table: ref?.table ?? "" } }).catch(() => undefined))?.table;

  server.registerTool(
    "list_tables",
    {
      title: "List tables",
      description:
        "Lists the data sources and the tables in one of them. A short list comes with each table's columns and types; a long one gives names only, so narrow it with `search` or `database`, or call describe_table. Call this before writing SQL.",
      inputSchema: {
        sourceId: sourceArg,
        database: z.string().optional().describe("A database or schema to list. Omit for the ones the source covers by default."),
        search: z.string().optional().describe("Part of a table name."),
      },
      annotations: READ_ONLY,
    },
    async ({ sourceId, database, search }) => {
      try {
        const { sources } = await dataSource.listSources({});
        const id = await sourceOf(sourceId);
        const { tables } = await dataSource.listTables({ sourceId: id, schema: database ?? "", search: search ?? "" });
        const lines = [`Sources: ${sources.map((s) => s.id).join(", ")}`, `Tables in ${id}${database ? `, ${database}` : ""}:`];
        // Describing every table of a warehouse would take minutes: past a screenful, names only.
        const detailed = tables.length <= 30;
        for (const table of tables.slice(0, 200)) {
          const name = tableName(table.ref);
          const columns = detailed ? `(${(await columnsOf(id, table.ref))?.columns.map((c) => `${c.name} ${c.nativeType}`).join(", ") ?? ""})` : "";
          lines.push(`- ${name}${columns}${table.comment ? ` — ${table.comment}` : ""}`);
        }
        if (tables.length > 200) lines.push(`…and ${tables.length - 200} more. Narrow the list with search or database.`);
        else if (!detailed) lines.push("Names only: call describe_table for a table's columns.");
        return text(lines.join("\n"));
      } catch (error) {
        return failure(message(error));
      }
    },
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe a table",
      description: "One table's columns: names, types, keys and descriptions, and the tables it declares joins to. Never data values.",
      inputSchema: {
        table: z.string().describe("The table's name, as list_tables gave it (database.table where it has a database)."),
        sourceId: sourceArg,
      },
      annotations: READ_ONLY,
    },
    async ({ table, sourceId }) => {
      try {
        const id = await sourceOf(sourceId);
        const parts = table.split(".");
        const ref = parts.length > 1 ? { schema: parts.slice(0, -1).join("."), table: parts.at(-1)! } : { table };
        const detail = (await dataSource.describeTable({ sourceId: id, ref })).table;
        if (!detail) return failure(`Table not found: ${table}`);
        const lines = [`${tableName(detail.summary?.ref) || table}${detail.summary?.comment ? ` — ${detail.summary.comment}` : ""}`];
        for (const column of detail.columns) lines.push(`- ${column.name} ${column.nativeType}${column.primaryKey ? " (key)" : ""}${column.comment ? ` — ${column.comment}` : ""}`);
        for (const key of detail.foreignKeys) {
          const other = tableName(key.references);
          lines.push(`Joins to ${other}: ${key.columns.map((c, i) => `${c} = ${other}.${key.referencedColumns[i] ?? c}`).join(" AND ")}`);
        }
        return text(lines.join("\n"));
      } catch (error) {
        return failure(message(error));
      }
    },
  );

  const { discovery } = options;
  if (discovery) {
    server.registerTool(
      "search_data",
      {
        title: "Search the catalog",
        description: "Finds tables and columns by words or meaning, across the databases the catalog covers. Returns names, types and descriptions, never data values.",
        inputSchema: { query: z.string().min(1).describe("What to look for, e.g. customer revenue."), sourceId: z.string().optional().describe("Search one source. Omit to search all.") },
        annotations: READ_ONLY,
      },
      async ({ query, sourceId }) => {
        try {
          const found = await discovery.search({ query, sourceIds: sourceId ? [sourceId] : [], pageSize: 20 });
          if (found.hits.length === 0) return text(`Nothing in the catalog matches "${query}".`);
          const lines = found.hits.map((hit) => {
            const ref = hit.object?.ref;
            const name = `${ref?.sourceId}: ${tableName(ref)}${ref?.column ? `.${ref.column}` : ""}`;
            return `- ${name}${hit.object?.nativeType ? ` ${hit.object.nativeType}` : ""}${hit.object?.description ? ` — ${hit.object.description}` : ""}`;
          });
          return text([`${found.total} matches for "${query}"; the best ${lines.length}:`, ...lines].join("\n"));
        } catch (error) {
          return failure(message(error));
        }
      },
    );
  }

  if (options.pipelines) registerPipelineTools(server, options.pipelines, show);

  // The app page's data channel. Read-only, and capped per request.
  registerAppTool(
    server,
    RPC_TOOL,
    {
      title: "Surfaces data channel",
      description: "Used by the Surfaces app page to fetch data. Not for direct use.",
      inputSchema: { method: z.string(), request: z.record(z.string(), z.unknown()) },
      annotations: READ_ONLY,
      _meta: { ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ method, request }) => {
      if (!isRpcMethod(method)) return failure(`Unknown method ${method}.`);
      const shape = RPC[method];
      try {
        // Requests arrive as protobuf JSON; decode them so enums, 64-bit numbers and oneofs are read correctly.
        const decoded = fromJson(shape.request, request as never);
        if (method === "execute") {
          const execute = decoded as ExecuteRequest;
          execute.query ??= create(ViewQuerySchema);
          execute.query.page ??= create(PagingSchema);
          execute.query.page.limit = Math.min(execute.query.page.limit || maxRows, maxRows);
          const messages = [];
          for await (const part of dataSource.execute(execute)) messages.push(toJson(shape.response, part));
          return { ...text(`${messages.length} messages`), structuredContent: { messages } };
        }
        const response = await (dataSource[method] as (r: unknown) => Promise<never>)(decoded);
        return { ...text("ok"), structuredContent: { messages: [toJson(shape.response, response)] } };
      } catch (error) {
        return failure(message(error));
      }
    },
  );
}

/** The agent's pipeline tools as MCP tools: one implementation, so the two cannot drift. */
function registerPipelineTools(server: McpServer, pipelines: Pipelines, show: (view: AppView, summary: string) => ReturnType<typeof text> & { structuredContent: Record<string, unknown> }) {
  const tools = new Map(pipelineTools(pipelines).map((tool) => [tool.name, tool]));
  const toText = (value: unknown) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? Number(v) : v), 2);
  const json = (value: unknown) => text(toText(value));
  const call = (name: string) => async (input: unknown) => {
    try {
      return json(await tools.get(name)!.run(input));
    } catch (error) {
      return failure(message(error));
    }
  };
  const pipelineId = z.string().describe("The pipeline's id, from list_pipelines.");
  const select = z.array(z.string()).optional().describe("Datasets to build: name alone, name+ with what reads it, +name with what it reads. Omit for all.");
  const describe = (name: string) => tools.get(name)!.description;
  server.registerTool("list_pipelines", { title: "List pipelines", description: describe("list_pipelines"), inputSchema: {}, annotations: READ_ONLY }, call("list_pipelines"));
  server.registerTool("describe_pipeline", { title: "Describe a pipeline", description: describe("describe_pipeline"), inputSchema: { pipelineId }, annotations: READ_ONLY }, call("describe_pipeline"));
  server.registerTool("check_pipeline", { title: "Check a pipeline", description: describe("check_pipeline"), inputSchema: { pipelineId, select }, annotations: READ_ONLY }, call("check_pipeline"));
  server.registerTool("get_run", { title: "A pipeline run", description: describe("get_run"), inputSchema: { pipelineId, runId: z.string() }, annotations: READ_ONLY }, call("get_run"));

  registerAppTool(
    server,
    "show_pipeline",
    {
      title: "Show a pipeline",
      description:
        "Shows a pipeline live to the person: its datasets and how they feed one another, its runs, and each dataset's query, grain, key, columns and check results. The person can run it, check it, rebuild one dataset or cancel from there.",
      inputSchema: { pipelineId },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async ({ pipelineId: id }) => {
      try {
        const { pipeline } = await pipelines.getPipeline({ id });
        if (!pipeline?.summary) return failure(`Unknown pipeline ${id}.`);
        const { runs } = await pipelines.listRuns({ pipelineId: id, pageSize: 1 });
        const built = pipeline.datasets.filter((d) => d.sql).length;
        const last = runs[0] ? `; the last run, ${runs[0].id}, is ${RunState[runs[0].state].toLowerCase()}` : "; it has not run yet";
        return show(
          { view: "pipeline", pipelineId: id, sourceId: pipeline.summary.sourceId },
          `Showing the pipeline ${pipeline.summary.name}: ${built} dataset${built === 1 ? "" : "s"}${last}.`,
        );
      } catch (error) {
        return failure(message(error));
      }
    },
  );

  registerAppTool(
    server,
    "propose_dataset",
    {
      title: "Propose a dataset",
      description: `${describe("propose_dataset")} The proposal is shown to the person for review, filled in here: do not draw it yourself. The person edits it, names themselves and approves, which saves it; their decision comes back as a message.`,
      inputSchema: {
        pipelineId: z.string().describe("The pipeline's id, from list_pipelines, or a new id to propose a new pipeline."),
        sourceId: z.string().optional().describe("For a new pipeline only: the source it reads and builds in."),
        pipelineName: z.string().optional().describe("For a new pipeline only: its name."),
        name: z.string(),
        sql: z.string(),
        grain: z.string(),
        description: z.string().optional(),
        layer: z.enum(["bronze", "silver", "gold"]).optional(),
        view: z.boolean().optional(),
        depends: z.array(z.string()).optional(),
        primaryKey: z.array(z.string()).optional(),
        columns: z.array(z.object({ name: z.string(), type: z.string().optional(), description: z.string().optional() })).optional(),
        checks: z
          .array(
            z.object({
              kind: z.enum(["unique", "not_null", "relationships", "accepted_values", "row_count"]),
              columns: z.array(z.string()).optional(),
              toTable: z.string().optional(),
              toColumn: z.string().optional(),
              values: z.array(z.string()).optional(),
              min: z.number().optional(),
              max: z.number().optional(),
              warnOnly: z.boolean().optional(),
            }),
          )
          .optional(),
      },
      annotations: READ_ONLY,
      _meta: ui,
    },
    async (input) => {
      try {
        const proposed = (await tools.get("propose_dataset")!.run(input)) as { pipelineId: string; change: string; expectedVersion: number; digest: string; dataset: string; pipeline: { sourceId?: string; name?: string } };
        return show(
          {
            view: "datasetReview",
            pipeline: proposed.pipeline,
            dataset: input.name,
            expectedVersion: proposed.expectedVersion,
            digest: proposed.digest,
            sourceId: proposed.pipeline.sourceId ?? "",
            proposedBy: "the agent",
          },
          `Showing the proposal (${proposed.change}, based on version ${proposed.expectedVersion}) for the person to review. Nothing is saved until they approve, and nothing is built until the pipeline runs.`,
        );
      } catch (error) {
        return failure(message(error));
      }
    },
  );

  server.registerTool(
    "run_pipeline",
    {
      title: "Run a pipeline",
      description: "Builds a pipeline's datasets, replacing their tables, then runs their checks. Ask the person first. Waits up to a minute, then returns the run id for get_run.",
      inputSchema: { pipelineId, select },
      annotations: { destructiveHint: true, idempotentHint: true, readOnlyHint: false },
    },
    async ({ pipelineId: id, select: chosen }) => {
      try {
        const { pipelines: list } = await pipelines.listPipelines({});
        if (!list.some((p) => p.id === id)) return failure(`Unknown pipeline ${id}.`);
        let { run } = await pipelines.startRun({ pipelineId: id, select: chosen ?? [], trigger: "agent", startedBy: "agent over MCP" });
        for (const until = Date.now() + 60_000; run && run.state === RunState.RUNNING && Date.now() < until; ) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          run = (await pipelines.getRun({ pipelineId: id, runId: run.id })).run;
        }
        return json(runSummary(run!));
      } catch (error) {
        return failure(message(error));
      }
    },
  );

  // The app page's pipeline channel. Hidden from the model. What changes
  // anything comes from a person in the page: a run they press (never a full
  // refresh here), or a save they approved, which the backend still checks for
  // the approver, the digest of what they saw and the version it was made against.
  registerAppTool(
    server,
    PIPELINE_RPC_TOOL,
    {
      title: "Surfaces pipeline channel",
      description: "Used by the Surfaces app page to show pipelines and act on a person's choices there. Not for direct use.",
      inputSchema: { method: z.string(), request: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: APP_RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ method, request }) => {
      if (!isPipelineRpcMethod(method)) return failure(`Unknown method ${method}.`);
      const handler = pipelines[method] as ((r: unknown) => Promise<never>) | undefined;
      if (!handler) return failure("This server keeps no saved pipelines.");
      const shape = PIPELINE_RPC[method];
      try {
        const decoded = fromJson(shape.request, request as never);
        if (method === "startRun") {
          const start = decoded as StartRunRequest;
          if (start.refreshKind === RefreshKind.FULL_REFRESH || start.confirmFullRefresh) return failure("A full refresh is not offered here. Use the dev server's own page or the surfaces-pipelines CLI.");
          start.trigger = "manual";
          start.startedBy = "a person, in the MCP app";
        }
        const response = await handler.call(pipelines, decoded);
        return { ...text("ok"), structuredContent: { message: toJson(shape.response, response) } };
      } catch (error) {
        return failure(message(error));
      }
    },
  );
}
