import type { Json, JsonRecord, TraceEvent } from "./event.js";
import { messageKind } from "./recorder.js";

/**
 * How a log is replayed. The surface model lives in `@surfaces-ui/spec`,
 * which this package does not depend on, so its two pure functions are
 * handed in: `applyMessage` and `setPath`.
 */
export interface ReplayOptions<S extends { data: unknown }> {
  /** Applies one A2UI message to a set of surfaces and returns the new set. May throw; a message that throws is noted and skipped. */
  apply(surfaces: Record<string, S>, message: unknown): Record<string, S>;
  /** Writes a value at a JSON pointer in a data model and returns the new model. */
  setPath(model: unknown, path: string, value: unknown): unknown;
}

/** Where things stood after a step. */
export interface ReplayState<S extends { data: unknown }> {
  /** Each surface by its host's key, with what a person typed written over the agent's data model. */
  surfaces: Record<string, S>;
  /** Each surface's components' controls as a person left them, by surface key then component id. */
  controls: Record<string, Record<string, Json>>;
  /** What a person wrote into each surface's data model, in order: a path and a value. */
  writes: Record<string, [string, Json][]>;
  /** Messages that could not be applied again, by event id. */
  skipped: { id: string; message: string }[];
}

/** The events that can change what a surface draws: the steps of time travel. */
export const isStep = (event: TraceEvent): boolean => (event.kind === "message" && event.detail.replay !== false) || event.kind === "state";

/** The steps of a log, oldest first. */
export const traceSteps = (events: readonly TraceEvent[]): TraceEvent[] => events.filter(isStep);

/**
 * The surfaces as they stood after the event numbered `upTo` (its `seq`),
 * or after everything when it is left out. Pure: it replays the recorded
 * messages through `apply`, then the data a person wrote and the controls
 * they set, and reads nothing else. A log whose oldest events were let go
 * replays from what is left.
 */
export function replay<S extends { data: unknown }>(events: readonly TraceEvent[], upTo: number | undefined, options: ReplayOptions<S>): ReplayState<S> {
  const base: Record<string, S> = {};
  const controls: Record<string, Record<string, Json>> = {};
  const writes: Record<string, [string, Json][]> = {};
  const skipped: { id: string; message: string }[] = [];
  for (const event of events) {
    if (upTo !== undefined && event.seq > upTo) break;
    const key = event.surfaceId;
    if (event.kind === "message" && key !== undefined) {
      if (event.detail.applied === false || event.detail.replay === false) continue;
      const message = event.detail.message ?? event.detail.raw;
      const named = messageKind(message);
      if (!named) continue;
      // The host keeps the surface under its own key; the message names it as the agent does.
      const own = base[key] && !event.detail.snapshot ? { [named.surfaceId]: base[key]! } : {};
      try {
        const next = options.apply(own, message)[named.surfaceId];
        if (next) base[key] = next;
        else {
          delete base[key];
          delete controls[key];
          delete writes[key];
        }
      } catch (error) {
        skipped.push({ id: event.id, message: error instanceof Error ? error.message : String(error) });
      }
    } else if (event.kind === "state" && event.name === "data.write" && key !== undefined) {
      const path = String(event.detail.path ?? "/");
      // A later write to the same place, or above it, replaces an earlier one, as it does where it is drawn.
      writes[key] = [...(writes[key] ?? []).filter(([p]) => p !== path && !p.startsWith(`${path}/`)), [path, event.detail.value ?? null]];
    } else if (event.kind === "state" && event.name === "controls" && key !== undefined && event.componentId !== undefined) {
      controls[key] = { ...controls[key], [event.componentId]: event.detail.controls ?? {} };
    } else if (event.kind === "state" && event.name === "reset") {
      const prefix = String(event.detail.prefix ?? "");
      for (const held of Object.keys(base)) {
        if (!held.startsWith(prefix)) continue;
        delete base[held];
        delete controls[held];
        delete writes[held];
      }
    }
  }
  const surfaces: Record<string, S> = {};
  for (const [key, surface] of Object.entries(base)) {
    const written = writes[key];
    surfaces[key] = written?.length ? { ...surface, data: written.reduce<unknown>((model, [path, value]) => options.setPath(model, path, value), surface.data) } : surface;
  }
  return { surfaces, controls, writes, skipped };
}

/** One difference between two JSON values. */
export interface JsonChange {
  /** A JSON pointer to where they differ. */
  path: string;
  change: "added" | "removed" | "changed";
  before?: Json;
  after?: Json;
}

const isRecord = (value: unknown): value is JsonRecord => value !== null && typeof value === "object" && !Array.isArray(value);
const pointer = (path: string, key: string | number) => `${path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;

/**
 * The differences between two JSON values, as pointers. Objects are compared
 * a key at a time and lists a place at a time; anything else that differs is
 * one change. At most `limit` are returned (200 by default).
 */
export function diffJson(before: unknown, after: unknown, limit = 200): JsonChange[] {
  const out: JsonChange[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (out.length >= limit || a === b) return;
    if (a === undefined) return void out.push({ path: path || "/", change: "added", after: b as Json });
    if (b === undefined) return void out.push({ path: path || "/", change: "removed", before: a as Json });
    if (isRecord(a) && isRecord(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], pointer(path, key));
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], pointer(path, i));
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: path || "/", change: "changed", before: a as Json, after: b as Json });
  };
  walk(before, after, "");
  return out;
}

/** What one step changed: the surfaces, controls and writes after it against those after the step before. */
export function stepDiff<S extends { data: unknown }>(events: readonly TraceEvent[], seq: number, options: ReplayOptions<S>): JsonChange[] {
  const steps = traceSteps(events).filter((event) => event.seq <= seq);
  const previous = steps.at(-2)?.seq ?? 0;
  const before = replay(events, previous, options);
  const after = replay(events, seq, options);
  return diffJson({ surfaces: before.surfaces, controls: before.controls }, { surfaces: after.surfaces, controls: after.controls });
}
