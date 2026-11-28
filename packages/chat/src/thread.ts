import type { AgentEvent } from "@surfaces-ui/agent";
import type { JsonObject } from "@bufbuild/protobuf";
import { ApprovalKind, ApprovalRisk, StepStatus } from "@surfaces-ui/proto";
import { type Catalog, type SurfaceMessage, type Surfaces, applyMessage, isComponentIssue, upgradeMessage, upgradeSurface } from "@surfaces-ui/spec";
import type { DataRef } from "@surfaces-ui/components";

export interface ChatStep {
  id: string;
  title: string;
  status: "running" | "done" | "failed";
  tool: string;
  /** More to show when opened: the SQL run, an error message. */
  detail: string;
  durationMs: number;
}

export interface ChatApproval {
  id: string;
  kind: "permission" | "choice" | "input";
  title: string;
  detail: string;
  /** SQL the agent wants to run, when that is what needs approval. */
  sql: string;
  options: string[];
  /** What exactly is being approved, shown as JSON. */
  subject?: JsonObject;
  /** "sha256:…" of `{ sql, subject }`; the card refuses to offer approval when it does not match. */
  digest: string;
  /** ISO time after which it cannot be approved. Empty for no limit. */
  expiresAt: string;
  risk: "low" | "high" | "irreversible" | "";
  /** The person may change the SQL or subject before approving. */
  editable: boolean;
  reasonRequired: boolean;
  /** Different people who must allow it. */
  approvalsRequired: number;
  /** Decisions already made, when several people must decide. */
  approvals: ChatDecision[];
  /** What the request was based on, for the person to see. */
  basis: string;
  /** Set once the person has answered. */
  answer?: ChatApprovalAnswer;
}

/** Who decided, as the host identified them. */
export interface ChatActor {
  id: string;
  name: string;
}

export interface ChatDecision {
  by?: ChatActor;
  /** ISO time. */
  at: string;
  allow: boolean;
  reason: string;
}

export interface ChatApprovalAnswer extends ChatDecision {
  /** The chosen option or typed answer. */
  text: string;
  /** "sha256:…" of what was approved, edits included. */
  digest: string;
  editedSql?: string;
  editedSubject?: JsonObject;
}

/** One button in an actions part. What a press does is the host's to decide. */
export interface ChatButton {
  /** Reaches the host with the press; need only be unique within its row. */
  id: string;
  label: string;
  /** "primary" for the one thing most people will do; "danger" for what cannot be taken back. */
  variant?: "primary" | "danger";
  /** Shown but cannot be pressed. It stays reachable by keyboard so its reason can be read. */
  disabled?: boolean;
  /** Why it cannot be pressed (or, when it can, what it does). Its tooltip, and read with it. */
  reason?: string;
  /** A fuller name when the label alone is ambiguous: "Apply “Bold” from the chat". */
  ariaLabel?: string;
}

/** One of several alternatives in an actions part, with buttons of its own. */
export interface ChatChoice {
  id: string;
  title: string;
  detail?: string;
  buttons: ChatButton[];
}

/**
 * What a person can do about a reply, drawn under it: one set of buttons
 * ("Show on the page", "Discard", "Apply"), or several alternatives one row
 * each with buttons for the whole set after them ("Discard all"). Presses go
 * to `MessageList`'s `onPartAction`. Once handled, the host sets `outcome`,
 * which replaces every button.
 */
export interface ChatActions {
  id: string;
  title?: string;
  detail?: string;
  /** Alternatives to choose between, one row each. */
  choices?: ChatChoice[];
  /** Buttons for the whole set, after any choices. */
  buttons?: ChatButton[];
  /** What became of it ("Applied.", "Discarded."). Replaces the buttons. */
  outcome?: string;
}

/**
 * Something a person attached to a message that is not a table or a file of data: a picture, usually. The host
 * keeps the bytes; the thread keeps this description, which is what the message list shows.
 */
export interface ChatAttachment {
  /** Tells it apart, and lets the host find what it kept. Default: the name. */
  id?: string;
  /** The file's name, shown under or beside the thumbnail. */
  name: string;
  /** Its media type, such as "image/png". A thumbnail is drawn only for an `image/*` type. */
  mediaType: string;
  /** Its size in bytes, when known. */
  size?: number;
  /**
   * An address a small picture of it can be drawn from (a `blob:` URL the host made, a raster `data:image/` URL, an
   * http(s) or same-origin address). It comes from the host, never from a model: nothing an agent wrote is put here, and
   * an address that is not one of those kinds is ignored. A blob URL does not outlive the page, so a thread kept
   * across reloads shows the name alone until the host supplies a preview again.
   */
  preview?: string;
}

