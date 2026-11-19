import { type AgentBackend, type AgentEvent, agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import type { JsonObject } from "@bufbuild/protobuf";
import { StepStatus } from "@surfaces-ui/proto";
import { A2UI_VERSION, type Catalog, type ConversationScript, type ScriptPart, scriptEventReply } from "@surfaces-ui/spec";
import { type ChatThread, emptyThread, parseThread, reduceThread } from "./thread.js";

/**
 * A conversation as a document: a title and the thread, as plain JSON. It
 * can be saved beside pages in a surface library (kind "conversation"),
 * opened again with `Chat`'s `initialThread`, and shown to someone else.
 * Whatever is in it is checked again when it is opened (`parseConversation`)
 * and when its surfaces are drawn.
 */
export interface ConversationDocument {
  type: "conversation";
  id: string;
  title: string;
  description?: string;
  thread: Pick<ChatThread, "messages" | "surfaces" | "suggestions">;
}

/** A thread as a document to keep. A reply still streaming is kept as it stands; the session and usage are not kept. */
export function conversationDocument(thread: ChatThread, meta: { id: string; title: string; description?: string }): ConversationDocument {
  const plain = JSON.parse(JSON.stringify({ messages: thread.messages.map((m) => ({ ...m, streaming: false })), surfaces: thread.surfaces, suggestions: thread.suggestions })) as ConversationDocument["thread"];
  return { type: "conversation", id: meta.id, title: meta.title, ...(meta.description ? { description: meta.description } : {}), thread: plain };
}

/** Checks a conversation document from storage, a library or anywhere else before it is used. Undefined for anything that is not one. */
export function parseConversation(input: unknown): ConversationDocument | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  if (record.type !== "conversation" || typeof record.title !== "string") return undefined;
  const thread = parseThread(record.thread);
  if (!thread) return undefined;
  return {
    type: "conversation",
    id: typeof record.id === "string" ? record.id : "",
    title: record.title,
    ...(typeof record.description === "string" && record.description ? { description: record.description } : {}),
    thread: { messages: thread.messages, surfaces: thread.surfaces, suggestions: thread.suggestions },
  };
}

/** A conversation document's thread, ready for `Chat`'s `initialThread` or `MessageList`. */
export function conversationThread(document: ConversationDocument): ChatThread {
  return { ...emptyThread, messages: document.thread.messages, surfaces: document.thread.surfaces, suggestions: document.thread.suggestions };
}

/** The events one written reply becomes, ending in `done`. */
export function scriptEvents(reply: ScriptPart[], options: { catalogId: string; answeredBy: string; suggestions?: string[]; sessionId?: string }): AgentEvent[] {
  const events: AgentEvent[] = [];
  let steps = 0;
  let previous: ScriptPart | undefined;
  for (const part of reply) {
    // Text arrives as pieces of one stream, so two written paragraphs in a row need a break between them.
    if ("text" in part) events.push(agentEvent.text(previous && "text" in previous ? `\n\n${part.text}` : part.text));
    else if ("steps" in part) {
      for (const step of part.steps) {
        const id = `s${++steps}`;
        events.push(agentEvent.step({ id, title: step.title, status: StepStatus.RUNNING, tool: step.tool ?? "" }));
        events.push(agentEvent.step({ id, title: step.title, status: StepStatus.DONE, detail: step.detail ?? "", tool: step.tool ?? "" }));
      }
    } else {
      const { id, components, data } = part.surface;
      events.push(agentEvent.surface({ version: A2UI_VERSION, createSurface: { surfaceId: id, catalogId: options.catalogId } }));
      events.push(agentEvent.surface({ version: A2UI_VERSION, updateComponents: { surfaceId: id, components } } as unknown as JsonObject));
      if (data !== undefined) events.push(agentEvent.surface({ version: A2UI_VERSION, updateDataModel: { surfaceId: id, path: "/", value: data } } as unknown as JsonObject));
    }
    previous = part;
  }
  if (options.suggestions?.length) events.push(agentEvent.suggestions(options.suggestions));
  events.push(agentEvent.done(options.sessionId ?? "script", options.answeredBy));
  return events;
}

