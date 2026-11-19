import { type JsonObject, create } from "@bufbuild/protobuf";
import { type AgentBackend, type AgentEvent, type DescribesAgents, agentEvent, errorEvent, extractSurfaces, turnText } from "@surfaces-ui/agent";
import { AgentInfoSchema, ApprovalKind, DescribeAgentsResponseSchema, StepStatus } from "@surfaces-ui/proto";

/**
 * One event from Loom's `POST /v1/weave:stream`, as its HTTP gateway writes
 * it: the `WeaveProgress` message in JSON with snake_case names and numeric
 * enums. Only the fields this adapter reads are listed. Nothing from Loom is
 * vendored; this describes its public wire format.
 */
export interface LoomProgress {
  /** 7 is completed, 8 is failed. An error frame carries the text "EXECUTION_STAGE_FAILED". */
  stage?: number | string;
  message?: string;
  /** Set on a frame the gateway writes when the call itself fails. */
  error?: string;
  /** The reply so far (accumulated, not a delta) while `is_token_stream` is set. */
  partial_content?: string;
  is_token_stream?: boolean;
  tool_name?: string;
  tool_call_id?: string;
  is_tool_started?: boolean;
  is_tool_completed?: boolean;
  tool_input?: Record<string, unknown>;
  tool_error?: string;
  tool_success?: boolean;
  tool_duration_ms?: number | string;
  hitl_request?: {
    request_id?: string;
    question_id?: string;
    question?: string;
    request_type?: string;
    kind?: string;
    summary?: string;
    options?: string[];
    params_json?: string;
  };
  cost?: { total_cost_usd?: number; llm_cost?: { input_tokens?: number; output_tokens?: number; model?: string } };
  context_state?: { context_tokens_used?: number | string; context_tokens_max?: number | string };
}

const COMPLETED = 7;
const FAILED = 8;
/** Tools whose input is a list of A2UI messages to draw, not something to show as a step. */
const SURFACE_TOOLS = new Set(["render_surface"]);

export interface LoomTurnState {
  /** Reply text already passed on, to turn Loom's accumulated text into deltas. */
  text: string;
  model: string;
  /** Maps a Loom question to the tool step numbering, so repeated frames are not repeated here. */
  asked: Set<string>;
  steps: number;
}

export const newLoomTurn = (): LoomTurnState => ({ text: "", model: "", asked: new Set(), steps: 0 });

const words = (tool: string) => tool.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const clip = (text: string, max = 4000) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * Turns one Loom progress event into the events a chat shows. Pure: the
 * turn's running state is passed in and updated, so a recorded stream can be
 * replayed in tests.
 */
export function mapLoomProgress(frame: LoomProgress, state: LoomTurnState, sessionId: string): AgentEvent[] {
  const out: AgentEvent[] = [];
  if (frame.error) return [agentEvent.error("FAILED", frame.error)];

  if (typeof frame.partial_content === "string" && frame.partial_content !== "" && (frame.is_token_stream || frame.stage === COMPLETED)) {
    const all = frame.partial_content;
    // Loom sends the whole reply so far each time; only what is new is passed on.
    const delta = all.startsWith(state.text) ? all.slice(state.text.length) : all;
    if (delta) out.push(agentEvent.text(delta));
    state.text = all;
  }

  const tool = frame.tool_name ?? "";
  const stepId = frame.tool_call_id || (tool ? `${tool}#${state.steps}` : "");
  if (frame.is_tool_started && tool) {
    const messages = SURFACE_TOOLS.has(tool) ? frame.tool_input?.messages : undefined;
    if (Array.isArray(messages)) {
      for (const message of messages) if (message && typeof message === "object") out.push(agentEvent.surface(message as JsonObject));
    } else {
      const sql = typeof frame.tool_input?.sql === "string" ? frame.tool_input.sql : undefined;
      out.push(agentEvent.step({ id: stepId, title: words(tool), status: StepStatus.RUNNING, tool, detail: clip(sql ?? (frame.tool_input ? JSON.stringify(frame.tool_input, null, 2) : "")) }));
    }
  }
  if (frame.is_tool_completed && tool && !SURFACE_TOOLS.has(tool)) {
    const failed = Boolean(frame.tool_error) || frame.tool_success === false;
    out.push(
      agentEvent.step({
        id: stepId,
        title: words(tool),
        status: failed ? StepStatus.FAILED : StepStatus.DONE,
        tool,
        detail: frame.tool_error ? clip(frame.tool_error) : "",
        durationMs: BigInt(Math.max(0, Math.round(Number(frame.tool_duration_ms ?? 0)))),
      }),
    );
    if (!frame.tool_call_id) state.steps++;
  }

  const ask = frame.hitl_request;
  // An empty request_id is only a hint that a question is coming; the one that can be answered follows.
  const askId = ask?.question_id || ask?.request_id || "";
  if (ask && ask.request_id && !state.asked.has(askId)) {
    state.asked.add(askId);
    const options = ask.options ?? [];
    const kind = options.length > 0 ? ApprovalKind.CHOICE : /approv|permission|confirm/i.test(`${ask.request_type ?? ""} ${ask.kind ?? ""}`) ? ApprovalKind.PERMISSION : ApprovalKind.INPUT;
    let sql = "";
    try {
      const params = ask.params_json ? (JSON.parse(ask.params_json) as Record<string, unknown>) : {};
      if (typeof params.sql === "string") sql = params.sql;
    } catch {
      // Parameters are optional context; a question without them is still a question.
    }
    out.push(agentEvent.approval({ id: askId, kind, title: ask.question ?? "The agent has a question.", detail: ask.summary ?? "", sql, options }));
  }

  if (frame.cost?.llm_cost?.model) state.model = frame.cost.llm_cost.model;
  if (frame.cost || frame.context_state) {
    out.push(
      agentEvent.usage({
        inputTokens: BigInt(frame.cost?.llm_cost?.input_tokens ?? 0),
        outputTokens: BigInt(frame.cost?.llm_cost?.output_tokens ?? 0),
        contextTokens: BigInt(Number(frame.context_state?.context_tokens_used ?? 0)),
        contextLimit: BigInt(Number(frame.context_state?.context_tokens_max ?? 0)),
        costUsd: frame.cost?.total_cost_usd,
      }),
    );
  }

  if (frame.stage === FAILED || frame.stage === "EXECUTION_STAGE_FAILED") out.push(agentEvent.error("FAILED", frame.message || "The agent could not finish."));
  if (frame.stage === COMPLETED) out.push(agentEvent.done(sessionId, state.model ? `Loom · ${state.model}` : "Loom"));
  return out;
}

