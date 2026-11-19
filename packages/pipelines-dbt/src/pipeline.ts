import { type MessageInitShape, create } from "@bufbuild/protobuf";
import {
  type CheckResultSchema,
  CheckKind,
  CheckSeverity,
  type CheckSchema,
  type Dataset,
  DatasetKind,
  type DatasetRunSchema,
  type DatasetSchema,
  type Pipeline,
  PipelineSchema,
  RefreshKind,
  type Run,
  RunSchema,
  RunState,
} from "@surfaces-ui/proto";
import type { DbtArtifacts, DbtNode, DbtPeriod, DbtResult, DbtRunResults } from "./artifacts.js";

export interface DbtPipelineOptions {
  /** The pipeline's id. Defaults to the dbt project's name. */
  id?: string;
  name?: string;
  description?: string;
  /** The source whose engine reads the warehouse dbt builds into: models, seeds and sources are tables of it. */
  sourceId: string;
  /**
   * Where a node's table is read from, as the source names it. Defaults to
   * `schema.alias` (a source's `schema.identifier`), which suits a source
   * whose engine is connected to dbt's database. Return "" to read it by its
   * name alone.
   */
  relationOf?(node: DbtNode): string;
  /** True when this backend can run `dbt build` (on a person's request). */
  canBuild?: boolean;
}

const BUILT = new Set(["model", "seed", "snapshot"]);

/** schema.alias from a node, the parts it has. */
export const defaultRelation = (node: DbtNode): string => [node.schema, node.resource_type === "source" ? node.identifier || node.name : node.alias || node.name].filter(Boolean).join(".");

/** What dbt's node is called here: its name, a source as source_name.name, and the package first when two packages use one name. */
export function datasetNames(artifacts: DbtArtifacts): Map<string, string> {
  const nodes = [...Object.values(artifacts.manifest.nodes ?? {}).filter((n) => BUILT.has(n.resource_type ?? "") && n.config?.materialized !== "ephemeral" && n.config?.enabled !== false), ...Object.values(artifacts.manifest.sources ?? {})];
  const base = (n: DbtNode) => (n.resource_type === "source" ? `${n.source_name}.${n.name}` : (n.name ?? ""));
  const count = new Map<string, number>();
  for (const n of nodes) count.set(base(n), (count.get(base(n)) ?? 0) + 1);
  return new Map(nodes.map((n) => [n.unique_id ?? "", (count.get(base(n)) ?? 0) > 1 ? `${n.package_name}.${base(n)}` : base(n)]));
}

/** The tests dbt attaches to each node, by the node's unique id. */
function testsByNode(artifacts: DbtArtifacts): Map<string, DbtNode[]> {
  const out = new Map<string, DbtNode[]>();
  for (const test of Object.values(artifacts.manifest.nodes ?? {})) {
    if (test.resource_type !== "test" || test.config?.enabled === false) continue;
    const node = test.attached_node || (test.depends_on?.nodes?.length === 1 ? test.depends_on.nodes[0] : undefined);
    if (!node) continue;
    out.set(node, [...(out.get(node) ?? []), test]);
  }
  return out;
}

/** A ref('x') or source('a', 'b') in a test's arguments, as the dataset it names. */
function refName(to: unknown): string {
  const text = String(to ?? "");
  const ref = /ref\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?\s*\)/.exec(text);
  if (ref) return ref[2] ?? ref[1]!;
  const source = /source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/.exec(text);
  return source ? `${source[1]}.${source[2]}` : text;
}

const words = (period: DbtPeriod | null | undefined) => (period?.count ? `${period.count} ${period.period ?? "hour"}${period.count === 1 ? "" : "s"}` : "");

