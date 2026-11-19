import http from "node:http";
import { create } from "@bufbuild/protobuf";
import type { AddressInfo } from "node:net";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import {
  type DataSource,
  type Discovery,
  type Forms,
  ModelChoiceError,
  type ModelSettings,
  type Pipelines,
  combinePipelines,
  SemanticModelError,
  type Semantics,
  StaleSemanticModelError,
  StaleSurfaceError,
  type SurfaceLibrary,
  semanticDatasetProblems,
  semanticModelDataProblems,
} from "@surfaces-ui/data";
import { type DiscoveryOptions, createDiscovery } from "@surfaces-ui/discovery";
import { type EngineServicesOptions, createEngineServices, toConnectError } from "@surfaces-ui/engine-service";
import { type PipelineDefinition, type PipelineStore, type RunStore, createPipelines } from "@surfaces-ui/pipelines";
import { type AgentBackend, agentEvent, describesAgents } from "@surfaces-ui/agent";
import { AgentService, ContextService, DescribeAgentsResponseSchema, DiscoveryService, FormService, IngestService, ListPipelineVersionsResponseSchema, ModelService, PipelineService, SemanticService, ViewService } from "@surfaces-ui/proto";

export type { ServerSource, StoredResultsOptions } from "@surfaces-ui/engine-service";

export interface SurfacesServerOptions extends EngineServicesOptions {
  /**
   * Discovery settings: sources whose data values may be shown or shared, an
   * embedder for semantic search, a language model, and where packs are kept.
   * Pass `false` to leave the discovery services out.
   */
  discovery?: Omit<DiscoveryOptions, "dataSource"> | false;
  /**
   * Pipelines this server can run. Their SQL is set here, on the server; a
   * client can only choose which to run. Omit to leave the pipeline services out.
   */
  pipelines?: PipelineDefinition[];
  /**
   * Pipeline backends built by another tool, served beside the pipelines
   * above: `dbtPipelines` from `@surfaces-ui/pipelines-dbt` for a dbt project.
   * `onFinished` is for a run they start, which changes tables.
   */
  externalPipelines?(hooks: { onFinished(): void }): Pipelines[];
  /** Where pipeline runs are kept, so history outlives a restart. Omit to keep them in memory. */
  pipelineRuns?: RunStore;
  /**
   * Allows `SavePipeline`: a pipeline a person approved is checked (its
   * version, the digest of what they approved, read-only queries and a dry
   * run) and kept here. Pipelines in `pipelines` cannot be changed this way.
   * Omit to keep pipelines fixed.
   */
  savedPipelines?: PipelineStore;
  /**
   * Forms people can submit. The backend defines each form's fields; a client
   * sends a form id and values, which are checked before anything is kept.
   * Omit to leave the form service out.
   */
  forms?: Forms;
  /** Where saved surfaces (pages, charts, forms, explorers) are kept. Omit to leave the surface calls out. */
  library?: SurfaceLibrary;
  /**
   * Where semantic models are kept, served as `SemanticService`. Every save
   * is checked against the data first: the model's query must run through
   * this server's read-only sources and return the columns its fields name.
   * Omit to leave it out.
   */
  semantics?: Semantics;
  /**
   * Which model each agent backend uses, served as `ModelService` so a page
   * can show and change it. It carries no key. Omit to leave it out.
   */
  models?: ModelSettings;
  /**
   * An agent to serve as `AgentService`, so a browser chat reaches it with
   * `connectAgent` from `@surfaces-ui/client-connect`. The agent runs here, with
   * its model key in this server's environment. Omit to leave it out.
   * Pass a function to build the agent from this server's own data source,
   * for tools that list tables or run queries.
   */
  agent?: AgentBackend | ((dataSource: DataSource, services: AgentServices) => AgentBackend);
  /** Origins allowed to call from a browser. Defaults to any localhost origin. */
  allowedOrigins?: (string | RegExp)[];
}

