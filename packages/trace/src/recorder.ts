import { type Json, type JsonRecord, type TraceEvent, type TraceKind, type TraceScope, type TraceStatus, newSpanId, newTraceId, plain } from "./event.js";

/** What a recorder holds at one moment. */
export interface TraceLog {
  /** Oldest first. */
  readonly events: readonly TraceEvent[];
  /** How many of the oldest events were let go to stay within the limit. */
  readonly dropped: number;
}

/**
 * A log that can be read and watched: all a panel needs. A recorder is one;
 * so is anything else that can hand over events (a file that was exported, a
 * channel from another window, a server).
 */
export interface TraceFeed {
  get(): TraceLog;
  /** Calls `listener` after the log changes. Returns a function that stops it. */
  subscribe(listener: (log: TraceLog) => void): () => void;
}

export interface TraceInput {
  kind: TraceKind;
  name: string;
  /** Defaults to "ok" for `record` and "running" for `start`. */
  status?: TraceStatus;
  detail?: Record<string, unknown>;
  durationMs?: number;
  surfaceId?: string;
  componentId?: string;
  /** Use this span id instead of a new one, for a span whose id was handed out before it was recorded. */
  spanId?: string;
  /** When it started; now, if left out. */
  time?: number;
}

export interface TracePatch {
  status?: TraceStatus;
  /** Merged over the event's detail, a key at a time. */
  detail?: Record<string, unknown>;
  durationMs?: number;
}

/** Something that takes time: recorded when it starts, and again when it ends. */
export interface TraceSpan {
  readonly id: string;
  /** The scope for what happens inside it. */
  readonly scope: TraceScope;
  update(patch: TracePatch): void;
  /** Ends it, with how long it took. Ending twice does nothing. */
  end(patch?: TracePatch): void;
}

export interface Recorder extends TraceFeed {
  /** Records something that happened at a moment. Inside `scope` it joins that trace as a child; with none it joins the turn in progress, or starts a trace of its own. */
  record(input: TraceInput, scope?: TraceScope): TraceEvent;
  /** Records the start of something that takes time. */
  start(input: TraceInput, scope?: TraceScope): TraceSpan;
  /** Changes an event already recorded. An event that has been let go is ignored. */
  update(id: string, patch: TracePatch): void;
  /** Forgets every event. */
  clear(): void;
  /** Tells subscribers now, instead of at the end of the current task. */
  flush(): void;
  /**
   * Marks a surface object with the key its host holds it under, so that what is recorded where it is drawn
   * can be matched to the messages that built it. Two hosts may both call a surface "main"; their keys differ.
   */
  tag(surface: object, key: string): void;
  keyOf(surface: object): string | undefined;
  /** The scope of the last message recorded for a surface: what drew it. */
  surfaceScope(key: string): TraceScope | undefined;
  /** Marks a turn as in progress, so messages recorded with no scope join it. Returns a function that ends that. */
  enter(scope: TraceScope): () => void;
  /**
   * Hands the recorder a backend the page is using ("dataSource", "discovery"), so a tool drawing a recorded
   * surface again can query the same data. Returns a function that takes it back.
   */
  provide(name: string, service: unknown): () => void;
  service<T = unknown>(name: string): T | undefined;
  /**
   * Points at one drawn component, or at nothing: a tool showing the trace says which component a person picked,
   * and the surface that drew it marks it on the page. It is not an event and nothing is recorded.
   */
  inspect(target: InspectTarget | undefined): void;
  inspected(): InspectTarget | undefined;
  /**
   * Turns picking on or off: while it is on, every drawn component is marked, so a tool can tell which component
   * a person points at on the page and `inspect` it.
   */
  pick(on: boolean): void;
  picking(): boolean;
  /** Told when what is pointed at, or picking, changes. Returns a function that stops that. */
  onInspect(listener: () => void): () => void;
}

/**
 * The attribute on the mark a surface puts before a component: a hidden, empty `template`, there only while the
 * component is pointed at or a person is picking one. Its value is the surface's key, `INSPECT_COMPONENT` holds the
 * component's id, and `INSPECT_POINTED` is on the one pointed at. The component's element is the next element.
 */
export const INSPECT_MARK = "data-sf-inspect";
export const INSPECT_COMPONENT = "data-sf-component";
export const INSPECT_POINTED = "data-sf-pointed";

