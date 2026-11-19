import { Code, ConnectError, type Transport, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { type DataSource, type Discovery, type Forms, ModelChoiceError, type ModelSettings, type Pipelines, QueryError, SemanticModelError, type Semantics, StaleSemanticModelError, StaleSurfaceError, type SurfaceLibrary } from "@surfaces-ui/data";
import { AgentService, FormService, IngestService, ModelService, PipelineService, SemanticService, ViewService } from "@surfaces-ui/proto";
import { CatalogService, ContextService, DiscoveryService, QueryErrorDetailSchema, QueryService, SourceService } from "@surfaces-ui/proto";

/** Turns a failed call into a QueryError carrying the code and position the server sent. */
function queryError(error: unknown): unknown {
  if (!(error instanceof ConnectError)) return error;
  const detail = error.findDetails(QueryErrorDetailSchema)[0];
  return new QueryError(error.rawMessage, { code: detail?.code, line: detail?.line, column: detail?.column, engineCode: detail?.engineCode });
}

async function* located<T>(stream: AsyncIterable<T>): AsyncGenerator<T> {
  try {
    yield* stream;
  } catch (error) {
    throw queryError(error);
  }
}

const locatedCall = <T>(call: Promise<T>): Promise<T> =>
  call.catch((error: unknown) => {
    throw queryError(error);
  });

export interface ConnectDataSourceOptions {
  /** Base URL of a server that implements the Surfaces services, e.g. http://localhost:5220. */
  baseUrl?: string;
  /** Use an existing transport instead (for Node, auth interceptors, or gRPC-web). */
  transport?: Transport;
}

/** A DataSource that calls a server implementing the Surfaces protobuf services over Connect. */
export function connectDataSource(options: ConnectDataSourceOptions): DataSource {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const query = createClient(QueryService, transport);
  const catalog = createClient(CatalogService, transport);
  const sources = createClient(SourceService, transport);
  return {
    execute: (request, callOptions) => located(query.execute(request, callOptions)),
    count: (request, callOptions) => locatedCall(query.count(request, callOptions)),
    explain: (request, callOptions) => locatedCall(query.explain(request, callOptions)),
    cancel: (request, callOptions) => query.cancel(request, callOptions),
    listSources: (request, callOptions) => sources.listSources(request, callOptions),
    testSource: (request, callOptions) => sources.testSource(request, callOptions),
    listFiles: (request, callOptions) => sources.listFiles(request, callOptions),
    listCatalogs: (request, callOptions) => catalog.listCatalogs(request, callOptions),
    listSchemas: (request, callOptions) => catalog.listSchemas(request, callOptions),
    listTables: (request, callOptions) => catalog.listTables(request, callOptions),
    describeTable: (request, callOptions) => catalog.describeTable(request, callOptions),
    listSnapshots: (request, callOptions) => catalog.listSnapshots(request, callOptions),
  };
}

/** A Discovery backend reached over Connect: a server implementing DiscoveryService and ContextService. */
export function connectDiscovery(options: ConnectDataSourceOptions): Discovery {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const discovery = createClient(DiscoveryService, transport);
  const context = createClient(ContextService, transport);
  return {
    search: (request, callOptions) => discovery.search(request, callOptions),
    getObject: (request, callOptions) => discovery.getObject(request, callOptions),
    getRelated: (request, callOptions) => discovery.getRelated(request, callOptions),
    describe: (request, callOptions) => discovery.describe(request, callOptions),
    saveDescription: (request, callOptions) => discovery.saveDescription(request, callOptions),
    setCertification: (request, callOptions) => discovery.setCertification(request, callOptions),
    ask: (request, callOptions) => discovery.ask(request, callOptions),
    listContextPacks: (request, callOptions) => context.listContextPacks(request, callOptions),
    getContextPack: (request, callOptions) => context.getContextPack(request, callOptions),
    saveContextPack: (request, callOptions) => context.saveContextPack(request, callOptions),
    deleteContextPack: (request, callOptions) => context.deleteContextPack(request, callOptions),
    renderContextPack: (request, callOptions) => context.renderContextPack(request, callOptions),
  };
}

/** A Pipelines backend reached over Connect: a server implementing PipelineService and IngestService. */
export function connectPipelines(options: ConnectDataSourceOptions): Pipelines {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const pipelines = createClient(PipelineService, transport);
  const ingest = createClient(IngestService, transport);
  return {
    listPipelines: (request, callOptions) => pipelines.listPipelines(request, callOptions),
    getPipeline: (request, callOptions) => pipelines.getPipeline(request, callOptions),
    listRuns: (request, callOptions) => pipelines.listRuns(request, callOptions),
    getRun: (request, callOptions) => pipelines.getRun(request, callOptions),
    startRun: (request, callOptions) => pipelines.startRun(request, callOptions),
    cancelRun: (request, callOptions) => pipelines.cancelRun(request, callOptions),
    // A server whose pipelines are fixed refuses a save with a message saying so.
    savePipeline: (request, callOptions) => pipelines.savePipeline(request, callOptions),
    listPipelineVersions: (request, callOptions) => pipelines.listPipelineVersions(request, callOptions),
    inspectFiles: (request, callOptions) => locatedCall(ingest.inspectFiles(request, callOptions)),
  };
}

/** A Forms backend reached over Connect: a server implementing FormService. */
export function connectForms(options: ConnectDataSourceOptions): Forms {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const forms = createClient(FormService, transport);
  return {
    listForms: (request, callOptions) => forms.listForms(request, callOptions),
    getForm: (request, callOptions) => forms.getForm(request, callOptions),
    submit: (request, callOptions) => forms.submit(request, callOptions),
    listSubmissions: (request, callOptions) => forms.listSubmissions(request, callOptions),
  };
}

/**
 * Saved surfaces reached over Connect: a server implementing the surface
 * calls of ViewService. A save that lost a race fails with `StaleSurfaceError`,
 * as it does in memory.
 */
export function connectSurfaceLibrary(options: ConnectDataSourceOptions): SurfaceLibrary {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const views = createClient(ViewService, transport);
  return {
    listSurfaces: (request, callOptions) => views.listSurfaces(request, callOptions),
    getSurface: (request, callOptions) => views.getSurface(request, callOptions),
    async saveSurface(request, callOptions) {
      try {
        return await views.saveSurface(request, callOptions);
      } catch (error) {
        if (error instanceof ConnectError && error.code === Code.Aborted) {
          const latest = Number(/version (\d+)/.exec(error.rawMessage)?.[1] ?? 0);
          throw new StaleSurfaceError(request.surface?.id ?? "", latest);
        }
        throw error;
      }
    },
    deleteSurface: (request, callOptions) => views.deleteSurface(request, callOptions),
    listSurfaceVersions: (request, callOptions) => views.listSurfaceVersions(request, callOptions),
  };
}

/**
 * Semantic models reached over Connect: a server serving `SemanticService`
 * (the `semantics` option of `createSurfacesServer`, or any server with
 * `surfaces.config.ts`). A save that lost a race fails with
 * `StaleSemanticModelError` and one that does not check with
 * `SemanticModelError`, as they do in memory.
 */
export function connectSemantics(options: ConnectDataSourceOptions): Semantics {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const client = createClient(SemanticService, transport);
  return {
    listSemanticModels: (request, callOptions) => client.listSemanticModels(request, callOptions),
    getSemanticModel: (request, callOptions) => client.getSemanticModel(request, callOptions),
    async saveSemanticModel(request, callOptions) {
      try {
        return await client.saveSemanticModel(request, callOptions);
      } catch (error) {
        if (error instanceof ConnectError && error.code === Code.Aborted) throw new StaleSemanticModelError(request.model?.name ?? "", Number(/version (\d+)/.exec(error.rawMessage)?.[1] ?? 0), request.expectedVersion ?? 0);
        if (error instanceof ConnectError && error.code === Code.InvalidArgument) throw new SemanticModelError([error.rawMessage]);
        throw error;
      }
    },
    deleteSemanticModel: (request, callOptions) => client.deleteSemanticModel(request, callOptions),
    listSemanticModelVersions: (request, callOptions) => client.listSemanticModelVersions(request, callOptions),
  };
}

/**
 * Model settings reached over Connect: a server serving `ModelService`
 * (the `models` option of `createSurfacesServer` or `surfaces.config.ts`).
 * It shows and changes which model each backend uses; no key crosses it.
 */
export function connectModelSettings(options: ConnectDataSourceOptions): ModelSettings {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const models = createClient(ModelService, transport);
  return {
    listModelBackends: (request, callOptions) => models.listModelBackends(request, callOptions),
    async setModel(request, callOptions) {
      try {
        return await models.setModel(request, callOptions);
      } catch (error) {
        if (error instanceof ConnectError && error.code === Code.InvalidArgument) throw new ModelChoiceError(error.rawMessage);
        throw error;
      }
    },
  };
}

/**
 * An AgentBackend reached over Connect: a server serving `AgentService`
 * (`agentRoutes` or `createSurfacesServer({ agent })` from
 * `@surfaces-ui/dev-server`, or your own). The model and its key stay on the
 * server; the browser only streams turns.
 */
export function connectAgent(options: ConnectDataSourceOptions): { send: AgentSend; describeAgents(): Promise<import("@surfaces-ui/proto").DescribeAgentsResponse> } {
  const transport = options.transport ?? createConnectTransport({ baseUrl: options.baseUrl ?? "" });
  const agent = createClient(AgentService, transport);
  return { send: (request, callOptions) => agent.send(request, { signal: callOptions?.signal }), describeAgents: () => agent.describeAgents({}) };
}

type AgentSend = (request: Parameters<ReturnType<typeof createClient<typeof AgentService>>["send"]>[0], options?: { signal?: AbortSignal }) => AsyncIterable<import("@surfaces-ui/proto").SendResponse>;