/** What a server gives an agent it builds, besides its data: give them to `dataTools`. */
export interface AgentServices {
  /** The server's semantic models, for `list_semantic_models` and `describe_semantic_model`. */
  semantics?: Semantics;
  /** The server's pipelines, for `pipelineTools` from `@surfaces-ui/agent`. */
  pipelines?: Pipelines;
}

/** Answers every turn by saying no agent is set up, so a chat explains itself instead of failing with a protocol error. */
const noAgent: AgentBackend = {
  async *send() {
    yield agentEvent.error("UNAVAILABLE", "No agent is set up on this server. Give surfaces.config.ts an agent (for example anthropicAgent from @surfaces-ui/agent-anthropic) and restart the server.");
    yield agentEvent.done("", "no agent");
  },
};

/**
 * Serves any AgentBackend as `AgentService` on a Connect router: one `Send`
 * streams one turn. Mount it in your own Connect server, or pass `agent` to
 * `createSurfacesServer`. Who the person is comes from the request
 * (`decided_by`, `actor`); check it against your own session before acting.
 */
export function agentRoutes(agent: AgentBackend): (router: ConnectRouter) => void {
  return (router) => {
    router.service(AgentService, {
      async *send(request, context) {
        yield* agent.send(request, { signal: context.signal });
      },
      // What a chat may offer: agents, models, skills and connectors. An agent that says nothing offers no choices.
      async describeAgents() {
        return describesAgents(agent) ? await agent.describeAgents() : create(DescribeAgentsResponseSchema, {});
      },
    });
  };
}