/** Reads `data:` lines from a server-sent event stream as JSON. Comment lines (heartbeats) are skipped. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<LoomProgress> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          yield JSON.parse(payload) as LoomProgress;
        } catch {
          // A frame that is not JSON is skipped; the stream carries on.
        }
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export interface LoomAgentOptions {
  /** Where the Loom server's HTTP gateway is, e.g. http://localhost:5006. */
  baseUrl: string;
  /** Supplies a bearer token per request. The token is the host's to manage; it is never stored here. */
  token?(): string | Promise<string>;
  /** Extra headers, e.g. for a proxy. */
  headers?: Record<string, string>;
  /** Uses this instead of the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * A Loom model as a chat names it: `provider/model` (`anthropic/claude-opus-5-5`,
 * `ollama/qwen3:8b`), since Loom switches a session by both. The provider
 * part never holds a slash.
 */
export const loomModelId = (provider: string, model: string) => (provider ? `${provider}/${model}` : model);
export function splitLoomModel(id: string): { provider: string; model: string } {
  const at = id.indexOf("/");
  return at < 0 ? { provider: "", model: id } : { provider: id.slice(0, at), model: id.slice(at + 1) };
}

interface OpenTurn {
  frames: AsyncGenerator<LoomProgress>;
  state: LoomTurnState;
  stop(): void;
}

/**
 * An AgentBackend that talks to a Loom server. Loom stays a separate
 * program: this adapter only calls its HTTP gateway, so nothing from Loom is
 * built into or shipped with this library.
 *
 * - A turn is `POST /v1/weave:stream`; replies, tool calls, questions and
 *   usage are mapped to chat events.
 * - When Loom asks the person something, the turn pauses. Answering posts to
 *   `/v1/clarifications/{session}/answer` and carries on reading the same
 *   stream.
 * - A Loom agent draws UI by calling a `render_surface` tool (as the
 *   Surfaces MCP server provides) or by writing an `a2ui` fenced block.
 */
