import { fraud } from "./industries/fraud.js";
import { healthcare } from "./industries/healthcare.js";
import { manufacturing } from "./industries/manufacturing.js";
import { retail } from "./industries/retail.js";
import { telco } from "./industries/telco.js";
import { transportation } from "./industries/transportation.js";
import { overviewConversation } from "./industries/overview-conversation.js";
import type { Seed, SeedTable } from "./types.js";

export * from "./types.js";
export { joinsOf, pipelineGraph, starters, withStarters, type ChartSpec, type DashboardSpec, type MetricSpec, type StarterSpec } from "./starters.js";
export { prelude, withDefaults } from "./sql.js";
export { REFUND_SHARE, RETURNS_JOINED, SALES_LINES, STORE_REFUNDS } from "./industries/retail-conversation.js";
export { overviewConversation } from "./industries/overview-conversation.js";
export { ORDER_LINES, RETAIL_FACTS } from "./industries/retail-lifecycle.js";
export { SUBSCRIBER_ROWS, TELCO_FACTS } from "./industries/telco-lifecycle.js";

/** Every seed, in the order they are offered. */
export const seeds: Seed[] = [retail, healthcare, fraud, telco, transportation, manufacturing].map((seed) =>
  // A model with no written conversation of its own gets a first look over its own tables and measures, never another model's.
  seed.conversations?.length ? seed : { ...seed, conversations: [overviewConversation(seed)] },
);

export function seedById(id: string): Seed | undefined {
  return seeds.find((seed) => seed.id === id);
}

/** The tables of every seed, as `surfaces.config.ts` sources reading Parquet from `dir/<seed>/<table>.parquet`. */
export function seedSources(dir: string) {
  return seeds.map((seed) => ({
    id: seed.id,
    displayName: `${seed.title} (sample)`,
    engine: "duckdb" as const,
    tables: seed.tables.map((table) => ({ name: table.name, format: "parquet" as const, path: `${dir.replace(/\/$/, "")}/${seed.id}/${table.name}.parquet`, comment: table.description, model: tableModel(table) })),
  }));
}

/** A table's declared keys and column descriptions, in the shape a source's table config takes (`model`). */
export function tableModel(table: SeedTable) {
  return {
    primaryKey: table.primaryKey,
    columns: Object.fromEntries(table.columns.map((c) => [c.name, c.description])),
    foreignKeys: (table.foreignKeys ?? []).map((fk) => ({ columns: [fk.column], table: fk.table, references: [fk.references] })),
  };
}
export { factTable, generatedModel, retailSalesLines, seedSemanticModels, type SeedSemanticModel } from "./semantic.js";
