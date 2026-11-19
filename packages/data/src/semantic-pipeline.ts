import { type MessageInitShape, create } from "@bufbuild/protobuf";
import { type Check, CheckKind, CheckSeverity, type Dataset, type Pipeline, type Run, RunState, type SemanticModel, SemanticModelSchema } from "@surfaces-ui/proto";
import { draftSemanticFields } from "./semantic-draft.js";

type ModelInit = MessageInitShape<typeof SemanticModelSchema>;
const cap = (text: string) => text.replace(/^\w/, (c) => c.toUpperCase());

const PLAIN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A pipeline named in a sentence: "the Retail sales pipeline", or "the pipeline Refunds". */
export const thePipeline = (name: string) => (/pipeline$/i.test(name.trim()) ? `the ${name.trim()}` : `the pipeline ${name.trim()}`);

const part = (name: string) => (PLAIN.test(name) ? name : `"${name.replace(/"/g, '""')}"`);

/**
 * The query that reads a built dataset on the pipeline's source: its
 * `relation` when it has one ("analytics.orders", each part quoted only when
 * it must be), its name otherwise.
 */
export function datasetSql(dataset: string | Pick<Dataset, "name" | "relation">): string {
  if (typeof dataset === "string") return `SELECT * FROM ${part(dataset)}`;
  return dataset.relation ? `SELECT * FROM ${dataset.relation.split(".").map(part).join(".")}` : `SELECT * FROM ${part(dataset.name)}`;
}

/**
 * A new semantic model whose rows are a dataset a pipeline builds: the query
 * reads the dataset's table on the pipeline's source, the grain and key are
 * the dataset's (checked unique and not empty after every build), and the
 * fields are drafted from the dataset's declared columns, by name and type
 * only, with their descriptions, labelled as coming from the pipeline. Not
 * saved: a draft of version 0 for a person or an agent to correct.
 */
export function semanticModelFromDataset(pipeline: Pipeline, datasetName: string, options: { name?: string; label?: string; definedBy?: string } = {}): SemanticModel {
  const dataset = pipeline.datasets.find((d) => d.name === datasetName);
  if (!dataset) throw new Error(`${cap(thePipeline(pipeline.summary?.name || pipeline.summary?.id || ""))} has no dataset "${datasetName}".`);
  const pipelineName = pipeline.summary?.name || pipeline.summary?.id || "";
  const fields = draftSemanticFields(
    dataset.columns.map((c) => ({ name: c.name, type: c.type, description: c.description })),
    { definedBy: options.definedBy ?? `from ${thePipeline(pipelineName)}`, grain: dataset.grain },
  );
  const name = options.name ?? (datasetName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "") || "model");
  return create(SemanticModelSchema, {
    name,
    label: options.label ?? name.replace(/_+/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    description: dataset.description,
    sourceId: pipeline.summary?.sourceId ?? "",
    sql: datasetSql(dataset),
    grain: dataset.grain,
    primaryKey: [...dataset.primaryKey],
    dataset: { pipelineId: pipeline.summary?.id ?? "", dataset: dataset.name },
    ...fields,
  } satisfies ModelInit);
}

/** How a dataset stands, from its definition and its latest run: when it was built, its checks, what it reads. */
export interface DatasetStanding {
  pipelineId: string;
  pipelineName: string;
  dataset: string;
  /** Where its table is read from, when that is not its name. */
  relation?: string;
  /** False when it has never been built: the model's query has no table to read yet. */
  built: boolean;
  /** ISO 8601, when it was last built. */
  builtAt?: string;
  /** The state of the latest run that touched it. */
  state: "never" | "running" | "completed" | "failed" | "cancelled" | "skipped" | "unknown";
  /** Checks the latest run reported, failing ones first. Counts, never values. */
  checks: { name: string; severity: "fail" | "warn"; failedRecords: number; summary: string }[];
  /** Checks that failed and stop what reads the dataset. */
  failing: number;
  /** Checks of severity warn that found rows: reported, and nothing stops. */
  warnings: number;
  /** True when its key was checked unique and not empty by the latest run, and passed. */
  keyChecked: boolean;
  /** What it reads: other datasets of the pipeline and tables, and whether the definition names them or the server worked them out from the query. */
  inputs: string[];
  inputsDeclared: boolean;
  grain: string;
  primaryKey: string[];
  owner: string;
  /** All of the above in a sentence or two, for a person or a model. */
  summary: string;
}

const STATE: Partial<Record<RunState, DatasetStanding["state"]>> = {
  [RunState.RUNNING]: "running",
  [RunState.COMPLETED]: "completed",
  [RunState.FAILED]: "failed",
  [RunState.CANCELLED]: "cancelled",
  [RunState.SKIPPED]: "skipped",
};

/**
 * Where a dataset stands for a model built on it: when it was last built,
 * how the checks of its latest run went, whether its key was checked, and
 * what it reads. From the pipeline's definition and its latest run only;
 * nothing is queried.
 */