/** What is offered after a turn: its own suggestions, or what the person says next in the script. */
const offered = (script: ConversationScript, index: number): string[] => script.turns[index]?.suggestions ?? (script.turns[index + 1] ? [script.turns[index + 1]!.say] : []);

/**
 * A written conversation as a thread, already played: the first `turns`
 * turns (all of them by default), each folded through `reduceThread` exactly
 * as a live reply would be, so what is drawn is what a real agent sending
 * the same content would draw.
 */
export function scriptThread(script: ConversationScript, catalog: Catalog, turns = script.turns.length): ChatThread {
  let thread = emptyThread;
  script.turns.slice(0, Math.max(0, turns)).forEach((turn, index) => {
    thread = reduceThread(thread, { type: "user", text: turn.say }, catalog);
    thread = reduceThread(thread, { type: "begin" }, catalog);
    for (const event of scriptEvents(turn.reply, { catalogId: catalog.id, answeredBy: script.answeredBy, suggestions: offered(script, index) })) thread = reduceThread(thread, { type: "event", event }, catalog);
    thread = reduceThread(thread, { type: "end" }, catalog);
  });
  return thread;
}

export interface ScriptAgentOptions {
  catalog: Catalog;
  /** Pause between events, so a reply arrives a piece at a time. */
  delayMs?: number;
  /** How many turns the thread it carries on from has already played (`scriptThread`'s `turns`), so it knows what to offer next. */
  played?: number;
  /**
   * What to answer when a control in a drawn component sends an event the
   * script's own `events` do not cover. Without an answer the event is
   * acknowledged in a line.
   */
  onAction?(action: { name: string; surfaceId: string; context: Record<string, unknown> }): ScriptPart[] | undefined;
}

const plain = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * An agent that answers from a written conversation: a message that matches
 * a turn's `say` gets that turn's reply, an event from a drawn component gets
 * the script's answer to it (`events`), and anything else is told what the
 * script can answer. It is not a model and its replies say so through
 * `answeredBy`. Use it to let people carry on a sample conversation.
 */
export function scriptAgent(script: ConversationScript, options: ScriptAgentOptions): AgentBackend {
  const base = { catalogId: options.catalog.id, answeredBy: script.answeredBy };
  // The furthest turn played, so an answer to an event can offer the way on again.
  let next = Math.max(0, options.played ?? 0);
  const onward = () => (script.turns[next] ? [script.turns[next]!.say] : []);
  return scriptedAgent(function* (request) {
    const input = request.input;
    if (input?.case === "text") {
      const index = script.turns.findIndex((turn) => plain(turn.say) === plain(input.value));
      if (index >= 0) {
        next = Math.max(next, index + 1);
        yield* scriptEvents(script.turns[index]!.reply, { ...base, suggestions: offered(script, index) });
      }
      else
        yield* scriptEvents([{ text: "This conversation is written out in advance, so it can only answer what it was written for. Pick one of the suggestions below, or press a control in a component above." }], {
          ...base,
          suggestions: script.turns.map((turn) => turn.say),
        });
    } else if (input?.case === "action") {
      const context = (input.value.context ?? {}) as Record<string, unknown>;
      const name = input.value.name ?? "";
      const reply = scriptEventReply(script, name, context) ?? options.onAction?.({ name, surfaceId: input.value.surfaceId ?? "", context });
      yield* scriptEvents(reply ?? [{ text: `Noted (${input.value.name ?? "event"}). This conversation is written out in advance, so nothing else happens.` }], { ...base, suggestions: onward() });
    } else {
      yield* scriptEvents([{ text: "This conversation is written out in advance and asks for no approvals." }], base);
    }
  }, options.delayMs ?? 0);
}
