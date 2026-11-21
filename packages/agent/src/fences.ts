import type { JsonObject } from "@bufbuild/protobuf";
import { type AgentEvent, agentEvent } from "./backend.js";

const OPEN = "```a2ui";
const CLOSE = "```";

/** The code of the `error` event sent for a block that could not be read. */
export const UNREAD_SURFACE = "INVALID_SURFACE";

/**
 * Lets any text-only model draw UI. The model writes A2UI messages as JSON
 * inside a fenced block:
 *
 *     ```a2ui
 *     {"version":"1.0","createSurface":{...}}
 *     {"version":"1.0","updateComponents":{...}}
 *     ```
 *
 * This wraps a stream of events, removes those blocks from the text, and
 * emits each message as a `surface` event as soon as it is complete, so a
 * surface builds up while the reply is still streaming. A message is asked
 * for one to a line, but models also write one over many lines, or a list of
 * them, so a message ends where its brackets close, not where a line does.
 * Text in a block that is not a message is never dropped quietly: when the
 * block ends, one `error` event (`UNREAD_SURFACE`) says a change could not be
 * read. Validation against the catalog happens where surfaces are drawn.
 */
export async function* extractSurfaces(events: AsyncIterable<AgentEvent>): AsyncIterable<AgentEvent> {
  let pending = "";
  let inside = false;
  /** Lines of a message that has started and whose brackets are still open. */
  let message = "";
  let scan = newScan();
  /** How many pieces of this block were not messages. */
  let unread = 0;

  function* take(line: string): Generator<AgentEvent> {
    if (message === "") {
      if (line === "") return;
      if (!line.startsWith("{") && !line.startsWith("[")) {
        unread++;
        return;
      }
    }
    message += (message ? "\n" : "") + line;
    scanLine(scan, line);
    if (scan.depth > 0) return;
    // A model that writes messages as a list without its brackets leaves a comma after each.
    const found = parse(message.replace(/,$/, ""));
    if (found.length === 0) unread++;
    for (const one of found) yield agentEvent.surface(one);
    message = "";
    scan = newScan();
  }

  function* close(): Generator<AgentEvent> {
    if (message !== "") unread++;
    if (unread > 0) {
      yield agentEvent.error(UNREAD_SURFACE, "Part of the agent's change to the page could not be read, so it was not applied. Ask it to send the change again.");
    }
    message = "";
    scan = newScan();
    unread = 0;
    inside = false;
  }

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
      if (newline === -1) return;
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      if (line === CLOSE) {
        yield* close();
        // A fence is normally followed by a line break that belongs to it.
        if (pending.startsWith("\n")) pending = pending.slice(1);
        continue;
      }
      yield* take(line);
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
  if (inside) {
    // The reply ended inside a block: read what is left of it.
    const last = pending.trim();
    pending = "";
    if (last !== CLOSE) yield* take(last);
    yield* close();
  } else {
    yield* drain(true);
  }
}

function longestPrefixAtEnd(text: string, marker: string): number {
  for (let length = Math.min(marker.length - 1, text.length); length > 0; length--) {
    if (text.endsWith(marker.slice(0, length))) return length;
  }
  return 0;
}

interface Scan {
  depth: number;
  inString: boolean;
  escaped: boolean;
}
const newScan = (): Scan => ({ depth: 0, inString: false, escaped: false });

/** Follows brackets through one more line, leaving alone those inside a string. */
function scanLine(scan: Scan, line: string): void {
  for (const char of line) {
    if (scan.inString) {
      if (scan.escaped) scan.escaped = false;
      else if (char === "\\") scan.escaped = true;
      else if (char === '"') scan.inString = false;
    } else if (char === '"') scan.inString = true;
    else if (char === "{" || char === "[") scan.depth++;
    else if (char === "}" || char === "]") scan.depth--;
  }
  // JSON has no string over a line break, so an open one is a mistake that must not swallow the rest.
  scan.inString = false;
  scan.escaped = false;
}

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);

/** The messages in one piece of JSON: an object, or a list of objects. Empty when it is neither. */
function parse(text: string): JsonObject[] {
  try {
    const value = JSON.parse(text) as unknown;
    if (isObject(value)) return [value];
    if (Array.isArray(value) && value.length > 0 && value.every(isObject)) return value;
    return [];
  } catch {
    return [];
  }
}
