import { type Json, type JsonRecord, type TraceScope, errorDetail, plain } from "./event.js";
import type { Recorder, TraceSpan } from "./recorder.js";

/** Builds what is kept of a streamed answer, an item at a time. */
export interface StreamSummary {
  add(item: unknown): void;
  result(): JsonRecord;
}

export interface TraceServiceOptions {
  /** The scope calls are recorded in: a fixed one, or a function asked at each call. With none, a call joins the turn in progress or starts its own trace. */
  scope?: TraceScope | (() => TraceScope | undefined);
  /** What to keep of a method's answer, by method name, in place of `responseSummary`. */
  responses?: Record<string, (response: unknown) => JsonRecord>;
  /** How to summarise a streaming method's items, by method name. Without one, only their number is kept. */
  streams?: Record<string, () => StreamSummary>;
}

const TRACED = Symbol.for("surfaces-ui.traced");
interface Traced {
  target: object;
  recorder: Recorder;
  name: string;
  options: TraceServiceOptions;
}
const tracedOf = (service: unknown): Traced | undefined => (service && typeof service === "object" ? ((service as Record<symbol, unknown>)[TRACED] as Traced | undefined) : undefined);

/** True for a backend that is already traced, by `traceService` or one of its kin. */
export const isTraced = (service: unknown): boolean => tracedOf(service) !== undefined;

/** Text fields of an answer that are names, codes or SQL, and so are kept as they are. Any other text is kept as its length. */
const KEPT_TEXT = new Set([
  "executedSql", "queryId", "planText", "code", "message", "name", "id", "version", "generatedBy", "sessionId", "status", "state", "kind", "format",
  "type", "engine", "dialect", "sourceId", "table", "schema", "catalog", "column", "nextCursor", "nextPageToken", "pipelineId", "runId", "trigger", "startedBy",
]);

/**
 * What is kept of an answer when nothing more specific is known about it:
 * numbers and flags, the size of every list, and text only where the field
 * is a name, a code or SQL. Lists are never walked, so no row, sample or
 * common value an answer carries can reach a trace.
 */
export function responseSummary(value: unknown, depth = 0): JsonRecord {
  if (value === null || typeof value !== "object" || ArrayBuffer.isView(value)) return {};
  const out: JsonRecord = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("$") || item === undefined || item === null || typeof item === "function") continue;
    if (typeof item === "number" || typeof item === "boolean" || typeof item === "bigint") out[key] = plain(item);
    else if (typeof item === "string") {
      if (item === "") continue;
      out[key] = KEPT_TEXT.has(key) ? plain(item, { maxString: 4000 }) : { "@text": item.length };
    } else if (Array.isArray(item)) out[key] = key === "notices" ? plain(item, { maxItems: 20, maxString: 1000 }) : { "@count": item.length };
    else if (ArrayBuffer.isView(item) || item instanceof ArrayBuffer) out[key] = { "@bytes": item.byteLength };
    else if (depth < 2) {
      const inner = responseSummary(item, depth + 1);
      if (Object.keys(inner).length > 0) out[key] = inner;
    }
  }
  return out;
}

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> => !!value && typeof value === "object" && Symbol.asyncIterator in value;
const isThenable = (value: unknown): value is PromiseLike<unknown> => !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** A call the caller stopped (its signal was aborted) is a warning, not a failure: a view that closed, a query that was replaced. */
const failed = (error: unknown, signal?: { aborted?: boolean }) => {
  const aborted = (error instanceof Error && error.name === "AbortError") || signal?.aborted === true;
  return { status: aborted ? ("warning" as const) : ("error" as const), detail: { error: errorDetail(error), ...(aborted ? { cancelled: true } : {}) } };
};

function traceStream(source: AsyncIterable<unknown>, span: TraceSpan, summary: StreamSummary, signal?: { aborted?: boolean }): AsyncIterable<unknown> {
  return {
    [Symbol.asyncIterator]() {
      const inner = source[Symbol.asyncIterator]();
      return {
        async next() {
          try {
            const step = await inner.next();
            if (step.done) span.end({ detail: { response: summary.result() } });
            else summary.add(step.value);
            return step;
          } catch (error) {
            span.end({ ...failed(error, signal), detail: { ...failed(error, signal).detail, response: summary.result() } });
            throw error;
          }
        },
        // The reader stopped before the end: a window that was scrolled away, a view that closed.
        async return(value?: unknown) {
          span.end({ detail: { response: summary.result(), stoppedEarly: true } });
          return inner.return ? inner.return(value) : { done: true as const, value };
        },
        async throw(error?: unknown) {
          span.end(failed(error));
          if (inner.throw) return inner.throw(error);
          throw error;
        },
      };
    },
  };
}

