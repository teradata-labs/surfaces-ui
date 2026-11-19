import { create } from "@bufbuild/protobuf";
import {
  type DeleteSurfaceRequestSchema,
  type DeleteSurfaceResponse,
  type GetSurfaceRequestSchema,
  type GetSurfaceResponse,
  type ListSurfacesRequestSchema,
  type ListSurfacesResponse,
  SavedSurfaceSchema,
  type SaveSurfaceRequestSchema,
  type SaveSurfaceResponse,
  SurfaceKind,
  type SurfaceSummary,
} from "@surfaces-ui/proto";
import type { DescMessage, JsonObject, MessageInitShape } from "@bufbuild/protobuf";
import { type ConversationDocument, conversationDocument, parseConversation } from "./conversation.js";
import type { ChatThread } from "./thread.js";

/** One saved conversation, as a list shows it. Plain JSON. */
export interface ChatSessionSummary {
  id: string;
  title: string;
  /** ISO times. */
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  model?: string;
  /** Data sources the conversation used, by id. */
  sources: string[];
  tags: string[];
  pinned: boolean;
  messageCount: number;
  /** The last thing said, as text only. */
  lastMessage: string;
}

/** What to keep of a conversation. */
export interface ChatSessionSave {
  /** Left out for a new conversation. */
  id?: string;
  /** Left out: taken from the first thing the person said. */
  title?: string;
  thread: ChatThread;
  agentId?: string;
  model?: string;
  sources?: string[];
  tags?: string[];
}

/**
 * Where conversations are kept. `librarySessions` keeps them in a surface
 * library as saved surfaces of kind conversation; `memorySessions` keeps them
 * in memory, for tests and demos; a host may write its own.
 */
export interface ChatSessions {
  list(): Promise<ChatSessionSummary[]>;
  load(id: string): Promise<ConversationDocument>;
  save(session: ChatSessionSave): Promise<ChatSessionSummary>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
}

const textOf = (thread: ChatThread, role?: "user" | "assistant") => {
  const messages = role ? thread.messages.filter((m) => m.role === role) : thread.messages;
  const pick = role === "user" ? messages[0] : messages.at(-1);
  return (pick?.parts ?? [])
    .flatMap((p) => (p.kind === "text" ? [p.text] : []))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};
const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

/** A conversation's title from the first thing the person said. */
export const sessionTitle = (thread: ChatThread) => clip(textOf(thread, "user"), 60) || "New conversation";

/** The sources a conversation attached, by id. */
export function sessionSources(thread: ChatThread): string[] {
  const out = new Set<string>();
  for (const message of thread.messages) for (const part of message.parts) if (part.kind === "references") for (const ref of part.references) if (ref.sourceId) out.add(ref.sourceId);
  return [...out];
}

function summaryOf(save: ChatSessionSave, id: string, createdAt: string, updatedAt: string, pinned: boolean): ChatSessionSummary {
  return {
    id,
    title: save.title?.trim() || sessionTitle(save.thread),
    createdAt,
    updatedAt,
    ...(save.agentId ? { agentId: save.agentId } : {}),
    ...(save.model ? { model: save.model } : {}),
    sources: [...new Set([...(save.sources ?? []), ...sessionSources(save.thread)])],
    tags: save.tags ?? [],
    pinned,
    messageCount: save.thread.messages.length,
    lastMessage: clip(textOf(save.thread), 160),
  };
}

const newId = (taken: (id: string) => boolean) => {
  for (let n = 0; ; n++) {
    const id = `chat-${Date.now().toString(36)}${n ? `-${n}` : ""}`;
    if (!taken(id)) return id;
  }
};

/** Conversations in memory. */
export function memorySessions(options: { now?(): Date } = {}): ChatSessions {
  const now = () => (options.now?.() ?? new Date()).toISOString();
  const kept = new Map<string, { summary: ChatSessionSummary; document: ConversationDocument }>();
  const get = (id: string) => {
    const found = kept.get(id);
    if (!found) throw new Error(`No conversation "${id}".`);
    return found;
  };
  return {
    async list() {
      return [...kept.values()].map((k) => ({ ...k.summary }));
    },
    async load(id) {
      return structuredClone(get(id).document);
    },
    async save(save) {
      const before = save.id ? kept.get(save.id) : undefined;
      const id = before?.summary.id ?? save.id ?? newId((x) => kept.has(x));
      const summary = summaryOf(save, id, before?.summary.createdAt ?? now(), now(), before?.summary.pinned ?? false);
      kept.set(id, { summary, document: conversationDocument(save.thread, { id, title: summary.title }) });
      return { ...summary };
    },
    async rename(id, title) {
      const k = get(id);
      k.summary = { ...k.summary, title };
      k.document = { ...k.document, title };
    },
    async remove(id) {
      kept.delete(id);
    },
    async pin(id, pinned) {
      const k = get(id);
      k.summary = { ...k.summary, pinned };
    },
  };
}

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>) => Promise<Res>;
/** The part of a `SurfaceLibrary` (`@surfaces-ui/data`) that conversations need. */
export interface ConversationLibrary {
  listSurfaces: Unary<typeof ListSurfacesRequestSchema, ListSurfacesResponse>;
  getSurface: Unary<typeof GetSurfaceRequestSchema, GetSurfaceResponse>;
  saveSurface: Unary<typeof SaveSurfaceRequestSchema, SaveSurfaceResponse>;
  deleteSurface: Unary<typeof DeleteSurfaceRequestSchema, DeleteSurfaceResponse>;
}

