import { type AgentBackend, type SendInit, approvalDigest, errorEvent } from "@surfaces-ui/agent";
import type { JsonObject } from "@bufbuild/protobuf";
import { type Catalog, type SurfaceAction, upgradeMessage } from "@surfaces-ui/spec";
import { type SurfaceNote, type SurfaceProblem, surfaceSnapshot } from "@surfaces-ui/spec/react";
import { type StateStorage, decodeState, encodeState } from "@surfaces-ui/state";
import type { DataRef } from "@surfaces-ui/components";
import { ObjectKind } from "@surfaces-ui/proto";
import { newHolder, recordMessage, traceAgent } from "@surfaces-ui/trace";
import { useRecorder } from "@surfaces-ui/trace/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";

/** One thing a person did in a surface, kept until the agent's next turn. */
export interface ChatActivity {
  componentId: string;
  kind: string;
  summary: string;
  subject?: Record<string, unknown>;
  at: string;
}

/** Where a surface stands on this page, and what a person has done in it that the agent has not been told. */
interface SurfaceLocal {
  data?: unknown;
  controls: Record<string, Record<string, unknown>>;
  activity?: ChatActivity[];
}

/** The most notes kept for one surface between turns; the oldest go first. */
const MAX_ACTIVITY = 40;

/** A reference as the contract carries it. */
const objectRef = (ref: DataRef) => ({
  sourceId: ref.sourceId,
  kind: ref.kind === "file" ? ObjectKind.FILE : ref.column ? ObjectKind.COLUMN : ObjectKind.TABLE,
  catalog: ref.catalog ?? "",
  schema: ref.schema ?? "",
  table: ref.table,
  column: ref.column ?? "",
  path: ref.path ?? "",
});
import { type ChatAction, type ChatActor, type ChatApprovalAnswer, type ChatThread, agentSurfaceId, emptyThread, parseThread, reduceThread } from "./thread.js";

export interface UseChatOptions {
  /** The catalog agent-drawn components are checked against. */
  catalog: Catalog;
  /** Which agent to talk to, when the backend has several. */
  agentId?: string;
  /** Limit the agent to the data in this saved context pack. */
  contextPackId?: string;
  /**
   * Who is using the chat, from the host's own sign-in. Recorded on every
   * approval answer (`decided_by`). A backend must still check it against
   * its own session.
   */
  user?: ChatActor;
  /**
   * Where to keep the conversation so it survives a reload: the thread,
   * where each surface stands, and approvals still waiting. Use
   * `browserStorage()` from `@surfaces-ui/state` for this browser, or your own
   * `StateStorage` over a server so another person can pick up a waiting
   * approval. Nothing is kept without it.
   */
  storage?: StateStorage;
  /** The key the conversation is kept under. Defaults to "surfaces.chat". */
  storageKey?: string;
  /**
   * The thread to open with: a saved conversation (`conversationThread`) or a
   * written one (`scriptThread`). Read once; a kept conversation in `storage`
   * does not replace it.
   */
  initial?: ChatThread;
  /**
   * What the person chose for this conversation: the agent, the model, and
   * the skills and connectors that are on. Sent with every turn; the backend
   * refuses anything it does not offer. Leave it out to use the agent's defaults.
   */
  settings?: ChatSettings;
}

/** A person's choices for a conversation, as plain JSON a host or a saved conversation can hold. */
export interface ChatSettings {
  agentId?: string;
  /** Empty or left out: the agent's default. */
  model?: string;
  /**
   * Where the model runs, when the host offers several (`ChatProvider`): the
   * host turns it into its own backend. Neither it nor the model picked under
   * it is sent with a turn: the host passes the model to that backend.
   */
  provider?: string;
  /** Given: exactly these are on. Left out: each one's default. */
  skillIds?: string[];
  connectorIds?: string[];
  /** The data connection the person browses and attaches from. Not sent: what the agent sees is what they attach. */
  sourceId?: string;
}

/** The parts of a turn request that carry a person's choices. */
export function settingsRequest(settings: ChatSettings | undefined, agentId?: string) {
  const chosen = settings?.skillIds !== undefined || settings?.connectorIds !== undefined;
  return {
    agentId: settings?.agentId || agentId || "",
    // A model picked under a provider is the host's to hand its own backend, which is the one that knows it.
    model: settings?.provider ? "" : (settings?.model ?? ""),
    ...(chosen ? { choicesSet: true, skillIds: settings?.skillIds ?? [], connectorIds: settings?.connectorIds ?? [] } : {}),
  };
}