const counted = (): StreamSummary => {
  let items = 0;
  return { add: () => void items++, result: () => ({ items }) };
};

/**
 * Wraps any backend so every call is recorded as a `service` event: the
 * method, the request, how long it took, what is kept of the answer, and the
 * error when it failed. It works for a method that returns a value, a
 * promise or a stream (an async iterable, recorded until its last item).
 * The wrapped backend behaves exactly as the original: same answers, same
 * errors, same streams.
 *
 * The request is kept as plain JSON (SQL text, names, the filter values a
 * person chose). Of the answer only `responseSummary` is kept unless the
 * options say otherwise, so no row values are held.
 */
export function traceService<T extends object>(name: string, service: T, recorder: Recorder, options: TraceServiceOptions = {}): T {
  const already = tracedOf(service);
  // Tracing what is already traced by this recorder traces it once, in the new scope.
  const target = (already && already.recorder === recorder ? already.target : service) as T;
  const merged: TraceServiceOptions = already && already.recorder === recorder ? { ...already.options, ...options } : options;
  const label = already && already.recorder === recorder ? already.name : name;
  const wrappers = new Map<PropertyKey, unknown>();
  const info: Traced = { target, recorder, name: label, options: merged };
  const scopeNow = () => (typeof merged.scope === "function" ? merged.scope() : merged.scope);

  return new Proxy(target, {
    get(held, prop) {
      if (prop === TRACED) return info;
      const value = Reflect.get(held, prop, held) as unknown;
      if (typeof value !== "function" || typeof prop !== "string") return value;
      const kept = wrappers.get(prop) as { fn: unknown; of: unknown } | undefined;
      if (kept && kept.of === value) return kept.fn;
      const fn = (...args: unknown[]) => {
        const span = recorder.start({ kind: "service", name: `${label}.${prop}`, detail: { service: label, method: prop, request: plain(args[0]) } }, scopeNow());
        const signal = (args[1] as { signal?: { aborted?: boolean } } | undefined)?.signal;
        let result: unknown;
        try {
          result = (value as (...a: unknown[]) => unknown).apply(held, args);
        } catch (error) {
          span.end(failed(error, signal));
          throw error;
        }
        const summarise = merged.responses?.[prop] ?? responseSummary;
        if (isAsyncIterable(result)) return traceStream(result, span, merged.streams?.[prop]?.() ?? counted(), signal);
        if (isThenable(result)) {
          return Promise.resolve(result).then(
            (answer) => {
              span.end({ detail: { response: summarise(answer) } });
              return answer;
            },
            (error: unknown) => {
              span.end(failed(error, signal));
              throw error;
            },
          );
        }
        span.end({ detail: { response: summarise(result) } });
        return result;
      };
      wrappers.set(prop, { fn, of: value });
      return fn;
    },
  });
}

const part = (item: unknown): { case?: string; value?: Record<string, unknown> } => ((item as { part?: { case?: string; value?: Record<string, unknown> } } | null)?.part ?? {});

/**
 * What is kept of a query's streamed result: the SQL the engine ran, the
 * notices, each column's name and type, whether a kept result was read, and
 * the number of batches, rows and bytes. The batches themselves are never
 * read or held.
 */
