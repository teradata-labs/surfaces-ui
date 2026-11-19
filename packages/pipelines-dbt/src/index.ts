import { create } from "@bufbuild/protobuf";
import type { Pipelines } from "@surfaces-ui/data";
import {
  CancelRunResponseSchema,
  GetPipelineResponseSchema,
  GetRunResponseSchema,
  ListPipelinesResponseSchema,
  ListRunsResponseSchema,
  type Pipeline,
  RefreshKind,
  type Run,
  RunSchema,
  RunState,
  StartRunResponseSchema,
} from "@surfaces-ui/proto";
import { type ArtifactReader, type DbtArtifacts, readArtifacts } from "./artifacts.js";
import { type DbtPipelineOptions, dbtSelection, pipelineFromArtifacts, runFromResults } from "./pipeline.js";

export * from "./artifacts.js";
export * from "./pipeline.js";
export * from "./semantic.js";

/**
 * Runs dbt with these arguments (never through a shell) and resolves when it
 * exits. `@surfaces-ui/pipelines-dbt/node` has `dbtCommand`, which runs the
 * dbt CLI in a project directory.
 */
export type DbtInvoke = (args: string[], options: { signal: AbortSignal }) => Promise<{ exitCode: number }>;

export interface DbtPipelinesOptions extends Omit<DbtPipelineOptions, "canBuild"> {
  /** Where the artifacts are read from: `targetDir(dir)` from `@surfaces-ui/pipelines-dbt/node` for a project's target directory. */
  read: ArtifactReader;
  /**
   * Lets a run start `dbt build` (or `dbt compile` for a check), only when a
   * person asks: a run they press in the UI, or an agent's run_pipeline that
   * a person approved. Left out, the project is read only and runs made by
   * dbt itself are reported.
   */
  invoke?: DbtInvoke;
  /** Called when a run started here ends, to drop kept results and rebuild the search index. */
  onFinished?(run: Run): void;
  /** Runs kept per project, newest first. Defaults to 50. */
  maxRuns?: number;
  now?(): Date;
}

/**
 * A dbt project as a `Pipelines` backend, read from dbt's artifacts:
 * manifest.json (datasets, what each reads, tests as checks, compiled SQL as
 * a read-only preview), run_results.json and sources.json (runs, test
 * results and source freshness), catalog.json (column types) and, for
 * semantic models, semantic_manifest.json (`semanticModelsFromDbt`).
 *
 * dbt stays the only thing that builds: this never runs a model's SQL and
 * never rebuilds a model from its compiled text. With `invoke`, a run asks
 * dbt itself to build, selecting by the project's own model names (checked
 * against the manifest) and asking for a full refresh only when it is
 * confirmed. Nothing can be saved: a dbt project changes in its repository.
 */