/** One drawn component: the key its surface is held under, and its id. */
export interface InspectTarget {
  surfaceKey: string;
  componentId: string;
}

export interface RecorderOptions {
  /** The most events kept; the oldest are let go first. Default 2,000. */
  limit?: number;
  /** The clock, in milliseconds since the epoch. For tests. */
  now?(): number;
}

const merge = (detail: JsonRecord, more: Record<string, unknown> | undefined): JsonRecord => (more ? { ...detail, ...(plain(more) as JsonRecord) } : detail);

/**
 * Keeps the last `limit` events. It has no dependency on React or the DOM,
 * and it is shaped like a store (`get`, `subscribe`), so `useStore` from
 * `@surfaces-ui/state/react` reads it. Everything given to it is turned into
 * plain JSON first (`plain`), so it can never hold a reference to a result,
 * a batch or a backend.
 *
 * Subscribers are told once per task, after the code that recorded has
 * finished, so recording while a component renders is safe.
 */
export function createRecorder(options: RecorderOptions = {}): Recorder {
  const limit = Math.max(1, Math.floor(options.limit ?? 2000));
  const now = options.now ?? Date.now;
  let events: TraceEvent[] = [];
  let dropped = 0;
  let seq = 0;
  let snapshot: TraceLog | undefined;
  let scheduled = false;
  const listeners = new Set<(log: TraceLog) => void>();
  const tags = new WeakMap<object, string>();
  const drew = new Map<string, TraceScope>();
  const turns: TraceScope[] = [];
  const services = new Map<string, unknown[]>();
  let pointed: InspectTarget | undefined;
  let choosing = false;
  const pointers = new Set<() => void>();

  const get = (): TraceLog => (snapshot ??= { events: [...events], dropped });
  const flush = () => {
    scheduled = false;
    const log = get();
    for (const listener of [...listeners]) listener(log);
  };
  const changed = () => {
    snapshot = undefined;
    if (scheduled || listeners.size === 0) return;
    scheduled = true;
    queueMicrotask(() => scheduled && flush());
  };
  const indexOf = (id: string) => {
    for (let i = events.length - 1; i >= 0; i--) if (events[i]!.id === id) return i;
    return -1;
  };

  const add = (input: TraceInput, scope: TraceScope | undefined, status: TraceStatus): TraceEvent => {
    const within = scope ?? turns.at(-1);
    const spanId = input.spanId ?? newSpanId();
    const surfaceId = input.surfaceId ?? within?.surfaceId;
    const componentId = input.componentId ?? within?.componentId;
    const event: TraceEvent = {
      id: spanId,
      seq: ++seq,
      time: input.time ?? now(),
      traceId: within?.traceId ?? newTraceId(),
      spanId,
      ...(within?.spanId ? { parentId: within.spanId } : {}),
      kind: input.kind,
      name: input.name,
      status: input.status ?? status,
      ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
      ...(surfaceId !== undefined ? { surfaceId } : {}),
      ...(componentId !== undefined ? { componentId } : {}),
      detail: merge({}, input.detail),
    };
    events.push(event);
    if (events.length > limit) {
      dropped += events.length - limit;
      events = events.slice(events.length - limit);
    }
    if (event.kind === "message" && event.surfaceId !== undefined) drew.set(event.surfaceId, { traceId: event.traceId, spanId: event.spanId, surfaceId: event.surfaceId });
    changed();
    return event;
  };

  const update = (id: string, patch: TracePatch) => {
    const index = indexOf(id);
    if (index < 0) return;
    const event = events[index]!;
    events[index] = {
      ...event,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {}),
      detail: merge(event.detail, patch.detail),
    };
    changed();
  };

  return {
    get,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    record: (input, scope) => add(input, scope, "ok"),
    start(input, scope) {
      const event = add(input, scope, "running");
      let open = true;
      return {
        id: event.id,
        scope: { traceId: event.traceId, spanId: event.spanId, ...(event.surfaceId !== undefined ? { surfaceId: event.surfaceId } : {}), ...(event.componentId !== undefined ? { componentId: event.componentId } : {}) },
        update: (patch) => update(event.id, patch),
        end(patch = {}) {
          if (!open) return;
          open = false;
          update(event.id, { ...patch, status: patch.status ?? "ok", durationMs: patch.durationMs ?? Math.max(0, now() - event.time) });
        },
      };
    },
    update,
    clear() {
      events = [];
      dropped = 0;
      drew.clear();
      changed();
    },
    flush,
    tag: (surface, key) => void tags.set(surface, key),
    keyOf: (surface) => tags.get(surface),
    surfaceScope: (key) => drew.get(key),
    enter(scope) {
      turns.push(scope);
      return () => {
        const index = turns.lastIndexOf(scope);
        if (index >= 0) turns.splice(index, 1);
      };
    },
    provide(name, service) {
      const held = services.get(name) ?? [];
      held.push(service);
      services.set(name, held);
      // Subscribers are told, so a tool showing a recorded surface picks the backend up.
      changed();
      return () => {
        const index = held.lastIndexOf(service);
        if (index >= 0) held.splice(index, 1);
        changed();
      };
    },
    service: <T,>(name: string) => services.get(name)?.at(-1) as T | undefined,
    inspect(target) {
      if (pointed?.surfaceKey === target?.surfaceKey && pointed?.componentId === target?.componentId) return;
      pointed = target ? { surfaceKey: target.surfaceKey, componentId: target.componentId } : undefined;
      for (const listener of [...pointers]) listener();
    },
    inspected: () => pointed,
    pick(on) {
      if (choosing === on) return;
      choosing = on;
      for (const listener of [...pointers]) listener();
    },
    picking: () => choosing,
    onInspect(listener) {
      pointers.add(listener);
      return () => void pointers.delete(listener);
    },
  };
}