/** A dbt test as a check. The kinds dbt ships map to ours; any other test keeps its name and says what it is in words. */
export function checkOf(test: DbtNode): MessageInitShape<typeof CheckSchema> {
  const meta = test.test_metadata;
  const kwargs = meta?.kwargs ?? {};
  const column = test.column_name || (typeof kwargs.column_name === "string" ? kwargs.column_name : "");
  const severity = String(test.config?.severity ?? "error").toLowerCase() === "warn" ? CheckSeverity.WARN : CheckSeverity.FAIL;
  const base = { name: test.name ?? "", severity };
  const builtIn = !meta?.namespace;
  if (builtIn && meta?.name === "unique") return { ...base, kind: CheckKind.UNIQUE, columns: [column] };
  if (builtIn && meta?.name === "not_null") return { ...base, kind: CheckKind.NOT_NULL, columns: [column] };
  if (builtIn && meta?.name === "accepted_values") return { ...base, kind: CheckKind.ACCEPTED_VALUES, columns: [column], values: (Array.isArray(kwargs.values) ? kwargs.values : []).map(String) };
  if (builtIn && meta?.name === "relationships") return { ...base, kind: CheckKind.RELATIONSHIPS, columns: [column], toTable: refName(kwargs.to), toColumn: String(kwargs.field ?? "") };
  if (meta?.namespace === "dbt_utils" && meta.name === "unique_combination_of_columns" && Array.isArray(kwargs.combination_of_columns)) return { ...base, kind: CheckKind.UNIQUE, columns: kwargs.combination_of_columns.map(String) };
  const what = test.description || (meta ? `${meta.namespace ? `${meta.namespace}.` : ""}${meta.name}${typeof kwargs.expression === "string" ? `: ${kwargs.expression}` : ""}${column ? ` on ${column}` : ""}` : `The dbt test ${test.name}.`);
  return { ...base, kind: CheckKind.UNSPECIFIED, columns: column ? [column] : [], description: what };
}

/** The columns that pick out one row: declared in meta, a primary key constraint, or a column dbt tests unique and not null. */
function keyOf(node: DbtNode, tests: DbtNode[]): string[] {
  const meta = { ...(node.config?.meta ?? {}), ...(node.meta ?? {}) };
  const declared = meta.primary_key ?? meta.primaryKey;
  if (Array.isArray(declared)) return declared.map(String);
  if (typeof declared === "string" && declared) return [declared];
  const constraint = node.constraints?.find((c) => c.type === "primary_key" && c.columns?.length);
  if (constraint?.columns) return [...constraint.columns];
  const columnConstraint = Object.values(node.columns ?? {}).find((c) => c.constraints?.some((k) => k.type === "primary_key"));
  if (columnConstraint?.name) return [columnConstraint.name];
  const checks = tests.map(checkOf);
  const unique = checks.filter((c) => c.kind === CheckKind.UNIQUE);
  const notNull = new Set(checks.filter((c) => c.kind === CheckKind.NOT_NULL).flatMap((c) => c.columns ?? []));
  const single = unique.find((c) => c.columns?.length === 1 && notNull.has(c.columns[0]!));
  if (single?.columns) return [...single.columns];
  const combined = unique.find((c) => (c.columns?.length ?? 0) > 1);
  return combined?.columns ? [...combined.columns] : [];
}

/** The node's columns: what the project says about them, with the warehouse's types from the catalog, in the warehouse's order. */
function columnsOf(node: DbtNode, artifacts: DbtArtifacts) {
  const declared = Object.values(node.columns ?? {});
  const found = artifacts.catalog?.[node.resource_type === "source" ? "sources" : "nodes"]?.[node.unique_id ?? ""]?.columns ?? {};
  const byName = new Map(declared.map((c) => [String(c.name ?? "").toLowerCase(), c]));
  const fromCatalog = Object.values(found)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((c) => {
      const said = byName.get(String(c.name ?? "").toLowerCase());
      byName.delete(String(c.name ?? "").toLowerCase());
      return { name: said?.name || c.name || "", type: c.type || said?.data_type || "", description: said?.description ?? "" };
    });
  return [...fromCatalog, ...[...byName.values()].map((c) => ({ name: c.name ?? "", type: c.data_type ?? "", description: c.description ?? "" }))];
}

const execute = (result: DbtResult) => result.timing?.find((t) => t.name === "execute") ?? result.timing?.at(-1);

/** A run's id: dbt's invocation id. */
const runId = (results: DbtRunResults) => results.metadata?.invocation_id || `dbt-${results.metadata?.generated_at ?? "run"}`;

