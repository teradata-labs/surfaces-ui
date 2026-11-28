import type { AgentBackend } from "@surfaces-ui/agent";
import type { DataSource, ModelSettings } from "@surfaces-ui/data";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Embedder } from "@surfaces-ui/discovery";
import { type DuckDbCatalog, type DuckDbConnection, type DuckDbSecretValues, type DuckDbTable, createDuckDbEngine, isRemotePath } from "@surfaces-ui/engine-duckdb";
import { createDataFusionEngine } from "@surfaces-ui/engine-datafusion";
import { createMcpEngine, httpServer } from "@surfaces-ui/engine-mcp";
import { stdioServer } from "@surfaces-ui/engine-mcp/node";
import { type DriverConnection, createTeradataEngine, driverClient } from "@surfaces-ui/engine-teradata";
import type { PipelineDefinition } from "@surfaces-ui/pipelines";
import { type DbtNode, type DbtPipelinesOptions, dbtPipelines as dbtPipelinesOf, defaultRelation, readArtifacts, semanticModelsFromDbt } from "@surfaces-ui/pipelines-dbt";
import { dbtCommand, targetDir } from "@surfaces-ui/pipelines-dbt/node";
import { type SemanticModel, SemanticModelSchema, SourceKind } from "@surfaces-ui/proto";
import { type JsonValue, create } from "@bufbuild/protobuf";
import { semanticModelFromJson } from "@surfaces-ui/data";
import type { StoredResultsOptions } from "@surfaces-ui/engine-service";
import type { AgentServices, ServerSource, SurfacesServerOptions } from "./server.js";
import { fileDiscoveryStore } from "./store.js";
import { type FormConfig, fileForms, filePipelineStore, fileRunStore, fileSemantics, fileSurfaceLibrary } from "./stores.js";

/** A DuckDB-backed source: files and lake tables exposed as named tables. */
export interface DuckDbSourceConfig {
  id: string;
  displayName?: string;
  engine: "duckdb";
  /** Local paths are relative to the config file; remote ones (`s3://`, `gs://`, `az://`, `https://`) need a connection that covers them. */
  tables: DuckDbTable[];
  /**
   * Object stores and web locations the tables read from. Each names a
   * secret; the values come from the server's environment (see `envSecrets`),
   * never from this file.
   */
  connections?: DuckDbConnection[];
  /** Catalogs to attach read-only: an Iceberg REST catalog, or a DuckDB database file. */
  catalogs?: DuckDbCatalog[];
}

/** A DataFusion server reached over its HTTP SQL endpoint. Read-only: no kept results and no pipelines. */
export interface DataFusionSourceConfig {
  id: string;
  displayName?: string;
  engine: "datafusion";
  /** Address of the server, e.g. http://localhost:8080. */
  baseUrl: string;
}

/**
 * A Teradata system reached through Teradata Query Service (its REST API).
 * Read-only: no kept results, no pipelines and no time travel. The password
 * or JWT is never written here: `secret` names it, and the server reads
 * `<NAME>_PASSWORD` or `<NAME>_TOKEN` from its environment (see `envSecrets`).
 */
export interface TeradataSourceConfig {
  id: string;
  displayName?: string;
  engine: "teradata";
  /** Address of Query Service up to `/systems`, e.g. https://vantage.example.com:1443. */
  baseUrl: string;
  /** The system name configured in Query Service. */
  system: string;
  /** Database user. Needed with a password; not with a JWT. The user should hold SELECT rights only. */
  user?: string;
  /** Name of the secret holding the password or JWT. */
  secret: string;
  /** Default database: unqualified names resolve here. */
  database?: string;
  /** The databases listings, search and agent context cover when no database is named. Defaults to the default database. */
  databases?: string[];
  transport?: "query-service";
  /** `explicit` (default) keeps one session set to UTC; `implicit` lets requests run side by side. See `QueryServiceOptions.session`. */
  session?: "explicit" | "implicit";
}

/**
 * A Teradata system reached through a driver connection the config opens
 * itself, for example with the `teradatasql` package installed outside this
 * repo. The server never imports a driver: `connect` is the config's own
 * code, and it reads the password from the environment, never from here.
 */