/** A person's answer to an approval. */
export interface ApprovalReply {
  allow: boolean;
  /** The chosen option or typed answer. */
  text?: string;
  /** Why, in their words. */
  reason?: string;
  /** Their version of the SQL, when the request was editable. */
  editedSql?: string;
  /** Their version of the subject, when the request was editable. */
  editedSubject?: JsonObject;
}

export interface UseChat {
  thread: ChatThread;
  /** Sends what the person typed, with any tables and columns they attached. */
  send(text: string, references?: DataRef[]): void;
  /** Answers an approval the agent is waiting on, recording who, when and why, and the digest of what was approved. */
  answer(id: string, reply: ApprovalReply): void;
  /** Sends an event from a control on an agent-drawn component. */
  act(action: SurfaceAction): void;
  /**
   * Records where an agent-drawn surface stands: its data model after a
   * person typed, or one component's controls. Nothing is sent now; every
   * later turn carries it (`SendRequest.surfaces`).
   */
  report(surfaceKey: string, state: { data?: unknown; componentId?: string; controls?: Record<string, unknown>; note?: SurfaceNote }): void;
  /** Records a problem with an agent-drawn surface, to tell the agent on the next turn (`SendRequest.surface_errors`). */
  problem(surfaceKey: string, problem: SurfaceProblem): void;
  /** Stops the reply in progress. */
  stop(): void;
  /** Starts a new conversation, forgetting the kept one too. */
  reset(): void;
  /** False until a kept conversation has been loaded (always true without `storage`). */
  ready: boolean;
}

/**
 * Runs a conversation against any AgentBackend and keeps its thread. One
 * turn streams at a time; starting another stops the one in progress.
 */
