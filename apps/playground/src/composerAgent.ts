type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
import type { DataRef } from "@surfaces-ui/components";
import { ObjectKind } from "@surfaces-ui/proto";
import { type AgentBackend, type SendInit, dataTools } from "@surfaces-ui/agent";
import { loomAgent } from "@surfaces-ui/agent-loom";
import { openAiCompatibleAgent } from "@surfaces-ui/agent-openai";
import { connectAgent, connectModelSettings } from "@surfaces-ui/client-connect";
import type { DataSource, Semantics } from "@surfaces-ui/data";
import { A2UI_VERSION, type SurfaceAction, type SurfaceComponent, type SurfaceMessage, analyticsCatalog, surfaceAgentPrompt } from "@surfaces-ui/spec";
import { demoPageAgent } from "./demoPageAgent.js";
import type { DataFocus } from "./focus.js";

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
/** A local Loom server for development, never the personal one. */
export const LOOM_URL = env.VITE_LOOM_URL ?? "http://127.0.0.1:5028";
/** Local OpenAI-compatible servers (Ollama) to look for, in order. */
export const LOCAL_MODEL_URLS = PUBLISHED ? [] : [env.VITE_LOCAL_MODEL_URL, "http://127.0.0.1:11534", "http://127.0.0.1:11434"].filter((u): u is string => !!u);
export { SERVER as SERVER_URL } from "./source.js";
import { PUBLISHED, SERVER as SERVER_URL } from "./source.js";

export type AgentKind = "scripted" | "server" | "local" | "loom";

/** One agent the composer can talk to. */
export interface AgentOption {
  /** Stable key for the picker. */
  id: string;
  kind: AgentKind;
  label: string;
  /** One line on where it runs and what it is. */
  detail: string;
  /** Loom: which of its agents. */
  agentId?: string;
  /** Local model server: its address and model. */
  baseUrl?: string;
  model?: string;
  /** The dev server: the models its backend can run, and the backend's name. */
  models?: { id: string; label: string }[];
  provider?: string;
}

export const SCRIPTED: AgentOption = { id: "scripted", kind: "scripted", label: "Scripted demo", detail: "A fixed script that matches a few phrasings. Not a model." };

/**
 * The agents within reach of this page: the scripted demo always; the dev
 * server's agent when the server is running (Claude, OpenAI or a local model,
 * chosen by its environment, so no key is in this page); models on a local
 * Ollama; and agents on a local Loom. Each is probed with a short timeout and
 * left out if it does not answer. Nothing is sent to an agent until a person
 * picks it and writes.
 */
/** What the dev server says each of its backends runs (from `ModelService`), for naming agents by their model. */
export interface BackendModel {
  id: string;
  label: string;
  model: string;
  models: { id: string; label: string }[];
  active: boolean;
  available: boolean;
}

const modelName = (b: BackendModel) => b.models.find((m) => m.id === b.model)?.label || b.model;

