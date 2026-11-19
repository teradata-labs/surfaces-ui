import { type JsonObject, type MessageInitShape, create } from "@bufbuild/protobuf";
import { type SendRequestSchema, type SendResponse, SendResponseSchema } from "@surfaces-ui/proto";

/** One event in a turn's stream: text, a step, a surface message, an approval request, usage, suggestions, an error, or done. */
export type AgentEvent = SendResponse;

export interface AgentCallOptions {
  /** Aborting stops the turn. */
  signal?: AbortSignal;
}

export type SendInit = MessageInitShape<typeof SendRequestSchema>;

/**
 * A conversation with an agent, and nothing else. Chat components depend on
 * this interface only, so any agent runtime can be plugged in: Loom, a
 * server implementing `AgentService`, or a consumer's own adapter.
 *
 * One `send` is one turn. The stream ends with a `done` event, or with an
 * `error` event if the turn failed; it may pause on an `approval` event,
 * which the person answers with another `send`.
 */
export interface AgentBackend {
  send(request: SendInit, options?: AgentCallOptions): AsyncIterable<AgentEvent>;
}

type EventInit = NonNullable<MessageInitShape<typeof SendResponseSchema>["event"]>;
const event = (value: EventInit): AgentEvent => create(SendResponseSchema, { event: value });

/** Constructors for each kind of event, for adapters and tests. */
export const agentEvent = {
  text: (delta: string) => event({ case: "text", value: { delta } }),
  step: (value: Extract<EventInit, { case: "step" }>["value"]) => event({ case: "step", value }),
  /** One A2UI server-to-client message. */
  surface: (message: JsonObject) => event({ case: "surface", value: message }),
  approval: (value: Extract<EventInit, { case: "approval" }>["value"]) => event({ case: "approval", value }),
  usage: (value: Extract<EventInit, { case: "usage" }>["value"]) => event({ case: "usage", value }),
  suggestions: (items: string[]) => event({ case: "suggestions", value: { items } }),
  error: (code: string, message: string) => event({ case: "error", value: { code, message } }),
  done: (sessionId: string, generatedBy: string) => event({ case: "done", value: { sessionId, generatedBy } }),
};

/** Turns a failure into the `error` event a chat shows, hiding nothing a person needs. */
export function errorEvent(error: unknown): AgentEvent {
  if (error instanceof DOMException && error.name === "AbortError") return agentEvent.error("CANCELLED", "Stopped.");
  const message = error instanceof Error ? error.message : String(error);
  return agentEvent.error(/fetch|network|load failed|ECONNREFUSED/i.test(message) ? "UNAVAILABLE" : "FAILED", message.replace(/^\[[a-z_]+\]\s*/i, ""));
}

/**
 * An AgentBackend that plays back scripted turns. For tests, demos and
 * stories: each `send` yields the events the script returns for it.
 */
export function scriptedAgent(script: (request: SendInit, turn: number) => Iterable<AgentEvent> | AsyncIterable<AgentEvent>, delayMs = 0): AgentBackend {
  let turn = 0;
  return {
    async *send(request, options) {
      const index = turn++;
      for await (const next of script(request, index)) {
        if (options?.signal?.aborted) {
          yield agentEvent.error("CANCELLED", "Stopped.");
          return;
        }
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
        yield next;
      }
    },
  };
}