export function useChat(given: AgentBackend, options: UseChatOptions): UseChat {
  const { catalog, agentId, contextPackId, user, storage, storageKey = "surfaces.chat" } = options;
  // Dev tools: with a recorder above, each turn is one trace and each surface message is recorded. Without one, nothing here runs.
  const recorder = useRecorder();
  const agent = useMemo(() => (recorder ? traceAgent(given, recorder) : given), [given, recorder]);
  const holder = useRef<string | undefined>(undefined);
  const [thread, send_] = useReducer((state: ChatThread, action: ChatAction) => reduceThread(state, action, catalog), options.initial ?? emptyThread);
  const controller = useRef<AbortController | undefined>(undefined);
  const sessionId = useRef("");
  sessionId.current = thread.sessionId;
  const settings = useRef(options.settings);
  settings.current = options.settings;
  const latest = useRef(thread);
  latest.current = thread;
  // The thread as it stands after every action so far, kept only while tracing: what the reducer made of a
  // surface message (which surface it changed, or why it was refused) is read from it as the message arrives.
  const shadow = useRef<ChatThread | undefined>(undefined);
  const dispatch = useCallback(
    (action: ChatAction) => {
      if (recorder) {
        const before = shadow.current ?? latest.current;
        const after = reduceThread(before, action, catalog);
        shadow.current = after;
        const prefix = `${(holder.current ??= newHolder("c"))}:`;
        if (action.type === "event" && action.event.event.case === "surface") {
          const raw = action.event.event.value;
          const key = Object.keys(after.surfaces).find((k) => after.surfaces[k] !== before.surfaces[k]) ?? Object.keys(before.surfaces).find((k) => !(k in after.surfaces));
          const refused = after.messages.at(-1)?.parts.at(-1);
          const error = key === undefined && refused?.kind === "error" && refused !== before.messages.at(-1)?.parts.at(-1) ? { code: refused.code, message: refused.message } : undefined;
          const event = recordMessage(recorder, { format: "a2ui", key: `${prefix}${key ?? ""}`, raw, message: upgradeMessage(raw), issues: catalog.validateMessage(raw), applied: key !== undefined, ...(error ? { error } : {}) });
          if (error) recorder.record({ kind: "problem", name: error.code, status: "error", surfaceId: event.surfaceId, detail: { code: error.code, path: "/", message: error.message } }, { traceId: event.traceId, spanId: event.spanId });
        } else if (action.type === "reset" || action.type === "restore") recorder.record({ kind: "state", name: "reset", detail: { prefix } });
      } else shadow.current = undefined;
      send_(action);
    },
    [recorder, catalog],
  );
  if (recorder) for (const [key, surface] of Object.entries(thread.surfaces)) recorder.tag(surface, `${(holder.current ??= newHolder("c"))}:${key}`);
  // A surface that came with the thread (a saved or written conversation) has no recorded messages: it is recorded whole.
  useLayoutEffect(() => {
    if (!recorder) return;
    for (const [key, surface] of Object.entries(thread.surfaces)) {
      const traced = `${(holder.current ??= newHolder("c"))}:${key}`;
      if (!recorder.surfaceScope(traced)) recordMessage(recorder, { format: "surface", key: traced, raw: surfaceSnapshot(surface), snapshot: true, name: "surface" });
    }
  }, [recorder, thread.surfaces]);
  // Where each surface stands on this page, and problems not yet told to the agent.
  const states = useRef(new Map<string, SurfaceLocal>());
  const pending = useRef<{ surfaceId: string; code: string; path: string; message: string }[]>([]);
  const toldErrors = useRef(0);
  const [ready, setReady] = useState(!storage);

  // Load a kept conversation once, then keep it after every change.
  useEffect(() => {
    if (!storage) return;
    let live = true;
    void (async () => {
      try {
        const text = await storage.load(storageKey);
        const saved = text ? (decodeState(text) as { version?: number; thread?: unknown; states?: unknown; pending?: unknown; toldErrors?: unknown }) : undefined;
        const restored = saved?.version === STORE_VERSION ? parseThread(saved.thread) : undefined;
        if (live && restored && latest.current.messages.length === 0) {
          dispatch({ type: "restore", thread: restored });
          if (saved?.states && typeof saved.states === "object") states.current = new Map(Object.entries(saved.states as Record<string, SurfaceLocal>));
          if (Array.isArray(saved?.pending)) pending.current = saved.pending as typeof pending.current;
          if (typeof saved?.toldErrors === "number") toldErrors.current = saved.toldErrors;
        }
      } catch {
        // A kept conversation that cannot be read is ignored, not fatal.
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [storage, storageKey]);
  const save = useCallback(() => {
    if (!storage) return;
    const record = { version: STORE_VERSION, thread: latest.current, states: Object.fromEntries(states.current), pending: pending.current, toldErrors: toldErrors.current };
    void storage.save(storageKey, encodeState(record));
  }, [storage, storageKey]);
  useEffect(() => {
    if (!ready || !storage) return;
    const timer = setTimeout(save, thread.status === "streaming" ? 500 : 0);
    return () => clearTimeout(timer);
  }, [thread, ready, storage, save]);

  const run = useCallback(
    (input: NonNullable<SendInit["input"]>, resume = false, references: DataRef[] = []) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      dispatch({ type: "begin", resume });
      void (async () => {
        try {
          const { surfaces, surfaceErrors } = takeState(latest.current, states.current, pending, toldErrors);
          for await (const event of agent.send({ sessionId: sessionId.current, ...settingsRequest(settings.current, agentId), contextPackId, input, surfaces, surfaceErrors, references: references.map(objectRef) }, { signal: current.signal })) {
            if (current.signal.aborted) break;
            dispatch({ type: "event", event });
          }
        } catch (error) {
          if (!current.signal.aborted) dispatch({ type: "event", event: errorEvent(error) });
        } finally {
          if (controller.current === current) {
            controller.current = undefined;
            dispatch({ type: "end" });
          }
        }
      })();
    },
    [agent, agentId, contextPackId, dispatch],
  );

  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(
    (text: string, references: DataRef[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      dispatch({ type: "user", text: trimmed, references });
      run({ case: "text", value: trimmed }, false, references);
    },
    [run, dispatch],
  );
  const answer = useCallback(
    (id: string, reply: ApprovalReply) => {
      const approval = latest.current.messages.flatMap((m) => m.parts).find((p) => p.kind === "approval" && p.approval.id === id);
      const request = approval?.kind === "approval" ? approval.approval : undefined;
      void (async () => {
        // The digest of what the person approved: their edited version when they changed it.
        const digest = await approvalDigest({ sql: reply.editedSql ?? request?.sql, subject: reply.editedSubject ?? request?.subject });
        const decided: ChatApprovalAnswer = {
          allow: reply.allow,
          text: reply.text ?? "",
          reason: reply.reason?.trim() ?? "",
          at: new Date().toISOString(),
          digest,
          ...(user ? { by: user } : {}),
          ...(reply.editedSql !== undefined ? { editedSql: reply.editedSql } : {}),
          ...(reply.editedSubject ? { editedSubject: reply.editedSubject } : {}),
        };
        dispatch({ type: "answered", id, answer: decided });
        run(
          {
            case: "approval",
            value: {
              id,
              allow: decided.allow,
              answer: decided.text,
              reason: decided.reason,
              decidedAt: decided.at,
              digest,
              ...(user ? { decidedBy: user } : {}),
              ...(decided.editedSql !== undefined ? { editedSql: decided.editedSql } : {}),
              ...(decided.editedSubject ? { editedSubject: decided.editedSubject } : {}),
            },
          },
          true,
        );
      })();
    },
    [run, user, dispatch],
  );
  const act = useCallback(
    (action: SurfaceAction) =>
      run({
        case: "action",
        value: {
          name: action.name,
          surfaceId: agentSurfaceId(action.surfaceId),
          sourceComponentId: action.sourceComponentId,
          timestamp: action.timestamp,
          // Values travel as JSON; anything that is not JSON (a bigint) is sent as text.
          context: asJson(action.context),
          ...(action.dataModel !== undefined ? { dataModel: asJson(action.dataModel) } : {}),
          ...(user ? { actor: user } : {}),
        },
      }),
    [run, user],
  );
  const report = useCallback<UseChat["report"]>((key, state) => {
    const entry = states.current.get(key) ?? { controls: {} };
    if (state.data !== undefined) entry.data = state.data;
    if (state.componentId && state.controls) entry.controls[state.componentId] = state.controls;
    if (state.componentId && state.note) {
      // What a person did, for the agent's context on its next turn. The same thing twice in a row is told once.
      const last = entry.activity?.at(-1);
      if (!(last && last.componentId === state.componentId && last.kind === state.note.kind && last.summary === state.note.summary)) {
        entry.activity = [...(entry.activity ?? []), { componentId: state.componentId, kind: state.note.kind, summary: state.note.summary, ...(state.note.subject ? { subject: state.note.subject } : {}), at: new Date().toISOString() }].slice(-MAX_ACTIVITY);
      }
    }
    states.current.set(key, entry);
    save();
  }, [save]);
  const problem = useCallback<UseChat["problem"]>((key, p) => {
    const message = { surfaceId: agentSurfaceId(key), code: p.code, path: p.path, message: p.message };
    // The same problem is reported once, however often the surface is drawn.
    if (!pending.current.some((e) => e.surfaceId === message.surfaceId && e.path === message.path && e.message === message.message)) pending.current.push(message);
    save();
  }, [save]);
  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
    dispatch({ type: "end" });
  }, [dispatch]);
  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
    states.current = new Map();
    pending.current = [];
    toldErrors.current = 0;
    dispatch({ type: "reset" });
  }, [dispatch]);

  return { thread, send, answer, act, report, problem, stop, reset, ready };
}

