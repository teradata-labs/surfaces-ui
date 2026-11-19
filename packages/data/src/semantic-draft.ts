import { type MessageInitShape, create } from "@bufbuild/protobuf";
import { AggregateFunction, DimensionKind, type DimensionSchema, type MeasureSchema, type SemanticModel, SemanticModelSchema, SortDirection } from "@surfaces-ui/proto";
import type { CallOptions, DataSource } from "./datasource.js";
import { collect } from "./result.js";

export type TypeFamily = "number" | "text" | "time" | "boolean" | "binary" | "nested" | "unknown";

/** The broad kind of a column's type, from its engine type, its Arrow type or both: enough to tell what it can be summarised or matched as. */
export function typeFamily(column: { nativeType?: string; arrowType?: string }): TypeFamily {
  // A dictionary-encoded column is judged by its values, not by the integer codes that index them.
  const type = `${column.arrowType ?? ""} ${column.nativeType ?? ""}`.toLowerCase().replace(/dictionary<[^,>]+,\s*([^>]+)>/g, "$1");
  if (/list|struct|map|json|array|variant|union/.test(type)) return "nested";
  if (/bool/.test(type)) return "boolean";
  if (/date|time|interval/.test(type)) return "time";
  if (/int|decimal|numeric|float|double|real|number/.test(type)) return "number";
  if (/utf8|char|string|text|clob|uuid/.test(type)) return "text";
  if (/binary|blob|bytea/.test(type)) return "binary";
  return "unknown";
}

/** A column's name as words for people: `line_amount` is "Line amount". */
export const columnWords = (name: string) => name.replace(/_+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase());

const KEY = /(^id$|_id$|_key$|_no$|_number$|code$)/i;
const MONEY = /(amount|price|cost|revenue|total|refund|paid|charge|fee|balance|sales)/i;

export interface DraftColumn {
  name: string;
  /** The engine's type or the Arrow type, as text. */
  type: string;
  description?: string;
  /** Personal data: left out of the draft. */
  personal?: boolean;
}

type ModelInit = MessageInitShape<typeof SemanticModelSchema>;

/**
 * Dimensions and measures drafted from a query's columns, by name and type
 * only, each saying it was generated: dates become dimensions by month,
 * numbers that are not keys become sums (money as currency), text and flags
 * become dimensions, keys and personal data are left out, and a count of rows
 * is added. A place to start that a person or an agent corrects, never a
 * definition anyone made. No values are read.
 */
export function draftSemanticFields(columns: DraftColumn[], options: { definedBy?: string; rowsLabel?: string; grain?: string } = {}): Pick<ModelInit, "dimensions" | "measures"> {
  const by = options.definedBy ?? "generated from the columns";
  const dimensions: MessageInitShape<typeof DimensionSchema>[] = [];
  const measures: MessageInitShape<typeof MeasureSchema>[] = [];
  const used = new Set<string>();
  const nameOf = (column: string) => {
    const base = column.replace(/\W+/g, "_").replace(/^[^A-Za-z]+/, "") || "field";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}_${n}`;
    used.add(name.toLowerCase());
    return name;
  };
  for (const column of columns) {
    if (column.personal) continue;
    const family = typeFamily({ nativeType: column.type, arrowType: column.type });
    const about = column.description ? { description: column.description } : {};
    const field = { label: columnWords(column.name), column: column.name, ...about, definedBy: by };
    if (family === "time") dimensions.push({ name: nameOf(column.name), kind: DimensionKind.TIME, grain: "month", ...field });
    else if (family === "number" && !KEY.test(column.name)) measures.push({ name: nameOf(column.name), aggregate: AggregateFunction.SUM, format: MONEY.test(column.name) ? "currency" : "compact", ...field });
    else if (family === "boolean" || (family === "text" && !KEY.test(column.name))) dimensions.push({ name: nameOf(column.name), kind: DimensionKind.CATEGORY, ...field });
  }
  measures.push({ name: nameOf("row_count"), label: options.rowsLabel ?? "Rows", aggregate: AggregateFunction.COUNT, format: "compact", description: options.grain ? `How many rows: ${options.grain.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())}.` : "How many rows.", definedBy: by });
  return { dimensions, measures };
}

/**
 * Whether a model's primary key is unique over its query, asked of the
 * engine: one grouped query, largest group first, one row back. Returns the
 * problem in a sentence, or undefined when each key names one row. No key
 * values are returned or shown.
 */
export async function semanticKeyProblem(model: Pick<ModelInit, "sourceId" | "sql" | "primaryKey">, dataSource: Pick<DataSource, "execute">, options?: CallOptions): Promise<string | undefined> {
  const key = model.primaryKey ?? [];
  if (key.length === 0) return "Name the columns that make a row unique.";
  try {
    const most = await mostRowsPerKey(dataSource, { sourceId: model.sourceId ?? "", sql: model.sql ?? "", columns: key }, options);
    return most > 1 ? `${key.join(", ")} ${key.length === 1 ? "repeats" : "repeat together"}: some rows share it, up to ${most} times, so sums over this model would count them more than once. Choose a key that is unique, or join only tables that add one row of detail to each.` : undefined;
  } catch (error) {
    return `The key could not be checked: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * The most rows that share one value of `columns` in a query's result, asked
 * of the engine: one grouped count, largest first, one row back. 1 means the
 * columns name each row once; 0 means there are no rows. No values are
 * returned. Used to check a key, and whether a join can repeat rows.
 */
export async function mostRowsPerKey(dataSource: Pick<DataSource, "execute">, request: { sourceId: string; sql: string; columns: string[] }, options?: CallOptions): Promise<number> {
  const result = await collect(
    dataSource.execute(
      {
        sourceId: request.sourceId,
        query: { baseSql: request.sql, groupBy: request.columns, aggregates: [{ function: AggregateFunction.COUNT, alias: "sf_rows" }], sorts: [{ column: "sf_rows", direction: SortDirection.DESC }], page: { limit: 1 } },
      },
      options,
    ),
  );
  return Number(result.table.getChild("sf_rows")?.get(0) ?? 0);
}

/**
 * A whole model drafted from a query's columns: the identity, rows, grain
 * and key given, and fields from `draftSemanticFields`. Not saved; a draft
 * for a person or an agent to correct.
 */
export interface SemanticModelDraftInit {
  name: string;
  label?: string;
  description?: string;
  sourceId: string;
  sql: string;
  grain?: string;
  primaryKey?: string[];
  tables?: string[];
  joins?: ModelInit["joins"];
  columns: DraftColumn[];
  definedBy?: string;
}

export function draftSemanticModel(init: SemanticModelDraftInit): SemanticModel {
  const { columns, definedBy, ...model } = init;
  return create(SemanticModelSchema, { ...model, ...draftSemanticFields(columns, { definedBy, grain: model.grain }) });
}
