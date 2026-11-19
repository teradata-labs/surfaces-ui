import { type DescMessage, type MessageInitShape, create, toJson } from "@bufbuild/protobuf";
import {
  type CancelRunRequestSchema,
  type CancelRunResponse,
  CancelRunResponseSchema,
  CheckKind,
  type GetPipelineRequestSchema,
  type GetPipelineResponse,
  GetPipelineResponseSchema,
  type GetRunRequestSchema,
  type GetRunResponse,
  GetRunResponseSchema,
  type InspectFilesRequestSchema,
  type InspectFilesResponse,
  type ListPipelineVersionsRequestSchema,
  type ListPipelineVersionsResponse,
  ListPipelineVersionsResponseSchema,
  type ListPipelinesRequestSchema,
  type ListPipelinesResponse,
  ListPipelinesResponseSchema,
  type ListRunsRequestSchema,
  type ListRunsResponse,
  ListRunsResponseSchema,
  type Pipeline,
  type PipelineDraft,
  PipelineDraftSchema,
  PipelineSchema,
  PipelineSummarySchema,
  type PipelineVersion,
  PipelineVersionSchema,
  type Run,
  RunSchema,
  RunState,
  type SavePipelineRequestSchema,
  type SavePipelineResponse,
  SavePipelineResponseSchema,
  type StartRunRequestSchema,
  type StartRunResponse,
  StartRunResponseSchema,
} from "@surfaces-ui/proto";
import type { CallOptions } from "./datasource.js";
import { contentDigest } from "./digest.js";

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Everything the pipeline and ingest components, and an agent's pipeline
 * tools, need from a backend. It is separate from DataSource because it
 * changes data: a run rebuilds tables. A run request names a pipeline and
 * datasets, never SQL. Where the backend allows it, `savePipeline` stores a
 * definition a person approved; the backend checks it before keeping it.
 */
export interface Pipelines {
  listPipelines: Unary<typeof ListPipelinesRequestSchema, ListPipelinesResponse>;
  getPipeline: Unary<typeof GetPipelineRequestSchema, GetPipelineResponse>;
  /** Newest first. */
  listRuns: Unary<typeof ListRunsRequestSchema, ListRunsResponse>;
  getRun: Unary<typeof GetRunRequestSchema, GetRunResponse>;
  /** Returns as soon as the run has begun; poll `getRun` for progress. */
  startRun: Unary<typeof StartRunRequestSchema, StartRunResponse>;
  cancelRun: Unary<typeof CancelRunRequestSchema, CancelRunResponse>;
  /** Reads the schema of files at a location, without loading them. */
  inspectFiles: Unary<typeof InspectFilesRequestSchema, InspectFilesResponse>;
  /** Stores a version a person approved. Left out by a backend whose pipelines are fixed. */
  savePipeline?: Unary<typeof SavePipelineRequestSchema, SavePipelineResponse>;
  listPipelineVersions?: Unary<typeof ListPipelineVersionsRequestSchema, ListPipelineVersionsResponse>;
}

/**
 * "sha256:<hex>" of a pipeline draft as a person approved it: the canonical
 * JSON of the draft in its protobuf JSON form, so the same definition gives
 * the same digest in a browser, an agent and the server.
 */
export function pipelineDigest(draft: MessageInitShape<typeof PipelineDraftSchema> | PipelineDraft): Promise<string> {
  return contentDigest(toJson(PipelineDraftSchema, create(PipelineDraftSchema, draft as MessageInitShape<typeof PipelineDraftSchema>)));
}

/** A pipeline's definition as a draft, to change and save: what `getPipeline` returned, without run state or the source tables it reads. */
export function draftOf(pipeline: Pipeline): PipelineDraft {
  const summary = pipeline.summary;
  return create(PipelineDraftSchema, {
    id: summary?.id ?? "",
    name: summary?.name ?? "",
    description: summary?.description ?? "",
    sourceId: summary?.sourceId ?? "",
    datasets: pipeline.datasets
      .filter((d) => d.sql)
      .map((d) => ({
        name: d.name,
        kind: d.kind,
        layer: d.layer,
        description: d.description,
        sql: d.sql,
        inputs: d.inputsDeclared ? d.inputs : [],
        inputsDeclared: d.inputsDeclared,
        expectations: d.expectations,
        grain: d.grain,
        primaryKey: d.primaryKey,
        columns: d.columns,
        checks: d.checks.filter((c) => !c.implied),
        tags: d.tags,
        owner: d.owner,
      })),
  });
}

