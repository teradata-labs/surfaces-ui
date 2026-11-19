import { SALES_LINES } from "./industries/retail-conversation.js";
import { draftSemanticModel, semanticModelJson } from "@surfaces-ui/data";
import type { Seed, SeedTable } from "./types.js";

/**
 * A semantic model in the JSON form of `surfaces.v1.SemanticModel`: the form
 * it takes as a file in a repo. Read it with `semanticModelFromJson` from
 * `@surfaces-ui/data`. Kept as plain JSON so the seeds depend on no contract
 * package.
 */
export interface SeedSemanticModel {
  name: string;
  label: string;
  description: string;
  sourceId: string;
  sql: string;
  primaryKey?: string[];
  /** What one row is, in a sentence. */
  grain?: string;
  dimensions: { name: string; label: string; column: string; kind: "DIMENSION_KIND_CATEGORY" | "DIMENSION_KIND_TIME"; grain?: string; description?: string; definedBy?: string }[];
  measures: { name: string; label: string; column?: string; aggregate: `AGGREGATE_FUNCTION_${"SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX" | "MEDIAN"}`; format?: string; description?: string; definedBy?: string }[];
  metrics: { name: string; label: string; expression: string; format?: string; description?: string; definedBy?: string }[];
}

const AUTHOR = "the sample data's authors";

/** Retail's order lines with their order, store, product and refund: the model the explorer and reports start from. */
export const retailSalesLines: SeedSemanticModel = {
  name: "sales_lines",
  label: "Sales lines",
  description: "One row per order line, with its order, store, product and any refund. Revenue, cost and refunds add up across any breakdown.",
  sourceId: "retail",
  // The lines' own key leads, so the model can say which columns make a row unique.
  sql: SALES_LINES.replace(/^SELECT /, "SELECT i.order_id, i.line_no, "),
  grain: "One order line.",
  primaryKey: ["order_id", "line_no"],
  dimensions: [
    { name: "ordered", label: "Ordered", column: "ordered_at", kind: "DIMENSION_KIND_TIME", grain: "month", description: "When the order was placed.", definedBy: AUTHOR },
    { name: "channel", label: "Channel", column: "channel", kind: "DIMENSION_KIND_CATEGORY", description: "Web, app or store.", definedBy: AUTHOR },
    { name: "status", label: "Order status", column: "status", kind: "DIMENSION_KIND_CATEGORY", definedBy: AUTHOR },
    { name: "region", label: "Region", column: "region", kind: "DIMENSION_KIND_CATEGORY", description: "The store's region.", definedBy: AUTHOR },
    { name: "store", label: "Store", column: "store_name", kind: "DIMENSION_KIND_CATEGORY", definedBy: AUTHOR },
    { name: "category", label: "Category", column: "category", kind: "DIMENSION_KIND_CATEGORY", description: "The product's category.", definedBy: AUTHOR },
    { name: "brand", label: "Brand", column: "brand", kind: "DIMENSION_KIND_CATEGORY", definedBy: AUTHOR },
  ],
  measures: [
    { name: "revenue", label: "Revenue", column: "line_amount", aggregate: "AGGREGATE_FUNCTION_SUM", format: "currency", description: "What the lines were sold for, before refunds.", definedBy: AUTHOR },
    { name: "cost", label: "Cost", column: "line_cost", aggregate: "AGGREGATE_FUNCTION_SUM", format: "currency", description: "Quantity times the product's unit cost.", definedBy: AUTHOR },
    { name: "refunded", label: "Refunded", column: "refund_amount", aggregate: "AGGREGATE_FUNCTION_SUM", format: "currency", description: "Money given back for returned lines.", definedBy: AUTHOR },
    { name: "units", label: "Units", column: "quantity", aggregate: "AGGREGATE_FUNCTION_SUM", format: "compact", definedBy: AUTHOR },
    { name: "lines", label: "Lines", aggregate: "AGGREGATE_FUNCTION_COUNT", format: "compact", description: "Order lines.", definedBy: AUTHOR },
  ],
  metrics: [
    { name: "refund_rate", label: "Refund rate", expression: "refunded / revenue", format: "percent", description: "Refunded as a share of revenue.", definedBy: AUTHOR },
    { name: "margin", label: "Margin", expression: "(revenue - cost) / revenue", format: "percent", description: "What is left of revenue after cost, as a share.", definedBy: AUTHOR },
    { name: "net_revenue", label: "Net revenue", expression: "revenue - refunded", format: "currency", description: "Revenue after refunds.", definedBy: AUTHOR },
    { name: "revenue_per_line", label: "Revenue per line", expression: "revenue / lines", format: "currency", definedBy: AUTHOR },
  ],
};

/** The table most others hang off: the one that declares the most foreign keys. */
export function factTable(seed: Seed): SeedTable {
  return [...seed.tables].sort((a, b) => (b.foreignKeys?.length ?? 0) - (a.foreignKeys?.length ?? 0))[0]!;
}

/**
 * A model over one table, generated from its columns' names and types and
 * labelled as generated: a place to start that a person or an agent
 * corrects, not a definition anyone made.
 */
export function generatedModel(seed: Seed, table: SeedTable = factTable(seed)): SeedSemanticModel {
  const model = draftSemanticModel({
    name: table.name.toLowerCase(),
    label: table.name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    description: table.description,
    sourceId: seed.id,
    sql: `SELECT * FROM ${table.name}`,
    grain: table.grain,
    primaryKey: table.primaryKey,
    tables: [table.name],
    columns: table.columns.map((c) => ({ name: c.name, type: c.type, description: c.description, personal: !!c.pii })),
  });
  return semanticModelJson(model) as unknown as SeedSemanticModel;
}

/** The semantic models each seed starts with. */
export function seedSemanticModels(seed: Seed): SeedSemanticModel[] {
  return seed.id === "retail" ? [retailSalesLines, generatedModel(seed)] : [generatedModel(seed)];
}