const NODE_STATE: Record<string, RunState> = { success: RunState.COMPLETED, pass: RunState.COMPLETED, warn: RunState.COMPLETED, error: RunState.FAILED, fail: RunState.FAILED, "runtime error": RunState.FAILED, skipped: RunState.SKIPPED };

/** A test's result as a check result: counts and dbt's own message, never rows. */
function checkResultOf(test: DbtNode, result: DbtResult): MessageInitShape<typeof CheckResultSchema> {
  const check = checkOf(test);
  const status = result.status ?? "";
  const failures = typeof result.failures === "number" ? result.failures : status === "pass" ? 0 : 1;
  const summary =
    status === "pass"
      ? "Passed."
      : status === "error"
        ? `Could not run: ${result.message ?? "dbt reported an error."}`
        : status === "skipped"
          ? "Skipped, because what it tests was not built."
          : typeof result.failures === "number"
            ? `${result.failures} ${result.failures === 1 ? "row breaks" : "rows break"} it${status === "warn" ? " (a warning)" : ""}.`
            : (result.message ?? status);
  // dbt's own test query selects the rows that break it: offered to a person to open, never run here.
  const failingRowsSql = failures > 0 && status !== "error" ? (result.compiled_code ?? test.compiled_code ?? "").trim() : "";
  return { name: check.name, kind: check.kind, severity: check.severity, failedRecords: BigInt(status === "error" ? Math.max(1, failures) : failures), summary, ...(failingRowsSql ? { failingRowsSql } : {}) };
}

/**
 * A run from dbt's run_results.json: each model, seed and snapshot it
 * built, with the results of the tests on it. A test that fails at error
 * severity marks its dataset failed (it stays built), as the reference
 * runner does. Counts only.
 */
export function runFromResults(artifacts: DbtArtifacts, results: DbtRunResults, pipelineId: string): Run {
  const names = datasetNames(artifacts);
  const nodes = artifacts.manifest.nodes ?? {};
  const byNode = new Map<string, MessageInitShape<typeof DatasetRunSchema>>();
  const run = (uid: string) => {
    const name = names.get(uid);
    if (!name) return undefined;
    let entry = byNode.get(uid);
    if (!entry) byNode.set(uid, (entry = { name, state: RunState.COMPLETED, checks: [] }));
    return entry;
  };
  for (const result of results.results ?? []) {
    const node = nodes[result.unique_id ?? ""];
    if (!node || !BUILT.has(node.resource_type ?? "")) continue;
    const entry = run(node.unique_id ?? "");
    if (!entry) continue;
    entry.state = NODE_STATE[result.status ?? ""] ?? RunState.UNSPECIFIED;
    if (result.adapter_response?.rows_affected !== undefined && result.adapter_response.rows_affected >= 0) entry.rowsWritten = BigInt(result.adapter_response.rows_affected);
    const timing = execute(result);
    if (timing?.started_at && timing.completed_at) entry.durationMs = BigInt(Math.max(0, Date.parse(timing.completed_at) - Date.parse(timing.started_at)));
    if (result.status === "error" && result.message) entry.errorMessage = result.message;
  }
  for (const result of results.results ?? []) {
    const test = nodes[result.unique_id ?? ""];
    if (test?.resource_type !== "test") continue;
    const target = test.attached_node || (test.depends_on?.nodes?.length === 1 ? test.depends_on.nodes[0] : undefined);
    const entry = target ? run(target) : undefined;
    if (!entry) continue;
    const check = checkResultOf(test, result);
    entry.checks = [...(entry.checks ?? []), check];
    if (check.severity === CheckSeverity.FAIL && Number(check.failedRecords) > 0 && entry.state === RunState.COMPLETED) entry.state = RunState.FAILED;
  }
  for (const result of artifacts.sources === results ? (results.results ?? []) : []) {
    const entry = run(result.unique_id ?? "");
    if (!entry) continue;
    // Past its error limit, or not checkable: the source is not fit to build from.
    entry.state = result.status === "error" || result.status === "runtime error" ? RunState.FAILED : RunState.COMPLETED;
    entry.checks = [freshnessResult(result)];
  }
  const datasetRuns = [...byNode.values()];
  const generated = results.metadata?.generated_at ?? "";
  const start = generated && results.elapsed_time ? new Date(Date.parse(generated) - results.elapsed_time * 1000).toISOString() : generated;
  const freshness = artifacts.sources === results;
  return create(RunSchema, {
    id: runId(results),
    pipelineId,
    state: datasetRuns.some((d) => d.state === RunState.FAILED) ? RunState.FAILED : RunState.COMPLETED,
    startTime: start,
    endTime: generated,
    trigger: "dbt",
    startedBy: freshness ? "dbt source freshness" : `dbt ${results.args?.which ?? "run"}`,
    refreshKind: RefreshKind.REFRESH,
    datasetRuns,
  });
}

