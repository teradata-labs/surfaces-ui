import { type DescMessage, type MessageInitShape, create, fromJson, toJson } from "@bufbuild/protobuf";
import type { DataSource, Pipelines } from "@surfaces-ui/data";
import {
  CancelRunRequestSchema,
  CancelRunResponseSchema,
  GetPipelineRequestSchema,
  GetPipelineResponseSchema,
  GetRunRequestSchema,
  GetRunResponseSchema,
  ListPipelineVersionsRequestSchema,
  ListPipelineVersionsResponseSchema,
  ListPipelinesRequestSchema,
  ListPipelinesResponseSchema,
  ListRunsRequestSchema,
  ListRunsResponseSchema,
  SavePipelineRequestSchema,
  SavePipelineResponseSchema,
  StartRunRequestSchema,
  StartRunResponseSchema,
  CancelRequestSchema,
  CancelResponseSchema,
  CountRequestSchema,
  CountResponseSchema,
  DescribeTableRequestSchema,
  DescribeTableResponseSchema,
  ExecuteRequestSchema,
  ExecuteResponseSchema,
  ExplainRequestSchema,
  ExplainResponseSchema,
  ListCatalogsRequestSchema,
  ListCatalogsResponseSchema,
  ListSchemasRequestSchema,
  ListSchemasResponseSchema,
  ListSnapshotsRequestSchema,
  ListSnapshotsResponseSchema,
  ListSourcesRequestSchema,
  ListFilesRequestSchema,
  ListFilesResponseSchema,
  TestSourceRequestSchema,
  TestSourceResponseSchema,
  ListSourcesResponseSchema,
  ListTablesRequestSchema,
  ListTablesResponseSchema,
} from "@surfaces-ui/proto";

/** URI of the single app page every Surfaces tool renders into. */
export const APP_RESOURCE_URI = "ui://surfaces/app.html";

/** The tool the app page uses to reach data. Hidden from the model. */
export const RPC_TOOL = "surfaces_rpc";

/**
 * The tool the app page uses to reach pipelines. Hidden from the model, and
 * kept apart from the data channel because it can change things: a save the
 * person approved in the page, and a run the person started there.
 */
export const PIPELINE_RPC_TOOL = "surfaces_pipeline_rpc";

/** What a UI tool tells the app to show. Travels as the tool result's structured content. */
export type AppView =
  | { view: "grid"; sourceId: string; sql: string; title?: string }
  | {
      view: "chart";
      sourceId: string;
      sql: string;
      title?: string;
      type: string;
      x: string;
      y: unknown[];
      splitBy?: string;
      xGrain?: string;
      xBins?: number;
      stacked?: boolean;
      legend?: string;
    }
  | { view: "pivot"; sourceId: string; sql: string; title?: string; rows: unknown[]; columns?: unknown[]; measures: unknown[] }
  | { view: "result"; sourceId: string; sql: string; title?: string }
  | { view: "editor"; sourceId: string; sql: string }
  | { view: "schema"; sourceId: string }
  | { view: "surface"; messages: unknown[] }
  /** Both draw their own heading, so they carry no title. */
  | { view: "pipeline"; pipelineId: string; sourceId: string }
  | {
      view: "datasetReview";
      /** The proposed pipeline, as PipelineDraft protobuf JSON, filled in by the server. */
      pipeline: unknown;
      dataset: string;
      expectedVersion: number;
      digest: string;
      sourceId: string;
      proposedBy?: string;
    };

export type RpcMethod = Exclude<keyof DataSource, never>;

/** Request and response message types for each DataSource method, used to carry them as JSON. */
export const RPC: Record<RpcMethod, { request: DescMessage; response: DescMessage; stream?: boolean }> = {
  execute: { request: ExecuteRequestSchema, response: ExecuteResponseSchema, stream: true },
  count: { request: CountRequestSchema, response: CountResponseSchema },
  explain: { request: ExplainRequestSchema, response: ExplainResponseSchema },
  cancel: { request: CancelRequestSchema, response: CancelResponseSchema },
  listSources: { request: ListSourcesRequestSchema, response: ListSourcesResponseSchema },
  testSource: { request: TestSourceRequestSchema, response: TestSourceResponseSchema },
  listFiles: { request: ListFilesRequestSchema, response: ListFilesResponseSchema },
  listCatalogs: { request: ListCatalogsRequestSchema, response: ListCatalogsResponseSchema },
  listSchemas: { request: ListSchemasRequestSchema, response: ListSchemasResponseSchema },
  listTables: { request: ListTablesRequestSchema, response: ListTablesResponseSchema },
  describeTable: { request: DescribeTableRequestSchema, response: DescribeTableResponseSchema },
  listSnapshots: { request: ListSnapshotsRequestSchema, response: ListSnapshotsResponseSchema },
};