export function dbtPipelines(options: DbtPipelinesOptions): Pipelines & { artifacts(): Promise<DbtArtifacts> } {
  const now = options.now ?? (() => new Date());
  const maxRuns = options.maxRuns ?? 50;
  const runs = new Map<string, Run>();
  const active = new Map<string, AbortController>();
  // dbt invocations that a run started here already stands for, under its own id.
  const claimed = new Set<string>();
  let counter = 0;

  const remember = (run: Run) => {
    runs.set(run.id, run);
    const sorted = [...runs.values()].sort((a, b) => b.startTime.localeCompare(a.startTime));
    for (const old of sorted.slice(maxRuns)) runs.delete(old.id);
  };
  const id = async () => options.id ?? (await load()).artifacts.manifest.metadata?.project_name ?? "dbt";
  /** Reads the artifacts and takes in any run dbt made since the last reading. */
  const load = async () => {
    const artifacts = await readArtifacts(options.read);
    const pipelineId = options.id ?? artifacts.manifest.metadata?.project_name ?? "dbt";
    for (const results of [artifacts.runResults, artifacts.sources]) {
      if (!results?.results?.length) continue;
      const run = runFromResults(artifacts, results, pipelineId);
      // While a run started here is going, what dbt writes is that run's, and is taken in when it ends.
      if (results === artifacts.runResults && active.size > 0) continue;
      if (!runs.has(run.id) && !claimed.has(run.id)) remember(run);
    }
    return { artifacts, pipelineId };
  };
  const pipeline = async (): Promise<Pipeline> => {
    const { artifacts } = await load();
    return pipelineFromArtifacts(artifacts, { ...options, canBuild: !!options.invoke }, [...runs.values()]);
  };
  const own = async (pipelineId: string | undefined) => {
    const mine = await id();
    if (pipelineId && pipelineId !== mine) throw new Error(`No pipeline "${pipelineId}".`);
    return mine;
  };

  return {
    artifacts: async () => (await load()).artifacts,
    async listPipelines() {
      const p = await pipeline();
      return create(ListPipelinesResponseSchema, { pipelines: p.summary ? [p.summary] : [] });
    },
    async getPipeline(request) {
      await own(request.id);
      return create(GetPipelineResponseSchema, { pipeline: await pipeline() });
    },
    async listRuns(request) {
      await own(request.pipelineId);
      await load();
      const sorted = [...runs.values()].sort((a, b) => b.startTime.localeCompare(a.startTime));
      return create(ListRunsResponseSchema, { runs: sorted.slice(0, request.pageSize || 20) });
    },
    async getRun(request) {
      await own(request.pipelineId);
      await load();
      const run = runs.get(request.runId ?? "");
      if (!run) throw new Error(`No run "${request.runId}".`);
      return create(GetRunResponseSchema, { run });
    },
    async startRun(request) {
      const pipelineId = await own(request.pipelineId);
      if (!options.invoke) throw new Error("This dbt project is built by dbt itself; its runs are reported here.");
      const full = request.refreshKind === RefreshKind.FULL_REFRESH;
      if (full && !request.dryRun && !request.confirmFullRefresh) throw new Error("A full refresh rebuilds incremental models from nothing. Confirm it to go ahead.");
      const current = await pipeline();
      const select = dbtSelection(current, request.select?.length ? request.select : (request.datasets ?? []).map((d) => `${d}+`));
      const args = [request.dryRun ? "compile" : "build", ...(select.length ? ["--select", ...select] : []), ...(full && !request.dryRun ? ["--full-refresh"] : [])];
      const run = create(RunSchema, {
        id: `run-${String(++counter).padStart(4, "0")}`,
        pipelineId,
        state: RunState.RUNNING,
        startTime: now().toISOString(),
        trigger: request.trigger || "manual",
        startedBy: request.startedBy ?? "",
        refreshKind: full ? RefreshKind.FULL_REFRESH : RefreshKind.REFRESH,
        datasets: select,
        dryRun: !!request.dryRun,
      });
      const seen = (await readArtifacts(options.read)).runResults?.metadata?.invocation_id;
      remember(run);
      const controller = new AbortController();
      active.set(run.id, controller);
      void (async () => {
        let exitCode = -1;
        try {
          exitCode = (await options.invoke!(args, { signal: controller.signal })).exitCode;
        } catch {
          exitCode = -1;
        }
        let finished: Run;
        try {
          const artifacts = await readArtifacts(options.read);
          const reported = artifacts.runResults ? runFromResults(artifacts, artifacts.runResults, pipelineId) : undefined;
          const fresh = reported && artifacts.runResults?.metadata?.invocation_id !== seen ? reported : undefined;
          if (fresh) claimed.add(fresh.id);
          finished = create(RunSchema, {
            ...run,
            state: controller.signal.aborted ? RunState.CANCELLED : fresh ? (exitCode === 0 ? fresh.state : RunState.FAILED) : exitCode === 0 ? RunState.COMPLETED : RunState.FAILED,
            endTime: now().toISOString(),
            datasetRuns: request.dryRun ? [] : (fresh?.datasetRuns ?? []),
            ...(exitCode !== 0 && !controller.signal.aborted ? { errorMessage: `dbt ${args[0]} exited with code ${exitCode}. Its log is in the project's logs/dbt.log.` } : {}),
          });
        } catch (error) {
          finished = create(RunSchema, { ...run, state: RunState.FAILED, endTime: now().toISOString(), errorMessage: error instanceof Error ? error.message : String(error) });
        }
        active.delete(run.id);
        remember(finished);
        options.onFinished?.(finished);
      })();
      return create(StartRunResponseSchema, { run });
    },
    async cancelRun(request) {
      await own(request.pipelineId);
      active.get(request.runId ?? "")?.abort();
      return create(CancelRunResponseSchema, {});
    },
    async inspectFiles() {
      throw new Error("A dbt project reads its sources through dbt; there are no files to inspect here.");
    },
  };
}