function freshnessResult(result: DbtResult): MessageInitShape<typeof CheckResultSchema> {
  const status = result.status ?? "";
  const hours = typeof result.max_loaded_at_time_ago_in_s === "number" ? Math.round(result.max_loaded_at_time_ago_in_s / 360) / 10 : undefined;
  const limits = [words(result.criteria?.warn_after) && `warns after ${words(result.criteria?.warn_after)}`, words(result.criteria?.error_after) && `fails after ${words(result.criteria?.error_after)}`].filter(Boolean).join(", ");
  const summary = status === "runtime error" ? "Freshness could not be checked." : `Last loaded ${hours !== undefined ? `${hours} hours ago` : "at an unknown time"}${limits ? `; ${limits}` : ""}.`;
  return { name: "freshness", kind: CheckKind.UNSPECIFIED, severity: status === "warn" ? CheckSeverity.WARN : CheckSeverity.FAIL, failedRecords: status === "pass" ? 0n : 1n, summary };
}

/**
 * A dbt project as a pipeline, read from its artifacts: its sources, seeds,
 * models and snapshots as datasets with what they read, their columns
 * (types from the catalog), key, grain and owner (from `meta`), tags, and
 * dbt's tests as checks; and, from the latest runs, when each was built and
 * how. The compiled SQL is carried as a read-only preview: dbt builds each
 * model from its own definition and nothing here runs that text. Ephemeral
 * models, which have no table, are left out.
 */