/** The name a check is shown by when it has none of its own: its kind and columns, e.g. unique_order_id. */
export function checkName(check: { name?: string; kind?: CheckKind; columns?: string[] }): string {
  if (check.name) return check.name;
  const kind = { [CheckKind.UNIQUE]: "unique", [CheckKind.NOT_NULL]: "not_null", [CheckKind.RELATIONSHIPS]: "relationships", [CheckKind.ACCEPTED_VALUES]: "accepted_values", [CheckKind.ROW_COUNT]: "row_count", [CheckKind.UNSPECIFIED]: "check" }[check.kind ?? CheckKind.UNSPECIFIED];
  return [kind, ...(check.columns ?? [])].join("_");
}

export interface MemoryPipelinesOptions {
  /** Saving is allowed. Default true. */
  editable?: boolean;
  now?: () => Date;
}

/**
 * Pipelines kept in memory, for tests and demos with no server. It holds
 * the pipelines it is given and anything saved, and a run completes at once
 * with every chosen dataset marked built: nothing is queried, so row counts
 * and check results stay empty. Saving checks the version and the approval
 * digest as a server does, but not the queries.
 */
export function memoryPipelines(pipelines: (MessageInitShape<typeof PipelineSchema> | Pipeline)[], options: MemoryPipelinesOptions = {}): Pipelines & Required<Pick<Pipelines, "savePipeline" | "listPipelineVersions">> {
  const now = options.now ?? (() => new Date());
  const editable = options.editable ?? true;
  const held = new Map<string, Pipeline>();
  const versions = new Map<string, PipelineVersion[]>();
  const runs = new Map<string, Run[]>();
  let counter = 0;
  for (const init of pipelines) {
    const pipeline = create(PipelineSchema, init as MessageInitShape<typeof PipelineSchema>);
    held.set(pipeline.summary?.id ?? "", create(PipelineSchema, { ...pipeline, canSave: editable, canBuild: true }));
  }
  const find = (id: string) => {
    const pipeline = held.get(id);
    if (!pipeline) throw new Error(`Pipeline not found: ${id}`);
    return pipeline;
  };
  const withLatest = (pipeline: Pipeline): Pipeline => {
    const latestRun = runs.get(pipeline.summary?.id ?? "")?.[0];
    const summary = create(PipelineSummarySchema, { id: pipeline.summary?.id ?? "", name: pipeline.summary?.name ?? "", description: pipeline.summary?.description ?? "", sourceId: pipeline.summary?.sourceId ?? "", datasetCount: pipeline.datasets.filter((d) => d.sql).length, ...(latestRun ? { latestRun } : {}) });
    return create(PipelineSchema, { ...pipeline, summary });
  };

  return {
    async listPipelines() {
      return create(ListPipelinesResponseSchema, { pipelines: [...held.values()].map((p) => withLatest(p).summary!) });
    },
    async getPipeline(request) {
      return create(GetPipelineResponseSchema, { pipeline: withLatest(find(request.id ?? "")) });
    },
    async listRuns(request) {
      find(request.pipelineId ?? "");
      return create(ListRunsResponseSchema, { runs: (runs.get(request.pipelineId ?? "") ?? []).slice(0, request.pageSize || undefined) });
    },
    async getRun(request) {
      const run = runs.get(request.pipelineId ?? "")?.find((r) => r.id === request.runId);
      if (!run) throw new Error(`Run not found: ${request.runId}`);
      return create(GetRunResponseSchema, { run });
    },
    async startRun(request) {
      const pipeline = find(request.pipelineId ?? "");
      const names = pipeline.datasets.filter((d) => d.sql).map((d) => d.name);
      const chosen = (request.select?.length ? request.select.map((s) => s.replace(/\+/g, "")) : request.datasets?.length ? request.datasets : names).filter((n) => names.includes(n));
      const at = now().toISOString();
      const run = create(RunSchema, {
        id: `run-${String(++counter).padStart(4, "0")}`,
        pipelineId: pipeline.summary?.id ?? "",
        state: RunState.COMPLETED,
        startTime: at,
        endTime: at,
        trigger: request.trigger || "manual",
        startedBy: request.startedBy ?? "",
        refreshKind: request.refreshKind,
        datasets: request.datasets ?? [],
        dryRun: request.dryRun ?? false,
        version: pipeline.version,
        datasetRuns: request.dryRun ? [] : chosen.map((name) => ({ name, state: RunState.COMPLETED })),
      });
      runs.set(run.pipelineId, [run, ...(runs.get(run.pipelineId) ?? [])]);
      return create(StartRunResponseSchema, { run });
    },
    async cancelRun() {
      return create(CancelRunResponseSchema, { cancelled: false });
    },
    async inspectFiles() {
      throw new Error("Files cannot be inspected without a backend.");
    },
    async savePipeline(request) {
      if (!editable) throw new Error("These pipelines cannot be changed here.");
      const draft = create(PipelineDraftSchema, request.pipeline as MessageInitShape<typeof PipelineDraftSchema>);
      if (!draft.id) throw new Error("A pipeline needs an ID.");
      const current = held.get(draft.id);
      const version = current?.version ?? 0;
      if ((request.expectedVersion ?? 0) !== version) throw new Error(`This pipeline has changed since (version ${version} now, the change was made against ${request.expectedVersion ?? 0}).`);
      if (!request.approvedBy) throw new Error("Say who approved it.");
      if (request.approvalDigest !== (await pipelineDigest(draft))) throw new Error("The pipeline is not the one that was approved: it changed after approval.");
      const saved = create(PipelineSchema, {
        summary: { id: draft.id, name: draft.name || draft.id, description: draft.description, sourceId: draft.sourceId },
        datasets: draft.datasets,
        recomputeOnly: true,
        canBuild: true,
        canSave: true,
        version: version + 1,
      });
      held.set(draft.id, saved);
      versions.set(draft.id, [create(PipelineVersionSchema, { version: version + 1, savedAt: now().toISOString(), approvedBy: request.approvedBy, note: request.note ?? "" }), ...(versions.get(draft.id) ?? [])]);
      return create(SavePipelineResponseSchema, { pipeline: withLatest(saved) });
    },
    async listPipelineVersions(request) {
      return create(ListPipelineVersionsResponseSchema, { versions: versions.get(request.pipelineId ?? "") ?? [] });
    },
  };
}