export async function findAgents(options: { serverUp: boolean; fetch?: typeof fetch; backends?: () => Promise<BackendModel[]> }): Promise<AgentOption[]> {
  const get = options.fetch ?? fetch;
  const json = async (url: string) => {
    const response = await get(url, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as unknown;
  };
  const found: AgentOption[] = [SCRIPTED];
  // The dev server says which backend answers its turns and on which model; an older server without ModelService says nothing.
  const listBackends = options.backends ?? (async () => (await connectModelSettings({ baseUrl: SERVER_URL }).listModelBackends({}, { signal: AbortSignal.timeout(1500) })).backends);
  const backends: BackendModel[] = options.serverUp ? await listBackends().catch(() => []) : [];
  const active = backends.find((b) => b.active);
  const loomBackend = backends.find((b) => b.id === "loom-test");
  if (options.serverUp)
    found.push({
      id: "server",
      kind: "server",
      label: active ? `Dev server: ${modelName(active)}${active.available ? "" : " (cannot run)"}` : "Dev server agent",
      detail: active
        ? `${active.label} on the dev server, model ${active.model}. The key stays on the server; pick another in the Model menu.`
        : "Runs on the dev server: Claude, OpenAI or a local model, as its environment sets. The key stays on the server.",
      ...(active ? { model: active.model, models: active.models.length > 0 ? active.models : [{ id: active.model, label: modelName(active) }], provider: active.label } : {}),
    });
  const [locals, loom] = await Promise.all([
    Promise.all(
      LOCAL_MODEL_URLS.map(async (baseUrl) => {
        try {
          const body = (await json(`${baseUrl}/api/tags`)) as { models?: { name: string }[] };
          // Embedding models cannot answer; leave them out.
          return (body.models ?? []).filter((m) => !/embed/i.test(m.name)).map((m) => ({ baseUrl, model: m.name }));
        } catch {
          return [];
        }
      }),
    ),
    // A published copy offers the scripted demo only: it never calls the visitor's own machine.
    (PUBLISHED ? Promise.reject(new Error("published")) : json(`${LOOM_URL}/v1/agents`)).then(
      (body) => ((body as { agents?: { name: string; metadata?: { description?: string } }[] }).agents ?? []),
      () => [],
    ),
  ]);
  for (const { baseUrl, model } of locals.flat())
    found.push({ id: `local:${baseUrl}:${model}`, kind: "local", label: `${model} (local)`, detail: `A model on this machine at ${baseUrl}, called from this page.`, baseUrl, model });
  for (const agent of loom)
    found.push({
      id: `loom:${agent.name}`,
      kind: "loom",
      label: `Loom: ${agent.name}${loomBackend?.model ? ` (${modelName(loomBackend)})` : ""}`,
      detail: agent.metadata?.description || `A Loom agent at ${LOOM_URL}.`,
      agentId: agent.name,
      ...(loomBackend?.model ? { model: loomBackend.model } : {}),
    });
  return found;
}

/**
 * The backend for a picked agent. Only the scripted demo and a local model
 * run in this page; the rest are reached over HTTP. `scripted` replaces the
 * page-editing script where a page has its own (the chat). A Loom agent is
 * named on every turn, so a host that does not pass `agentId` still reaches it.
 */
export function agentFor(option: AgentOption, dataSource: DataSource, focus: DataFocus, scripted?: () => AgentBackend, semantics?: Semantics, model?: string): AgentBackend {
  switch (option.kind) {
    case "server": {
      const server = connectAgent({ baseUrl: SERVER_URL }) as AgentBackend;
      // A model picked in the Model menu goes with every turn; a turn that names its own keeps it.
      if (!model || model === option.model) return server;
      return { ...server, send: (request, options) => server.send({ ...request, model: request.model || model }, options) };
    }
    case "local":
      return openAiCompatibleAgent({
        baseUrl: `${option.baseUrl}/v1`,
        model: option.model ?? "",
        generatedBy: `${option.model} (local)`,
        maxTokens: 4000,
        system: surfaceAgentPrompt(analyticsCatalog, { dialect: "the dialect list_tables reports for that source (DuckDB for the sample data)", dataTools: true, semanticModels: !!semantics }),
        tools: dataTools(dataSource, { sourceIds: [focus.sourceId], semantics }),
        checkSurface: (message) => analyticsCatalog.validateMessage(message),
      });
    case "loom":
      return withGuide(loomAgent({ baseUrl: LOOM_URL }), option.agentId ?? "");
    default:
      return scripted ? scripted() : demoPageAgent(dataSource, focus);
  }
}

/** How to draw, and every component the catalog holds, for an agent that has no system prompt of ours. */
export const loomGuide = () => surfaceAgentPrompt(analyticsCatalog, { dialect: "DuckDB", draw: "fence" });

/**
 * A text-only agent (a Loom agent) has no system prompt of ours, so it knows
 * only the components it is shown. The first text turn of each conversation
 * (no session yet) starts with the drawing guide and the whole catalog, so
 * every page that uses it, not only the Playground, can ask for any
 * component. Later turns of that conversation carry it already.
 */
export function withGuide(agent: AgentBackend, agentId: string, guide: () => string = loomGuide): AgentBackend {
  return {
    ...agent,
    send: (request, options) => {
      const named = { ...request, agentId: request.agentId || agentId };
      if (request.sessionId || request.input?.case !== "text") return agent.send(named, options);
      return agent.send({ ...named, input: { case: "text", value: `${guide()}\n\n${request.input.value}` } }, options);
    },
  };
}

/** A short outline of a source's tables, by names and types only, for the agent. Values are never read. */
export async function datasetOutline(dataSource: DataSource, sourceId: string, maxTables = 12): Promise<string> {
  const { tables } = await dataSource.listTables({ sourceId });
  const lines = await Promise.all(
    tables.slice(0, maxTables).map(async (t) => {
      const name = t.ref?.table ?? "";
      const detail = await dataSource.describeTable({ sourceId, ref: { table: name } }).catch(() => undefined);
      const columns = detail?.table?.columns.map((c) => `${c.name} ${c.nativeType}`).join(", ") ?? "";
      return `- ${name}(${columns})${t.comment ? `: ${t.comment}` : ""}`;
    }),
  );
  return [`Source "${sourceId}" (DuckDB SQL). Tables:`, ...lines, ...(tables.length > maxTables ? [`…and ${tables.length - maxTables} more.`] : [])].join("\n");
}

/**
 * What one instruction sends: the dataset, the instruction, and the surface
 * as it stands. The components are the last line, and the instruction and
 * surface id are in the shape `PageStudio` uses, so the scripted agent reads
 * them too. A text-only agent (Loom) gets the drawing guide on the first turn
 * of its conversation.
 */
export function composerPrompt(input: { instruction: string; surfaceId: string; components: SurfaceComponent[]; outline?: string; guide?: string }): string {
  const exists = input.components.length > 0;
  return [
    ...(input.guide ? [input.guide, ""] : []),
    ...(input.outline ? [input.outline, ""] : []),
    `Instruction: ${input.instruction.replace(/\s+/g, " ").trim()}`,
    "",
    exists
      ? `Change the page "${input.surfaceId}" by sending A2UI updateComponents messages for surfaceId "${input.surfaceId}".`
      : `Change the page "${input.surfaceId}": it does not exist yet, so start with createSurface for surfaceId "${input.surfaceId}" and catalogId "${analyticsCatalog.id}", then send its components with a "root".`,
    "Send only the components you add or change. To remove one, send its container without it in children.",
    "Say in one sentence what you changed.",
    "",
    "Current components:",
    JSON.stringify(input.components),
  ].join("\n");
}

/**
 * Messages from the agent, ready to add to the composer's list: each gets
 * the version, and a createSurface for a surface that already exists is left
 * out (models often start again), with a note saying so.
 */
export function mergeAgentMessages(existing: Set<string>, incoming: unknown[]): { messages: SurfaceMessage[]; notes: string[] } {
  const known = new Set(existing);
  const messages: SurfaceMessage[] = [];
  const notes: string[] = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== "object") continue;
    const message = { version: A2UI_VERSION, ...(raw as object) } as SurfaceMessage & { createSurface?: { surfaceId?: string } };
    const created = message.createSurface?.surfaceId;
    if (typeof created === "string") {
      if (known.has(created)) {
        notes.push(`Left out a createSurface for "${created}", which already exists.`);
        continue;
      }
      known.add(created);
    }
    messages.push(message);
  }
  return { messages, notes };
}

