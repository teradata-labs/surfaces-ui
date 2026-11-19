import { type JsonObject, type MessageInitShape, create } from "@bufbuild/protobuf";
import { ApprovalAnswerSchema, ApprovalKind, ApprovalRecordSchema, type ApprovalRequest, ApprovalRequestSchema, StepStatus } from "@surfaces-ui/proto";
import { type CheckApprovalOptions, checkApproval, withDigest } from "./approvals.js";
import { type AgentBackend, type AgentEvent, type SendInit, agentEvent, errorEvent } from "./backend.js";
import { type AgentOffer, type DescribesAgents, agentInfo, resolveChoices, systemWith, toolsFor } from "./choices.js";
import { turnText } from "./turn.js";
import { DescribeAgentsResponseSchema } from "@surfaces-ui/proto";

/** A message in the neutral shape most chat-completion APIs map onto directly. */
export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** On an assistant message: the tools it called. */
  toolCalls?: ToolCall[];
  /** On a tool message: the call it answers. */
  toolCallId?: string;
  /** On a tool message: the tool failed or its input was refused. */
  isError?: boolean;
  /**
   * On an assistant message: the provider's own content for this turn, as
   * `complete` returned it in its `done` chunk. An adapter sends it back
   * unchanged on later calls, which some models require (reasoning blocks
   * tied to the conversation). Other adapters ignore it.
   */
  raw?: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

/** A tool as models are told about it: a name, what it is for, and JSON Schema for its input. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** What a person allowed, handed to a tool that asked first. */
export interface ApprovedRun {
  /** The SQL to run: the person's edited version when they edited it. */
  sql: string;
  /** The subject as allowed, edited or not. */
  subject: JsonObject;
  edited: boolean;
  /** Everyone who allowed it, in order. */
  approvals: { decidedBy?: { id: string; name: string }; decidedAt: string; reason: string }[];
}

/** What to show a person before a tool runs: the `ApprovalRequest` fields other than `id` and `digest`, which the agent fills in. */
export type ApprovalAsk = Omit<MessageInitShape<typeof ApprovalRequestSchema>, "id" | "digest" | "approvals" | "$typeName">;

/** A tool the adapter runs itself when the model calls it. */
export interface RunnableTool extends ToolDefinition {
  /** `approved` is set when the tool asked first (`approval`) and enough people allowed it; run what it says, not the model's input. */
  run(input: unknown, signal?: AbortSignal, approved?: ApprovedRun): Promise<unknown>;
  /**
   * Ask a person before running. Return what to show (title, the SQL, a
   * subject, risk, whether it may be edited, how many people must allow it)
   * or undefined to run without asking. The turn pauses on an `approval`
   * event; the person's answer is checked with `checkApproval` (digest,
   * expiry, edits, reason, who may decide) before anything runs. A refusal
   * or a failed check goes back to the model as the tool's result.
   */
  approval?(input: unknown): ApprovalAsk | undefined | Promise<ApprovalAsk | undefined>;
}

