import type { StateStorage } from "./storage.js";
import { create, type DescMessage, type JsonObject, type MessageInitShape } from "@bufbuild/protobuf";
import {
  type DeleteSurfaceRequestSchema,
  type DeleteSurfaceResponse,
  DeleteSurfaceResponseSchema,
  type GetSurfaceRequestSchema,
  type GetSurfaceResponse,
  GetSurfaceResponseSchema,
  type ListSurfacesRequestSchema,
  type ListSurfacesResponse,
  ListSurfacesResponseSchema,
  type ListSurfaceVersionsRequestSchema,
  type ListSurfaceVersionsResponse,
  ListSurfaceVersionsResponseSchema,
  type SavedSurface,
  SavedSurfaceSchema,
  type SaveSurfaceRequestSchema,
  type SaveSurfaceResponse,
  SaveSurfaceResponseSchema,
  SurfaceKind,
  SurfaceSummarySchema,
  SurfaceVersionSchema,
} from "@surfaces-ui/proto";
import type { CallOptions } from "./datasource.js";

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Saved surfaces: page documents a person kept, each versioned and given a
 * kind. Any backend can hold them: memory, the browser's storage, files on
 * a server, or a consumer's own store.
 */
export interface SurfaceLibrary {
  listSurfaces: Unary<typeof ListSurfacesRequestSchema, ListSurfacesResponse>;
  getSurface: Unary<typeof GetSurfaceRequestSchema, GetSurfaceResponse>;
  /** Fails with `StaleSurfaceError` when `expectedVersion` is not the latest. */
  saveSurface: Unary<typeof SaveSurfaceRequestSchema, SaveSurfaceResponse>;
  deleteSurface: Unary<typeof DeleteSurfaceRequestSchema, DeleteSurfaceResponse>;
  listSurfaceVersions: Unary<typeof ListSurfaceVersionsRequestSchema, ListSurfaceVersionsResponse>;
}

/** Someone else saved a newer version since this edit began. */
export class StaleSurfaceError extends Error {
  constructor(
    readonly id: string,
    readonly latest: number,
  ) {
    super(`This surface was saved by someone else since you opened it (now version ${latest}). Reload it before saving.`);
    this.name = "StaleSurfaceError";
  }
}

/** One stored version, as plain JSON. */
export interface StoredSurfaceVersion {
  id: string;
  kind: SurfaceKind;
  title: string;
  description: string;
  document: JsonObject;
  tags: string[];
  version: number;
  updatedAt: string;
  savedBy: string;
  generatedBy: string;
  note: string;
}

export interface MemorySurfaceLibraryOptions {
  /** Keep the library somewhere that outlives the page. Without it, memory only. */
  storage?: StateStorage;
  /** Storage key. */
  key?: string;
  /** Versions kept per surface; older ones are dropped. Default 20. */
  maxVersions?: number;
  now?(): Date;
}

export function slugId(title: string, taken: (id: string) => boolean): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .slice(0, 48) || "surface";
  let id = base;
  for (let n = 2; taken(id); n++) id = `${base}-${n}`;
  return id;
}

const toMessage = (v: StoredSurfaceVersion): SavedSurface =>
  create(SavedSurfaceSchema, { id: v.id, kind: v.kind, title: v.title, description: v.description, document: v.document, tags: v.tags, version: v.version, updatedAt: v.updatedAt, savedBy: v.savedBy, generatedBy: v.generatedBy });

function parseStored(value: unknown): Record<string, StoredSurfaceVersion[]> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, StoredSurfaceVersion[]> = {};
  for (const [id, versions] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(versions)) continue;
    const ok = versions.filter((v): v is StoredSurfaceVersion => !!v && typeof v === "object" && typeof (v as StoredSurfaceVersion).version === "number" && typeof (v as StoredSurfaceVersion).document === "object");
    if (ok.length > 0) out[id] = ok;
  }
  return out;
}

/**
 * A library held in memory, optionally written through to storage (the
 * browser's localStorage, a file, anything with load and save).
 */
