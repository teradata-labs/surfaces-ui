import type { JsonObject } from "@bufbuild/protobuf";
import { type AgentEvent, agentEvent } from "./backend.js";

const OPEN = "```a2ui";
const CLOSE = "```";

/**
 * Lets any text-only model draw UI. The model writes A2UI messages, one JSON
 * object per line, inside a fenced block:
 *
 *     ```a2ui
 *     {"version":"1.0","createSurface":{...}}
 *     {"version":"1.0","updateComponents":{...}}
 *     ```
 *
 * This wraps a stream of events, removes those blocks from the text, and
 * emits each line as a `surface` event as soon as the line is complete, so a
 * surface builds up while the reply is still streaming. Lines that are not
 * valid JSON objects are dropped; validation against the catalog happens
 * where surfaces are drawn.
 */
export async function* extractSurfaces(events: AsyncIterable<AgentEvent>): AsyncIterable<AgentEvent> {
  let pending = "";
  let inside = false;

  function* drain(final: boolean): Generator<AgentEvent> {
    for (;;) {
      if (!inside) {
        const at = pending.indexOf(OPEN);
        if (at === -1) {
          // Keep back a tail that could be the start of a fence split across deltas.
          const keep = final ? 0 : longestPrefixAtEnd(pending, OPEN);
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) yield agentEvent.text(out);
          return;
        }
        if (at > 0) yield agentEvent.text(pending.slice(0, at));
        pending = pending.slice(at + OPEN.length);
        inside = true;
      }
      const newline = pending.indexOf("\n");
      if (newline === -1) {
        if (final) pending = "";
        return;
      }
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      if (line === CLOSE) {
        inside = false;
        // A fence is normally followed by a line break that belongs to it.
        if (pending.startsWith("\n")) pending = pending.slice(1);
        continue;
      }
      const message = parse(line);
      if (message) yield agentEvent.surface(message);
    }
  }

  for await (const next of events) {
    if (next.event.case === "text") {
      pending += next.event.value.delta;
      yield* drain(false);
    } else {
      // Flush text before anything else so order is preserved.
      if (!inside) yield* drain(true);
      yield next;
    }
  }
  if (inside && pending.trim() !== "" && pending.trim() !== CLOSE) {
    const message = parse(pending.trim());
    if (message) yield agentEvent.surface(message);
    pending = "";
  } else if (!inside) {
    yield* drain(true);
  }
}

function longestPrefixAtEnd(text: string, marker: string): number {
  for (let length = Math.min(marker.length - 1, text.length); length > 0; length--) {
    if (text.endsWith(marker.slice(0, length))) return length;
  }
  return 0;
}

function parse(line: string): JsonObject | undefined {
  if (!line.startsWith("{")) return undefined;
  try {
    const value = JSON.parse(line) as unknown;
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;
  } catch {
    return undefined;
  }
}