export interface SurfacesServer {
  /** The server's sources as an in-process DataSource (no HTTP), for embedding in other servers. */
  dataSource: DataSource;
  /** The discovery backend, when enabled. */
  discovery: (Discovery & { warm(): Promise<{ objects: number }> }) | undefined;
  /** The pipeline backend, when pipelines are configured. */
  pipelines: Pipelines | undefined;
  forms: Forms | undefined;
  library: SurfaceLibrary | undefined;
  semantics: Semantics | undefined;
  models: ModelSettings | undefined;
  /** Registers the services on a Connect router, to mount in an existing server. */
  routes(router: ConnectRouter): void;
  /** Starts an HTTP server. Port 0 picks a free port. */
  listen(port?: number, host?: string): Promise<{ url: string; port: number }>;
  close(): Promise<void>;
}

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export async function createSurfacesServer(options: SurfacesServerOptions): Promise<SurfacesServer> {
  const services = await createEngineServices(options);
  const sources = new Map(options.sources.map((s) => [s.id, s]));
  let server: http.Server | undefined;

  const dataRoutes = services.routes;
  // Discovery reads the catalog through the same services, in process.
  const dataSource = services.dataSource;
  const discovery = options.discovery === false ? undefined : createDiscovery({ ...options.discovery, dataSource });
  // Discovery messages are written for people (not found, needs a name), so they are passed on.
  const found = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      throw error instanceof ConnectError ? error : new ConnectError(error instanceof Error ? error.message : String(error), Code.InvalidArgument);
    }
  };
  const finished = () => {
    services.clearResults();
    discovery?.refresh();
  };
  const reference =
    (options.pipelines && options.pipelines.length > 0) || options.savedPipelines
      ? await createPipelines({
          pipelines: options.pipelines ?? [],
          engineOf: (id) => sources.get(id)?.engine,
          ...(options.pipelineRuns ? { runs: options.pipelineRuns } : {}),
          ...(options.savedPipelines ? { saved: options.savedPipelines } : {}),
          // A run changes tables, so kept results and the search index over them are out of date.
          onFinished: finished,
        })
      : undefined;
  const backends = [...(reference ? [reference] : []), ...(options.externalPipelines?.({ onFinished: finished }) ?? [])];
  const pipelines = backends.length > 0 ? combinePipelines(backends) : undefined;
  const agent = typeof options.agent === "function" ? options.agent(dataSource, { semantics: options.semantics, ...(pipelines ? { pipelines } : {}) }) : (options.agent ?? noAgent);
  const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      throw toConnectError(error);
    }
  };
  const { forms, library, models } = options;
  // Every save is checked against the data, whatever store holds the models.
  const semantics: Semantics | undefined = options.semantics && {
    ...options.semantics,
    async saveSemanticModel(request, callOptions) {
      const problems = request.model ? await semanticModelDataProblems(request.model, services.dataSource, callOptions) : [];
      // A model on a pipeline dataset must read that dataset, on its source.
      const ref = request.model?.dataset;
      if (ref?.pipelineId && request.model) {
        const pipeline = pipelines ? await pipelines.getPipeline({ id: ref.pipelineId }, callOptions).then((r) => r.pipeline, () => undefined) : undefined;
        problems.push(...semanticDatasetProblems(request.model, pipeline, { key: false }));
      }
      if (problems.length > 0) throw new SemanticModelError(problems);
      return options.semantics!.saveSemanticModel(request, callOptions);
    },
  };
  const modelled = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof StaleSemanticModelError) throw new ConnectError(error.message, Code.Aborted);
      if (error instanceof SemanticModelError) throw new ConnectError(error.message, Code.InvalidArgument);
      if (error instanceof Error && /^(No semantic model|Version \d+ of)/.test(error.message)) throw new ConnectError(error.message, Code.NotFound);
      return found(() => Promise.reject(error));
    }
  };
  const saved = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof StaleSurfaceError) throw new ConnectError(error.message, Code.Aborted);
      if (error instanceof Error && /^(No saved surface|Version \d+ of)/.test(error.message)) throw new ConnectError(error.message, Code.NotFound);
      return found(() => Promise.reject(error));
    }
  };
  const unbuilt = () => Promise.reject(new ConnectError("Apps are not built yet; use the surface calls.", Code.Unimplemented));
  const allRoutes = (router: ConnectRouter) => {
    dataRoutes(router);
    agentRoutes(agent)(router);
    if (forms) {
      router.service(FormService, {
        listForms: (r) => found(() => forms.listForms(r)),
        getForm: (r) => found(() => forms.getForm(r)),
        submit: (r) => found(() => forms.submit(r)),
        listSubmissions: (r) => found(() => forms.listSubmissions(r)),
      });
    }
    if (models) {
      const chosen = async <T>(run: () => Promise<T>): Promise<T> => {
        try {
          return await run();
        } catch (error) {
          if (error instanceof ModelChoiceError) throw new ConnectError(error.message, Code.InvalidArgument);
          return found(() => Promise.reject(error));
        }
      };
      router.service(ModelService, {
        listModelBackends: (r) => chosen(() => models.listModelBackends(r)),
        setModel: (r) => chosen(() => models.setModel(r)),
      });
    }
    if (library) {
      router.service(ViewService, {
        listSurfaces: (r) => saved(() => library.listSurfaces(r)),
        getSurface: (r) => saved(() => library.getSurface(r)),
        saveSurface: (r) => saved(() => library.saveSurface(r)),
        deleteSurface: (r) => saved(() => library.deleteSurface(r)),
        listSurfaceVersions: (r) => saved(() => library.listSurfaceVersions(r)),
        listApps: unbuilt,
        getApp: unbuilt,
        saveApp: unbuilt,
        deleteApp: unbuilt,
        listAppVersions: unbuilt,
        createSnapshot: unbuilt,
        getSnapshot: unbuilt,
      });
    }
    if (semantics) {
      router.service(SemanticService, {
        listSemanticModels: (r) => modelled(() => semantics.listSemanticModels(r)),
        getSemanticModel: (r) => modelled(() => semantics.getSemanticModel(r)),
        saveSemanticModel: (r) => modelled(() => semantics.saveSemanticModel(r)),
        deleteSemanticModel: (r) => modelled(() => semantics.deleteSemanticModel(r)),
        listSemanticModelVersions: (r) => modelled(() => semantics.listSemanticModelVersions(r)),
      });
    }
    if (pipelines) {
      router.service(PipelineService, {
        listPipelines: (r) => found(() => pipelines.listPipelines(r)),
        getPipeline: (r) => found(() => pipelines.getPipeline(r)),
        listRuns: (r) => found(() => pipelines.listRuns(r)),
        getRun: (r) => found(() => pipelines.getRun(r)),
        startRun: (r) => found(() => pipelines.startRun(r)),
        cancelRun: (r) => found(() => pipelines.cancelRun(r)),
        savePipeline: (r) =>
          pipelines.savePipeline
            ? found(async () => {
                try {
                  return await pipelines.savePipeline!(r);
                } catch (error) {
                  if (error instanceof Error && /changed since/.test(error.message)) throw new ConnectError(error.message, Code.Aborted);
                  throw error;
                }
              })
            : Promise.reject(new ConnectError("Pipelines on this server cannot be changed. Set savedPipelines in surfaces.config.ts to allow approved saves.", Code.FailedPrecondition)),
        listPipelineVersions: (r) => found(() => pipelines.listPipelineVersions?.(r) ?? Promise.resolve(create(ListPipelineVersionsResponseSchema, {}))),
      });
      router.service(IngestService, { inspectFiles: (r) => guarded(() => pipelines.inspectFiles(r)) });
    }
    if (!discovery) return;
    router.service(DiscoveryService, {
      search: (r) => found(() => discovery.search(r)),
      getObject: (r) => found(() => discovery.getObject(r)),
      getRelated: (r) => found(() => discovery.getRelated(r)),
      describe: (r, context) => found(() => discovery.describe(r, { signal: context.signal })),
      saveDescription: (r) => found(() => discovery.saveDescription(r)),
      setCertification: (r) => found(() => discovery.setCertification(r)),
      async *ask(r, context) {
        try {
          yield* discovery.ask(r, { signal: context.signal });
        } catch (error) {
          throw error instanceof ConnectError ? error : new ConnectError(error instanceof Error ? error.message : String(error), Code.InvalidArgument);
        }
      },
    });
    router.service(ContextService, {
      listContextPacks: (r) => found(() => discovery.listContextPacks(r)),
      getContextPack: (r) => found(() => discovery.getContextPack(r)),
      saveContextPack: (r) => found(() => discovery.saveContextPack(r)),
      deleteContextPack: (r) => found(() => discovery.deleteContextPack(r)),
      renderContextPack: (r) => found(() => discovery.renderContextPack(r)),
    });
  };

  const allowed = options.allowedOrigins ?? [LOCALHOST];
  const originAllowed = (origin: string) => allowed.some((rule) => (typeof rule === "string" ? rule === origin : rule.test(origin)));

  return {
    dataSource,
    discovery,
    pipelines,
    forms,
    library,
    semantics,
    models,
    routes: allRoutes,
    listen(port = 5220, host = "127.0.0.1") {
      const handler = connectNodeAdapter({ routes: allRoutes });
      server = http.createServer((req, res) => {
        const origin = req.headers.origin;
        if (origin && originAllowed(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
          res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, Connect-Accept-Encoding, Connect-Content-Encoding, X-User-Agent",
          );
          res.setHeader("Access-Control-Max-Age", "7200");
        }
        if (req.method === "OPTIONS") {
          res.writeHead(origin && originAllowed(origin) ? 204 : 403).end();
          return;
        }
        handler(req, res);
      });
      return new Promise((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(port, host, () => {
          const address = server!.address() as AddressInfo;
          resolve({ url: `http://${host}:${address.port}`, port: address.port });
        });
      });
    },
    async close() {
      await services.close();
      if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      await Promise.all([...sources.values()].map((s) => s.engine.close().catch(() => {})));
    },
  };
}