export function memorySurfaceLibrary(options: MemorySurfaceLibraryOptions = {}): SurfaceLibrary {
  const key = options.key ?? "surfaces-library";
  const maxVersions = Math.max(1, options.maxVersions ?? 20);
  const now = options.now ?? (() => new Date());
  let all: Record<string, StoredSurfaceVersion[]> | undefined;

  const load = async () => {
    if (!all) {
      let raw: unknown;
      try {
        const text = options.storage ? await options.storage.load(key) : undefined;
        raw = text ? JSON.parse(text) : undefined;
      } catch {
        raw = undefined;
      }
      all ??= parseStored(raw);
    }
    return all;
  };
  const save = async () => {
    if (options.storage && all) await options.storage.save(key, JSON.stringify(all));
  };
  const latest = (versions: StoredSurfaceVersion[]) => versions[versions.length - 1] as StoredSurfaceVersion;

  return {
    async listSurfaces(request) {
      const store = await load();
      const tags = request.tags ?? [];
      const kind = request.kind ?? SurfaceKind.UNSPECIFIED;
      const rows = Object.values(store)
        .map(latest)
        .filter((s) => (kind === SurfaceKind.UNSPECIFIED || s.kind === kind) && tags.every((t) => s.tags.includes(t)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
      const start = request.pageToken ? Number(request.pageToken) : 0;
      const size = request.pageSize || 200;
      return create(ListSurfacesResponseSchema, {
        surfaces: rows.slice(start, start + size).map((s) => create(SurfaceSummarySchema, { id: s.id, kind: s.kind, title: s.title, description: s.description, tags: s.tags, version: s.version, updatedAt: s.updatedAt })),
        nextPageToken: start + size < rows.length ? String(start + size) : "",
      });
    },
    async getSurface(request) {
      const versions = (await load())[request.id ?? ""];
      if (!versions) throw new Error(`No saved surface "${request.id}".`);
      const found = request.version ? versions.find((v) => v.version === request.version) : latest(versions);
      if (!found) throw new Error(`Version ${request.version} of "${request.id}" is no longer kept.`);
      return create(GetSurfaceResponseSchema, { surface: toMessage(found) });
    },
    async saveSurface(request) {
      const store = await load();
      const input = request.surface ?? {};
      const expected = request.expectedVersion ?? 0;
      let id = input.id ?? "";
      const existing = id ? store[id] : undefined;
      if (existing) {
        const current = latest(existing).version;
        if (expected !== current) throw new StaleSurfaceError(id, current);
      } else if (expected !== 0) {
        throw new StaleSurfaceError(id, 0);
      }
      if (!id) id = slugId(input.title || "surface", (candidate) => candidate in store);
      if (!input.document || typeof input.document !== "object") throw new Error("A saved surface needs a document.");
      const version: StoredSurfaceVersion = {
        id,
        kind: input.kind ?? SurfaceKind.OTHER,
        title: input.title || "Untitled",
        description: input.description ?? "",
        document: structuredClone(input.document) as JsonObject,
        tags: [...new Set(input.tags ?? [])],
        version: (existing ? latest(existing).version : 0) + 1,
        updatedAt: now().toISOString(),
        savedBy: input.savedBy ?? "",
        generatedBy: input.generatedBy ?? "",
        note: request.note ?? "",
      };
      store[id] = [...(existing ?? []), version].slice(-maxVersions);
      await save();
      return create(SaveSurfaceResponseSchema, { surface: toMessage(version) });
    },
    async deleteSurface(request) {
      const store = await load();
      delete store[request.id ?? ""];
      await save();
      return create(DeleteSurfaceResponseSchema, {});
    },
    async listSurfaceVersions(request) {
      const versions = (await load())[request.id ?? ""];
      if (!versions) throw new Error(`No saved surface "${request.id}".`);
      return create(ListSurfaceVersionsResponseSchema, {
        versions: [...versions].reverse().map((v) => create(SurfaceVersionSchema, { version: v.version, savedAt: v.updatedAt, note: v.note, savedBy: v.savedBy })),
      });
    },
  };
}

/** What a saved surface is for, as a word: the same names `surfaceKind` in `@surfaces-ui/spec` guesses. */
export type SurfaceKindWord = "chart" | "dashboard" | "form" | "dag" | "data-explorer" | "metadata-explorer" | "conversation" | "other";

const KIND_WORDS: [SurfaceKind, SurfaceKindWord, string][] = [
  [SurfaceKind.CHART, "chart", "Chart"],
  [SurfaceKind.DASHBOARD, "dashboard", "Dashboard"],
  [SurfaceKind.FORM, "form", "Form"],
  [SurfaceKind.DAG, "dag", "Pipeline (DAG)"],
  [SurfaceKind.DATA_EXPLORER, "data-explorer", "Data explorer"],
  [SurfaceKind.METADATA_EXPLORER, "metadata-explorer", "Metadata explorer"],
  [SurfaceKind.CONVERSATION, "conversation", "Conversation"],
  [SurfaceKind.OTHER, "other", "Other"],
];

/** Every kind a person can file a surface under, in the order to list them. */
export const surfaceKinds = KIND_WORDS.map(([kind, word, label]) => ({ kind, word, label }));

export const surfaceKindOf = (word: string): SurfaceKind => KIND_WORDS.find(([, w]) => w === word)?.[0] ?? SurfaceKind.OTHER;
export const surfaceKindWord = (kind: SurfaceKind): SurfaceKindWord => KIND_WORDS.find(([k]) => k === kind)?.[1] ?? "other";
export const surfaceKindLabel = (kind: SurfaceKind): string => KIND_WORDS.find(([k]) => k === kind)?.[2] ?? "Other";
