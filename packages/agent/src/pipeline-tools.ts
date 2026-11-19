import { create, toJson } from "@bufbuild/protobuf";
import { type Pipelines, checkName, draftOf, pipelineDigest } from "@surfaces-ui/data";
import { ApprovalRisk, CheckKind, CheckSeverity, DatasetKind, DatasetSchema, type Pipeline, PipelineDraftSchema, PipelineSchema, RefreshKind, type Run, RunState } from "@surfaces-ui/proto";
import type { RunnableTool } from "./tools.js";

export interface PipelineToolsOptions {
  /** Pipelines the model may see and run. Default: every one the backend lists. */
  pipelineIds?: string[];
  /** How long `run_pipeline` waits for a run before handing back its id for `get_run`. Default 60 seconds. */
  waitMs?: number;
}

const STATE: Record<number, string> = {
  [RunState.QUEUED]: "queued",
  [RunState.RUNNING]: "running",
  [RunState.COMPLETED]: "completed",
  [RunState.FAILED]: "failed",
  [RunState.CANCELLED]: "cancelled",
  [RunState.SKIPPED]: "skipped",
};
const KIND: Record<number, string> = { [CheckKind.UNIQUE]: "unique", [CheckKind.NOT_NULL]: "not_null", [CheckKind.RELATIONSHIPS]: "relationships", [CheckKind.ACCEPTED_VALUES]: "accepted_values", [CheckKind.ROW_COUNT]: "row_count" };
const KIND_OF: Record<string, CheckKind> = Object.fromEntries(Object.entries(KIND).map(([kind, name]) => [name, Number(kind) as CheckKind]));

/** A run as a model reads it: states, counts and check results. Never a row value. */
export function runSummary(run: Run) {
  return {
    runId: run.id,
    pipelineId: run.pipelineId,
    state: STATE[run.state] ?? "unknown",
    ...(run.dryRun ? { dryRun: true } : {}),
    ...(run.errorMessage ? { error: run.errorMessage } : {}),
    ...(run.trigger ? { trigger: run.trigger } : {}),
    ...(run.startedBy ? { startedBy: run.startedBy } : {}),
    datasets: run.datasetRuns.map((d) => ({
      name: d.name,
      state: STATE[d.state] ?? "unknown",
      ...(d.state === RunState.COMPLETED || d.rowsWritten > 0n ? { rows: Number(d.rowsWritten) } : {}),
      ...(d.errorMessage ? { error: d.errorMessage } : {}),
      ...(d.expectations.length > 0 ? { rules: d.expectations.map((e) => ({ name: e.name, failed: Number(e.failedRecords) })) } : {}),
      ...(d.checks.length > 0
        ? { checks: d.checks.map((c) => ({ name: c.name, passed: c.failedRecords === 0n, ...(c.severity === CheckSeverity.WARN ? { warnOnly: true } : {}), summary: c.summary, ...(c.failedRecords > 0n && c.failingRowsSql ? { failingRowsSql: c.failingRowsSql } : {}) })) }
        : {}),
    })),
  };
}

/** A pipeline as a model reads it: its datasets' queries, what each reads, grain, key, columns, checks and last state. */
export function pipelineSummary(pipeline: Pipeline) {
  return {
    pipelineId: pipeline.summary?.id,
    name: pipeline.summary?.name,
    ...(pipeline.summary?.description ? { description: pipeline.summary.description } : {}),
    sourceId: pipeline.summary?.sourceId,
    version: pipeline.version,
    canSave: pipeline.canSave,
    canBuild: pipeline.canBuild,
    ...(pipeline.recomputeOnly ? { note: "Every run rebuilds whole datasets." } : {}),
    sources: pipeline.datasets.filter((d) => d.kind === DatasetKind.SOURCE).map((d) => d.name),
    datasets: pipeline.datasets
      .filter((d) => d.kind !== DatasetKind.SOURCE)
      .map((d) => ({
        name: d.name,
        ...(d.kind === DatasetKind.VIEW ? { view: true } : {}),
        ...(d.layer ? { layer: d.layer } : {}),
        ...(d.description ? { description: d.description } : {}),
        sql: d.sql,
        reads: d.inputs,
        ...(d.inputsDeclared ? {} : { readsWorkedOutFromQuery: true }),
        ...(d.grain ? { grain: d.grain } : {}),
        ...(d.primaryKey.length > 0 ? { primaryKey: d.primaryKey } : {}),
        ...(d.columns.length > 0 ? { columns: d.columns.map((c) => ({ name: c.name, ...(c.type ? { type: c.type } : {}), ...(c.description ? { description: c.description } : {}) })) } : {}),
        ...(d.checks.length > 0 ? { checks: d.checks.map((c) => ({ name: c.name, kind: KIND[c.kind], ...(c.implied ? { fromKey: true } : {}), ...(c.severity === CheckSeverity.WARN ? { warnOnly: true } : {}) })) } : {}),
        ...(d.state ? { lastState: STATE[d.state] } : {}),
        ...(d.builtAt ? { builtAt: d.builtAt } : {}),
        ...(d.rowsWritten !== undefined && d.state === RunState.COMPLETED ? { rows: Number(d.rowsWritten) } : {}),
      })),
  };
}