export interface TeradataDriverSourceConfig {
  id: string;
  displayName?: string;
  engine: "teradata";
  transport: "driver";
  /** Opens the connection, on first use. Its errors are not passed on, since a driver's message can repeat its settings. */
  connect(): DriverConnection | Promise<DriverConnection>;
  /** Shown as where this source connects, such as the host name. Never a credential. */
  address?: string;
  /** Default database: unqualified names resolve here. */
  database?: string;
  /** The databases listings, search and agent context cover when no database is named. Defaults to the default database. */
  databases?: string[];
}

/**
 * A database reached through its own MCP server (the Teradata MCP server, a
 * Postgres or DuckDB one). The SQL for every sort, filter and page goes
 * through that server's query tool, so its rows never pass through a model.
 * Read-only: no kept results, no pipelines and no time travel.
 *
 * A local server is started from `command`; only the environment variables
 * named in `env` are passed to it, so a connection string stays in the
 * environment (or the git-ignored `.env.local`) and out of this file. A
 * remote one is called at `url`, with the bearer token read from
 * `<SECRET>_TOKEN`.
 */
export interface McpSourceConfig {
  id: string;
  displayName?: string;
  engine: "mcp";
  /** The database behind the server, which decides the SQL written for it. */
  dialect: "postgres" | "mysql" | "duckdb" | "teradata";
  server: { command: string; args?: string[]; env?: string[] } | { url: string; secret?: string };
  /** The server's tool that runs a query, and its SQL argument. Found from the server's tool list when left out. */
  tool?: string;
  argument?: string;
  /** Other arguments sent with every query, such as a project id. Never a credential. */
  arguments?: Record<string, unknown>;
  /** Teradata: the default database, and the databases listings cover when none is named. */
  database?: string;
  databases?: string[];
}

export type SourceConfig = DuckDbSourceConfig | DataFusionSourceConfig | TeradataSourceConfig | TeradataDriverSourceConfig | McpSourceConfig;

export interface DiscoveryConfig {
  /**
   * "local" runs a small embedding model on this machine for semantic search
   * (needs `@surfaces-ui/embedder-local`; the model downloads once to a cache
   * outside the repo). Omit for keyword search only.
   */
  embedder?: "local";
  /** Source IDs whose data values may be profiled, shown and put in agent context. Default: none. */
  allowSampleValues?: string[];
  /** Folder for context packs and accepted descriptions, relative to the config file. Defaults to `.surfaces`. */
  storeDir?: string;
}

export interface SurfacesConfig {
  /** May be left out when `seeds` is on. */
  sources?: SourceConfig[];
  /**
   * Serve the six synthetic industry models from `@surfaces-ui/seeds` as the
   * sources `retail`, `healthcare`, `fraud`, `telco`, `transportation` and
   * `manufacturing`, with their pipelines and forms. Their data is invented,
   * so their values may be shown (they are added to `allowSampleValues`).
   */
  seeds?: boolean;
  /**
   * Semantic models: the dimensions, measures and metrics of a project's
   * queries, which explorers and reports take their fields from. They are
   * kept as one JSON file each in `dir` (default `<storeDir>/semantic`), so
   * point it at a folder in your repo to review and commit them. `models`
   * (in the contract's JSON form) are added when the folder has none of
   * that name; with `seeds` on, each seed's starter models are too.
   */
  semantic?: { dir?: string; models?: JsonValue[] };
  /**
   * Forms people can submit. Fields and checks are set here; a client sends
   * only a form id and values. Submissions are appended to
   * `<storeDir>/forms/<form id>.jsonl`.
   */
  forms?: FormConfig[];
  discovery?: DiscoveryConfig;
  /** Port for `surfaces-dev`. Defaults to 5220. */
  port?: number;
  maxResultRows?: number;
  /**
   * Pipelines the server can run: datasets built from one another by SQL,
   * with data quality rules. The SQL lives here, never in the browser.
   */
  pipelines?: PipelineDefinition[];
  /**
   * Lets people save pipelines they approved (`SavePipeline`), typically ones
   * an agent proposed. Each is checked by the server before it is kept, as
   * one JSON file with its versions in `<storeDir>/pipelines/` (or `dir`).
   * Pipelines in `pipelines` stay as written here. Off by default.
   */
  savedPipelines?: boolean | { dir?: string };
  /**
   * dbt projects, served as pipelines read from their artifacts: models,
   * seeds, snapshots and sources as datasets, dbt's tests as checks, and its
   * runs and source freshness. dbt stays what builds them.
   */
  dbt?: DbtProjectConfig[];
  /** Keeping query results so views do not re-run the query. `false` turns it off. */
  storedResults?: StoredResultsOptions | false;
  /**
   * An agent to serve as `AgentService`, such as
   * `anthropicAgent({ client: new Anthropic(), system: catalogPrompt(analyticsCatalog) })`.
   * Its model key is read from this server's environment, never from config.
   * A function gets the server's data source, for tools that list tables or
   * run queries.
   */
  agent?: AgentBackend | ((dataSource: DataSource, services: AgentServices) => AgentBackend);
  /**
   * Which model each agent backend uses, shown and changed from a page
   * (`ModelService`). Build it with `modelSettings` from `@surfaces-ui/data`.
   * Keys stay in the environment; nothing here carries one.
   */
  models?: ModelSettings;
}