/** What a model call streams back. */
export type ModelChunk =
  | { type: "text"; delta: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  /** The call ended; `raw` is the provider's own content, kept with the assistant message. */
  | { type: "done"; model?: string; raw?: unknown }
  /** The model declined or the output was cut off: the turn stops here and no tools run. */
  | { type: "error"; code: string; message: string; raw?: unknown };

export interface ToolCallingAgentOptions {
  /**
   * One call to the model. The host writes this for its provider (OpenAI,
   * Anthropic, a local model): map `messages` and `tools` onto its request
   * and its stream onto chunks. This package never calls a model itself.
   */
  complete(request: { messages: ModelMessage[]; tools: ToolDefinition[]; signal?: AbortSignal; model?: string }): AsyncIterable<ModelChunk>;
  /** The system prompt; include the catalog's (`catalogPrompt` from `@surfaces-ui/spec`). */
  system: string;
  /** JSON Schema for one A2UI message, to describe `render_surface`'s input. Defaults to any object. */
  surfaceMessageSchema?: Record<string, unknown>;
  /** Other tools the model may call, such as listing tables. They run here; their results go back to the model. */
  tools?: RunnableTool[];
  /**
   * Checks each A2UI message before it is drawn, such as
   * `(m) => analyticsCatalog.validateMessage(m)`. Messages with problems are
   * not drawn; the problems go back to the model as the tool's result, so it
   * corrects them in the same turn. Without it, the client still checks
   * every message and reports problems on the next turn.
   */
  checkSurface?(message: unknown): { path: string; message: string }[];
  /** Model calls per turn before the turn is stopped. Default 8. */
  maxSteps?: number;
  /** Who may answer a tool's approval, checked on this side (`decided_by` comes from the client). Default: anyone. */
  mayDecide?: CheckApprovalOptions["mayDecide"];
  /** Shown as "Answered by …" when the model does not name itself. */
  generatedBy?: string;
  newSessionId?(): string;
  /**
   * What a person may choose in a chat: models a turn may name (passed to
   * `complete` as `model`), skills added to the system prompt while on, and
   * connectors that gate tools. Reported by `describeAgents`; a turn naming
   * anything not offered is refused.
   */
  offer?: AgentOffer;
}

export const RENDER_SURFACE = "render_surface";

/**
 * An AgentBackend over any model that can call tools. The model draws by
 * calling `render_surface` with A2UI messages; each becomes a `surface`
 * event, so the client validates and draws it as it would for any agent.
 * What a person then does (an event, typed values, control changes, the
 * agent's own contract, problems) reaches the model as the next user
 * message (`turnText`). History is kept per session in memory.
 */
export function toolCallingAgent(options: ToolCallingAgentOptions): AgentBackend & DescribesAgents {
  const sessions = new Map<string, ModelMessage[]>();
  const maxSteps = Math.max(1, options.maxSteps ?? 8);
  const render: ToolDefinition = {
    name: RENDER_SURFACE,
    description:
      'Draw or update a view for the person with A2UI 1.0 messages. Each message has "version": "1.0" and exactly one of createSurface, updateComponents, updateDataModel or deleteSurface. Send createSurface once for a surface (it may carry the first `components` and `dataModel`, and in `metadata.extensions.surfaces_expects` a JSON Schema per event name for the reply you need); change it afterwards with updateComponents, a flat list of components, one with id "root". Bind a prop to data with {"@path": "/a/b"}. Use only catalog components. Example: {"messages": [{"version": "1.0", "createSurface": {"surfaceId": "main", "catalogId": "<the catalog id>"}}, {"version": "1.0", "updateComponents": {"surfaceId": "main", "components": [{"id": "root", "component": "Text", "text": "Hello"}]}}]}',

    inputSchema: { type: "object", properties: { messages: { type: "array", minItems: 1, items: options.surfaceMessageSchema ?? { type: "object" } } }, required: ["messages"], additionalProperties: false },
  };
  const offer = options.offer ?? {};
  const definitions = (runnable: RunnableTool[]): ToolDefinition[] => [render, ...runnable.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))];
  /** Per session: the tool call waiting on a person, the calls after it in the same step, and the tools that were on. */
  const waiting = new Map<string, { request: ApprovalRequest; call: ToolCall; rest: ToolCall[]; approvals: ApprovedRun["approvals"]; tools: RunnableTool[] }>();
  let counter = 0;

  /** Runs calls in order. Returns false when one is now waiting on a person. */
  async function* runCalls(sessionId: string, history: ModelMessage[], calls: ToolCall[], active: RunnableTool[], signal?: AbortSignal): AsyncGenerator<AgentEvent, boolean> {
    for (const [index, call] of calls.entries()) {
      const tool = active.find((t) => t.name === call.name);
      const ask = tool?.approval ? await tool.approval(call.input) : undefined;
      if (ask) {
        const init = await withDigest({ ...ask, id: `approval-${call.id}`, kind: ask.kind ?? ApprovalKind.PERMISSION });
        const request = create(ApprovalRequestSchema, init);
        waiting.set(sessionId, { request, call, rest: calls.slice(index + 1), approvals: [], tools: active });
        yield agentEvent.approval(request);
        return false;
      }
      // Only tools that are on can run, whatever the model asks for.
      for await (const event of runCall(call, active, signal, options.checkSurface)) {
        if (event.kind === "event") yield event.event;
        else history.push({ role: "tool", toolCallId: call.id, content: event.result, ...(event.isError ? { isError: true } : {}) });
      }
    }
    return true;
  }

  /** The person answered (or wrote instead of answering) a paused call. Returns false when it still waits for more people. */
  async function* resume(sessionId: string, history: ModelMessage[], request: SendInit, signal?: AbortSignal): AsyncGenerator<AgentEvent, boolean> {
    const pending = waiting.get(sessionId)!;
    waiting.delete(sessionId);
    const { call } = pending;
    const result = (value: unknown, isError = false) => history.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(value), ...(isError ? { isError: true } : {}) });
    const skipRest = () => {
      for (const later of pending.rest) history.push({ role: "tool", toolCallId: later.id, content: JSON.stringify({ error: "Not run: an earlier call in this step was not allowed." }), isError: true });
    };
    if (request.input?.case !== "approval") {
      // Tool calls must each get a result before the conversation goes on.
      result({ denied: true, reason: "The person wrote a message instead of answering. Nothing ran." }, true);
      skipRest();
      history.push({ role: "user", content: turnText(request) });
      return true;
    }
    const answer = create(ApprovalAnswerSchema, request.input.value);
    const check = await checkApproval(pending.request, answer, { mayDecide: options.mayDecide });
    const step = (status: StepStatus, detail = "") => agentEvent.step({ id: call.id, title: call.name, tool: call.name, status, detail });
    if (!check.ok) {
      yield step(StepStatus.FAILED, check.message);
      result({ error: check.message, code: check.code, ran: false }, true);
      skipRest();
      return true;
    }
    if (!check.allow) {
      yield step(StepStatus.FAILED, `Not allowed${check.record.decidedBy ? ` by ${check.record.decidedBy.name}` : ""}${check.record.reason ? `: ${check.record.reason}` : ""}`);
      result({ denied: true, by: check.record.decidedBy?.name, reason: check.record.reason, ran: false }, true);
      skipRest();
      return true;
    }
    const approvals = [...pending.approvals, { ...(check.record.decidedBy ? { decidedBy: check.record.decidedBy } : {}), decidedAt: check.record.decidedAt, reason: check.record.reason }];
    if (!check.complete) {
      // More people must allow it: ask again, showing who has.
      const next = create(ApprovalRequestSchema, { ...pending.request, approvals: [...pending.request.approvals, create(ApprovalRecordSchema, check.record)] });
      waiting.set(sessionId, { ...pending, request: next, approvals });
      yield agentEvent.approval(next);
      return false;
    }
    const approved: ApprovedRun = { sql: check.sql, subject: check.subject, edited: check.edited, approvals };
    for await (const event of runCall(call, pending.tools, signal, options.checkSurface, approved)) {
      if (event.kind === "event") yield event.event;
      else history.push({ role: "tool", toolCallId: call.id, content: event.result, ...(event.isError ? { isError: true } : {}) });
    }
    return yield* runCalls(sessionId, history, pending.rest, pending.tools, signal);
  }

  return {
    async describeAgents() {
      return create(DescribeAgentsResponseSchema, { agents: [agentInfo(offer)] });
    },
    async *send(request: SendInit, callOptions): AsyncIterable<AgentEvent> {
      const signal = callOptions?.signal;
      const sessionId = request.sessionId || options.newSessionId?.() || `session-${Date.now().toString(36)}-${counter++}`;
      const choices = resolveChoices(request, offer);
      if ("refused" in choices) {
        yield agentEvent.error("FAILED", choices.refused);
        yield agentEvent.done(sessionId, options.generatedBy ?? "a tool-calling model");
        return;
      }
      const history = sessions.get(sessionId) ?? [{ role: "system", content: options.system }];
      sessions.set(sessionId, history);
      // The skills on for this turn; the system prompt is the first message, so it changes with them.
      history[0] = { role: "system", content: systemWith(options.system, choices.skills) };
      const active = toolsFor(options.tools ?? [], offer, choices.connectors);
      const tools = definitions(active);
      let model = options.generatedBy ?? "";
      try {
        if (waiting.has(sessionId)) {
          if (!(yield* resume(sessionId, history, request, signal))) {
            yield agentEvent.done(sessionId, model || "a tool-calling model");
            return;
          }
        } else history.push({ role: "user", content: turnText(request) });
        for (let step = 0; step < maxSteps; step++) {
          let text = "";
          let raw: unknown;
          let stopped: { code: string; message: string } | undefined;
          const calls: ToolCall[] = [];
          for await (const chunk of options.complete({ messages: history, tools, signal, ...(choices.model ? { model: choices.model } : {}) })) {
            if (signal?.aborted) return;
            if (chunk.type === "text") {
              text += chunk.delta;
              yield agentEvent.text(chunk.delta);
            } else if (chunk.type === "tool_call") calls.push(chunk.call);
            else if (chunk.type === "usage") yield agentEvent.usage({ inputTokens: BigInt(chunk.inputTokens), outputTokens: BigInt(chunk.outputTokens) });
            else if (chunk.type === "error") {
              stopped = { code: chunk.code, message: chunk.message };
              raw = chunk.raw;
            } else {
              if (chunk.model) model = chunk.model;
              raw = chunk.raw;
            }
          }
          // History only grows: the assistant turn is kept as the model gave it, even when it stopped.
          history.push({ role: "assistant", content: text, ...(!stopped && calls.length > 0 ? { toolCalls: calls } : {}), ...(raw !== undefined ? { raw } : {}) });
          if (stopped) {
            yield agentEvent.error(stopped.code, stopped.message);
            yield agentEvent.done(sessionId, model || "a tool-calling model");
            return;
          }
          if (calls.length === 0 || !(yield* runCalls(sessionId, history, calls, active, signal))) {
            // No calls: the answer is complete. A call waiting on a person: the turn pauses here.
            yield agentEvent.done(sessionId, model || "a tool-calling model");
            return;
          }
        }
        yield agentEvent.error("FAILED", `Stopped after ${maxSteps} steps without an answer.`);
      } catch (error) {
        yield errorEvent(error);
      }
    },
  };
}

