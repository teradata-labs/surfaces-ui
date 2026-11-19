import { type MessageInitShape, create } from "@bufbuild/protobuf";
import { type Pipelines, checkName, pipelineDigest } from "@surfaces-ui/data";
import type { Engine, Param } from "@surfaces-ui/engine";
import {
  CancelRunRequestSchema,
  CancelRunResponseSchema,
  type CheckResultSchema,
  CheckKind,
  CheckSeverity,
  type Dataset,
  DatasetKind,
  type DatasetSchema,
  DatasetRunSchema,
  ExpectationAction,
  GetPipelineRequestSchema,
  GetPipelineResponseSchema,
  GetRunRequestSchema,
  GetRunResponseSchema,
  InspectFilesRequestSchema,
  InspectFilesResponseSchema,
  ListPipelineVersionsRequestSchema,
  ListPipelineVersionsResponseSchema,
  ListPipelinesResponseSchema,
  ListRunsRequestSchema,
  ListRunsResponseSchema,
  type PipelineDraft,
  PipelineDraftSchema,
  PipelineSchema,
  type PipelineVersion,
  PipelineVersionSchema,
  RefreshKind,
  type Run,
  RunSchema,
  RunState,
  SavePipelineRequestSchema,
  SavePipelineResponseSchema,
  StartRunRequestSchema,
  StartRunResponseSchema,
} from "@surfaces-ui/proto";
import { SqlError, assertReadOnly, blankLiterals, checkQuery, initSql } from "@surfaces-ui/sql";

export interface ExpectationDefinition {
  name: string;
  /** A condition every record should meet, e.g. `amount >= 0`. */
  constraint: string;
  /** What happens to a record that breaks it. Defaults to "warn". */
  action?: "warn" | "drop" | "fail";
}

/** A test over the whole built dataset: what a row-level expectation cannot say. */
export interface CheckDefinition {
  kind: "unique" | "not_null" | "relationships" | "accepted_values" | "row_count";
  /** The column, or for "unique" the columns that together must not repeat. */
  columns?: string[];
  /** "relationships": the dataset or table, and column, every value must be found in. */
  to?: { table: string; column: string };
  /** "accepted_values": the values allowed, compared as text. */
  values?: string[];
  /** "row_count" bounds. */
  min?: number;
  max?: number;
  /** "fail" (default) counts the dataset as failed, so what reads it is not built; "warn" reports it. */
  severity?: "warn" | "fail";
  name?: string;
}

export interface ColumnDefinition {
  name: string;
  type?: string;
  description?: string;
}

export interface DatasetDefinition {
  /** The table's name. Other datasets read it by this name. */
  name: string;
  /** "table" (default) is rebuilt on each run; "view" runs its query when read. */
  kind?: "table" | "view";
  layer?: "bronze" | "silver" | "gold";
  description?: string;
  /** A single SELECT. It may read the source's tables and other datasets of the pipeline. */
  sql: string;
  /**
   * The datasets and source tables it reads. Left out, they are worked out
   * from the query's text, which can mistake a name that only appears in it
   * (a column or an alias) for one it reads.
   */
  depends?: string[];
  /** What one row is, in a sentence: "one row per order line". */
  grain?: string;
  /** The columns that pick out one row. They are checked unique and not empty after every build. */
  primaryKey?: string[];
  columns?: ColumnDefinition[];
  expectations?: ExpectationDefinition[];
  checks?: CheckDefinition[];
  tags?: string[];
  owner?: string;
}

export interface PipelineDefinition {
  id: string;
  name?: string;
  description?: string;
  /** The source whose engine builds the datasets. They can then be queried through it. */
  sourceId: string;
  datasets: DatasetDefinition[];
}

/** A pipeline someone saved, with every version kept. */
export interface SavedPipeline {
  definition: PipelineDefinition;
  version: number;
  versions: { version: number; savedAt: string; approvedBy: string; note: string; definition: PipelineDefinition }[];
}

/** Where saved pipelines live. The dev server keeps one JSON file per pipeline. */
export interface PipelineStore {
  list(): Promise<SavedPipeline[]>;
  put(saved: SavedPipeline): Promise<void>;
}

/** Where runs are kept, so history outlives the process. */
export interface RunStore {
  /** Every pipeline's runs, newest first. */
  load(): Promise<Run[]>;
  /** Called as a run progresses and when it ends; the same ID replaces what was kept. */
  save(run: Run): Promise<void>;
}