/** One piece of a reply, in the order it arrived. */
export type ChatPart =
  | { kind: "text"; text: string }
  /** Tables and columns a person attached to their message, by name. */
  | { kind: "references"; references: DataRef[] }
  /** Pictures and other files a person attached to their message that are not data (`ChatAttachment`). */
  | { kind: "attachments"; attachments: ChatAttachment[] }
  | { kind: "steps"; steps: ChatStep[] }
  /** A component the agent drew. `surfaceId` is the key into `ChatThread.surfaces`. */
  | { kind: "surface"; surfaceId: string }
  | { kind: "approval"; approval: ChatApproval }
  /** Buttons the host offers under a reply. Added by the host, never by an agent's events. */
  | { kind: "actions"; actions: ChatActions }
  | { kind: "error"; code: string; message: string };

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  parts: ChatPart[];
  /** The model or agent that answered. Always shown. */
  generatedBy: string;
  streaming: boolean;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  contextTokens: number;
  contextLimit: number;
  costUsd?: number;
}

export interface ChatThread {
  messages: ChatMessage[];
  /** Agent-drawn surfaces, keyed by message and the agent's own surface ID. */
  surfaces: Surfaces;
  /** "waiting" means the agent paused for the person's answer. */
  status: "idle" | "streaming" | "waiting";
  sessionId: string;
  usage?: ChatUsage;
  /** Things the person might say next. */
  suggestions: string[];
}

export type ChatAction =
  | { type: "user"; text: string; references?: DataRef[]; attachments?: ChatAttachment[] }
  /** A turn has started; the reply is added to the latest assistant message when `resume` is set. */
  | { type: "begin"; resume?: boolean }
  | { type: "event"; event: AgentEvent }
  | { type: "answered"; id: string; answer: ChatApprovalAnswer }
  | { type: "end" }
  | { type: "reset" }
  /** Replaces the thread with one loaded from storage (checked with `parseThread` first). */
  | { type: "restore"; thread: ChatThread };

export const emptyThread: ChatThread = { messages: [], surfaces: {}, status: "idle", sessionId: "", suggestions: [] };

const STEP_STATUS: Partial<Record<StepStatus, ChatStep["status"]>> = {
  [StepStatus.RUNNING]: "running",
  [StepStatus.DONE]: "done",
  [StepStatus.FAILED]: "failed",
};
const APPROVAL_KIND: Partial<Record<ApprovalKind, ChatApproval["kind"]>> = {
  [ApprovalKind.PERMISSION]: "permission",
  [ApprovalKind.CHOICE]: "choice",
  [ApprovalKind.INPUT]: "input",
};

const APPROVAL_RISK: Partial<Record<ApprovalRisk, ChatApproval["risk"]>> = {
  [ApprovalRisk.LOW]: "low",
  [ApprovalRisk.HIGH]: "high",
  [ApprovalRisk.IRREVERSIBLE]: "irreversible",
};

const SCOPE = ":";
/** The key a message's surface is stored under, so two replies can both use "main". */
export const surfaceKey = (messageId: number, surfaceId: string) => `m${messageId}${SCOPE}${surfaceId}`;
/** The agent's own ID for a stored surface, to send back with an action. */
export const agentSurfaceId = (key: string) => key.slice(key.indexOf(SCOPE) + 1);

function updateLast(thread: ChatThread, change: (message: ChatMessage) => ChatMessage): ChatThread {
  const index = thread.messages.findLastIndex((m) => m.role === "assistant");
  if (index < 0) return thread;
  return { ...thread, messages: thread.messages.map((m, i) => (i === index ? change(m) : m)) };
}

function withPart(message: ChatMessage, part: ChatPart): ChatMessage {
  return { ...message, parts: [...message.parts, part] };
}

