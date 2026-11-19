/**
 * The parts of dbt's artifacts this package reads, typed loosely: dbt adds
 * fields between versions, and anything not listed here is ignored. Every
 * field is optional because an older or partial artifact may lack it.
 * See https://schemas.getdbt.com for the full schemas.
 */

export interface DbtColumn {
  name?: string;
  description?: string;
  data_type?: string | null;
  meta?: Record<string, unknown>;
  constraints?: { type?: string }[];
}

export interface DbtNode {
  unique_id?: string;
  resource_type?: string;
  package_name?: string;
  name?: string;
  alias?: string;
  schema?: string;
  database?: string;
  relation_name?: string | null;
  description?: string;
  columns?: Record<string, DbtColumn>;
  config?: { materialized?: string; tags?: string[]; meta?: Record<string, unknown>; severity?: string; enabled?: boolean };
  tags?: string[];
  meta?: Record<string, unknown>;
  depends_on?: { nodes?: string[] };
  /** The SQL dbt compiled. Shown as a read-only preview, never run by this package. */
  compiled_code?: string | null;
  constraints?: { type?: string; columns?: string[] }[];
  // Tests
  attached_node?: string | null;
  column_name?: string | null;
  test_metadata?: { name?: string; namespace?: string | null; kwargs?: Record<string, unknown> } | null;
  // Sources
  source_name?: string;
  identifier?: string;
  loaded_at_field?: string | null;
  freshness?: { warn_after?: DbtPeriod | null; error_after?: DbtPeriod | null } | null;
}

export interface DbtPeriod {
  count?: number | null;
  period?: string | null;
}

export interface DbtManifest {
  metadata?: { dbt_version?: string; project_name?: string; generated_at?: string; adapter_type?: string; invocation_id?: string };
  nodes?: Record<string, DbtNode>;
  sources?: Record<string, DbtNode>;
}

export interface DbtResult {
  unique_id?: string;
  /** success, error, skipped (models); pass, fail, warn, error (tests); pass, warn, error, runtime error (freshness). */
  status?: string;
  timing?: { name?: string; started_at?: string; completed_at?: string }[];
  message?: string | null;
  failures?: number | null;
  adapter_response?: { rows_affected?: number };
  /** For a test, the query dbt ran: it selects the rows that break the test. */
  compiled_code?: string | null;
  // sources.json
  max_loaded_at?: string;
  max_loaded_at_time_ago_in_s?: number;
  criteria?: { warn_after?: DbtPeriod | null; error_after?: DbtPeriod | null };
}

export interface DbtRunResults {
  metadata?: { generated_at?: string; invocation_id?: string; dbt_version?: string };
  elapsed_time?: number;
  args?: { which?: string };
  results?: DbtResult[];
}

export interface DbtCatalog {
  nodes?: Record<string, { columns?: Record<string, { name?: string; type?: string; index?: number }>; stats?: Record<string, { value?: unknown }> }>;
  sources?: DbtCatalog["nodes"];
}

export interface DbtSemanticManifest {
  semantic_models?: DbtSemanticModel[];
  metrics?: DbtMetric[];
}

export interface DbtSemanticModel {
  name?: string;
  label?: string;
  description?: string | null;
  node_relation?: { alias?: string; schema_name?: string; database?: string; relation_name?: string };
  defaults?: { agg_time_dimension?: string } | null;
  entities?: { name?: string; type?: string; expr?: string | null; description?: string | null }[];
  dimensions?: { name?: string; type?: string; expr?: string | null; label?: string | null; description?: string | null; type_params?: { time_granularity?: string } | null }[];
  measures?: { name?: string; agg?: string; expr?: string | null; label?: string | null; description?: string | null; agg_params?: Record<string, unknown> | null }[];
}

export interface DbtMetric {
  name?: string;
  label?: string;
  description?: string | null;
  type?: string;
  type_params?: { measure?: { name?: string } | null; numerator?: { name?: string } | null; denominator?: { name?: string } | null; expr?: string | null; metrics?: { name?: string }[] | null };
  filter?: unknown;
}

/** One reading of a project's target directory. Only the manifest is needed; each other artifact adds what it holds. */
export interface DbtArtifacts {
  manifest: DbtManifest;
  runResults?: DbtRunResults;
  /** From `dbt source freshness`. */
  sources?: DbtRunResults;
  catalog?: DbtCatalog;
  semanticManifest?: DbtSemanticManifest;
}

/** Where artifacts come from: a target directory on disk (`@surfaces-ui/pipelines-dbt/node`), object storage, a CI artifact. Returns the file's text, or undefined when it is not there. */
export type ArtifactReader = (file: "manifest.json" | "run_results.json" | "sources.json" | "catalog.json" | "semantic_manifest.json") => Promise<string | undefined>;

const parse = <T>(file: string, text: string | undefined): T | undefined => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`dbt's ${file} could not be read as JSON.`);
  }
};

/** Reads every artifact there is. A missing manifest is an error; anything else missing is left out. */
export async function readArtifacts(read: ArtifactReader): Promise<DbtArtifacts> {
  const [manifest, runResults, sources, catalog, semanticManifest] = await Promise.all([
    read("manifest.json").then((t) => parse<DbtManifest>("manifest.json", t)),
    read("run_results.json").then((t) => parse<DbtRunResults>("run_results.json", t)),
    read("sources.json").then((t) => parse<DbtRunResults>("sources.json", t)),
    read("catalog.json").then((t) => parse<DbtCatalog>("catalog.json", t)),
    read("semantic_manifest.json").then((t) => parse<DbtSemanticManifest>("semantic_manifest.json", t)),
  ]);
  if (!manifest) throw new Error("dbt's manifest.json is not there. Run dbt parse, compile or build to write it.");
  return { manifest, ...(runResults ? { runResults } : {}), ...(sources ? { sources } : {}), ...(catalog ? { catalog } : {}), ...(semanticManifest ? { semanticManifest } : {}) };
}