export interface PipelinesOptions {
  /** Pipelines defined in the server's config. They cannot be changed by a save. */
  pipelines: PipelineDefinition[];
  /** The engine behind a source. It must support `materialize`. */
  engineOf(sourceId: string): Engine | undefined;
  /** Called when a run that built something ends, so caches over the source can be dropped. */
  onFinished?(run: Run, sourceId: string): void;
  /** Runs kept per pipeline. Defaults to 50. */
  historyLimit?: number;
  /** Where runs are kept. Left out, they are kept in memory and lost on restart. */
  runs?: RunStore;
  /**
   * Allows `savePipeline`: pipelines a person approved are checked and kept
   * here, and can be run like the configured ones. Left out, pipelines are
   * fixed.
   */
  saved?: PipelineStore;
  now?: () => Date;
}

type DatasetRunInit = MessageInitShape<typeof DatasetRunSchema>;
type CheckResultInit = MessageInitShape<typeof CheckResultSchema>;

const ACTION: Record<NonNullable<ExpectationDefinition["action"]>, ExpectationAction> = {
  warn: ExpectationAction.WARN,
  drop: ExpectationAction.DROP,
  fail: ExpectationAction.FAIL,
};
const ACTION_NAME = new Map<ExpectationAction, ExpectationDefinition["action"]>([
  [ExpectationAction.WARN, "warn"],
  [ExpectationAction.DROP, "drop"],
  [ExpectationAction.FAIL, "fail"],
]);
const KIND: Record<CheckDefinition["kind"], CheckKind> = {
  unique: CheckKind.UNIQUE,
  not_null: CheckKind.NOT_NULL,
  relationships: CheckKind.RELATIONSHIPS,
  accepted_values: CheckKind.ACCEPTED_VALUES,
  row_count: CheckKind.ROW_COUNT,
};
const KIND_NAME = new Map<CheckKind, CheckDefinition["kind"]>(Object.entries(KIND).map(([name, kind]) => [kind, name as CheckDefinition["kind"]]));
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** A pipeline ID: also a file name where saved pipelines are kept. */
const PIPELINE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const lower = (name: string) => name.toLowerCase();
const plural = (n: bigint | number, one: string, many: string) => `${n.toLocaleString("en")} ${n === 1 || n === 1n ? one : many}`;

/**
 * The names a query reads, out of a list of candidates. String literals and
 * comments are ignored, so a name that only appears in text does not count.
 */
export function referencedNames(sql: string, candidates: string[]): string[] {
  const bare = blankLiterals(sql).toLowerCase();
  return candidates.filter((name) => new RegExp(`(^|[^\\w$])${lower(name).replace(/[$]/g, "\\$")}($|[^\\w$])`).test(bare));
}

/**
 * The order to build datasets in: each after everything it reads. Throws a
 * readable error when datasets depend on each other in a circle.
 */
export function buildOrder(inputs: Map<string, string[]>): string[] {
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, trail: string[]) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") throw new Error(`These datasets depend on each other in a circle: ${[...trail.slice(trail.indexOf(name)), name].join(" → ")}`);
    state.set(name, "visiting");
    for (const input of inputs.get(name) ?? []) if (inputs.has(input)) visit(input, [...trail, name]);
    state.set(name, "done");
    order.push(name);
  };
  for (const name of inputs.keys()) visit(name, []);
  return order;
}

/**
 * The datasets a selection names, given what each reads. "orders" is that
 * dataset alone, "orders+" adds everything that reads it (directly or not),
 * "+orders" adds everything it reads, and "+orders+" both. Names are
 * matched without regard to case; an unknown name is reported.
 */
export function selectDatasets(select: string[], inputs: Map<string, string[]>): { selected: Set<string>; unknown: string[] } {
  const selected = new Set<string>();
  const unknown: string[] = [];
  const grow = (start: string, next: (name: string) => string[]) => {
    const seen = new Set([start]);
    for (const queue = [start]; queue.length > 0; ) {
      for (const n of next(queue.shift()!)) if (!seen.has(n)) (seen.add(n), queue.push(n));
    }
    return seen;
  };
  const readers = (name: string) => [...inputs].filter(([, reads]) => reads.map(lower).includes(name)).map(([n]) => n);
  const reads = (name: string) => (inputs.get(name) ?? []).map(lower).filter((n) => inputs.has(n));
  for (const item of select) {
    const up = item.startsWith("+");
    const down = item.endsWith("+");
    const name = lower(item.replace(/^\+|\+$/g, "").trim());
    if (!inputs.has(name)) {
      unknown.push(item.replace(/^\+|\+$/g, "").trim());
      continue;
    }
    selected.add(name);
    if (down) for (const n of grow(name, readers)) selected.add(n);
    if (up) for (const n of grow(name, reads)) selected.add(n);
  }
  return { selected, unknown };
}