export const isRpcMethod = (method: string): method is RpcMethod => Object.hasOwn(RPC, method);

type Json = Parameters<typeof fromJson>[1];

/** Calls a tool and returns its structured content, or throws its error text. */
export type CallTool = (name: string, args: Record<string, unknown>) => Promise<{ structuredContent?: unknown; content?: unknown; isError?: boolean }>;

/**
 * A DataSource whose calls travel as MCP tool calls. An MCP App page uses it
 * to reach the server that showed it: rows still come back as Arrow, and the
 * page still asks only for the window it is showing.
 */
export function mcpDataSource(callTool: CallTool): DataSource {
  const call = async (method: RpcMethod, init: unknown): Promise<Json[]> => {
    const shape = RPC[method];
    const request = toJson(shape.request, create(shape.request, init as MessageInitShape<DescMessage>));
    const result = await callTool(RPC_TOOL, { method, request });
    if (result.isError) {
      const first = Array.isArray(result.content) ? (result.content[0] as { text?: string } | undefined)?.text : undefined;
      throw new Error(first ?? "The request failed.");
    }
    return ((result.structuredContent as { messages?: Json[] } | undefined)?.messages ?? []) as Json[];
  };
  const unary = (method: RpcMethod) => async (init: unknown) => {
    const [message] = await call(method, init);
    return fromJson(RPC[method].response, message ?? {});
  };
  return {
    async *execute(init: unknown) {
      for (const message of await call("execute", init)) yield fromJson(ExecuteResponseSchema, message);
    },
    count: unary("count"),
    explain: unary("explain"),
    cancel: unary("cancel"),
    listSources: unary("listSources"),
    testSource: unary("testSource"),
    listFiles: unary("listFiles"),
    listCatalogs: unary("listCatalogs"),
    listSchemas: unary("listSchemas"),
    listTables: unary("listTables"),
    describeTable: unary("describeTable"),
    listSnapshots: unary("listSnapshots"),
  } as unknown as DataSource;
}

export type PipelineRpcMethod = Exclude<keyof Pipelines, "inspectFiles">;

/** Request and response message types for the pipeline calls the app page may make. */
export const PIPELINE_RPC: Record<PipelineRpcMethod, { request: DescMessage; response: DescMessage }> = {
  listPipelines: { request: ListPipelinesRequestSchema, response: ListPipelinesResponseSchema },
  getPipeline: { request: GetPipelineRequestSchema, response: GetPipelineResponseSchema },
  listRuns: { request: ListRunsRequestSchema, response: ListRunsResponseSchema },
  getRun: { request: GetRunRequestSchema, response: GetRunResponseSchema },
  startRun: { request: StartRunRequestSchema, response: StartRunResponseSchema },
  cancelRun: { request: CancelRunRequestSchema, response: CancelRunResponseSchema },
  savePipeline: { request: SavePipelineRequestSchema, response: SavePipelineResponseSchema },
  listPipelineVersions: { request: ListPipelineVersionsRequestSchema, response: ListPipelineVersionsResponseSchema },
};

export const isPipelineRpcMethod = (method: string): method is PipelineRpcMethod => Object.hasOwn(PIPELINE_RPC, method);

/**
 * A Pipelines backend whose calls travel as MCP tool calls, for the app page.
 * The server decides what each call may do: it refuses a full refresh, and a
 * save still needs the approver, the digest and the version it was made against.
 */
export function mcpPipelines(callTool: CallTool): Pipelines {
  const unary = (method: PipelineRpcMethod) => async (init: unknown) => {
    const shape = PIPELINE_RPC[method];
    const request = toJson(shape.request, create(shape.request, init as MessageInitShape<DescMessage>));
    const result = await callTool(PIPELINE_RPC_TOOL, { method, request });
    if (result.isError) {
      const first = Array.isArray(result.content) ? (result.content[0] as { text?: string } | undefined)?.text : undefined;
      throw new Error(first ?? "The request failed.");
    }
    return fromJson(shape.response, ((result.structuredContent as { message?: Json } | undefined)?.message ?? {}) as Json);
  };
  return {
    ...(Object.fromEntries(Object.keys(PIPELINE_RPC).map((method) => [method, unary(method as PipelineRpcMethod)])) as unknown as Omit<Pipelines, "inspectFiles">),
    inspectFiles: async () => {
      throw new Error("Inspecting files is not offered in this app.");
    },
  };
}
