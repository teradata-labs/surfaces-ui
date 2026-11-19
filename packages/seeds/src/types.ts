import type { DashboardSpec } from "./starters.js";
import type { ConversationScript, PageDocument, SurfaceKindName } from "@surfaces-ui/spec";

/** Categories of personal data, as `PiiReview` names them. Every value in a seed is invented. */
export type SeedPii = "name" | "email" | "phone" | "address" | "birth_date" | "government_id" | "account_number" | "health" | "location" | "device_id";

export interface SeedColumn {
  name: string;
  type: string;
  description: string;
  /** Invented values standing in for this kind of personal data, so a personal-data review has something to find. */
  pii?: SeedPii;
}

export interface SeedForeignKey {
  column: string;
  table: string;
  references: string;
}

export interface SeedTable {
  name: string;
  /** One sentence: what a row is. Search and agents read this. */
  description: string;
  /** "one row per order line". */
  grain: string;
  primaryKey: string[];
  columns: SeedColumn[];
  foreignKeys?: SeedForeignKey[];
}

/** A problem put in the data on purpose, for cleaning and quality work to find. */
export interface SeedIssue {
  table: string;
  column?: string;
  kind: "nulls" | "duplicates" | "orphans" | "out_of_range" | "inconsistent";
  description: string;
  /** A read-only query returning the rows that show it. */
  sql: string;
}

export interface SeedParams {
  /** Multiplies the row counts. 1 keeps each model to a few MB of Parquet. */
  scale: number;
  /** Changes every generated value; the same seed always gives the same data. */
  seed: number;
  /** The first day the data covers, YYYY-MM-DD. */
  start: string;
  /** How many days it covers. */
  days: number;
}

export const DEFAULT_PARAMS: SeedParams = { scale: 1, seed: 42, start: "2025-01-01", days: 365 };

/** A form the backend defines over this model, as server config. */
export interface SeedForm {
  id: string;
  title: string;
  description: string;
  /** Where submissions are kept, chosen by the backend. */
  table: string;
  fields: { name: string; label: string; type: "text" | "longtext" | "number" | "integer" | "boolean" | "date" | "datetime" | "choice"; required?: boolean; options?: string[]; min?: number; max?: number; maxLength?: number; pattern?: string; help?: string }[];
}

/** A pipeline over this model, in the shape `surfaces.config.ts` takes. */
export interface SeedPipeline {
  id: string;
  name: string;
  description: string;
  datasets: {
    name: string;
    kind?: "table" | "view";
    layer?: "bronze" | "silver" | "gold";
    description?: string;
    sql: string;
    /** The tables and datasets it reads. */
    depends?: string[];
    /** What one row is, in a sentence. */
    grain?: string;
    /** Checked unique and never empty after every build. */
    primaryKey?: string[];
    columns?: { name: string; type?: string; description?: string }[];
    expectations?: { name: string; constraint: string; action?: "warn" | "drop" | "fail" }[];
    /** Checks over the whole built dataset, as `@surfaces-ui/pipelines` takes them. */
    checks?: {
      kind: "unique" | "not_null" | "relationships" | "accepted_values" | "row_count";
      columns?: string[];
      to?: { table: string; column: string };
      values?: string[];
      min?: number;
      max?: number;
      severity?: "warn" | "fail";
      name?: string;
    }[];
    tags?: string[];
    owner?: string;
  }[];
}

export interface SeedStarter {
  kind: SurfaceKindName;
  page: PageDocument;
}

export interface Seed {
  /** Also the source id it is served under. */
  id: string;
  title: string;
  industry: string;
  description: string;
  tables: SeedTable[];
  issues: SeedIssue[];
  /** DuckDB statements that create every table from nothing. Deterministic for given params. */
  sql(params?: Partial<SeedParams>): string[];
  forms: SeedForm[];
  pipelines: SeedPipeline[];
  starters: SeedStarter[];
  /** Conversations written out over this model: what a person asks and what an agent answers with, drawn components included. */
  conversations?: ConversationScript[];
  /** What the data is about: headline measures, a trend and breakdowns. Pages, demos and examples are built from it. */
  dashboard: DashboardSpec;
}
