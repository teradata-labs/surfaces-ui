import { type DataSource, type Semantics, aggregateWord } from "@surfaces-ui/data";
import type { RunnableTool } from "./tools.js";

export interface DataToolsOptions {
  /** Sources the model may look at. Default: every source the DataSource lists. */
  sourceIds?: string[];
  /** Most tables listed per call. Default 100. */
  maxTables?: number;
  /**
   * The project's semantic models. With it the agent also gets
   * `list_semantic_models` and `describe_semantic_model`, so it uses the
   * metrics a model defines (an Explorer or ReportBuilder given `model`)
   * instead of writing its own.
   */
  semantics?: Pick<Semantics, "listSemanticModels" | "getSemanticModel">;
}


/**
 * Tools that let a model find out what data there is before it writes SQL:
 * `list_tables` (a source's tables with their descriptions) and
 * `describe_table` (one table's columns, types, keys and joins). Only names,
 * types, keys and descriptions are returned, never row values, so a source's
 * data stays withheld. Pass them as `tools` to `toolCallingAgent` or an
 * adapter built on it.
 */
export function dataTools(dataSource: Pick<DataSource, "listSources" | "listTables" | "describeTable">, options: DataToolsOptions = {}): RunnableTool[] {
  const maxTables = options.maxTables ?? 100;
  const semantics = options.semantics;
  const allowed = async (sourceId: unknown): Promise<string> => {
    const ids = options.sourceIds ?? (await dataSource.listSources({})).sources.map((s) => s.id);
    if (typeof sourceId !== "string" || !ids.includes(sourceId)) throw new Error(`Unknown source ${JSON.stringify(sourceId)}. Sources: ${ids.join(", ")}.`);
    return sourceId;
  };
  const sourceArg = { type: "string", description: "The source id, such as the one the person is working on." };
  /** A table's name as SQL writes it. A schema with no catalog above it is a database (Teradata) and is part of the name. */
  const nameOf = (ref: { catalog?: string; schema?: string; table?: string } | undefined) => (!ref?.catalog && ref?.schema ? `${ref.schema}.${ref.table ?? ""}` : (ref?.table ?? ""));
  /** What SQL a source speaks, in words, with what trips a model up. Engines are numbered as in the contract. */
  const DIALECTS: Record<number, string> = {
    1: "DuckDB",
    2: "DataFusion",
    3: "Teradata (no LIMIT or OFFSET: the components page results themselves, and TOP n is the only way to cut one by hand; name tables as database.table)",
    4: "Postgres",
  };
  return [
    {
      name: "list_tables",
      description:
        "Lists the tables in a data source, with what each holds and the SQL dialect the source speaks. A warehouse has many: narrow the list with `search` (part of a name) or `database`. Call it before writing SQL against a source you have not seen.",
      inputSchema: {
        type: "object",
        properties: { sourceId: sourceArg, search: { type: "string", description: "Part of a table name." }, database: { type: "string", description: "A database or schema to list. Omit for the ones the source covers by default." } },
        required: ["sourceId"],
        additionalProperties: false,
      },
      run: async (input) => {
        const args = (input ?? {}) as { sourceId?: unknown; search?: unknown; database?: unknown };
        const sourceId = await allowed(args.sourceId);
        const [{ tables }, { sources }] = await Promise.all([
          dataSource.listTables({ sourceId, search: typeof args.search === "string" ? args.search : "", schema: typeof args.database === "string" ? args.database : "" }),
          dataSource.listSources({}),
        ]);
        const dialect = DIALECTS[sources.find((s) => s.id === sourceId)?.dialect ?? 0];
        return {
          sourceId,
          ...(dialect ? { dialect } : {}),
          tables: tables.slice(0, maxTables).map((t) => ({ table: nameOf(t.ref), ...(t.comment ? { description: t.comment } : {}) })),
          ...(tables.length > maxTables ? { more: tables.length - maxTables } : {}),
        };
      },
    },
    {
      name: "describe_table",
      description: "One table's columns with their types, keys and descriptions, and the tables it declares joins to. No row values. Name the table as list_tables gave it.",
      inputSchema: { type: "object", properties: { sourceId: sourceArg, table: { type: "string" } }, required: ["sourceId", "table"], additionalProperties: false },
      run: async (input) => {
        const args = (input ?? {}) as { sourceId?: unknown; table?: unknown };
        const sourceId = await allowed(args.sourceId);
        if (typeof args.table !== "string" || !args.table) throw new Error("Name a table.");
        const parts = args.table.split(".");
        const ref = parts.length > 1 ? { schema: parts.slice(0, -1).join("."), table: parts.at(-1)! } : { table: args.table };
        const { table } = await dataSource.describeTable({ sourceId, ref });
        if (!table) throw new Error(`No table ${args.table} in ${sourceId}.`);
        return {
          sourceId,
          table: args.table,
          ...(table.summary?.comment ? { description: table.summary.comment } : {}),
          columns: table.columns.map((c) => ({ name: c.name, type: c.nativeType, ...(c.primaryKey ? { primaryKey: true } : {}), ...(c.comment ? { description: c.comment } : {}) })),
          joins: table.foreignKeys.map((fk) => ({ columns: fk.columns, table: nameOf(fk.references), references: fk.referencedColumns })),
        };
      },
    },
    ...(semantics ? semanticTools(semantics, allowed, sourceArg) : []),
  ];
}