function applySurface(thread: ChatThread, raw: unknown, catalog: Catalog): ChatThread {
  const message = thread.messages.findLast((m) => m.role === "assistant");
  if (!message) return thread;
  const fail = (text: string) => updateLast(thread, (m) => withPart(m, { kind: "error", code: "INVALID_SURFACE", message: text }));
  // A malformed envelope is refused; a malformed component is applied and reported where it is drawn.
  const fatal = catalog.validateMessage(raw).filter((issue) => !isComponentIssue(issue));
  if (fatal.length > 0) return fail(`The agent sent a view this page cannot draw: ${fatal[0]!.path} ${fatal[0]!.message}`);
  // What is kept is in the current version, whichever the agent wrote.
  const record = upgradeMessage(raw) as Record<string, { surfaceId: string }>;
  const kind = (["createSurface", "updateComponents", "updateDataModel", "deleteSurface"] as const).find((k) => record[k]);
  if (!kind) return thread;
  const key = surfaceKey(message.id, record[kind]!.surfaceId);
  const scoped = { ...record, [kind]: { ...record[kind], surfaceId: key } } as unknown as SurfaceMessage;
  try {
    const surfaces = applyMessage(thread.surfaces, scoped);
    const shown = message.parts.some((p) => p.kind === "surface" && p.surfaceId === key);
    const next = { ...thread, surfaces };
    return kind === "createSurface" && !shown ? updateLast(next, (m) => withPart(m, { kind: "surface", surfaceId: key })) : next;
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Folds user input and agent events into a thread. Pure: the same actions
 * always give the same thread, so a conversation can be replayed in tests.
 */
export function reduceThread(thread: ChatThread, action: ChatAction, catalog: Catalog): ChatThread {
  const nextId = (thread.messages.at(-1)?.id ?? 0) + 1;
  switch (action.type) {
    case "reset":
      return emptyThread;
    case "restore":
      return action.thread;
    case "user":
      return {
        ...thread,
        suggestions: [],
        messages: [
          ...thread.messages,
          { id: nextId, role: "user", parts: [
              { kind: "text", text: action.text },
              ...(action.references?.length ? [{ kind: "references" as const, references: action.references }] : []),
              ...(action.attachments?.length ? [{ kind: "attachments" as const, attachments: action.attachments }] : []),
            ], generatedBy: "", streaming: false },
        ],
      };
    case "begin": {
      const last = thread.messages.at(-1);
      if (action.resume && last?.role === "assistant") {
        return { ...updateLast(thread, (m) => ({ ...m, streaming: true })), status: "streaming", suggestions: [] };
      }
      return {
        ...thread,
        status: "streaming",
        suggestions: [],
        messages: [...thread.messages, { id: nextId, role: "assistant", parts: [], generatedBy: "", streaming: true }],
      };
    }
    case "answered":
      return {
        ...thread,
        messages: thread.messages.map((m) => ({
          ...m,
          parts: m.parts.map((p) =>
            p.kind === "approval" && p.approval.id === action.id ? { ...p, approval: { ...p.approval, answer: action.answer } } : p,
          ),
        })),
      };
    case "end": {
      const waiting = thread.messages.at(-1)?.parts.some((p) => p.kind === "approval" && !p.approval.answer) ?? false;
      return { ...updateLast(thread, (m) => ({ ...m, streaming: false })), status: waiting ? "waiting" : "idle" };
    }
    case "event": {
      const event = action.event.event;
      switch (event.case) {
        case "text":
          return updateLast(thread, (m) => {
            const last = m.parts.at(-1);
            if (last?.kind === "text") return { ...m, parts: [...m.parts.slice(0, -1), { kind: "text", text: last.text + event.value.delta }] };
            return withPart(m, { kind: "text", text: event.value.delta });
          });
        case "step": {
          const step: ChatStep = {
            id: event.value.id,
            title: event.value.title,
            status: STEP_STATUS[event.value.status] ?? "running",
            tool: event.value.tool,
            detail: event.value.detail,
            durationMs: Number(event.value.durationMs),
          };
          return updateLast(thread, (m) => {
            // An event for a step already shown updates it in place.
            if (m.parts.some((p) => p.kind === "steps" && p.steps.some((s) => s.id === step.id))) {
              return {
                ...m,
                parts: m.parts.map((p) =>
                  p.kind === "steps" ? { ...p, steps: p.steps.map((s) => (s.id === step.id ? { ...s, ...step, title: step.title || s.title, detail: step.detail || s.detail } : s)) } : p,
                ),
              };
            }
            const last = m.parts.at(-1);
            if (last?.kind === "steps") return { ...m, parts: [...m.parts.slice(0, -1), { kind: "steps", steps: [...last.steps, step] }] };
            return withPart(m, { kind: "steps", steps: [step] });
          });
        }
        case "surface":
          return applySurface(thread, event.value, catalog);
        case "approval": {
          const approval: ChatApproval = {
            id: event.value.id,
            kind: APPROVAL_KIND[event.value.kind] ?? "permission",
            title: event.value.title,
            detail: event.value.detail,
            sql: event.value.sql,
            options: event.value.options,
            ...(event.value.subject ? { subject: event.value.subject } : {}),
            digest: event.value.digest,
            expiresAt: event.value.expiresAt,
            risk: APPROVAL_RISK[event.value.risk] ?? "",
            editable: event.value.editable,
            reasonRequired: event.value.reasonRequired,
            approvalsRequired: Math.max(1, event.value.approvalsRequired),
            approvals: event.value.approvals.map((r) => ({
              ...(r.decidedBy ? { by: { id: r.decidedBy.id, name: r.decidedBy.name } } : {}),
              at: r.decidedAt,
              allow: r.allow,
              reason: r.reason,
            })),
            basis: event.value.basis,
          };
          return updateLast(thread, (m) => withPart(m, { kind: "approval", approval }));
        }
        case "usage":
          return {
            ...thread,
            usage: {
              inputTokens: Number(event.value.inputTokens),
              outputTokens: Number(event.value.outputTokens),
              contextTokens: Number(event.value.contextTokens),
              contextLimit: Number(event.value.contextLimit),
              costUsd: event.value.costUsd,
            },
          };
        case "suggestions":
          return { ...thread, suggestions: event.value.items };
        case "error":
          return updateLast(thread, (m) => withPart(m, { kind: "error", code: event.value.code, message: event.value.message }));
        case "done":
          return { ...updateLast(thread, (m) => ({ ...m, generatedBy: event.value.generatedBy || m.generatedBy })), sessionId: event.value.sessionId || thread.sessionId };
        default:
          return thread;
      }
    }
  }
}

const PART_KINDS = new Set(["text", "references", "attachments", "steps", "surface", "approval", "actions", "error"]);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Checks a thread loaded from storage before it is used, since anyone with
 * access to the storage can edit it. Returns undefined for anything that is
 * not a thread. A reply that was still streaming when the page closed is
 * marked as cut off; an approval nobody answered is still waiting. Surfaces
 * are checked against the catalog again when they are drawn.
 */
export function parseThread(input: unknown): ChatThread | undefined {
  if (!isRecord(input) || !Array.isArray(input.messages) || !isRecord(input.surfaces)) return undefined;
  const messages: ChatMessage[] = [];
  for (const raw of input.messages) {
    if (!isRecord(raw) || typeof raw.id !== "number" || (raw.role !== "user" && raw.role !== "assistant") || !Array.isArray(raw.parts)) return undefined;
    if (!raw.parts.every((p) => isRecord(p) && PART_KINDS.has(p.kind as string))) return undefined;
    const parts = raw.parts as ChatPart[];
    const cut = raw.streaming === true;
    messages.push({
      id: raw.id,
      role: raw.role,
      parts: cut ? [...parts, { kind: "error", code: "INTERRUPTED", message: "This reply was cut off when the page closed." }] : parts,
      generatedBy: typeof raw.generatedBy === "string" ? raw.generatedBy : "",
      streaming: false,
    });
  }
  const waiting = messages.at(-1)?.parts.some((p) => p.kind === "approval" && !p.approval.answer) ?? false;
  return {
    messages,
    // A thread kept before the move to A2UI v1.0 holds surfaces written for v0.9.
    surfaces: Object.fromEntries(Object.entries(input.surfaces as ChatThread["surfaces"]).map(([key, surface]) => [key, isRecord(surface) && isRecord(surface.components) ? upgradeSurface(surface) : surface])),
    status: waiting ? "waiting" : "idle",
    sessionId: typeof input.sessionId === "string" ? input.sessionId : "",
    ...(isRecord(input.usage) ? { usage: input.usage as unknown as ChatUsage } : {}),
    suggestions: Array.isArray(input.suggestions) ? input.suggestions.filter((s): s is string => typeof s === "string") : [],
  };
}