let holders = 0;
/** A short name, unique on this page, for something that holds surfaces ("s1", "c2"): the first part of a surface's key. */
export const newHolder = (prefix = "s"): string => `${prefix}${++holders}`;

/** How an incoming message is recorded. */
export interface MessageRecord {
  /** "a2ui", "json-render", or "surface" for one handed over whole. */
  format: string;
  /** The key the host holds the surface under. */
  key: string;
  /** Exactly what arrived. */
  raw: unknown;
  /** The A2UI message that was applied, when it is not `raw`: an older version upgraded, or another format converted. */
  message?: unknown;
  /** What the catalog said about it. */
  issues?: { path: string; message: string }[];
  /** False when it was refused and changed nothing. */
  applied?: boolean;
  error?: { code?: string; message: string };
  /** True when it stands for the whole surface, replacing what was there. */
  snapshot?: boolean;
  /**
   * False for a message recorded for reading only: its host applies messages in its own way and records the
   * surface whole each time it changes, so replaying this one as well would apply it twice.
   */
  replay?: boolean;
  name?: string;
}

const KINDS = ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"] as const;
/** Which A2UI message this is, and the surface it names. */
export function messageKind(message: unknown): { kind: string; surfaceId: string } | undefined {
  if (!message || typeof message !== "object") return undefined;
  for (const kind of KINDS) {
    const body = (message as Record<string, unknown>)[kind];
    if (body && typeof body === "object") return { kind, surfaceId: String((body as { surfaceId?: unknown }).surfaceId ?? "") };
  }
  return undefined;
}

/** Records a message in: what arrived, what it was read as, what the catalog said, and whether it was applied. */
export function recordMessage(recorder: Recorder, record: MessageRecord, scope?: TraceScope): TraceEvent {
  const read = messageKind(record.message ?? record.raw);
  const issues = record.issues ?? [];
  const applied = record.applied !== false;
  const raw = plain(record.raw);
  const message = record.message === undefined ? undefined : plain(record.message);
  return recorder.record(
    {
      kind: "message",
      name: record.name ?? read?.kind ?? record.format,
      status: !applied || record.error ? "error" : issues.length > 0 ? "warning" : "ok",
      surfaceId: record.key,
      detail: {
        format: record.format,
        raw,
        // Kept only when reading it changed it.
        ...(message !== undefined && JSON.stringify(message) !== JSON.stringify(raw) ? { message } : {}),
        ...(typeof (record.raw as { version?: unknown } | null)?.version === "string" ? { version: (record.raw as { version: string }).version } : {}),
        issues: issues.map((issue) => ({ path: issue.path, message: issue.message })) as Json,
        applied,
        ...(record.error ? { error: record.error } : {}),
        ...(record.snapshot ? { snapshot: true } : {}),
        ...(record.replay === false ? { replay: false } : {}),
      },
    },
    scope,
  );
}