/** The checks a dataset gets: its own, and for a primary key one that it is unique and one per column that it is never empty. */
export function datasetChecks(dataset: DatasetDefinition): (CheckDefinition & { implied?: boolean })[] {
  const key = dataset.primaryKey ?? [];
  const implied: (CheckDefinition & { implied: boolean })[] =
    key.length === 0 ? [] : [{ kind: "unique", columns: key, implied: true }, ...key.map((column) => ({ kind: "not_null" as const, columns: [column], implied: true }))];
  const own = dataset.checks ?? [];
  const same = (a: CheckDefinition, b: CheckDefinition) => a.kind === b.kind && (a.columns ?? []).map(lower).join() === (b.columns ?? []).map(lower).join();
  return [...implied.filter((i) => !own.some((o) => same(o, i))), ...own];
}

/** A pipeline definition from a draft a person approved. */
export function definitionFromDraft(draft: PipelineDraft): PipelineDefinition {
  return {
    id: draft.id,
    ...(draft.name && draft.name !== draft.id ? { name: draft.name } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    sourceId: draft.sourceId,
    datasets: draft.datasets.map((d) => ({
      name: d.name,
      ...(d.kind === DatasetKind.VIEW ? { kind: "view" as const } : {}),
      ...(d.layer === "bronze" || d.layer === "silver" || d.layer === "gold" ? { layer: d.layer } : {}),
      ...(d.description ? { description: d.description } : {}),
      sql: d.sql,
      ...(d.inputs.length > 0 ? { depends: d.inputs } : {}),
      ...(d.grain ? { grain: d.grain } : {}),
      ...(d.primaryKey.length > 0 ? { primaryKey: d.primaryKey } : {}),
      ...(d.columns.length > 0 ? { columns: d.columns.map((c) => ({ name: c.name, ...(c.type ? { type: c.type } : {}), ...(c.description ? { description: c.description } : {}) })) } : {}),
      ...(d.expectations.length > 0 ? { expectations: d.expectations.map((e) => ({ name: e.name, constraint: e.constraint, action: ACTION_NAME.get(e.action) ?? "warn" })) } : {}),
      ...(d.checks.filter((c) => !c.implied).length > 0
        ? {
            checks: d.checks
              .filter((c) => !c.implied)
              .map((c) => ({
                kind: KIND_NAME.get(c.kind) ?? "unique",
                ...(c.columns.length > 0 ? { columns: c.columns } : {}),
                ...(c.toTable ? { to: { table: c.toTable, column: c.toColumn } } : {}),
                ...(c.values.length > 0 ? { values: c.values } : {}),
                ...(c.minRows !== undefined ? { min: Number(c.minRows) } : {}),
                ...(c.maxRows !== undefined ? { max: Number(c.maxRows) } : {}),
                ...(c.severity === CheckSeverity.WARN ? { severity: "warn" as const } : {}),
                // A name that is only the one made up from the kind and columns is left out.
                ...(c.name && c.name !== checkName({ kind: c.kind, columns: c.columns }) ? { name: c.name } : {}),
              })),
          }
        : {}),
      ...(d.tags.length > 0 ? { tags: d.tags } : {}),
      ...(d.owner ? { owner: d.owner } : {}),
    })),
  };
}

/** A check as the `Check` message. */
function checkMessage(check: CheckDefinition & { implied?: boolean }) {
  return {
    name: checkName({ name: check.name, kind: KIND[check.kind], columns: check.columns }),
    kind: KIND[check.kind],
    columns: check.columns ?? [],
    toTable: check.to?.table ?? "",
    toColumn: check.to?.column ?? "",
    values: check.values ?? [],
    ...(check.min !== undefined ? { minRows: BigInt(check.min) } : {}),
    ...(check.max !== undefined ? { maxRows: BigInt(check.max) } : {}),
    severity: check.severity === "warn" ? CheckSeverity.WARN : CheckSeverity.FAIL,
    implied: check.implied ?? false,
  };
}

/** A dataset definition as the `Dataset` message, without run state. */
function datasetMessage(dataset: DatasetDefinition, inputs: string[]): MessageInitShape<typeof DatasetSchema> {
  return {
    name: dataset.name,
    kind: dataset.kind === "view" ? DatasetKind.VIEW : DatasetKind.TABLE,
    layer: dataset.layer ?? "",
    description: dataset.description ?? "",
    sql: dataset.sql,
    inputs,
    inputsDeclared: dataset.depends !== undefined,
    expectations: (dataset.expectations ?? []).map((rule) => ({ name: rule.name, constraint: rule.constraint, action: ACTION[rule.action ?? "warn"] })),
    grain: dataset.grain ?? "",
    primaryKey: dataset.primaryKey ?? [],
    columns: (dataset.columns ?? []).map((c) => ({ name: c.name, type: c.type ?? "", description: c.description ?? "" })),
    checks: datasetChecks(dataset).map(checkMessage),
    tags: dataset.tags ?? [],
    owner: dataset.owner ?? "",
  };
}

interface Prepared {
  definition: PipelineDefinition;
  engine: Engine;
  /** Dataset name (lower case) to the dataset and source table names it reads. */
  inputs: Map<string, string[]>;
  sources: string[];
  order: string[];
}

/**
 * A reference pipeline backend on any Engine that can `materialize`. Each
 * dataset is a SELECT; a run builds them in dependency order as tables (or
 * views) of the source, applying row-level rules before a build and checks
 * over the whole dataset after it. Every run recomputes whole datasets:
 * there is no incremental or streaming processing, checkpoints or
 * schedules.
 *
 * It runs only definitions it holds: those passed in, and with a `saved`
 * store, ones a person approved through `savePipeline`, which are checked
 * before they are kept. A run request names a pipeline and datasets, never
 * SQL.
 */
export async function createPipelines(options: PipelinesOptions): Promise<Pipelines> {
  await initSql();
  const now = options.now ?? (() => new Date());
  const historyLimit = options.historyLimit ?? 50;
  const runs = new Map<string, Run[]>();
  const latest = new Map<string, Map<string, DatasetRunInit & { builtAt?: string; runId?: string }>>();
  const cancelling = new Set<string>();
  let counter = 0;

  const configured = new Map<string, PipelineDefinition>();
  for (const definition of options.pipelines) {
    if (configured.has(definition.id)) throw new Error(`Two pipelines have the ID ${definition.id}.`);
    configured.set(definition.id, definition);
  }
  const saved = new Map<string, SavedPipeline>();
  for (const pipeline of (await options.saved?.list()) ?? []) if (!configured.has(pipeline.definition.id)) saved.set(pipeline.definition.id, pipeline);
  const find = (id: string) => {
    const definition = configured.get(id) ?? saved.get(id)?.definition;
    if (!definition) throw new Error(`Pipeline not found: ${id}`);
    return definition;
  };
  const versionOf = (id: string) => saved.get(id)?.version ?? 0;

  /** Remembers each dataset's last finished state from a run. */
  const remember = (run: Run) => {
    for (const result of run.datasetRuns) {
      if (result.state === RunState.RUNNING || result.state === RunState.QUEUED) continue;
      const seen = latest.get(run.pipelineId) ?? new Map();
      seen.set(lower(result.name), { ...result, ...(result.state === RunState.COMPLETED ? { builtAt: run.endTime || run.startTime, runId: run.id } : {}) });
      latest.set(run.pipelineId, seen);
    }
  };
  for (const run of [...((await options.runs?.load()) ?? [])].reverse()) {
    // A run the process stopped during is not still going.
    const kept = run.state === RunState.RUNNING ? create(RunSchema, { ...run, state: RunState.CANCELLED, errorMessage: run.errorMessage || "The server stopped during this run." }) : run;
    runs.set(kept.pipelineId, [kept, ...(runs.get(kept.pipelineId) ?? [])].slice(0, historyLimit));
    if (!kept.dryRun) remember(kept);
    const n = Number(/^run-(\d+)$/.exec(kept.id)?.[1] ?? 0);
    if (n > counter) counter = n;
  }

  /** Checks a pipeline and works out its graph. Every problem found is reported, not just the first. */
  const prepare = async (definition: PipelineDefinition): Promise<{ prepared?: Prepared; problems: string[] }> => {
    const problems: string[] = [];
    const engine = options.engineOf(definition.sourceId);
    if (!engine) return { problems: [`The source "${definition.sourceId}" is not available.`] };
    if (!engine.materialize) return { problems: [`The source "${definition.sourceId}" cannot build tables, so it cannot run pipelines.`] };
    const names = definition.datasets.map((d) => d.name);
    for (const name of names) if (!NAME.test(name)) problems.push(`Dataset names use letters, digits and underscores: ${name}`);
    if (new Set(names.map(lower)).size !== names.length) problems.push("Two datasets have the same name.");
    const sources = (await engine.listTables({ catalog: "", schema: "", search: "" })).map((t) => t.ref?.table ?? "").filter((t) => t && !names.some((n) => lower(n) === lower(t)));
    const known = new Set([...names, ...sources].map(lower));
    const inputs = new Map<string, string[]>();
    for (const dataset of definition.datasets) {
      try {
        // A dataset is always a single read-only query; the engine wraps it to build the table.
        assertReadOnly(dataset.sql, engine.dialect);
        for (const rule of dataset.expectations ?? []) assertReadOnly(`SELECT * FROM (${dataset.sql}) AS "_d" WHERE (${rule.constraint})`, engine.dialect);
        for (const check of datasetChecks(dataset)) {
          if (check.kind === "relationships" && check.to && !known.has(lower(check.to.table))) problems.push(`${dataset.name}: the check ${checkName({ name: check.name, kind: KIND[check.kind], columns: check.columns })} looks in ${check.to.table}, which is neither a dataset nor a table of the source.`);
          checkQuery({ kind: KIND[check.kind], columns: check.columns ?? [], toTable: check.to?.table, toColumn: check.to?.column, values: check.values }, dataset.name, engine.dialect);
        }
      } catch (error) {
        problems.push(`${dataset.name}: ${error instanceof SqlError ? error.message : error instanceof Error ? error.message : String(error)}`);
      }
      if (dataset.depends) {
        for (const name of dataset.depends) if (!known.has(lower(name))) problems.push(`${dataset.name} says it reads ${name}, which is neither a dataset nor a table of the source.`);
        inputs.set(lower(dataset.name), dataset.depends.filter((n) => lower(n) !== lower(dataset.name)));
      } else {
        inputs.set(lower(dataset.name), referencedNames(dataset.sql, [...names.filter((n) => n !== dataset.name), ...sources]));
      }
    }
    let order: string[] = [];
    try {
      order = buildOrder(new Map([...inputs].map(([name, reads]) => [name, reads.map(lower)])));
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
    return problems.length > 0 ? { problems } : { prepared: { definition, engine, inputs, sources, order }, problems };
  };

  const single = async (engine: Engine, sql: string, params: Param[] = []): Promise<Record<string, unknown>> => {
    const result = await engine.execute(sql, params);
    let row: Record<string, unknown> = {};
    for await (const batch of result.batches) if (batch.numRows > 0) row = (batch.get(0)?.toJSON() ?? {}) as Record<string, unknown>;
    return row;
  };

  const save = (run: Run) => {
    const list = runs.get(run.pipelineId) ?? [];
    const index = list.findIndex((r) => r.id === run.id);
    if (index >= 0) list[index] = run;
    else list.unshift(run);
    runs.set(run.pipelineId, list.slice(0, historyLimit));
    void options.runs?.save(run).catch(() => undefined);
  };

  /** Runs a dataset's checks over what was just built. Counts only; no value is read back. */
  const runChecks = async (engine: Engine, dataset: DatasetDefinition): Promise<CheckResultInit[]> => {
    const results: CheckResultInit[] = [];
    for (const check of datasetChecks(dataset)) {
      const name = checkName({ name: check.name, kind: KIND[check.kind], columns: check.columns });
      const severity = check.severity === "warn" ? CheckSeverity.WARN : CheckSeverity.FAIL;
      const query = checkQuery({ kind: KIND[check.kind], columns: check.columns ?? [], toTable: check.to?.table, toColumn: check.to?.column, values: check.values }, dataset.name, engine.dialect);
      const row = await single(engine, query.sql, query.params);
      let failed = 0n;
      let summary = "";
      const columns = (check.columns ?? []).join(", ");
      if (check.kind === "row_count") {
        const rows = BigInt(String(row.rows ?? 0));
        const low = check.min !== undefined && rows < BigInt(check.min);
        const high = check.max !== undefined && rows > BigInt(check.max);
        failed = low || high ? 1n : 0n;
        summary = `${plural(rows, "row", "rows")}${low ? `, fewer than ${check.min}` : high ? `, more than ${check.max}` : ""}.`;
      } else {
        failed = BigInt(String(row.failed ?? 0));
        summary =
          failed === 0n
            ? "Passed."
            : check.kind === "unique"
              ? `${plural(failed, "row shares", "rows share")} ${columns} with another row.`
              : check.kind === "not_null"
                ? `${plural(failed, "row has", "rows have")} no ${columns}.`
                : check.kind === "relationships"
                  ? `${plural(failed, "row has a", "rows have a")} ${columns} not found in ${check.to?.table}.${check.to?.column}.`
                  : `${plural(failed, "row has", "rows have")} a ${columns} that is not one of the values allowed.`;
      }
      results.push({ name, kind: KIND[check.kind], severity, failedRecords: failed, summary, failingRowsSql: query.failingRowsSql });
    }
    return results;
  };

  const execute = async (prepared: Prepared, run: Run, selected: Set<string>, fullRefresh: boolean) => {
    const { definition, engine } = prepared;
    const byName = new Map(definition.datasets.map((d) => [lower(d.name), d]));
    const results = new Map<string, DatasetRunInit>();
    const publish = (state: RunState, errorMessage = "") => {
      const next = create(RunSchema, { ...run, state, errorMessage, endTime: state === RunState.RUNNING ? "" : now().toISOString(), datasetRuns: [...results.values()].map((result) => create(DatasetRunSchema, result)) });
      save(next);
      return next;
    };
    const record = (result: DatasetRunInit) => {
      results.set(lower(result.name ?? ""), result);
      publish(RunState.RUNNING);
    };
    const todo = prepared.order.filter((name) => selected.has(name));
    for (const name of todo) results.set(name, { name: byName.get(name)!.name, state: RunState.QUEUED });
    publish(RunState.RUNNING);

    let failed = "";
    for (const name of todo) {
      const dataset = byName.get(name)!;
      if (cancelling.has(run.id)) {
        record({ name: dataset.name, state: RunState.CANCELLED });
        continue;
      }
      const blocked = (prepared.inputs.get(name) ?? []).map(lower).find((input) => {
        const state = results.get(input)?.state;
        return state === RunState.FAILED || state === RunState.SKIPPED || state === RunState.CANCELLED;
      });
      if (blocked) {
        record({ name: dataset.name, state: RunState.SKIPPED, errorMessage: `Not built because ${byName.get(blocked)?.name ?? blocked} was not.` });
        continue;
      }
      record({ name: dataset.name, state: RunState.RUNNING });
      const started = Date.now();
      const rules = dataset.expectations ?? [];
      try {
        if (fullRefresh) await engine.dropMaterialized?.(dataset.name);
        let expectations: DatasetRunInit["expectations"] = [];
        if (rules.length > 0) {
          // A record whose rule cannot be decided (a null) counts as failing it.
          const counts = await single(engine, `SELECT COUNT(*) AS "total", ${rules.map((rule, i) => `SUM(CASE WHEN (${rule.constraint}) THEN 0 ELSE 1 END) AS "f${i}"`).join(", ")} FROM (${dataset.sql}) AS "_d"`);
          const total = Number(counts.total ?? 0);
          expectations = rules.map((rule, i) => {
            const bad = Number(counts[`f${i}`] ?? 0);
            return { name: rule.name, constraint: rule.constraint, action: ACTION[rule.action ?? "warn"], passedRecords: BigInt(total - bad), failedRecords: BigInt(bad) };
          });
          const fatal = expectations.find((e) => e.action === ExpectationAction.FAIL && (e.failedRecords ?? 0n) > 0n);
          if (fatal) {
            const message = `${fatal.failedRecords} records broke the rule ${fatal.name}, which stops the run.`;
            record({ name: dataset.name, state: RunState.FAILED, durationMs: BigInt(Date.now() - started), errorMessage: message, expectations });
            failed ||= `${dataset.name}: ${message}`;
            continue;
          }
        }
        const dropping = rules.filter((rule) => rule.action === "drop");
        const sql = dropping.length === 0 ? dataset.sql : `SELECT * FROM (${dataset.sql}) AS "_d" WHERE ${dropping.map((rule) => `(${rule.constraint})`).join(" AND ")}`;
        const { rowCount } = await engine.materialize!(dataset.name, sql, { view: dataset.kind === "view" });
        const checks = await runChecks(engine, dataset);
        const broken = checks.filter((c) => c.severity === CheckSeverity.FAIL && (c.failedRecords ?? 0n) > 0n);
        if (broken.length > 0) {
          // Built, as dbt's build leaves a model that fails its tests; what reads it is not.
          const message = `Built, but ${broken.length === 1 ? "the check" : "the checks"} ${broken.map((c) => c.name).join(", ")} failed: ${broken.map((c) => c.summary).join(" ")}`;
          record({ name: dataset.name, state: RunState.FAILED, rowsWritten: BigInt(rowCount), durationMs: BigInt(Date.now() - started), errorMessage: message, expectations, checks });
          failed ||= `${dataset.name}: ${message}`;
          continue;
        }
        record({ name: dataset.name, state: RunState.COMPLETED, rowsWritten: BigInt(rowCount), durationMs: BigInt(Date.now() - started), expectations, checks });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        record({ name: dataset.name, state: RunState.FAILED, durationMs: BigInt(Date.now() - started), errorMessage: message });
        failed ||= `${dataset.name}: ${message}`;
      }
    }
    const cancelled = cancelling.delete(run.id);
    const ended = publish(failed ? RunState.FAILED : cancelled ? RunState.CANCELLED : RunState.COMPLETED, failed);
    remember(ended);
    options.onFinished?.(ended, definition.sourceId);
  };

  const summary = (definition: PipelineDefinition) => ({
    id: definition.id,
    name: definition.name ?? definition.id,
    description: definition.description ?? "",
    sourceId: definition.sourceId,
    datasetCount: definition.datasets.length,
    latestRun: runs.get(definition.id)?.[0],
  });

  const describe = async (definition: PipelineDefinition) => {
    const { prepared, problems } = await prepare(definition);
    if (!prepared) throw new Error(problems.join(" "));
    const seen = latest.get(definition.id);
    const read = new Set([...prepared.inputs.values()].flat().map(lower));
    return create(PipelineSchema, {
      summary: summary(definition),
      recomputeOnly: true,
      canBuild: true,
      canSave: !!options.saved && !configured.has(definition.id),
      version: versionOf(definition.id),
      datasets: [
        ...prepared.sources.filter((name) => read.has(lower(name))).map((name) => ({ name, kind: DatasetKind.SOURCE })),
        ...prepared.order.map((key) => {
          const dataset = definition.datasets.find((d) => lower(d.name) === key)!;
          const last = seen?.get(key);
          return {
            ...datasetMessage(dataset, prepared.inputs.get(key) ?? []),
            state: last?.state ?? RunState.UNSPECIFIED,
            rowsWritten: last?.state === RunState.COMPLETED ? last.rowsWritten : undefined,
            builtAt: last?.builtAt ?? "",
            lastRunId: last?.runId ?? "",
          };
        }),
      ],
    });
  };

  return {
    async listPipelines() {
      return create(ListPipelinesResponseSchema, { pipelines: [...configured.values(), ...[...saved.values()].map((s) => s.definition)].map(summary) });
    },

    async getPipeline(init) {
      const definition = find(create(GetPipelineRequestSchema, init).id);
      return create(GetPipelineResponseSchema, { pipeline: await describe(definition) });
    },

    async listRuns(init) {
      const request = create(ListRunsRequestSchema, init);
      find(request.pipelineId);
      return create(ListRunsResponseSchema, { runs: (runs.get(request.pipelineId) ?? []).slice(0, request.pageSize || historyLimit) });
    },

    async getRun(init) {
      const request = create(GetRunRequestSchema, init);
      const run = runs.get(request.pipelineId)?.find((r) => r.id === request.runId);
      if (!run) throw new Error(`Run not found: ${request.runId}`);
      return create(GetRunResponseSchema, { run });
    },

    async startRun(init) {
      const request = create(StartRunRequestSchema, init);
      const definition = find(request.pipelineId);
      if (runs.get(definition.id)?.some((r) => r.state === RunState.RUNNING)) throw new Error("This pipeline is already running.");
      const fullRefresh = request.refreshKind === RefreshKind.FULL_REFRESH;
      if (fullRefresh && !request.dryRun && !request.confirmFullRefresh) throw new Error("A full refresh clears the chosen tables first. Confirm it to go ahead.");
      const { prepared, problems } = await prepare(definition);
      const base = create(RunSchema, {
        id: `run-${String(++counter).padStart(4, "0")}`,
        pipelineId: definition.id,
        state: RunState.RUNNING,
        startTime: now().toISOString(),
        trigger: request.trigger || "manual",
        startedBy: request.startedBy,
        refreshKind: request.refreshKind,
        datasets: request.select.length > 0 ? request.select : request.datasets,
        dryRun: request.dryRun,
        version: versionOf(definition.id),
      });
      // `datasets` is the older form: each with what reads it.
      const select = request.select.length > 0 ? request.select : request.datasets.map((name) => `${name}+`);
      const inputs = prepared?.inputs ?? new Map(definition.datasets.map((d) => [lower(d.name), [] as string[]]));
      const { selected, unknown } = select.length === 0 ? { selected: new Set(prepared?.order ?? []), unknown: [] } : selectDatasets(select, inputs);
      const all = [...problems, ...unknown.map((name) => `There is no dataset called ${name}.`)];
      if (!prepared || all.length > 0 || request.dryRun) {
        const done = create(RunSchema, { ...base, state: all.length > 0 ? RunState.FAILED : RunState.COMPLETED, endTime: now().toISOString(), errorMessage: all.join(" ") });
        save(done);
        return create(StartRunResponseSchema, { run: done });
      }
      save(base);
      void execute(prepared, base, selected, fullRefresh).catch((error: unknown) => {
        save(create(RunSchema, { ...base, state: RunState.FAILED, endTime: now().toISOString(), errorMessage: error instanceof Error ? error.message : String(error) }));
      });
      return create(StartRunResponseSchema, { run: base });
    },

    async cancelRun(init) {
      const request = create(CancelRunRequestSchema, init);
      const run = runs.get(request.pipelineId)?.find((r) => r.id === request.runId);
      const running = run?.state === RunState.RUNNING;
      // The dataset being built finishes; the rest are not started.
      if (running) cancelling.add(request.runId);
      return create(CancelRunResponseSchema, { cancelled: running });
    },

    async inspectFiles(init) {
      const request = create(InspectFilesRequestSchema, init);
      const engine = options.engineOf(request.sourceId);
      if (!engine?.inspect) throw new Error(`The source "${request.sourceId}" cannot inspect files.`);
      const found = await engine.inspect(request.format, request.location.trim());
      return create(InspectFilesResponseSchema, found);
    },

    ...(options.saved
      ? {
          async savePipeline(init: MessageInitShape<typeof SavePipelineRequestSchema>) {
            const request = create(SavePipelineRequestSchema, init);
            const draft = create(PipelineDraftSchema, request.pipeline ?? {});
            if (!PIPELINE_ID.test(draft.id)) throw new Error("A pipeline ID uses letters, digits, hyphens and underscores.");
            if (configured.has(draft.id)) throw new Error(`${draft.id} is defined in the server's config, so it cannot be changed by a save.`);
            const current = versionOf(draft.id);
            if (request.expectedVersion !== current) throw new Error(`This pipeline has changed since (it is at version ${current}; the change was made against ${request.expectedVersion}).`);
            if (!request.approvedBy.trim()) throw new Error("Say who approved this pipeline.");
            if (request.approvalDigest !== (await pipelineDigest(draft))) throw new Error("This is not the pipeline that was approved: it changed after it was approved.");
            const definition = definitionFromDraft(draft);
            if (definition.datasets.length === 0) throw new Error("A pipeline needs at least one dataset.");
            const { problems } = await prepare(definition);
            if (problems.length > 0) throw new Error(problems.join(" "));
            const at = now().toISOString();
            const before = saved.get(draft.id);
            const next: SavedPipeline = { definition, version: current + 1, versions: [{ version: current + 1, savedAt: at, approvedBy: request.approvedBy.trim(), note: request.note, definition }, ...(before?.versions ?? [])] };
            await options.saved!.put(next);
            saved.set(draft.id, next);
            return create(SavePipelineResponseSchema, { pipeline: await describe(definition) });
          },
          async listPipelineVersions(init: MessageInitShape<typeof ListPipelineVersionsRequestSchema>) {
            const request = create(ListPipelineVersionsRequestSchema, init);
            find(request.pipelineId);
            const versions: PipelineVersion[] = (saved.get(request.pipelineId)?.versions ?? []).map((v) => create(PipelineVersionSchema, { version: v.version, savedAt: v.savedAt, approvedBy: v.approvedBy, note: v.note }));
            return create(ListPipelineVersionsResponseSchema, { versions });
          },
        }
      : {}),
  };
}

/** Saved pipelines kept in memory: for tests, and a server with nowhere to write. */
export function memoryPipelineStore(initial: SavedPipeline[] = []): PipelineStore {
  const held = new Map(initial.map((s) => [s.definition.id, s]));
  return {
    async list() {
      return [...held.values()];
    },
    async put(saved) {
      held.set(saved.definition.id, saved);
    },
  };
}

/** Runs kept in memory, as a `RunStore`. */
export function memoryRunStore(): RunStore & { runs: Run[] } {
  const runs: Run[] = [];
  return {
    runs,
    async load() {
      return [...runs];
    },
    async save(run) {
      const index = runs.findIndex((r) => r.id === run.id && r.pipelineId === run.pipelineId);
      if (index >= 0) runs[index] = run;
      else runs.unshift(run);
    },
  };
}

export type { Dataset };