/**
 * Reads a named secret from environment variables, so credentials stay out
 * of config files and the repository. For the name `LAKE` it reads
 * `LAKE_KEY_ID`, `LAKE_SECRET`, `LAKE_SESSION_TOKEN`, `LAKE_CONNECTION_STRING`
 * `LAKE_TOKEN` and `LAKE_PASSWORD`, whichever are set.
 */
export function envSecrets(env: Record<string, string | undefined> = process.env): (name: string) => DuckDbSecretValues | undefined {
  return (name) => {
    const values: DuckDbSecretValues = {
      keyId: env[`${name}_KEY_ID`],
      secret: env[`${name}_SECRET`],
      sessionToken: env[`${name}_SESSION_TOKEN`],
      connectionString: env[`${name}_CONNECTION_STRING`],
      token: env[`${name}_TOKEN`],
      password: env[`${name}_PASSWORD`],
    };
    return Object.values(values).some((v) => v) ? values : undefined;
  };
}

/** Identity helper that gives `surfaces.config.ts` type checking. */
export function defineConfig(config: SurfacesConfig): SurfacesConfig {
  return config;
}

export const CONFIG_FILES = ["surfaces.config.ts", "surfaces.config.mjs", "surfaces.config.js"];

/**
 * Where a person keeps a config that belongs to no project: `SURFACES_HOME`,
 * or `.surfaces` in their home directory. A server started by a desktop app
 * has no project folder, so it looks here after its working directory. The
 * git-ignored `.env.local` beside the config holds its secrets, as anywhere.
 */
export function configHome(env: Record<string, string | undefined> = process.env): string {
  return env.SURFACES_HOME?.trim() || path.join(os.homedir(), ".surfaces");
}

/** The config file to use: in the working directory, else in `configHome()`. */
export function findConfig(cwd: string = process.cwd(), env: Record<string, string | undefined> = process.env): string | undefined {
  for (const dir of [cwd, configHome(env)]) {
    const name = CONFIG_FILES.find((file) => existsSync(path.join(dir, file)));
    if (name) return path.join(dir, name);
  }
  return undefined;
}

/** Loads a config file and resolves its relative paths. */
export async function loadConfig(file: string): Promise<{ config: SurfacesConfig; dir: string }> {
  const absolute = path.resolve(file);
  const module = (await import(pathToFileURL(absolute).href)) as { default?: SurfacesConfig };
  const config = module.default;
  if (!config || (!Array.isArray(config.sources) && !config.seeds)) {
    throw new Error(`${file} must default-export defineConfig({ sources: [...] }) or defineConfig({ seeds: true })`);
  }
  return { config, dir: path.dirname(absolute) };
}

/** An address up to its query or fragment, which can hold a key. Cut by position, since a pattern that can backtrack over a long address is a way to stall the server. */
function withoutQuery(url: string): string {
  const cut = [url.indexOf("?"), url.indexOf("#")].filter((at) => at !== -1);
  return cut.length === 0 ? url : url.slice(0, Math.min(...cut));
}

/** Splits a command line into the program and its arguments, keeping what is inside quotes together. */
function words(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]!);
}

/**
 * A config made from the environment, for where there is no project folder
 * to keep a config file in (a plugin in a desktop app, whose settings screen
 * fills these in). One source, a database reached through its own MCP server:
 *
 * - `SURFACES_SOURCE_DIALECT`: `postgres`, `mysql`, `duckdb` or `teradata`.
 * - `SURFACES_SOURCE_SERVER`: the command that starts the database's MCP
 *   server (`uvx teradata-mcp-server`), or the address of one (`https://…`).
 * - `SURFACES_SOURCE_SECRET`: the connection string a local server reads, or
 *   the token a remote one takes. It is handed to a local server under the
 *   name in `SURFACES_SOURCE_SECRET_NAME` (`DATABASE_URI` unless said), and is
 *   never written anywhere or shown.
 * - `SURFACES_SOURCE_NAME`, `SURFACES_SOURCE_DATABASE`: a display name, and
 *   Teradata's default database.
 *
 * Nothing set gives `undefined`; a dialect or a server without the other is an error that says which is missing.
 */