function semanticTools(semantics: NonNullable<DataToolsOptions["semantics"]>, allowed: (sourceId: unknown) => Promise<string>, sourceArg: object): RunnableTool[] {
  return [
    {
      name: "list_semantic_models",
      description:
        "The semantic models over a source: each names a query and the dimensions, measures and metrics defined on it, by people and agents. When one covers what the person asks about, give an Explorer or ReportBuilder `model` with its name, so its metrics mean what the model defines.",
      inputSchema: { type: "object", properties: { sourceId: sourceArg }, required: ["sourceId"], additionalProperties: false },
      run: async (input) => {
        const sourceId = await allowed(((input ?? {}) as { sourceId?: unknown }).sourceId);
        const { models } = await semantics.listSemanticModels({ sourceId });
        return { sourceId, models: models.map((m) => ({ name: m.name, label: m.label, ...(m.description ? { description: m.description } : {}), dimensions: m.dimensionCount, measures: m.measureCount, metrics: m.metricCount, version: m.version })) };
      },
    },
    {
      name: "describe_semantic_model",
      description:
        "One semantic model: its query, and its dimensions, measures and metrics with their definitions and who defined each. Use the names as pill ids on an Explorer's or a ReportBuilder's shelves. To change the model, draw a SemanticModelEditor with `proposed`; a person saves it.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
      run: async (input) => {
        const name = ((input ?? {}) as { name?: unknown }).name;
        if (typeof name !== "string" || !name) throw new Error("Name a semantic model.");
        const { model } = await semantics.getSemanticModel({ name });
        if (!model) throw new Error(`No semantic model ${name}.`);
        await allowed(model.sourceId);
        const said = (text: string, key = "description") => (text ? { [key]: text } : {});
        return {
          name: model.name,
          label: model.label,
          ...said(model.description),
          sourceId: model.sourceId,
          sql: model.sql,
          ...said(model.grain, "grain"),
          ...(model.primaryKey.length ? { primaryKey: model.primaryKey } : {}),
          ...(model.dataset?.pipelineId ? { fromPipeline: { pipeline: model.dataset.pipelineId, dataset: model.dataset.dataset, note: "The rows are this pipeline dataset; describe_pipeline says when it was built and how its checks went." } } : {}),
          version: model.version,
          dimensions: model.dimensions.map((d) => ({ name: d.name, label: d.label, column: d.column, ...(d.kind === 2 ? { time: true, grain: d.grain || "month" } : {}), ...said(d.description), ...said(d.definedBy, "definedBy") })),
          measures: model.measures.map((m) => ({ name: m.name, label: m.label, aggregate: aggregateWord(m.aggregate) ?? "", ...(m.column ? { column: m.column } : {}), ...said(m.format, "format"), ...said(m.description), ...said(m.definedBy, "definedBy") })),
          metrics: model.metrics.map((m) => ({ name: m.name, label: m.label, expression: m.expression, ...said(m.format, "format"), ...said(m.description), ...said(m.definedBy, "definedBy") })),
        };
      },
    },
  ];
}