export function pipelineFromArtifacts(artifacts: DbtArtifacts, options: DbtPipelineOptions, runs: Run[] = []): Pipeline {
  const project = artifacts.manifest.metadata?.project_name ?? "dbt";
  const id = options.id ?? project;
  const names = datasetNames(artifacts);
  const tests = testsByNode(artifacts);
  const relationOf = options.relationOf ?? defaultRelation;
  const latest = new Map<string, { run: Run; result: Run["datasetRuns"][number] }>();
  for (const run of [...runs].filter((r) => !r.dryRun).sort((a, b) => a.startTime.localeCompare(b.startTime))) for (const result of run.datasetRuns) latest.set(result.name, { run, result });

  // What one row is, from the primary entity of a semantic model on it, when the model's meta does not say.
  const entityGrain = new Map<string, string>();
  for (const semantic of artifacts.semanticManifest?.semantic_models ?? []) {
    const primary = semantic.entities?.find((e) => e.type === "primary" || e.type === "natural");
    const relation = semantic.node_relation ?? {};
    if (primary?.name && relation.alias) entityGrain.set(`${relation.schema_name ?? ""}.${relation.alias}`, `One ${primary.name.replace(/_+/g, " ").toLowerCase()}.`);
  }
  const datasets: MessageInitShape<typeof DatasetSchema>[] = [];
  const all = [...Object.values(artifacts.manifest.sources ?? {}), ...Object.values(artifacts.manifest.nodes ?? {})];
  for (const node of all) {
    const name = names.get(node.unique_id ?? "");
    if (!name) continue;
    const source = node.resource_type === "source";
    const meta = { ...(node.config?.meta ?? {}), ...(node.meta ?? {}) };
    const own = tests.get(node.unique_id ?? "") ?? [];
    const checks = own.map(checkOf);
    if (source && (node.freshness?.warn_after?.count || node.freshness?.error_after?.count)) {
      const limits = [words(node.freshness.warn_after) && `warns after ${words(node.freshness.warn_after)}`, words(node.freshness.error_after) && `fails after ${words(node.freshness.error_after)}`].filter(Boolean).join(", ");
      checks.push({ name: "freshness", kind: CheckKind.UNSPECIFIED, severity: node.freshness.error_after?.count ? CheckSeverity.FAIL : CheckSeverity.WARN, description: `Loaded recently${node.loaded_at_field ? `, by ${node.loaded_at_field}` : ""}: ${limits}.` });
    }
    const last = latest.get(name);
    const materialized = node.config?.materialized ?? (source ? "" : "table");
    const path = String((node as { original_file_path?: string }).original_file_path ?? "").split("/");
    const owner = meta.owner ?? (node as { group?: string }).group;
    const built = last && last.result.state !== RunState.SKIPPED && (last.result.state !== RunState.FAILED || !!last.result.checks.length) ? last.run.endTime : "";
    datasets.push({
      name,
      kind: source ? DatasetKind.SOURCE : materialized === "view" ? DatasetKind.VIEW : DatasetKind.TABLE,
      ...(path.length > 2 && path[0] === "models" ? { layer: path[1] } : node.resource_type === "seed" ? { layer: "seed" } : node.resource_type === "snapshot" ? { layer: "snapshot" } : {}),
      description: node.description ?? "",
      sql: node.compiled_code ?? "",
      inputs: (node.depends_on?.nodes ?? []).map((n) => names.get(n)).filter((n): n is string => !!n),
      inputsDeclared: true,
      grain: typeof meta.grain === "string" ? meta.grain : (entityGrain.get(`${node.schema ?? ""}.${node.alias || node.name}`) ?? ""),
      primaryKey: source ? [] : keyOf(node, own),
      columns: columnsOf(node, artifacts),
      checks,
      tags: [...new Set([...(node.tags ?? []), ...(node.config?.tags ?? [])])],
      owner: typeof owner === "string" ? owner : "",
      relation: relationOf(node),
      ...(last ? { state: last.result.state, lastRunId: last.run.id, ...(built ? { builtAt: built } : {}), ...(last.result.rowsWritten ? { rowsWritten: last.result.rowsWritten } : {}) } : {}),
    });
  }
  // Sources first, then in the order dbt builds: what a dataset reads comes before it.
  const order = new Map<string, number>();
  const depth = (d: (typeof datasets)[number], seen = new Set<string>()): number => {
    if (order.has(d.name ?? "")) return order.get(d.name ?? "")!;
    if (seen.has(d.name ?? "")) return 0;
    seen.add(d.name ?? "");
    const value = Math.max(0, ...(d.inputs ?? []).map((i) => {
      const input = datasets.find((x) => x.name === i);
      return input ? depth(input, seen) + 1 : 0;
    }));
    order.set(d.name ?? "", value);
    return value;
  };
  const isSource = (d: (typeof datasets)[number]) => (d.kind === DatasetKind.SOURCE ? 0 : 1);
  datasets.sort((a, b) => isSource(a) - isSource(b) || depth(a) - depth(b) || String(a.name).localeCompare(String(b.name)));
  const version = artifacts.manifest.metadata?.dbt_version;
  const latestRun = [...runs].sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
  return create(PipelineSchema, {
    summary: {
      id,
      name: options.name ?? project,
      description: options.description ?? `A dbt project${version ? ` (dbt ${version})` : ""}, read from its artifacts.`,
      sourceId: options.sourceId,
      datasetCount: datasets.length,
      ...(latestRun ? { latestRun } : {}),
    },
    datasets,
    recomputeOnly: false,
    canBuild: !!options.canBuild,
    canSave: false,
    externalRuns: true,
    version: 0,
  });
}

/** Names a person or an agent may select: built datasets (not sources), with dbt's + marks. */
export function dbtSelection(pipeline: Pipeline, select: string[]): string[] {
  const built = new Set(pipeline.datasets.filter((d: Dataset) => d.kind !== DatasetKind.SOURCE).map((d) => d.name));
  return select.map((item) => {
    const match = /^(\+?)([A-Za-z_][A-Za-z0-9_.]*)(\+?)$/.exec(item.trim());
    if (!match || !built.has(match[2]!)) throw new Error(`"${item}" is not a model, seed or snapshot of this project. Name one, with + before for what it reads or after for what reads it.`);
    return `${match[1]}${match[2]}${match[3]}`;
  });
}