export function configFromEnv(env: Record<string, string | undefined> = process.env): SurfacesConfig | undefined {
  // A host that fills these in from a settings screen can leave one as an empty value, a "none" choice, or its own unfilled placeholder.
  const set = (value: string | undefined) => {
    const text = value?.trim() ?? "";
    return text === "" || text.startsWith("${") || /^(none|sample data)$/i.test(text) ? undefined : text;
  };
  const dialect = set(env.SURFACES_SOURCE_DIALECT)?.toLowerCase();
  const server = set(env.SURFACES_SOURCE_SERVER);
  if (!dialect && !server) return undefined;
  if (!dialect || !server) throw new Error(`A data source needs both its database type and its MCP server; ${dialect ? "the server" : "the database type"} is missing.`);
  if (dialect !== "postgres" && dialect !== "mysql" && dialect !== "duckdb" && dialect !== "teradata") throw new Error(`The database type must be postgres, mysql, duckdb or teradata, not "${dialect}".`);
  const common = { id: "data", displayName: set(env.SURFACES_SOURCE_NAME), engine: "mcp" as const, dialect: dialect as McpSourceConfig["dialect"], database: set(env.SURFACES_SOURCE_DATABASE) };
  if (/^https?:\/\//i.test(server)) return { sources: [{ ...common, server: { url: server, secret: set(env.SURFACES_SOURCE_SECRET) ? "SURFACES_SOURCE_SECRET" : undefined } }] };
  const [command, ...args] = words(server);
  if (!command) throw new Error("The MCP server's command is empty.");
  const name = set(env.SURFACES_SOURCE_SECRET_NAME) ?? "DATABASE_URI";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("The name the connection string is handed over under must be a plain environment variable name.");
  const secret = set(env.SURFACES_SOURCE_SECRET);
  if (secret) env[name] = secret;
  return { sources: [{ ...common, server: { command, args, env: [name] } }] };
}

/** Opens the engines a config describes. */
export async function openSources(
  config: SurfacesConfig,
  dir: string,
  resolveSecret: (name: string) => DuckDbSecretValues | undefined | Promise<DuckDbSecretValues | undefined> = envSecrets(),
): Promise<ServerSource[]> {
  const ids = new Set<string>();
  const sources: ServerSource[] = [];
  const all = [...(config.sources ?? []), ...(config.seeds ? (await loadSeeds()).sources : [])];
  for (const source of all) {
    if (ids.has(source.id)) throw new Error(`Duplicate source id: ${source.id}`);
    ids.add(source.id);
    if (source.engine === "datafusion") {
      sources.push({ id: source.id, displayName: source.displayName, kind: SourceKind.FILES, engine: await createDataFusionEngine({ baseUrl: source.baseUrl }) });
      continue;
    }
    if (source.engine === "mcp") {
      const server = source.server;
      const secret = "url" in server ? server.secret : undefined;
      // A source made from the environment (`configFromEnv`) keeps its token under this one name.
      const token = secret === "SURFACES_SOURCE_SECRET" ? process.env.SURFACES_SOURCE_SECRET : secret ? (await resolveSecret(secret))?.token : undefined;
      const engine = await createMcpEngine({
        dialect: source.dialect,
        transport: "url" in server ? httpServer(server.url, { token: () => token }) : stdioServer(server.command, server.args, { env: server.env }),
        // A command line can hold a connection string, so only the program is shown; an address is shown without its query.
        address: "url" in server ? withoutQuery(server.url) : server.command,
        tool: source.tool,
        argument: source.argument,
        arguments: source.arguments,
        database: source.database,
        databases: source.databases,
      });
      const kind = source.dialect === "teradata" ? SourceKind.TERADATA : source.dialect === "postgres" ? SourceKind.POSTGRES : source.dialect === "mysql" ? SourceKind.MYSQL : SourceKind.DUCKDB;
      sources.push({ id: source.id, displayName: source.displayName, kind, engine });
      continue;
    }
    if (source.engine === "teradata" && source.transport === "driver") {
      const engine = await createTeradataEngine({ client: driverClient(source.connect, { database: source.database }), database: source.database, databases: source.databases, address: source.address });
      sources.push({ id: source.id, displayName: source.displayName, kind: SourceKind.TERADATA, engine });
      continue;
    }
    if (source.engine === "teradata") {
      const engine = await createTeradataEngine({
        baseUrl: source.baseUrl,
        system: source.system,
        user: source.user,
        secret: source.secret,
        database: source.database,
        databases: source.databases,
        session: source.session,
        resolveSecret,
      });
      sources.push({ id: source.id, displayName: source.displayName, kind: SourceKind.TERADATA, engine });
      continue;
    }
    const engine = await createDuckDbEngine({
      tables: source.tables.map((t) => ({ ...t, path: isRemotePath(t.path) ? t.path : path.resolve(dir, t.path) })),
      connections: source.connections,
      catalogs: source.catalogs?.map((c) => (c.kind === "duckdb" ? { ...c, uri: path.resolve(dir, c.uri) } : c)),
      resolveSecret,
    });
    sources.push({ id: source.id, displayName: source.displayName, engine });
  }
  return sources;
}

type SeedsModule = typeof import("@surfaces-ui/seeds");

/** The seeds package and the sources, pipelines and forms it adds. */
export async function loadSeeds() {
  const module: SeedsModule = await import("@surfaces-ui/seeds");
  const dataDir = path.join(path.dirname(createRequire(import.meta.url).resolve("@surfaces-ui/seeds/package.json")), "data");
  const sources: DuckDbSourceConfig[] = module.seedSources(dataDir);
  const pipelines: PipelineDefinition[] = module.seeds.flatMap((seed) => seed.pipelines.map((p) => ({ ...p, sourceId: seed.id })));
  const forms: FormConfig[] = module.seeds.flatMap((seed) =>
    seed.forms.map((f) => ({ id: f.id, title: f.title, description: f.description, target: `${seed.id}.${f.table}`, fields: f.fields })),
  );
  const semanticModels: JsonValue[] = module.seeds.flatMap((seed) => module.seedSemanticModels(seed) as unknown as JsonValue[]);
  return { sources, pipelines, forms, semanticModels, ids: module.seeds.map((s) => s.id) };
}

/** A dbt project the server reads. Paths are relative to the config file. */
export interface DbtProjectConfig {
  /** The pipeline's id. Defaults to the project's name. */
  id?: string;
  name?: string;
  /** The source whose engine reads the warehouse dbt builds into. */
  sourceId: string;
  /** Where dbt writes its artifacts: the project's `target` directory. */
  targetDir: string;
  /**
   * Lets a person, or an agent they approve, start `dbt build` (or
   * `dbt compile` to check) from here. Needs `projectDir`. Credentials stay
   * in dbt's profile and this server's environment. Off by default: runs
   * made by dbt itself are reported either way.
   */
  build?: { projectDir: string; profilesDir?: string; target?: string; command?: string };
  /** Starter semantic models from dbt's semantic layer (semantic_manifest.json). On by default. */
  semanticModels?: boolean;
  /**
   * Put before each table's `schema.alias` when the source reads dbt's
   * database under a name of its own: the name a DuckDB source attaches the
   * database file as, for one.
   */
  relationPrefix?: string;
}

/** Each dbt project's backend options and its starter semantic models. A project whose artifacts cannot be read is reported and left out. */
async function dbtProjects(projects: DbtProjectConfig[], dir: string) {
  if (projects.length === 0) return [];
  const out: { options: Omit<DbtPipelinesOptions, "onFinished">; models: SemanticModel[] }[] = [];
  for (const project of projects) {
    const read = targetDir(path.resolve(dir, project.targetDir));
    try {
      const artifacts = await readArtifacts(read);
      const options = {
        ...(project.id ? { id: project.id } : {}),
        ...(project.name ? { name: project.name } : {}),
        sourceId: project.sourceId,
        read,
        ...(project.relationPrefix ? { relationOf: (node: DbtNode) => `${project.relationPrefix}.${defaultRelation(node)}` } : {}),
        ...(project.build ? { invoke: dbtCommand({ ...project.build, projectDir: path.resolve(dir, project.build.projectDir), ...(project.build.profilesDir ? { profilesDir: path.resolve(dir, project.build.profilesDir) } : {}) }) } : {}),
      };
      const semantic = project.semanticModels === false ? { models: [], skipped: [] } : semanticModelsFromDbt(artifacts, options);
      if (semantic.skipped.length > 0) console.warn(`[surfaces] dbt ${artifacts.manifest.metadata?.project_name}: ${semantic.skipped.length} semantic fields left out. ${semantic.skipped.join(" ")}`);
      out.push({ options, models: semantic.models.map((m) => create(SemanticModelSchema, m)) });
    } catch (error) {
      console.warn(`[surfaces] The dbt project at ${project.targetDir} was left out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return out;
}

export async function serverOptions(config: SurfacesConfig, sources: ServerSource[], dir = process.cwd()): Promise<SurfacesServerOptions> {
  let embedder: Embedder | undefined;
  if (config.discovery?.embedder === "local") {
    try {
      const name = "@surfaces-ui/embedder-local";
      embedder = ((await import(name)) as { localEmbedder(): Embedder }).localEmbedder();
    } catch {
      console.warn("[surfaces] @surfaces-ui/embedder-local is not installed; search will be keyword only.");
    }
  }
  const seeded = config.seeds ? await loadSeeds() : undefined;
  const storeDir = path.resolve(dir, config.discovery?.storeDir ?? ".surfaces");
  const forms = [...(config.forms ?? []), ...(seeded?.forms ?? [])];
  const dbt = await dbtProjects(config.dbt ?? [], dir);
  return {
    sources,
    maxResultRows: config.maxResultRows,
    storedResults: config.storedResults,
    ...(config.agent ? { agent: config.agent } : {}),
    ...(config.models ? { models: config.models } : {}),
    pipelines: [...(config.pipelines ?? []), ...(seeded?.pipelines ?? [])],
    ...(dbt.length > 0 ? { externalPipelines: ({ onFinished }) => dbt.map((project) => dbtPipelinesOf({ ...project.options, onFinished })) } : {}),
    // Run history outlives a restart.
    pipelineRuns: fileRunStore(path.join(storeDir, "pipeline-runs")),
    ...(config.savedPipelines
      ? { savedPipelines: filePipelineStore(path.resolve(dir, (typeof config.savedPipelines === "object" && config.savedPipelines.dir) || path.join(storeDir, "pipelines"))) }
      : {}),
    forms: forms.length > 0 ? fileForms(path.join(storeDir, "forms"), forms) : undefined,
    library: fileSurfaceLibrary(path.join(storeDir, "surfaces")),
    semantics: fileSemantics(path.resolve(dir, config.semantic?.dir ?? path.join(storeDir, "semantic")), {
      models: withDbtModels(starterModels([...(config.semantic?.models ?? []), ...(seeded?.semanticModels ?? [])]), dbt.flatMap((p) => p.models)),
    }),
    discovery: {
      embedder,
      allowSampleValues: [...(config.discovery?.allowSampleValues ?? []), ...(seeded?.ids ?? [])],
      store: fileDiscoveryStore(storeDir),
    },
  };
}

/**
 * dbt's semantic models beside the others. Names are shared by every source,
 * so one whose name is taken is renamed after its project (orders becomes
 * shop_orders) and the rename is reported.
 */
function withDbtModels(starters: SemanticModel[], fromDbt: SemanticModel[]): SemanticModel[] {
  const taken = new Set(starters.map((m) => m.name));
  const out = [...starters];
  for (const model of fromDbt) {
    let name = model.name;
    if (taken.has(name)) {
      name = `${model.dataset?.pipelineId ?? "dbt"}_${model.name}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64);
      if (taken.has(name)) {
        console.warn(`[surfaces] dbt's semantic model ${model.name} was left out: the names ${model.name} and ${name} are taken.`);
        continue;
      }
      console.warn(`[surfaces] dbt's semantic model ${model.name} is named ${name} here, since another model is named ${model.name}.`);
    }
    taken.add(name);
    out.push(name === model.name ? model : { ...model, name });
  }
  return out;
}

/** Starter models from config, in the contract's JSON form; one that does not parse is reported and left out. */
function starterModels(json: JsonValue[]): SemanticModel[] {
  return json.flatMap((item) => {
    try {
      return [semanticModelFromJson(item)];
    } catch (error) {
      console.warn(`[surfaces] A semantic model in the config was left out: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });
}