export function datasetStanding(pipeline: Pipeline, datasetName: string, latestRun?: Run): DatasetStanding | undefined {
  const dataset: Dataset | undefined = pipeline.datasets.find((d) => d.name === datasetName);
  if (!dataset) return undefined;
  const run = latestRun?.datasetRuns.find((d) => d.name === datasetName);
  // A result that does not say its severity has the check's.
  const severityOf = (name: string, own: CheckSeverity) => own || (dataset.checks.find((c) => c.name === name)?.severity ?? CheckSeverity.UNSPECIFIED);
  const checks = (run?.checks ?? [])
    .map((c) => ({ name: c.name, severity: severityOf(c.name, c.severity) === CheckSeverity.WARN ? ("warn" as const) : ("fail" as const), failedRecords: Number(c.failedRecords), summary: c.summary }))
    .sort((a, b) => Number(b.failedRecords > 0) - Number(a.failedRecords > 0));
  const failing = checks.filter((c) => c.failedRecords > 0 && c.severity === "fail").length;
  const warnings = checks.filter((c) => c.failedRecords > 0 && c.severity === "warn").length;
  // The checks a key adds, or, where a tool declares the key and tests it itself (dbt), its own unique and not-null tests on those columns.
  const implied = dataset.checks.filter((c) => c.implied);
  const key = [...dataset.primaryKey].sort().join(",");
  const onKey = (c: Check) => c.kind === CheckKind.UNIQUE && [...c.columns].sort().join(",") === key;
  const notNull = (column: string) => dataset.checks.find((c) => c.kind === CheckKind.NOT_NULL && c.columns.length === 1 && c.columns[0] === column);
  const tested = key && dataset.checks.find(onKey) && dataset.primaryKey.every(notNull) ? [dataset.checks.find(onKey)!, ...dataset.primaryKey.map((c) => notNull(c)!)] : [];
  const keyChecks = (implied.length > 0 ? implied : tested).map((c) => c.name);
  const keyChecked = keyChecks.length > 0 && keyChecks.every((name) => checks.some((c) => c.name === name && c.failedRecords === 0));
  const built = !!dataset.builtAt;
  const state = dataset.state === RunState.UNSPECIFIED && !built ? "never" : (STATE[dataset.state] ?? (built ? "completed" : "unknown"));
  const pipelineName = pipeline.summary?.name || pipeline.summary?.id || "";
  const parts = [
    built ? `Built by ${thePipeline(pipelineName)} on ${dataset.builtAt.slice(0, 16).replace("T", " ")} UTC` : `Not built yet by ${thePipeline(pipelineName)}`,
    state === "failed" ? "its latest run failed" : state === "running" ? "a run is under way" : "",
    checks.length === 0
      ? "no check results"
      : failing > 0
        ? `${failing} of ${checks.length} checks failing${warnings > 0 ? `, ${warnings} ${warnings === 1 ? "warning" : "warnings"}` : ""}`
        : warnings > 0
          ? `${warnings} ${warnings === 1 ? "warning" : "warnings"} among ${checks.length} checks, none failing`
          : `all ${checks.length} checks passed`,
    dataset.primaryKey.length > 0 ? (keyChecked ? `key ${dataset.primaryKey.join(", ")} checked unique` : `key ${dataset.primaryKey.join(", ")} not checked by the latest run`) : "no key declared",
  ].filter(Boolean);
  const reads = dataset.inputs.length > 0 ? ` Reads ${dataset.inputs.join(", ")}${dataset.inputsDeclared ? "" : " (worked out from its query)"}.` : "";
  return {
    pipelineId: pipeline.summary?.id ?? "",
    pipelineName,
    dataset: dataset.name,
    ...(dataset.relation ? { relation: dataset.relation } : {}),
    built,
    ...(built ? { builtAt: dataset.builtAt } : {}),
    state,
    checks,
    failing,
    warnings,
    keyChecked,
    inputs: [...dataset.inputs],
    inputsDeclared: dataset.inputsDeclared,
    grain: dataset.grain,
    primaryKey: [...dataset.primaryKey],
    owner: dataset.owner,
    summary: `${parts.join("; ")}.${reads}`,
  };
}

/**
 * What a model built on a pipeline dataset gets wrong about it: a dataset
 * that is gone, a source or query that is not the dataset's, a grain or key
 * that differs from the dataset's (left out with `key: false`, since the
 * engine checks a model's own key anyway). Pure; one sentence each.
 */
export function semanticDatasetProblems(model: Pick<ModelInit, "sourceId" | "sql" | "grain" | "primaryKey" | "dataset">, pipeline: Pipeline | undefined, options: { key?: boolean } = {}): string[] {
  const ref = model.dataset;
  if (!ref?.pipelineId) return [];
  if (!pipeline) return [`The pipeline ${ref.pipelineId} is not there any more.`];
  const dataset = pipeline.datasets.find((d) => d.name === ref.dataset);
  if (!dataset) return [`${cap(thePipeline(pipeline.summary?.name || ref.pipelineId))} has no dataset "${ref.dataset}" any more.`];
  const problems: string[] = [];
  if (pipeline.summary?.sourceId && model.sourceId !== pipeline.summary.sourceId) problems.push(`The dataset lives on the source ${pipeline.summary.sourceId}, not ${model.sourceId}.`);
  // The table's own name, alone or after its schema and database: what `datasetSql` writes.
  const table = (dataset.relation || dataset.name).split(".").at(-1) ?? dataset.name;
  const reads = new RegExp(`\\bfrom\\s+(?:"?[\\w$]+"?\\.){0,2}"?${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?(?![\\w$])`, "i");
  if (!reads.test(model.sql ?? "")) problems.push(`The model's query does not read the dataset ${dataset.name}.`);
  const key = (model.primaryKey ?? []).join(",").toLowerCase();
  if (options.key !== false && dataset.primaryKey.length > 0 && key !== dataset.primaryKey.join(",").toLowerCase()) problems.push(`The model's key (${(model.primaryKey ?? []).join(", ") || "none"}) is not the dataset's (${dataset.primaryKey.join(", ")}), which is the one the pipeline checks.`);
  return problems;
}