export function executeSummary(): StreamSummary {
  const out: JsonRecord = {};
  let batches = 0;
  let rows = 0;
  let bytes = 0;
  return {
    add(item) {
      const { case: kind, value } = part(item);
      if (!value) return;
      if (kind === "header") {
        if (typeof value.executedSql === "string") out.executedSql = plain(value.executedSql);
        if (typeof value.queryId === "string" && value.queryId) out.queryId = value.queryId;
        if (value.rewriteMode !== undefined) out.rewriteMode = plain(value.rewriteMode);
        if (Array.isArray(value.notices)) out.notices = plain(value.notices, { maxItems: 20, maxString: 1000 });
        if (Array.isArray(value.columns)) out.columns = value.columns.slice(0, 200).map((c: { name?: unknown; nativeType?: unknown }) => ({ name: String(c?.name ?? ""), type: String(c?.nativeType ?? "") })) as Json;
        if (value.stored && typeof value.stored === "object") out.stored = responseSummary(value.stored);
      } else if (kind === "batch") {
        batches++;
        rows += Number(value.rowCount ?? 0);
        bytes += ArrayBuffer.isView(value.arrowBatch) ? value.arrowBatch.byteLength : 0;
      } else if (kind === "footer") {
        out.totalRows = plain(value.totalRowsReturned ?? rows);
        out.truncated = value.truncated === true;
        out.elapsedMs = plain(value.elapsedMs ?? 0);
        if (value.nextCursor) out.more = true;
      }
    },
    result: () => ({ ...out, batches, rows, bytes }),
  };
}

/** The options `traceDataSource` adds: how a query's result is summarised. */
export const DATA_SOURCE_TRACE: TraceServiceOptions = { streams: { execute: executeSummary } };

/**
 * A `DataSource` that records every call. For a backend passed outside
 * `DataSourceProvider`, which traces itself when a recorder is above it.
 * A query is recorded with its SQL, the SQL the engine ran, notices, columns,
 * the row count and the time taken; never a row.
 */
export function traceDataSource<T extends object>(dataSource: T, recorder: Recorder, options: Pick<TraceServiceOptions, "scope"> = {}): T {
  return traceService("DataSource", dataSource, recorder, { ...DATA_SOURCE_TRACE, ...options });
}

/** One agent turn being recorded. */
export interface AgentTurn {
  readonly scope: TraceScope;
  /** Takes in one event of the turn's stream. */
  event(event: unknown): void;
  /** Ends the turn; with an error when it failed outside the stream. */
  end(error?: unknown): void;
}

const TEXT_KEPT = 8000;
const text = (value: unknown, max = 2000) => plain(String(value ?? ""), { maxString: max });

function requestDetail(request: unknown): JsonRecord {
  const r = (request ?? {}) as Record<string, unknown>;
  const input = (r.input ?? {}) as { case?: string; value?: unknown };
  const value = (input.value ?? {}) as Record<string, unknown>;
  const said: JsonRecord =
    input.case === "text"
      ? { case: "text", text: text(input.value, TEXT_KEPT) }
      : input.case === "action"
        ? { case: "action", name: text(value.name), surfaceId: text(value.surfaceId), sourceComponentId: text(value.sourceComponentId), context: plain(value.context) }
        : input.case === "approval"
          ? { case: "approval", id: text(value.id), allow: value.allow === true, answer: text(value.answer), reason: text(value.reason), digest: text(value.digest), edited: value.editedSql !== undefined || value.editedSubject !== undefined }
          : { case: String(input.case ?? "none") };
  const surfaces = Array.isArray(r.surfaces) ? (r.surfaces as Record<string, unknown>[]) : [];
  return {
    sessionId: text(r.sessionId),
    agentId: text(r.agentId),
    model: text(r.model),
    ...(r.contextPackId ? { contextPackId: text(r.contextPackId) } : {}),
    ...(Array.isArray(r.skillIds) ? { skillIds: plain(r.skillIds) } : {}),
    ...(Array.isArray(r.connectorIds) ? { connectorIds: plain(r.connectorIds) } : {}),
    input: said,
    references: plain(r.references ?? []),
    // Where each surface stands is told by name: its controls and what the person did. Its data model is not copied here.
    surfaces: surfaces.map((s) => ({ surfaceId: text(s.surfaceId), controls: plain(s.controls ?? {}), activity: plain(s.activity ?? []), contracts: Array.isArray(s.expects) ? s.expects.length : 0 })) as Json,
    surfaceErrors: plain(r.surfaceErrors ?? []),
  };
}

/**
 * Starts recording one turn with an agent: one trace. Feed it each event of
 * the turn's stream and end it. `traceAgent` and `useChat` both use it.
 * Kept: what was asked, the reply's text (cut when long), each step and tool
 * call, each approval asked for, usage, how many surface messages came, and
 * the error when there was one.
 */