/** What happened in one agent turn, for the transcript and the history. */
export interface TurnResult {
  text: string;
  generatedBy: string;
  sessionId: string;
  messages: SurfaceMessage[];
  notes: string[];
  error?: string;
}

/** Plain JSON for the wire: anything that is not JSON (a bigint) becomes text. */
export const asJson = (value: unknown): JsonObject => {
  const plain = JSON.parse(JSON.stringify(value ?? {}, (_, v) => (typeof v === "bigint" ? String(v) : v))) as unknown;
  return plain && typeof plain === "object" && !Array.isArray(plain) ? (plain as JsonObject) : {};
};

/**
 * Runs one turn: an instruction (text) or an event from the surface. The
 * agent's text is streamed to `onText`; the A2UI messages it sends are
 * collected and returned, merged against the surfaces that exist.
 */
export async function runTurn(
  agent: AgentBackend,
  request: {
    sessionId: string;
    agentId?: string;
    input: { case: "text"; value: string } | { case: "action"; value: SurfaceAction };
    surfaces: { surfaceId: string; dataModel: unknown; controls: Record<string, unknown>; activity?: { componentId: string; kind: string; summary: string; subject?: Record<string, unknown>; at: string }[] }[];
    existing: Set<string>;
    /** Tables and columns the person attached to the instruction. */
    references?: DataRef[];
  },
  options: { signal?: AbortSignal; onText?(text: string): void; /** Told each surface message as it arrives, exactly as the agent sent it. */ onSurface?(raw: unknown): void } = {},
): Promise<TurnResult> {
  const result: TurnResult = { text: "", generatedBy: "", sessionId: request.sessionId, messages: [], notes: [] };
  const drawn: unknown[] = [];
  const input: SendInit["input"] =
    request.input.case === "text"
      ? request.input
      : {
          case: "action",
          value: {
            name: request.input.value.name,
            surfaceId: request.input.value.surfaceId,
            sourceComponentId: request.input.value.sourceComponentId,
            timestamp: request.input.value.timestamp,
            context: asJson(request.input.value.context),
            ...(request.input.value.dataModel !== undefined ? { dataModel: asJson(request.input.value.dataModel) } : {}),
          },
        };
  try {
    for await (const event of agent.send(
      {
        sessionId: request.sessionId,
        ...(request.agentId ? { agentId: request.agentId } : {}),
        input,
        surfaces: request.surfaces.map((s) => ({ surfaceId: s.surfaceId, dataModel: asJson(s.dataModel), controls: Object.fromEntries(Object.entries(s.controls).map(([id, c]) => [id, asJson(c)])), activity: (s.activity ?? []).map((a) => ({ componentId: a.componentId, kind: a.kind, summary: a.summary, at: a.at, ...(a.subject ? { subject: asJson(a.subject) } : {}) })) })),
        references: (request.references ?? []).map((ref) => ({ sourceId: ref.sourceId, kind: ref.kind === "file" ? ObjectKind.FILE : ref.column ? ObjectKind.COLUMN : ObjectKind.TABLE, catalog: ref.catalog ?? "", schema: ref.schema ?? "", table: ref.table, column: ref.column ?? "", path: ref.path ?? "" })),
      },
      { signal: options.signal },
    )) {
      const part = event.event;
      if (part.case === "text") {
        result.text += part.value.delta;
        options.onText?.(result.text);
      } else if (part.case === "surface") {
        drawn.push(part.value);
        options.onSurface?.(part.value);
      }
      else if (part.case === "error") result.error = part.value.message;
      else if (part.case === "approval") result.notes.push("The agent asked for an approval. The Playground does not answer approvals; use the Chat page for that.");
      else if (part.case === "done") {
        result.generatedBy = part.value.generatedBy;
        result.sessionId = part.value.sessionId || result.sessionId;
      }
    }
  } catch (error) {
    if (options.signal?.aborted) result.error = "Stopped.";
    else result.error = error instanceof Error ? error.message : String(error);
  }
  const merged = mergeAgentMessages(request.existing, drawn);
  result.messages = merged.messages;
  result.notes.push(...merged.notes);
  result.text = result.text.trim();
  return result;
}