type CallOutput = { kind: "event"; event: AgentEvent } | { kind: "result"; result: string; isError?: boolean };

async function* runCall(call: ToolCall, tools: RunnableTool[], signal?: AbortSignal, check?: ToolCallingAgentOptions["checkSurface"], approved?: ApprovedRun): AsyncIterable<CallOutput> {
  if (call.name === RENDER_SURFACE) {
    const messages = (call.input as { messages?: unknown } | null)?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      yield { kind: "result", result: JSON.stringify({ error: "render_surface needs `messages`: a list of A2UI messages." }), isError: true };
      return;
    }
    let drawn = 0;
    const problems: { index: number; path: string; message: string }[] = [];
    for (const [index, message] of messages.entries()) {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        problems.push({ index, path: "/", message: "Not an A2UI message object." });
        continue;
      }
      const found = check?.(message) ?? [];
      if (found.length > 0) {
        problems.push(...found.slice(0, 10).map((p) => ({ index, ...p })));
        continue;
      }
      drawn++;
      yield { kind: "event", event: agentEvent.surface(message as JsonObject) };
    }
    // The client checks each message against the catalog too; anything it refuses comes back next turn as a surface error.
    yield {
      kind: "result",
      result: JSON.stringify(problems.length > 0 ? { drawn, refused: problems, fix: "Send the refused messages again, corrected. Each message has exactly one of createSurface, updateComponents, updateDataModel, deleteSurface, plus version." } : { drawn }),
      ...(problems.length > 0 ? { isError: true } : {}),
    };
    return;
  }
  const tool = tools.find((t) => t.name === call.name);
  const started = Date.now();
  yield { kind: "event", event: agentEvent.step({ id: call.id, title: call.name, tool: call.name, status: StepStatus.RUNNING }) };
  if (!tool) {
    yield { kind: "event", event: agentEvent.step({ id: call.id, title: call.name, tool: call.name, status: StepStatus.FAILED, detail: "No such tool." }) };
    yield { kind: "result", result: JSON.stringify({ error: `No tool named ${call.name}.` }), isError: true };
    return;
  }
  try {
    const result = await tool.run(call.input, signal, approved);
    yield { kind: "event", event: agentEvent.step({ id: call.id, title: call.name, tool: call.name, status: StepStatus.DONE, durationMs: BigInt(Date.now() - started) }) };
    yield { kind: "result", result: JSON.stringify(result ?? null, (_, v) => (typeof v === "bigint" ? String(v) : v)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield { kind: "event", event: agentEvent.step({ id: call.id, title: call.name, tool: call.name, status: StepStatus.FAILED, detail: message }) };
    yield { kind: "result", result: JSON.stringify({ error: message }), isError: true };
  }
}