/** Bump when the kept shape changes; older conversations are then dropped. */
const STORE_VERSION = 1;

/** Values travel as JSON; anything that is not JSON (a bigint) is sent as text. */
const asJson = (value: unknown): JsonObject => {
  const plain = JSON.parse(JSON.stringify(value ?? {}, (_, v) => (typeof v === "bigint" ? String(v) : v))) as unknown;
  return plain && typeof plain === "object" && !Array.isArray(plain) ? (plain as JsonObject) : { value: plain as JsonObject[string] };
};

/**
 * What goes with every turn: each agent surface as it now stands (the
 * latest one for each of the agent's surface IDs), and problems not yet
 * reported, including views the chat refused to draw.
 */
function takeState(
  thread: ChatThread,
  states: Map<string, SurfaceLocal>,
  pending: { current: { surfaceId: string; code: string; path: string; message: string }[] },
  toldErrors: { current: number },
): Pick<SendInit, "surfaces" | "surfaceErrors"> {
  const latestKey = new Map<string, string>();
  for (const key of Object.keys(thread.surfaces)) latestKey.set(agentSurfaceId(key), key);
  const surfaces = [...latestKey.entries()].map(([surfaceId, key]) => {
    const surface = thread.surfaces[key]!;
    const local = states.get(key);
    return {
      surfaceId,
      dataModel: asJson(local?.data ?? surface.data),
      controls: Object.fromEntries(Object.entries(local?.controls ?? {}).map(([id, c]) => [id, asJson(c)])),
      expects: Object.entries(surface.expects ?? {}).map(([event, schema]) => ({ event, schema: asJson(schema) })),
      activity: (local?.activity ?? []).map((a) => ({ componentId: a.componentId, kind: a.kind, summary: a.summary, at: a.at, ...(a.subject ? { subject: asJson(a.subject) } : {}) })),
    };
  });
  // Told once: what was done before this turn is not repeated on the next.
  for (const local of states.values()) if (local.activity?.length) local.activity = [];
  const refused = thread.messages.flatMap((m) => m.parts.flatMap((p) => (p.kind === "error" && p.code === "INVALID_SURFACE" ? [p.message] : [])));
  const fresh = refused.slice(toldErrors.current).map((message) => ({ surfaceId: "", code: "INVALID_MESSAGE", path: "/", message }));
  toldErrors.current = refused.length;
  const surfaceErrors = [...pending.current, ...fresh];
  pending.current = [];
  return { surfaces, surfaceErrors };
}
