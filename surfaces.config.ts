import Anthropic from "@anthropic-ai/sdk";
import { type AgentBackend, type AgentOffer, type AgentSkill, type DescribesAgents, type RunnableTool, agentEvent, dataTools, pipelineTools } from "@surfaces-ui/agent";
import { anthropicAgent } from "@surfaces-ui/agent-anthropic";
import { openAiCompatibleAgent } from "@surfaces-ui/agent-openai";
import { type DataSource, modelSettings } from "@surfaces-ui/data";
import { type AgentServices, type SourceConfig, defineConfig } from "@surfaces-ui/dev-server";
import { type DescribeAgentsResponse, ModelProvider } from "@surfaces-ui/proto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { analyticsCatalog, surfaceAgentPrompt } from "@surfaces-ui/spec";

/**
 * The agent behind `AgentService` (the playground's composer, chat and pages
 * reach it with `connectAgent`). It runs here, so a model key stays on this
 * machine and never reaches the browser. The backends:
 *
 * - `claude`: needs `ANTHROPIC_API_KEY`. Model `claude-sonnet-5-5` unless
 *   `ANTHROPIC_MODEL` says otherwise.
 * - `openai`: needs `OPENAI_API_KEY`; any server that speaks its API with
 *   `OPENAI_BASE_URL`; model from `OPENAI_MODEL` (default `gpt-5`).
 * - `local`: an OpenAI-compatible server on this machine such as Ollama,
 *   `SURFACES_LOCAL_MODEL_URL` (default `http://127.0.0.1:11434/v1`) and
 *   `SURFACES_LOCAL_MODEL`.
 *
 * `SURFACES_AGENT=claude|openai|local` picks the one that answers first;
 * otherwise the first with its key or URL set. The playground's Models page
 * changes the model and the backend while the server runs (`ModelService`);
 * nothing there carries a key.
 */
const env = process.env;
const localBase = () => env.SURFACES_LOCAL_MODEL_URL ?? "http://127.0.0.1:11434/v1";
const choice = {
  claude: env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  openai: env.OPENAI_MODEL ?? "gpt-5",
  local: env.SURFACES_LOCAL_MODEL ?? "",
};
let active = env.SURFACES_AGENT ?? (env.ANTHROPIC_API_KEY ? "claude" : env.OPENAI_API_KEY ? "openai" : env.SURFACES_LOCAL_MODEL_URL ? "local" : "claude");

const CLAUDE_MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", description: "Fast, and good at building pages over real data." },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", description: "Stronger on harder pages; slower and dearer." },
  { id: "claude-fable-5-2", label: "Claude Fable 5.2", description: "The most capable generally available model." },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Fastest; for quick, simple changes." },
];