const SELECT = {
  type: "array",
  items: { type: "string" },
  description: "Datasets to build: a name builds it alone, name+ adds everything that reads it, +name everything it reads. Omit for all.",
};

/**
 * Tools that let a model see, check and run a project's pipelines, and
 * propose a dataset for a person to approve:
 *
 * - `list_pipelines`, `describe_pipeline` and `get_run` read definitions and
 *   run results (counts and check results, never row values).
 * - `check_pipeline` is a dry run: it builds nothing.
 * - `run_pipeline` pauses for a person's approval before anything is built;
 *   a full refresh is marked irreversible. What runs is what they approved.
 * - `propose_dataset` stores nothing: it returns the pipeline as it would be
 *   with the dataset, its digest and the version it is based on, for the
 *   model to draw in a `DatasetReview`. Only the person's approval there saves
 *   it, through the host.
 */
export function pipelineTools(pipelines: Pipelines, options: PipelineToolsOptions = {}): RunnableTool[] {
  const waitMs = options.waitMs ?? 60_000;
  const allowed = async (id: unknown): Promise<string> => {
    const ids = options.pipelineIds ?? (await pipelines.listPipelines({})).pipelines.map((p) => p.id);
    if (typeof id !== "string" || !ids.includes(id)) throw new Error(`Unknown pipeline ${JSON.stringify(id)}. Pipelines: ${ids.join(", ") || "none"}.`);
    return id;
  };
  const selection = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()) : []);
  const finish = async (pipelineId: string, run: Run, signal?: AbortSignal): Promise<Run> => {
    const until = Date.now() + waitMs;
    let current = run;
    while (current.state === RunState.RUNNING && Date.now() < until && !signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      current = (await pipelines.getRun({ pipelineId, runId: run.id })).run ?? current;
    }
    return current;
  };
  const idArg = { type: "string", description: "The pipeline's id, from list_pipelines." };

  return [
    {
      name: "list_pipelines",
      description: "The project's pipelines: datasets built from a source's tables by SQL, with checks. Each with its source, dataset count and last run.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const { pipelines: list } = await pipelines.listPipelines({});
        const ids = options.pipelineIds;
        return {
          pipelines: list
            .filter((p) => !ids || ids.includes(p.id))
            .map((p) => ({ pipelineId: p.id, name: p.name, sourceId: p.sourceId, datasets: p.datasetCount, ...(p.latestRun ? { lastRun: { runId: p.latestRun.id, state: STATE[p.latestRun.state] ?? "unknown", at: p.latestRun.endTime || p.latestRun.startTime } } : {}) })),
        };
      },
    },
    {
      name: "describe_pipeline",
      description:
        "One pipeline: each dataset's query, what it reads, what one row is (grain), its key, columns and checks, and how its last build went. Built datasets are tables of the source and can be queried like any other.",
      inputSchema: { type: "object", properties: { pipelineId: idArg }, required: ["pipelineId"], additionalProperties: false },
      run: async (input) => {
        const id = await allowed((input as { pipelineId?: unknown })?.pipelineId);
        const { pipeline } = await pipelines.getPipeline({ id });
        return pipelineSummary(pipeline!);
      },
    },
    {
      name: "check_pipeline",
      description: "Checks a pipeline without building anything: every query is read-only, everything it reads exists, nothing depends on itself, and the checks can be written. Returns the problems found.",
      inputSchema: { type: "object", properties: { pipelineId: idArg, select: SELECT }, required: ["pipelineId"], additionalProperties: false },
      run: async (input) => {
        const args = (input ?? {}) as { pipelineId?: unknown; select?: unknown };
        const pipelineId = await allowed(args.pipelineId);
        const { run } = await pipelines.startRun({ pipelineId, select: selection(args.select), dryRun: true, trigger: "agent" });
        return { pipelineId, ok: run!.state === RunState.COMPLETED, ...(run!.errorMessage ? { problems: run!.errorMessage } : {}) };
      },
    },
    {
      name: "run_pipeline",
      description:
        "Builds a pipeline's datasets, then runs their checks. A person is asked first; it runs only if they allow it. A full refresh clears the tables before building them and cannot be undone. Waits for the run, or returns its id for get_run when it takes long.",
      inputSchema: {
        type: "object",
        properties: { pipelineId: idArg, select: SELECT, fullRefresh: { type: "boolean", description: "Clear the chosen tables before building. Destroys what is there." } },
        required: ["pipelineId"],
        additionalProperties: false,
      },
      approval: async (input) => {
        const args = (input ?? {}) as { pipelineId?: unknown; select?: unknown; fullRefresh?: unknown };
        const pipelineId = await allowed(args.pipelineId);
        const { pipeline } = await pipelines.getPipeline({ id: pipelineId });
        const select = selection(args.select);
        const fullRefresh = args.fullRefresh === true;
        const what = select.length > 0 ? select.join(", ") : "every dataset";
        return {
          title: `${fullRefresh ? "Clear and rebuild" : "Build"} ${what} in ${pipeline?.summary?.name ?? pipelineId}`,
          detail: fullRefresh
            ? "The chosen tables are emptied first, then rebuilt from their sources. What is in them now cannot be got back."
            : `Rebuilds ${what} of version ${pipeline?.version ?? 0} from their sources, then runs the checks. The tables are replaced.`,
          subject: { pipelineId, version: pipeline?.version ?? 0, select, refresh: fullRefresh ? "full" : "rebuild" },
          risk: fullRefresh ? ApprovalRisk.IRREVERSIBLE : ApprovalRisk.HIGH,
          basis: `${pipeline?.summary?.name ?? pipelineId}, version ${pipeline?.version ?? 0}`,
        };
      },
      run: async (_input, signal, approved) => {
        // Only what the person allowed runs; the model's input is not read again.
        if (!approved) throw new Error("Running a pipeline needs a person's approval.");
        const subject = approved.subject as { pipelineId?: unknown; version?: unknown; select?: unknown; refresh?: unknown };
        const pipelineId = await allowed(subject.pipelineId);
        const { pipeline } = await pipelines.getPipeline({ id: pipelineId });
        if ((pipeline?.version ?? 0) !== subject.version) throw new Error(`The pipeline changed after it was approved (version ${pipeline?.version ?? 0} now). Ask again.`);
        const fullRefresh = subject.refresh === "full";
        const by = approved.approvals.map((a) => a.decidedBy?.name).filter(Boolean).join(", ");
        const { run } = await pipelines.startRun({
          pipelineId,
          select: selection(subject.select),
          refreshKind: fullRefresh ? RefreshKind.FULL_REFRESH : RefreshKind.REFRESH,
          confirmFullRefresh: fullRefresh,
          trigger: "agent",
          startedBy: by ? `agent, approved by ${by}` : "agent",
        });
        const done = await finish(pipelineId, run!, signal);
        return { ...runSummary(done), ...(done.state === RunState.RUNNING ? { note: "Still running. Call get_run with this runId to see how it ends." } : {}) };
      },
    },
    {
      name: "get_run",
      description: "How a pipeline run went: each dataset's state and rows, and every check's result. Counts only.",
      inputSchema: { type: "object", properties: { pipelineId: idArg, runId: { type: "string" } }, required: ["pipelineId", "runId"], additionalProperties: false },
      run: async (input) => {
        const args = (input ?? {}) as { pipelineId?: unknown; runId?: unknown };
        const pipelineId = await allowed(args.pipelineId);
        if (typeof args.runId !== "string") throw new Error("Give the runId.");
        return runSummary((await pipelines.getRun({ pipelineId, runId: args.runId })).run!);
      },
    },
    {
      name: "propose_dataset",
      description:
        "Proposes a new or changed dataset in a pipeline, or a new pipeline holding it (give `sourceId` and a new `pipelineId`). Saves nothing: returns the pipeline as it would be, with its approval digest and the version it is based on. Then draw a DatasetReview with `pipeline`, `dataset`, `expectedVersion` and `digest` from this answer; the person reviews, may change it, and only their approval saves it. Give the grain and the key: the key is checked unique and never empty after every build.",
      inputSchema: {
        type: "object",
        properties: {
          pipelineId: { type: "string", description: "The pipeline's id, from list_pipelines, or a new id (letters, digits, hyphens and underscores) to propose a new pipeline." },
          sourceId: { type: "string", description: "For a new pipeline only: the source whose tables it reads and where it builds." },
          pipelineName: { type: "string", description: "For a new pipeline only: its name." },
          name: { type: "string", description: "The dataset's table name: letters, digits and underscores. An existing name changes that dataset." },
          sql: { type: "string", description: "One read-only SELECT over the source's tables and the pipeline's other datasets." },
          description: { type: "string" },
          layer: { type: "string", enum: ["bronze", "silver", "gold"] },
          view: { type: "boolean", description: "Build it as a view rather than a table." },
          depends: { type: "array", items: { type: "string" }, description: "The datasets and tables it reads." },
          grain: { type: "string", description: "What one row is, in a sentence: 'one row per order line'." },
          primaryKey: { type: "array", items: { type: "string" } },
          columns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" } }, required: ["name"], additionalProperties: false } },
          checks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: Object.values(KIND) },
                columns: { type: "array", items: { type: "string" } },
                toTable: { type: "string" },
                toColumn: { type: "string" },
                values: { type: "array", items: { type: "string" } },
                min: { type: "number" },
                max: { type: "number" },
                warnOnly: { type: "boolean" },
              },
              required: ["kind"],
              additionalProperties: false,
            },
          },
        },
        required: ["pipelineId", "name", "sql", "grain"],
        additionalProperties: false,
      },
      run: async (input) => {
        const args = (input ?? {}) as Record<string, unknown>;
        const known = (await pipelines.listPipelines({})).pipelines.some((p) => p.id === args.pipelineId);
        const creating = !known && typeof args.sourceId === "string" && args.sourceId !== "";
        if (creating) {
          if (options.pipelineIds) throw new Error("New pipelines cannot be proposed here.");
          if (typeof args.pipelineId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(args.pipelineId)) throw new Error("A new pipeline's id uses letters, digits, hyphens and underscores.");
          if (!pipelines.savePipeline) throw new Error("This backend keeps no saved pipelines, so a new one cannot be proposed.");
        }
        const pipelineId = creating ? (args.pipelineId as string) : await allowed(args.pipelineId);
        const name = typeof args.name === "string" ? args.name.trim() : "";
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("A dataset name uses letters, digits and underscores, and does not start with a digit.");
        if (typeof args.sql !== "string" || !args.sql.trim()) throw new Error("Give the dataset's query.");
        const { pipeline } = creating
          ? { pipeline: create(PipelineSchema, { summary: { id: pipelineId, name: typeof args.pipelineName === "string" && args.pipelineName ? args.pipelineName : pipelineId, sourceId: args.sourceId as string }, canSave: true, version: 0 }) }
          : await pipelines.getPipeline({ id: pipelineId });
        if (!pipeline?.canSave) throw new Error("This pipeline cannot be changed here: it is defined in the server's config, or the server does not keep saved pipelines. Propose a new pipeline instead, with sourceId.");
        const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
        const dataset = create(DatasetSchema, {
          name,
          kind: args.view === true ? DatasetKind.VIEW : DatasetKind.TABLE,
          layer: typeof args.layer === "string" ? args.layer : "",
          description: typeof args.description === "string" ? args.description : "",
          sql: args.sql.trim(),
          inputs: strings(args.depends),
          inputsDeclared: strings(args.depends).length > 0,
          grain: typeof args.grain === "string" ? args.grain : "",
          primaryKey: strings(args.primaryKey),
          columns: (Array.isArray(args.columns) ? args.columns : []).map((c) => ({ name: String(c?.name ?? ""), type: String(c?.type ?? ""), description: String(c?.description ?? "") })),
          checks: (Array.isArray(args.checks) ? args.checks : []).map((c: Record<string, unknown>) => {
            const kind = KIND_OF[String(c.kind)] ?? CheckKind.UNSPECIFIED;
            const columns = strings(c.columns);
            return {
              name: checkName({ kind, columns }),
              kind,
              columns,
              toTable: typeof c.toTable === "string" ? c.toTable : "",
              toColumn: typeof c.toColumn === "string" ? c.toColumn : "",
              values: strings(c.values),
              ...(typeof c.min === "number" ? { minRows: BigInt(Math.max(0, Math.round(c.min))) } : {}),
              ...(typeof c.max === "number" ? { maxRows: BigInt(Math.max(0, Math.round(c.max))) } : {}),
              severity: c.warnOnly === true ? CheckSeverity.WARN : CheckSeverity.FAIL,
            };
          }),
        });
        const current = draftOf(pipeline);
        const changed = current.datasets.some((d) => d.name.toLowerCase() === name.toLowerCase());
        const draft = create(PipelineDraftSchema, {
          ...current,
          datasets: changed ? current.datasets.map((d) => (d.name.toLowerCase() === name.toLowerCase() ? dataset : d)) : [...current.datasets, dataset],
        });
        return {
          pipelineId,
          change: creating ? "a new pipeline" : changed ? "changes an existing dataset" : "adds a dataset",
          expectedVersion: pipeline.version,
          digest: await pipelineDigest(draft),
          dataset: name,
          pipeline: toJson(PipelineDraftSchema, draft),
          next: "Draw a DatasetReview with these values. Nothing is saved until the person approves it there.",
        };
      },
    },
  ];
}