/**
 * Several pipeline backends as one: the reference runner's pipelines beside
 * a dbt project's, say. Each call goes to the backend that lists the
 * pipeline it names; a pipeline id two backends share is served by the
 * first. A new pipeline is saved by the first backend that saves.
 */
export function combinePipelines(backends: Pipelines[]): Pipelines {
  if (backends.length === 1) return backends[0]!;
  const owner = async (id: string | undefined, options?: CallOptions) => {
    for (const backend of backends) {
      const listed = await backend.listPipelines({}, options);
      if (listed.pipelines.some((p) => p.id === id)) return backend;
    }
    throw new Error(`No pipeline "${id}".`);
  };
  const saver = backends.find((b) => b.savePipeline);
  return {
    async listPipelines(request, options) {
      const seen = new Set<string>();
      const all = (await Promise.all(backends.map((b) => b.listPipelines(request, options)))).flatMap((r) => r.pipelines).filter((p) => !seen.has(p.id) && (seen.add(p.id), true));
      return create(ListPipelinesResponseSchema, { pipelines: all });
    },
    getPipeline: async (request, options) => (await owner(request.id, options)).getPipeline(request, options),
    listRuns: async (request, options) => (await owner(request.pipelineId, options)).listRuns(request, options),
    getRun: async (request, options) => (await owner(request.pipelineId, options)).getRun(request, options),
    startRun: async (request, options) => (await owner(request.pipelineId, options)).startRun(request, options),
    cancelRun: async (request, options) => (await owner(request.pipelineId, options)).cancelRun(request, options),
    inspectFiles: (request, options) => backends[0]!.inspectFiles(request, options),
    ...(saver
      ? {
          async savePipeline(request, options) {
            const target = await owner(request.pipeline?.id, options).catch(() => saver);
            if (!target.savePipeline) throw new Error(`The pipeline "${request.pipeline?.id}" cannot be saved here.`);
            return target.savePipeline(request, options);
          },
          async listPipelineVersions(request, options) {
            const target = await owner(request.pipelineId, options);
            if (!target.listPipelineVersions) return create(ListPipelineVersionsResponseSchema, { versions: [] });
            return target.listPipelineVersions(request, options);
          },
        }
      : {}),
  };
}