export function agentTurn(recorder: Recorder, request: unknown): AgentTurn {
  const detail = requestDetail(request);
  const span = recorder.start({ kind: "agent", name: `turn: ${(detail.input as JsonRecord).case as string}`, detail: { request: detail } });
  const leave = recorder.enter(span.scope);
  let reply = "";
  let length = 0;
  let messages = 0;
  let failure: JsonRecord | undefined;
  let waiting = false;
  const steps = new Map<string, JsonRecord>();
  const approvals: JsonRecord[] = [];
  const more: JsonRecord = {};
  const now = (): Record<string, unknown> => ({ text: reply, textLength: length, steps: [...steps.values()], approvals, surfaceMessages: messages, ...more, ...(failure ? { error: failure } : {}) });
  return {
    scope: span.scope,
    event(event) {
      const { case: kind, value } = ((event as { event?: { case?: string; value?: Record<string, unknown> } } | null)?.event ?? {}) as { case?: string; value?: Record<string, unknown> };
      if (!kind || !value) return;
      if (kind === "text") {
        const delta = String(value.delta ?? "");
        length += delta.length;
        if (reply.length < TEXT_KEPT) reply = (reply + delta).slice(0, TEXT_KEPT);
        // Text arrives a few characters at a time; it is written to the log with the next thing that happens.
        return;
      }
      if (kind === "step") {
        const id = String(value.id ?? steps.size);
        steps.set(id, { id, title: text(value.title), status: plain(value.status), tool: text(value.tool), detail: text(value.detail, 4000), durationMs: plain(value.durationMs ?? 0) });
      } else if (kind === "surface") messages++;
      else if (kind === "approval") {
        waiting = true;
        approvals.push({ id: text(value.id), kind: plain(value.kind), title: text(value.title), detail: text(value.detail), sql: text(value.sql, 8000), risk: plain(value.risk), digest: text(value.digest), editable: value.editable === true, expiresAt: text(value.expiresAt) });
      } else if (kind === "usage") more.usage = plain(value);
      else if (kind === "suggestions") more.suggestions = Array.isArray(value.items) ? value.items.length : 0;
      else if (kind === "error") failure = { code: text(value.code), message: text(value.message, 4000) };
      else if (kind === "done") {
        waiting = false;
        more.sessionId = text(value.sessionId);
        more.generatedBy = text(value.generatedBy);
      }
      span.update({ detail: now() });
    },
    end(error) {
      leave();
      if (error !== undefined && !failure) failure = errorDetail(error);
      const cancelled = failure?.code === "CANCELLED" || failure?.name === "AbortError";
      span.end({ status: failure ? (cancelled ? "warning" : "error") : "ok", detail: { ...now(), ...(waiting ? { waitingForApproval: true } : {}) } });
    },
  };
}

/**
 * An `AgentBackend` that records every turn. For an agent used outside
 * `useChat` and `Chat`, which trace themselves when a recorder is above
 * them. Its other methods (`describeAgents`) are recorded as service calls.
 */
export function traceAgent<T extends { send(request: never, options?: never): AsyncIterable<unknown> }>(agent: T, recorder: Recorder): T {
  const already = tracedOf(agent);
  if (already && already.recorder === recorder) return agent;
  const rest = traceService("Agent", agent, recorder);
  const send = (request: unknown, options?: unknown): AsyncIterable<unknown> => ({
    [Symbol.asyncIterator]() {
      const turn = agentTurn(recorder, request);
      let inner: AsyncIterator<unknown>;
      try {
        inner = (agent.send as (r: unknown, o?: unknown) => AsyncIterable<unknown>).call(agent, request, options)[Symbol.asyncIterator]();
      } catch (error) {
        turn.end(error);
        throw error;
      }
      return {
        async next() {
          try {
            const step = await inner.next();
            if (step.done) turn.end();
            else turn.event(step.value);
            return step;
          } catch (error) {
            turn.end(error);
            throw error;
          }
        },
        async return(value?: unknown) {
          turn.end();
          return inner.return ? inner.return(value) : { done: true as const, value };
        },
      };
    },
  });
  return new Proxy(agent, {
    get(held, prop) {
      if (prop === TRACED) return { target: held, recorder, name: "Agent", options: {} } satisfies Traced;
      if (prop === "send") return send;
      return Reflect.get(rest, prop);
    },
  });
}