export function loomAgent(options: LoomAgentOptions): AgentBackend & DescribesAgents {
  const call = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");
  const open = new Map<string, OpenTurn>();
  // The model each session was last switched to here, so a turn switches only when the choice changed.
  const switched = new Map<string, string>();

  const headers = async (accept: string) => {
    const token = await options.token?.();
    return {
      "Content-Type": "application/json",
      Accept: accept,
      // Marks the turn as started by a person, so Loom does not treat a retry as a duplicate background run.
      "X-Loom-Slot-Origin": "interactive",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
  };

  const createSession = async (agentId: string, signal?: AbortSignal): Promise<string> => {
    try {
      const response = await call(`${base}/v1/sessions`, { method: "POST", headers: await headers("application/json"), body: JSON.stringify({ agent_id: agentId }), signal });
      if (response.ok) {
        const session = (await response.json()) as { id?: string };
        if (session.id) return session.id;
      }
    } catch {
      // Fall through: Loom also accepts an ID chosen by the client.
    }
    return crypto.randomUUID();
  };

  async function* pump(turn: OpenTurn, sessionId: string): AsyncGenerator<AgentEvent> {
    for (;;) {
      const next = await turn.frames.next();
      if (next.done) {
        open.delete(sessionId);
        // The stream ended without a completed stage: still tell the chat the turn is over.
        yield agentEvent.done(sessionId, turn.state.model ? `Loom · ${turn.state.model}` : "Loom");
        return;
      }
      const events = mapLoomProgress(next.value, turn.state, sessionId);
      yield* events;
      const last = events.at(-1)?.event.case;
      if (last === "done" || last === "error") {
        open.delete(sessionId);
        // The reply is complete: close the reader. Aborting a finished request would raise in callers that share its body.
        await turn.frames.return(undefined);
        return;
      }
      // The agent is waiting for an answer: this turn pauses with the stream left open.
      if (events.some((e) => e.event.case === "approval")) return;
    }
  }

  const getJson = async (path: string) => {
    const response = await call(`${base}${path}`, { headers: await headers("application/json") });
    if (!response.ok) throw new Error(`Loom answered ${response.status} for ${path}.`);
    return (await response.json()) as unknown;
  };

  return {
    /**
     * Loom's agents, each offering the models Loom can run (`GET /v1/agents`,
     * `GET /v1/models`). A server that does not list models offers none, and a
     * turn then runs on the agent's own.
     */
    async describeAgents() {
      const [agents, models] = await Promise.all([
        getJson("/v1/agents").then((body) => (body as { agents?: { id?: string; name?: string; metadata?: { description?: string } }[] }).agents ?? []),
        getJson("/v1/models").then(
          (body) => (body as { models?: { id?: string; name?: string; provider?: string }[] }).models ?? [],
          () => [],
        ),
      ]);
      const options = models.filter((m) => m.id).map((m) => ({ id: loomModelId(m.provider ?? "", m.id!), label: m.name || m.id!, description: m.provider ?? "" }));
      return create(DescribeAgentsResponseSchema, {
        agents: agents.map((a, i) =>
          create(AgentInfoSchema, { id: a.name || a.id || "", name: a.name || a.id || "", description: a.metadata?.description ?? "", isDefault: i === 0, models: options }),
        ),
      });
    },
    async *send(request, callOptions) {
      const signal = callOptions?.signal;
      try {
        const input = request.input;
        const sessionId = request.sessionId || (await createSession(request.agentId ?? "", signal));
        const waiting = open.get(sessionId);

        if (input?.case === "approval" && waiting) {
          const answer = input.value.answer || (input.value.allow ? "approved" : "denied");
          const response = await call(`${base}/v1/clarifications/${encodeURIComponent(sessionId)}/answer`, {
            method: "POST",
            headers: await headers("application/json"),
            body: JSON.stringify({ session_id: sessionId, question_id: input.value.id, answer, agent_id: request.agentId ?? "" }),
            signal,
          });
          if (!response.ok) throw new Error(`Loom did not accept the answer (${response.status}).`);
          signal?.addEventListener("abort", () => (open.delete(sessionId), waiting.stop()), { once: true });
          yield* extractSurfaces(pump(waiting, sessionId));
          return;
        }
        // Anything else starts a new turn; a paused one is dropped.
        if (waiting) {
          open.delete(sessionId);
          waiting.stop();
        }

        // A model the person picked: Loom switches the session to it, keeping the conversation, before this turn.
        const model = request.model ?? "";
        if (model && switched.get(sessionId) !== model) {
          const { provider, model: name } = splitLoomModel(model);
          const switching = await call(`${base}/v1/sessions/${encodeURIComponent(sessionId)}:switch-model`, {
            method: "POST",
            headers: await headers("application/json"),
            body: JSON.stringify({ session_id: sessionId, agent_id: request.agentId ?? "", provider, model: name, preserve_context: true }),
            signal,
          });
          if (!switching.ok) throw new Error(`Loom could not switch to ${model} (${switching.status}).`);
          switched.set(sessionId, model);
        }

        // The event, the page's state, the agent's own contracts and any problems, as text Loom passes to the model.
        const query = turnText(request);
        const controller = new AbortController();
        signal?.addEventListener("abort", () => controller.abort(), { once: true });
        const response = await call(`${base}/v1/weave:stream`, {
          method: "POST",
          headers: await headers("text/event-stream"),
          body: JSON.stringify({
            query,
            session_id: sessionId,
            agent_id: request.agentId ?? "",
            context: request.contextPackId ? { context_pack_id: request.contextPackId } : undefined,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Loom answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
        const turn: OpenTurn = { frames: readSse(response.body), state: newLoomTurn(), stop: () => controller.abort() };
        open.set(sessionId, turn);
        yield* extractSurfaces(pump(turn, sessionId));
      } catch (error) {
        yield signal?.aborted ? agentEvent.error("CANCELLED", "Stopped.") : errorEvent(error);
      }
    },
  };
}
