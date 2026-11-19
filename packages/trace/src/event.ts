/** A value that is plain JSON: what a trace holds, and nothing else. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonRecord = { [key: string]: Json };

/**
 * What an event is about.
 * - `message`: something to draw arrived (A2UI, json-render, or a surface given whole), with its upgrade and issues.
 * - `component`: a component of a surface was drawn.
 * - `problem`: a catalog violation, a failed contract, an undeclared event, a component that threw.
 * - `state`: a write to a data model, a change to a component's controls, a reset.
 * - `event`: something sent out: an action to the agent, a context note.
 * - `agent`: one turn with an agent.
 * - `service`: one call to a backend (a `DataSource`, discovery, pipelines, any service).
 */
export type TraceKind = "message" | "component" | "problem" | "state" | "event" | "agent" | "service";
export const TRACE_KINDS: readonly TraceKind[] = ["message", "component", "problem", "state", "event", "agent", "service"];

/** `running` is a span that has not ended. */
export type TraceStatus = "running" | "ok" | "warning" | "error";
export const TRACE_STATUSES: readonly TraceStatus[] = ["running", "ok", "warning", "error"];

/**
 * One thing that happened. The ids are W3C trace context ids (`traceId` 32
 * hex digits, `spanId` and `parentId` 16), so a call can carry them to a
 * server in a `traceparent` header and the server's spans join the same trace.
 */
export interface TraceEvent {
  /** Unique in its recorder: the span id. */
  id: string;
  /** Its place in the order things were recorded, from 1. */
  seq: number;
  /** When it started, in milliseconds since the epoch. */
  time: number;
  traceId: string;
  spanId: string;
  /** The span this happened inside. */
  parentId?: string;
  kind: TraceKind;
  /** Short: "updateComponents", "DataSource.execute", "turn: text". */
  name: string;
  status: TraceStatus;
  /** How long it took, once it has ended. Left out for something that happens at a moment. */
  durationMs?: number;
  /** The surface it concerns, by the key its host holds it under. */
  surfaceId?: string;
  /** The component it concerns. */
  componentId?: string;
  /** Names, SQL text, counts, timings, errors. Never row values, file contents or credentials. */
  detail: JsonRecord;
}

/** Where an event sits: the trace it belongs to and the span it happened inside. */
export interface TraceScope {
  traceId: string;
  /** The span that events recorded in this scope are children of. */
  spanId?: string;
  surfaceId?: string;
  componentId?: string;
}

const hex = (bytes: number): string => {
  const out = new Uint8Array(bytes);
  const random = (globalThis as { crypto?: { getRandomValues?(array: Uint8Array): Uint8Array } }).crypto;
  if (random?.getRandomValues) random.getRandomValues(out);
  else for (let i = 0; i < bytes; i++) out[i] = Math.floor(Math.random() * 256);
  // All zeros is not a valid id in trace context.
  if (out.every((b) => b === 0)) out[bytes - 1] = 1;
  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** A new trace id: 32 lowercase hex digits. */
export const newTraceId = (): string => hex(16);
/** A new span id: 16 lowercase hex digits. */
export const newSpanId = (): string => hex(8);

/** The W3C `traceparent` header value for a call made inside a scope or an event. */
export function traceparent(at: { traceId: string; spanId?: string }): string {
  return `00-${at.traceId}-${at.spanId ?? "0".repeat(15) + "1"}-01`;
}

/** Reads a `traceparent` header value; undefined when it is not one. */
export function parseTraceparent(value: string): { traceId: string; spanId: string } | undefined {
  const match = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/.exec(value.trim());
  if (!match || /^0+$/.test(match[1]!) || /^0+$/.test(match[2]!)) return undefined;
  return { traceId: match[1]!, spanId: match[2]! };
}

export interface PlainLimits {
  /** Longer text is cut, with a note of how much was left out. Default 20,000 characters. */
  maxString?: number;
  /** Longer lists are cut, with a note. Default 500. */
  maxItems?: number;
  /** Deeper values are replaced by a note. Default 16. */
  maxDepth?: number;
}

/** What is kept in place of a value whose key says it is a credential. */
export const WITHHELD = "[withheld]";
const CREDENTIAL = /pass(word|wd|phrase)|secret|token|api[-_]?key|authorization|credential|private[-_]?key|cookie|session[-_]?key/i;
/** Keys that name a credential by reference, which is safe to keep: `secret: "LAKE"` in a connection is a name. */
const NAMED = /^(secret|secretName|tokenBudget|maxTokens|inputTokens|outputTokens|contextTokens|nextPageToken|pageToken)$/;

/** True for a key whose value must not be recorded. */
export const isCredentialKey = (key: string): boolean => CREDENTIAL.test(key) && !NAMED.test(key);

/**
 * Any value as plain JSON, safe to keep in a trace: binary data becomes its
 * length (so an Arrow batch or a file is never held), a value under a key
 * that names a credential is withheld, protobuf's own `$` fields are left
 * out, a bigint becomes a number or text, and long text, long lists and deep
 * values are cut.
 */
export function plain(value: unknown, limits: PlainLimits = {}, depth = 0): Json {
  const { maxString = 20_000, maxItems = 500, maxDepth = 16 } = limits;
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "bigint":
      return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
    case "string":
      return value.length > maxString ? `${value.slice(0, maxString)}… [${value.length - maxString} more characters]` : value;
    case "function":
    case "symbol":
      return null;
  }
  if (ArrayBuffer.isView(value)) return { "@bytes": value.byteLength };
  if (value instanceof ArrayBuffer) return { "@bytes": value.byteLength };
  if (typeof Blob !== "undefined" && value instanceof Blob) return { "@bytes": value.size };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Error) return errorDetail(value);
  if (depth >= maxDepth) return "[deeper than is kept]";
  if (value instanceof Map) return plain(Object.fromEntries(value), limits, depth);
  if (value instanceof Set) return plain([...value], limits, depth);
  if (Array.isArray(value)) {
    const out = value.slice(0, maxItems).map((item) => plain(item, limits, depth + 1));
    if (value.length > maxItems) out.push(`[${value.length - maxItems} more]`);
    return out;
  }
  const out: JsonRecord = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || item === undefined || typeof item === "function" || typeof item === "symbol") continue;
    // A number or a flag is not a credential, whatever its key.
    out[key] = isCredentialKey(key) && (typeof item === "string" ? item !== "" : typeof item === "object" && item !== null) ? WITHHELD : plain(item, limits, depth + 1);
  }
  return out;
}

/** What is kept of a failure: its message, and a code and a place in the SQL when the error carries them. */
export function errorDetail(error: unknown): JsonRecord {
  if (!(error instanceof Error)) return { message: typeof error === "string" ? error : String(error) };
  const out: JsonRecord = { message: error.message.slice(0, 4000) };
  if (error.name && error.name !== "Error") out.name = error.name;
  for (const key of ["code", "line", "column", "engineCode"] as const) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "string" || typeof value === "number") out[key] = value;
  }
  return out;
}