// What a list needs travels in the summary's tags, so the list is one call; a person's own tags have no colon.
const META = ["agent:", "model:", "source:", "created:", "messages:"] as const;
const PINNED = "pinned";

function fromLibrary(s: Pick<SurfaceSummary, "id" | "title" | "description" | "tags" | "updatedAt">): ChatSessionSummary {
  const tag = (prefix: string) => s.tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
  const agentId = tag("agent:")[0];
  const model = tag("model:")[0];
  return {
    id: s.id,
    title: s.title,
    createdAt: tag("created:")[0] ?? s.updatedAt,
    updatedAt: s.updatedAt,
    ...(agentId ? { agentId } : {}),
    ...(model ? { model } : {}),
    sources: tag("source:"),
    tags: s.tags.filter((t) => t !== PINNED && !META.some((m) => t.startsWith(m))),
    pinned: s.tags.includes(PINNED),
    messageCount: Number(tag("messages:")[0] ?? 0),
    lastMessage: s.description,
  };
}

function toTags(summary: ChatSessionSummary): string[] {
  return [
    ...summary.tags.filter((t) => t && !t.includes(":") && t !== PINNED),
    ...(summary.pinned ? [PINNED] : []),
    ...(summary.agentId ? [`agent:${summary.agentId}`] : []),
    ...(summary.model ? [`model:${summary.model}`] : []),
    ...summary.sources.map((s) => `source:${s}`),
    `created:${summary.createdAt}`,
    `messages:${summary.messageCount}`,
  ];
}

/**
 * Conversations kept in a surface library, each a saved surface of kind
 * conversation holding a `ConversationDocument`, so the Library shows them
 * too. Every save is a version.
 */
export function librarySessions(library: ConversationLibrary, options: { savedBy?: string } = {}): ChatSessions {
  const current = async (id: string) => {
    try {
      return (await library.getSurface({ id })).surface;
    } catch {
      return undefined;
    }
  };
  const write = async (summary: ChatSessionSummary, document: ConversationDocument, expectedVersion: number, note: string) => {
    await library.saveSurface({
      surface: create(SavedSurfaceSchema, {
        id: summary.id,
        kind: SurfaceKind.CONVERSATION,
        title: summary.title,
        description: summary.lastMessage,
        document: document as unknown as JsonObject,
        tags: toTags(summary),
        savedBy: options.savedBy ?? "",
      }),
      expectedVersion,
      note,
    });
  };
  const change = async (id: string, edit: (summary: ChatSessionSummary, document: ConversationDocument) => [ChatSessionSummary, ConversationDocument], note: string) => {
    const surface = await current(id);
    const document = parseConversation(surface?.document);
    if (!surface || !document) throw new Error(`No conversation "${id}".`);
    const summary = fromLibrary(surface);
    const [nextSummary, nextDocument] = edit(summary, document);
    await write(nextSummary, nextDocument, surface.version, note);
  };
  return {
    async list() {
      const out: ChatSessionSummary[] = [];
      let pageToken = "";
      do {
        const page = await library.listSurfaces({ kind: SurfaceKind.CONVERSATION, pageToken, pageSize: 200 });
        out.push(...page.surfaces.map(fromLibrary));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return out;
    },
    async load(id) {
      const document = parseConversation((await library.getSurface({ id })).surface?.document);
      if (!document) throw new Error(`"${id}" is not a conversation that can be opened.`);
      return { ...document, id };
    },
    async save(save) {
      const before = save.id ? await current(save.id) : undefined;
      const prior = before ? fromLibrary(before) : undefined;
      const id = before?.id ?? save.id ?? newId(() => false);
      const at = new Date().toISOString();
      const summary = summaryOf({ ...save, title: save.title ?? prior?.title, tags: save.tags ?? prior?.tags }, id, prior?.createdAt ?? at, at, prior?.pinned ?? false);
      await write(summary, conversationDocument(save.thread, { id, title: summary.title }), before?.version ?? 0, "Conversation saved");
      return summary;
    },
    async rename(id, title) {
      await change(id, (s, d) => [{ ...s, title }, { ...d, title }], "Renamed");
    },
    async remove(id) {
      await library.deleteSurface({ id });
    },
    async pin(id, pinned) {
      await change(id, (s, d) => [{ ...s, pinned }, d], pinned ? "Pinned" : "Unpinned");
    },
  };
}