/** Models an Ollama server offers, leaving out embedding models. Empty when it does not answer. */
async function ollamaModels(base: string): Promise<{ id: string; label: string }[]> {
  try {
    const response = await fetch(`${base.replace(/\/v1\/?$/, "")}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const body = (await response.json()) as { models?: { name: string }[] };
    return (body.models ?? []).filter((m) => !/embed/i.test(m.name)).map((m) => ({ id: m.name, label: m.name }));
  } catch {
    return [];
  }
}

/**
 * The throwaway Loom used to test the Loom adapter, found by
 * `SURFACES_TEST_LOOM_CONFIG` (the path of its looms.yaml). It runs either a
 * model on Ollama or Claude. Changing its model rewrites `provider` and
 * `ollama_model` or `anthropic_model` in that file and restarts that one
 * process, found by its `--config` argument. The restarted Loom inherits this
 * server's environment, so Claude's key reaches it as `ANTHROPIC_API_KEY` and
 * is never written into its config. It refuses a config on port 5018, the
 * personal Weaver, and never looks at any other Loom.
 */
/**
 * The test Loom's looms.yaml switched to `model`: a `claude-` id runs on
 * Anthropic, anything else on Ollama. Only the `llm` lines change; no key is
 * ever written here.
 */
function loomConfigFor(text: string, model: string): string {
  const claude = model.startsWith("claude-");
  let out = text.replace(/^(\s*provider:\s*).*$/m, `$1${claude ? "anthropic" : "ollama"}`);
  const key = claude ? "anthropic_model" : "ollama_model";
  if (new RegExp(`^\\s*${key}:`, "m").test(out)) out = out.replace(new RegExp(`^(\\s*${key}:\\s*).*$`, "m"), `$1${model}`);
  else out = out.replace(/^(\s*provider:.*)$/m, `$1\n  ${key}: ${model}`);
  return out;
}

function testLoomBackend(configPath: string) {
  const read = () => readFileSync(configPath, "utf8");
  const field = (text: string, name: string) => new RegExp(`^\\s*${name}:\\s*(\\S+)`, "m").exec(text)?.[1] ?? "";
  const httpPort = () => field(read(), "http_port");
  const processOf = () => {
    try {
      return execFileSync("pgrep", ["-f", `serve --config ${configPath}`], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };
  return {
    async describe() {
      const text = read();
      const port = httpPort();
      const offered = await ollamaModels(field(text, "ollama_endpoint"));
      const claude = field(text, "provider") === "anthropic";
      const keySet = Boolean(env.ANTHROPIC_API_KEY);
      let running = false;
      try {
        running = (await fetch(`http://127.0.0.1:${port}/v1/agents`, { signal: AbortSignal.timeout(1500) })).ok;
      } catch {}
      return {
        id: "loom-test",
        label: "Test Loom",
        provider: ModelProvider.LOOM,
        description: `The Loom on port ${port} used for testing, ${claude ? "on Claude" : `through Ollama at ${field(text, "ollama_endpoint")}`}. The playground reaches it directly.`,
        model: claude ? field(text, "anthropic_model") : field(text, "ollama_model"),
        models: [...CLAUDE_MODELS, ...offered],
        available: running && (!claude || keySet),
        reason: !running ? `Nothing answers on port ${port}.` : claude && !keySet ? "ANTHROPIC_API_KEY is not set on this server, so a restarted Loom has no key." : "",
        keyEnv: claude ? "ANTHROPIC_API_KEY" : "",
        keySet: claude ? keySet : false,
        changeNote: "Rewrites its looms.yaml and restarts that Loom; conversations on it end.",
      };
    },
    async setModel(model: string) {
      if (httpPort() === "5018") throw new Error("That config is the personal Loom on 5018, which this server never changes.");
      const pids = processOf();
      if (pids.length !== 1) throw new Error(`Expected one test Loom process for ${configPath}, found ${pids.length}.`);
      const command = execFileSync("ps", ["-o", "command=", "-p", pids[0]!], { encoding: "utf8" }).trim().split(/\s+/);
      writeFileSync(configPath, loomConfigFor(read(), model));
      process.kill(Number(pids[0]), "SIGTERM");
      for (let i = 0; i < 50 && processOf().length > 0; i++) await new Promise((r) => setTimeout(r, 100));
      spawn(command[0]!, command.slice(1), { detached: true, stdio: "ignore" }).unref();
      for (let i = 0; i < 50; i++) {
        try {
          if ((await fetch(`http://127.0.0.1:${httpPort()}/v1/agents`, { signal: AbortSignal.timeout(500) })).ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
    },
  };
}

/**
 * The skills a chat can turn on: the bodies of this repo's agent skills
 * (`plugins/surfaces-analytics/skills`), each appended to the system prompt
 * while it is on. Chart standards is on to begin with.
 */
function pluginSkills(): AgentSkill[] {
  const root = path.join(import.meta.dirname, "plugins/surfaces-analytics/skills");
  try {
    return readdirSync(root).flatMap((id) => {
      const file = path.join(root, id, "SKILL.md");
      if (!existsSync(file)) return [];
      const text = readFileSync(file, "utf8");
      const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
      const description = /^description:\s*(.+)$/m.exec(front?.[1] ?? "")?.[1]?.split(". ")[0] ?? "";
      const name = id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
      return [{ id, name, description, text: text.slice(front?.[0].length ?? 0).trim(), defaultOn: id === "chart-standards" }];
    });
  } catch {
    return [];
  }
}

/** What a chat may choose for this agent: models, skills, and tool sets as connectors. Tools no connector names are always on. */
/**
 * MCP servers whose tools the agent may use, each a connector a person turns
 * on in the chat's Connectors menu. Read from `surfaces.mcp.json` beside this
 * file (or `SURFACES_MCP_CONFIG`), when there is one:
 *
 *   { "servers": [
 *     { "id": "tickets", "name": "Tickets", "command": "npx", "args": ["-y", "some-mcp-server"], "env": ["TICKETS_TOKEN"] },
 *     { "id": "docs", "name": "Docs", "url": "https://mcp.example.com/mcp", "tokenEnv": "DOCS_TOKEN" } ] }
 *
 * The file names environment variables, never their values: `env` lists the
 * variables a local server is given, `tokenEnv` the one whose value is sent
 * as a bearer token. A server that cannot be reached is shown as unavailable
 * with the reason, and the agent starts without its tools.
 */
interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  command?: string;
  args?: string[];
  env?: string[];
  url?: string;
  tokenEnv?: string;
  approveAll?: boolean;
}
type McpConnections = { connectors: AgentOffer["connectors"]; tools: RunnableTool[] };
let mcpConnections: Promise<McpConnections> | undefined;
function connectMcpServers(): Promise<McpConnections> {
  mcpConnections ??= (async () => {
    const file = env.SURFACES_MCP_CONFIG ?? path.join(import.meta.dirname, "surfaces.mcp.json");
    if (!existsSync(file)) return { connectors: [], tools: [] };
    const servers = ((JSON.parse(readFileSync(file, "utf8")) as { servers?: McpServerConfig[] }).servers ?? []).filter((s) => s.id && s.name && (s.command || s.url));
    const { mcpConnector, httpTransport } = await import("@surfaces-ui/mcp");
    const { stdioTransport } = await import("@surfaces-ui/mcp/node");
    const connected = await Promise.all(
      servers.map((s) =>
        mcpConnector({
          id: s.id,
          name: s.name,
          description: s.description,
          approveAll: s.approveAll,
          transport: s.url ? httpTransport(s.url, { token: () => (s.tokenEnv ? env[s.tokenEnv] : undefined) }) : stdioTransport(s.command!, s.args ?? [], { env: s.env }),
        }),
      ),
    );
    for (const c of connected) console.log(`MCP server ${c.connector.name}: ${c.connector.status === "unavailable" ? c.connector.reason : `${c.tools.length} tools`}`);
    return { connectors: connected.map((c) => ({ ...c.connector, defaultOn: false })), tools: connected.flatMap((c) => c.tools) };
  })().catch((error) => {
    console.error(`MCP servers not connected: ${error instanceof Error ? error.message : String(error)}`);
    return { connectors: [], tools: [] };
  });
  return mcpConnections;
}

function agentOffer(kind: string, data: { name: string }[], pipes: { name: string }[], mcp: McpConnections): AgentOffer {
  const models = kind === "claude" ? CLAUDE_MODELS : kind === "openai" ? [{ id: choice.openai, label: choice.openai }] : choice.local ? [{ id: choice.local, label: choice.local }] : [];
  return {
    name: kind === "claude" ? "Claude" : kind === "openai" ? "OpenAI" : "Local model",
    description: "Builds pages, charts and models over this server's data",
    models,
    defaultModel: choice[kind as keyof typeof choice] ?? "",
    skills: pluginSkills(),
    connectors: [
      { id: "data", name: "Data catalog", description: "List and describe tables; never reads values", tools: data.map((t) => t.name), defaultOn: true },
      ...(pipes.length > 0 ? [{ id: "pipelines", name: "Pipelines", description: "Describe, check, propose and run pipelines", tools: pipes.map((t) => t.name), requiresApproval: true, defaultOn: true }] : []),
      ...(mcp.connectors ?? []),
    ],
  };
}

function buildAgent(dataSource: DataSource, kind: string, services: AgentServices, mcp: McpConnections): (AgentBackend & DescribesAgents) | undefined {
  const data = dataTools(dataSource, { semantics: services.semantics });
  const pipes = services.pipelines ? pipelineTools(services.pipelines) : [];
  const shared = {
    offer: agentOffer(kind, data, pipes, mcp),
    system: surfaceAgentPrompt(analyticsCatalog, { dialect: "the dialect list_tables reports for that source (DuckDB for the sample data)", dataTools: true, semanticModels: !!services.semantics, pipelineTools: !!services.pipelines }),
    tools: [...data, ...pipes, ...mcp.tools],
    checkSurface: (message: unknown) => analyticsCatalog.validateMessage(message),
  };
  if (kind === "claude" && env.ANTHROPIC_API_KEY) return anthropicAgent({ client: new Anthropic(), model: choice.claude, ...shared });
  if (kind === "openai" && env.OPENAI_API_KEY) {
    const key = env.OPENAI_API_KEY;
    return openAiCompatibleAgent({ baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1", model: choice.openai, headers: () => ({ Authorization: `Bearer ${key}` }), ...shared });
  }
  if (kind === "local" && choice.local) return openAiCompatibleAgent({ baseUrl: localBase(), model: choice.local, generatedBy: `${choice.local} (local)`, maxTokens: 4000, ...shared });
  return undefined;
}

const noAgentSetUp: AgentBackend = {
  async *send() {
    yield agentEvent.error(
      "UNAVAILABLE",
      `The dev server's agent "${active}" cannot run: its key or model is not set. Set ANTHROPIC_API_KEY (Claude), OPENAI_API_KEY (OpenAI), or SURFACES_LOCAL_MODEL_URL and SURFACES_LOCAL_MODEL (a local model) in the server's environment, or choose another on the Models page.`,
    );
    yield agentEvent.done("", "no agent");
  },
};

/** Builds the chosen backend for each turn, so a change on the Models page applies from the next turn. */
function switchingAgent(dataSource: DataSource, services: AgentServices): AgentBackend & DescribesAgents {
  let built: { key: string; agent: AgentBackend & Partial<DescribesAgents> } | undefined;
  // MCP servers connect once, in the background; a turn waits for them only the first time.
  const mcp = connectMcpServers();
  const current = async () => {
    const tools = await mcp;
    const key = `${active}:${choice[active as keyof typeof choice] ?? ""}`;
    if (built?.key !== key) built = { key, agent: buildAgent(dataSource, active, services, tools) ?? noAgentSetUp };
    return built.agent;
  };
  return {
    async *send(request, options) {
      yield* (await current()).send(request, options);
    },
    async describeAgents() {
      const agent = await current();
      return agent.describeAgents ? agent.describeAgents() : ({ $typeName: "surfaces.v1.DescribeAgentsResponse", agents: [] } as DescribeAgentsResponse);
    },
  };
}

const models = modelSettings({
  active: () => active,
  setActive: (id) => {
    active = id;
  },
  backends: [
    {
      describe: () => ({
        id: "claude",
        label: "Claude",
        provider: ModelProvider.ANTHROPIC,
        description: "Claude through the Messages API, from this server. Refusal fallbacks are on.",
        model: choice.claude,
        models: CLAUDE_MODELS,
        anyModel: true,
        keyEnv: "ANTHROPIC_API_KEY",
        keySet: !!env.ANTHROPIC_API_KEY,
        available: !!env.ANTHROPIC_API_KEY,
        reason: env.ANTHROPIC_API_KEY ? "" : "ANTHROPIC_API_KEY is not set in the server's environment or .env.local.",
      }),
      setModel: (model) => {
        choice.claude = model;
      },
    },
    {
      describe: () => ({
        id: "openai",
        label: "OpenAI",
        provider: ModelProvider.OPENAI,
        description: `${env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}, from this server.`,
        model: choice.openai,
        models: [{ id: "gpt-5", label: "GPT-5" }, { id: "gpt-5-mini", label: "GPT-5 mini" }],
        anyModel: true,
        keyEnv: "OPENAI_API_KEY",
        keySet: !!env.OPENAI_API_KEY,
        available: !!env.OPENAI_API_KEY,
        reason: env.OPENAI_API_KEY ? "" : "OPENAI_API_KEY is not set in the server's environment.",
      }),
      setModel: (model) => {
        choice.openai = model;
      },
    },
    {
      async describe() {
        const offered = await ollamaModels(localBase());
        if (!choice.local && offered[0]) choice.local = offered[0].id;
        return {
          id: "local",
          label: "Local model",
          provider: ModelProvider.LOCAL,
          description: `An OpenAI-compatible server on this machine at ${localBase()}, called from this server.`,
          model: choice.local,
          models: offered,
          available: offered.length > 0,
          reason: offered.length > 0 ? "" : `Nothing answers at ${localBase()}.`,
        };
      },
      setModel: (model) => {
        choice.local = model;
      },
    },
    ...(env.SURFACES_TEST_LOOM_CONFIG ? [testLoomBackend(env.SURFACES_TEST_LOOM_CONFIG)] : []),
  ],
});

// Sample sources for local development: `pnpm serve`, then `pnpm dev`.
/**
 * A Teradata system reached directly (a host, as teradatasql or ClearScape
 * use), added only when `SURFACES_TERADATA_HOST` is set. This repo never
 * installs a Teradata driver: install `teradatasql` somewhere outside it and
 * point `SURFACES_TERADATA_DRIVER` at that folder (default
 * ~/.cache/surfaces/teradata-driver). Put the host, user and password in the
 * git-ignored .env.local:
 *
 *   SURFACES_TERADATA_HOST=...           SURFACES_TERADATA_USER=...
 *   TERADATA_PASSWORD=...                SURFACES_TERADATA_DATABASE=... (optional)
 *   SURFACES_TERADATA_DATABASES=sales,finance   (optional)
 *
 * SURFACES_TERADATA_DATABASES names the databases the catalog, search and
 * agent context cover. Left out, they cover the default database and the
 * user's own. Tables elsewhere can still be browsed and queried by name.
 *
 * The user should hold SELECT rights only: Teradata has no read-only session.
 */
function teradataDatabases(): string[] {
  const named = (env.SURFACES_TERADATA_DATABASES ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  const fallback = [env.SURFACES_TERADATA_DATABASE ?? "", env.SURFACES_TERADATA_USER ?? ""].filter(Boolean);
  return [...new Set(named.length > 0 ? named : fallback)];
}

function teradataSources(): SourceConfig[] {
  const host = env.SURFACES_TERADATA_HOST;
  if (!host) return [];
  const driverDir = env.SURFACES_TERADATA_DRIVER ?? path.join(homedir(), ".cache", "surfaces", "teradata-driver");
  if (!existsSync(path.join(driverDir, "node_modules", "teradatasql"))) {
    console.warn(`Teradata: SURFACES_TERADATA_HOST is set but no teradatasql driver is installed in ${driverDir}. Run: npm install --prefix ${driverDir} teradatasql`);
    return [];
  }
  type Cursor = { executeAsync(sql: string, params?: unknown[]): Promise<unknown>; fetchall(): unknown; fetchmany(count: number): unknown; readonly description?: unknown; close(): unknown };
  type Connection = { cursor(): Cursor; closeAsync(): Promise<unknown> };
  const teradatasql = createRequire(path.join(driverDir, "package.json"))("teradatasql") as { connectAsync(params: Record<string, string>): Promise<Connection> };
  return [
    {
      id: "teradata",
      displayName: "Teradata",
      engine: "teradata",
      transport: "driver",
      address: host,
      database: env.SURFACES_TERADATA_DATABASE || undefined,
      databases: teradataDatabases(),
      async connect() {
        const connection = await teradatasql.connectAsync({
          host,
          user: env.SURFACES_TERADATA_USER ?? "",
          password: env.TERADATA_PASSWORD ?? "",
          encryptdata: "true",
          // Puts each column's type after a tab in its name, so results are typed.
          column_type: "true",
        });
        // The async calls keep the server answering while Teradata works.
        return {
          cursor() {
            const cursor = connection.cursor();
            return {
              execute: (sql: string, params?: unknown[]) => cursor.executeAsync(sql, params),
              fetchall: () => cursor.fetchall(),
              // The driver reads rows without yielding; in batches, the server keeps answering during a large result.
              fetchmany: (count: number) => cursor.fetchmany(count),
              get description() {
                return cursor.description;
              },
              close: () => cursor.close(),
            };
          },
          close: () => connection.closeAsync(),
        };
      },
    },
  ];
}

/**
 * An S3-compatible object store, when one is named: the retail sample read
 * from a bucket instead of from disk, to try tables, joins and the file
 * browser over object storage. `scripts/s3-sim.sh` starts a local stand-in
 * and uploads the files in the layout below.
 *
 *   SURFACES_S3_ENDPOINT=127.0.0.1:9100   host and port of the store (leave out for AWS itself)
 *   SURFACES_S3_BUCKET=acme-lake          default
 *   SURFACES_S3_SECRET_NAME=LAKE          optional: the server then reads LAKE_KEY_ID and LAKE_SECRET
 *                                         from its environment; without it the store is read anonymously
 */
function objectStoreSources(): SourceConfig[] {
  if (!env.SURFACES_S3_ENDPOINT && !env.SURFACES_S3_BUCKET) return [];
  const bucket = env.SURFACES_S3_BUCKET ?? "acme-lake";
  const scope = `s3://${bucket}/sales`;
  const local = env.SURFACES_S3_ENDPOINT;
  return [
    {
      id: "s3",
      displayName: "Object store (S3)",
      engine: "duckdb",
      connections: [
        {
          name: "lake",
          kind: "s3",
          scope,
          region: env.SURFACES_S3_REGION ?? "us-east-1",
          ...(env.SURFACES_S3_SECRET_NAME ? { secret: env.SURFACES_S3_SECRET_NAME } : {}),
          ...(local ? { endpoint: local, urlStyle: "path" as const, useSsl: false } : {}),
        },
      ],
      tables: [
        { name: "orders", format: "parquet", path: `${scope}/retail/orders.parquet`, comment: "Orders, read from the bucket" },
        { name: "order_items", format: "parquet", path: `${scope}/retail/order_items.parquet`, comment: "Order lines, read from the bucket" },
        { name: "stores", format: "parquet", path: `${scope}/retail/stores.parquet`, comment: "Stores, read from the bucket" },
        { name: "products", format: "parquet", path: `${scope}/retail/reference/products.parquet`, comment: "Products, read from the bucket" },
      ],
    },
  ];
}

/**
 * A dbt project, when one is named: its artifacts become a pipeline beside
 * the others, and the DuckDB database it builds into becomes the source
 * "dbt", attached read-only under the name dbt-duckdb gives it (the file's
 * name without .duckdb), so dbt's compiled queries read the same tables.
 *
 *   SURFACES_DBT_TARGET=path/to/project/target   where dbt writes its artifacts
 *   SURFACES_DBT_DATABASE=path/to/warehouse.duckdb  the database dbt-duckdb builds
 *   SURFACES_DBT_PROJECT=path/to/project          optional: lets a person start dbt build here
 *   SURFACES_DBT_COMMAND=path/to/dbt              optional: the dbt executable
 */
function dbtProjects(): { sources: SourceConfig[]; projects: NonNullable<Parameters<typeof defineConfig>[0]["dbt"]> } {
  if (!env.SURFACES_DBT_TARGET) return { sources: [], projects: [] };
  const database = env.SURFACES_DBT_DATABASE;
  const catalog = database ? path.basename(database).replace(/\.[^.]*$/, "") : "";
  return {
    sources: database ? [{ id: "dbt", displayName: "dbt warehouse", engine: "duckdb", tables: [], catalogs: [{ name: catalog, kind: "duckdb", uri: database }] }] : [],
    projects: [
      {
        sourceId: database ? "dbt" : "lake",
        targetDir: env.SURFACES_DBT_TARGET,
        ...(database ? { relationPrefix: catalog } : {}),
        ...(env.SURFACES_DBT_PROJECT ? { build: { projectDir: env.SURFACES_DBT_PROJECT, profilesDir: env.SURFACES_DBT_PROJECT, ...(env.SURFACES_DBT_COMMAND ? { command: env.SURFACES_DBT_COMMAND } : {}) } } : {}),
      },
    ],
  };
}
const dbt = dbtProjects();

export default defineConfig({
  agent: switchingAgent,
  models,
  // The six sample industry models (retail, healthcare, fraud, telco, transportation, manufacturing) beside the lake.
  seeds: true,
  // Semantic search runs a small model on this machine. It downloads once
  // (about 25 MB) to ~/.cache/surfaces/models, outside the repo.
  // Data values stay withheld: no source is listed in allowSampleValues.
  // Counting every Teradata table's rows to build the search index would read each one.
  discovery: { embedder: "local", skipRowCounts: ["teradata"] },
  // A small pipeline over the sample orders: raw, cleaned, then two summaries.
  // The SQL runs only on the server; the UI can start a run but cannot change it.
  pipelines: [
    {
      id: "sales",
      name: "Sales",
      description: "Cleans the sample orders and summarises revenue.",
      sourceId: "lake",
      datasets: [
        { name: "orders_raw", layer: "bronze", description: "Orders as they arrive.", sql: "SELECT * FROM orders" },
        {
          name: "orders_clean",
          layer: "silver",
          description: "Orders with a status and a positive amount.",
          sql: "SELECT * FROM orders_raw",
          expectations: [
            { name: "has_status", constraint: "status IS NOT NULL", action: "drop" },
            { name: "positive_amount", constraint: "amount > 0", action: "drop" },
            { name: "known_region", constraint: "region IN ('North America', 'Europe', 'Asia Pacific', 'Latin America')", action: "warn" },
          ],
        },
        {
          name: "daily_revenue",
          layer: "gold",
          description: "Revenue and order count per day.",
          sql: "SELECT CAST(ordered_at AS DATE) AS day, SUM(amount) AS revenue, COUNT(*) AS orders FROM orders_clean GROUP BY 1",
          expectations: [{ name: "has_revenue", constraint: "revenue > 0", action: "fail" }],
        },
        {
          name: "revenue_by_region",
          kind: "view",
          layer: "gold",
          description: "Revenue per region and status.",
          sql: "SELECT region, status, SUM(amount) AS revenue FROM orders_clean GROUP BY region, status",
        },
      ],
    },
  ],
  sources: [
    {
      id: "lake",
      displayName: "Sample lake",
      engine: "duckdb",
      tables: [
        { name: "orders", format: "parquet", path: "fixtures/lake/orders.parquet", comment: "5,000 sample orders" },
        { name: "delta_orders", format: "delta", path: "fixtures/lake/delta_orders", comment: "Delta table, 3 versions" },
        { name: "iceberg_orders", format: "iceberg", path: "fixtures/lake/iceberg_orders", comment: "Iceberg table, 3 snapshots" },
      ],
    },
    ...teradataSources(),
    ...objectStoreSources(),
    ...dbt.sources,
  ],
  dbt: dbt.projects,
});
