import type { DataSource } from "@surfaces-ui/data";
import { FileEntryKind, TableFormat } from "@surfaces-ui/proto";
import type { DataRef } from "../schema/refs.js";

/** What a file or folder can be read as. */
export type FileFormatName = "parquet" | "csv" | "json" | "delta" | "iceberg";

/** One folder or file, as a file browser shows it. */
export interface FileItem {
  name: string;
  /** Where it is, as its place gives it: a path or address in a source's storage, or a path within an opened local folder. */
  path: string;
  kind: "folder" | "file";
  /** Bytes; files only, when known. */
  size?: number;
  /** ISO 8601, when known. */
  modified?: string;
  format?: FileFormatName;
  /** The configured table that reads this entry, when there is one. */
  table?: string;
  /** A file on the person's own computer: the browser's handle on it, for a host that loads it. It never leaves the page unless the host sends it. */
  file?: File;
}

export interface FileListing {
  items: FileItem[];
  /** Pass to `list` for the next page; absent on the last. */
  next?: string;
  /** True when the place was not read to the end. */
  truncated?: boolean;
}

/**
 * Somewhere folders and files can be listed: a source's storage, a folder
 * on the person's computer, or a consumer's own store. `FileBrowser` depends
 * on this alone. Listing gives names, sizes and dates, never contents.
 */
export interface FilePlace {
  /** Used as the `sourceId` of references to its files: a source's id, or `local:<folder>`. */
  id: string;
  label: string;
  /** "source" is a data source's storage; "local" is this computer, read by the browser. */
  origin: "source" | "local";
  /** `path` empty lists the top of the place. */
  list(path: string, page?: string): Promise<FileListing>;
}

const FORMAT_NAMES: Partial<Record<TableFormat, FileFormatName>> = {
  [TableFormat.PARQUET]: "parquet",
  [TableFormat.CSV]: "csv",
  [TableFormat.JSON]: "json",
  [TableFormat.DELTA]: "delta",
  [TableFormat.ICEBERG]: "iceberg",
};

/** What a file can be read as, by its extension. */
export function fileFormatByName(name: string): FileFormatName | undefined {
  const lower = name.toLowerCase().replace(/\.(gz|zst)$/, "");
  if (lower.endsWith(".parquet")) return "parquet";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  if (lower.endsWith(".json") || lower.endsWith(".ndjson") || lower.endsWith(".jsonl")) return "json";
  return undefined;
}

/** A size as a person reads it: 812 B, 14.2 KB, 3.1 GB. */
export function fileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Folders first, then by name. */
const inOrder = (items: FileItem[]) => [...items].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === "folder" ? -1 : 1));

/** The storage of one of a backend's sources, when the backend can list it (`DataSource.listFiles`). Undefined when it cannot. */
export function sourceFiles(dataSource: DataSource, sourceId: string, label = sourceId, pageSize = 200): FilePlace | undefined {
  const listFiles = dataSource.listFiles?.bind(dataSource);
  if (!listFiles) return undefined;
  return {
    id: sourceId,
    label,
    origin: "source",
    async list(path, page) {
      const response = await listFiles({ sourceId, path, pageSize, pageToken: page ?? "" });
      return {
        items: response.entries.map((entry) => ({
          name: entry.name,
          path: entry.path,
          kind: entry.kind === FileEntryKind.FOLDER ? "folder" : "file",
          ...(entry.sizeBytes !== undefined ? { size: Number(entry.sizeBytes) } : {}),
          ...(entry.modifiedAt ? { modified: entry.modifiedAt } : {}),
          ...(FORMAT_NAMES[entry.format] ? { format: FORMAT_NAMES[entry.format] } : {}),
          ...(entry.table ? { table: entry.table } : {}),
        })),
        ...(response.nextPageToken ? { next: response.nextPageToken } : {}),
        ...(response.truncated ? { truncated: true } : {}),
      };
    },
  };
}

/** Cuts a listing into pages, for places that hold a whole folder at once. */
function paged(items: FileItem[], page: string | undefined, pageSize: number): FileListing {
  const from = Math.max(0, Number.parseInt(page ?? "0", 10) || 0);
  const next = from + pageSize;
  return { items: items.slice(from, next), ...(next < items.length ? { next: String(next) } : {}) };
}

/**
 * A folder a person chose with a folder input (`<input type="file" webkitdirectory>`),
 * which every browser has: the files arrive as one list, each with its path
 * within the folder. Nothing is uploaded; the files stay in the page.
 */
export function localFilesPlace(files: File[], pageSize = 200): FilePlace {
  const pathOf = (file: File) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const visible = files.filter((file) => !pathOf(file).split("/").some((part) => part.startsWith(".")));
  const root = pathOf(visible[0] ?? files[0] ?? new File([], "folder")).split("/")[0] ?? "folder";
  return {
    id: `local:${root}`,
    label: root,
    origin: "local",
    async list(path, page) {
      const prefix = path ? `${path}/` : "";
      const folders = new Map<string, FileItem>();
      const here: FileItem[] = [];
      for (const file of visible) {
        const full = pathOf(file);
        if (!full.startsWith(prefix)) continue;
        const rest = full.slice(prefix.length);
        const cut = rest.indexOf("/");
        if (cut >= 0) {
          const name = rest.slice(0, cut);
          if (!folders.has(name)) folders.set(name, { name, path: `${prefix}${name}`, kind: "folder" });
        } else {
          const format = fileFormatByName(file.name);
          here.push({ name: file.name, path: full, kind: "file", size: file.size, modified: new Date(file.lastModified).toISOString(), ...(format ? { format } : {}), file });
        }
      }
      return paged(inOrder([...folders.values(), ...here]), page, pageSize);
    },
  };
}

/** The parts of the File System Access API this uses; Chromium browsers have it. */
interface DirectoryHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<DirectoryHandle | { kind: "file"; name: string; getFile(): Promise<File> }>;
  getDirectoryHandle(name: string): Promise<DirectoryHandle>;
}

/**
 * A folder a person chose with the browser's folder picker
 * (`showDirectoryPicker`), read a folder at a time as it is opened, so a
 * large tree is not walked up front. Read-only; nothing is uploaded.
 */
export function directoryPlace(handle: unknown, pageSize = 200): FilePlace {
  const root = handle as DirectoryHandle;
  const cache = new Map<string, FileItem[]>();
  const open = async (path: string): Promise<DirectoryHandle> => {
    let at = root;
    // A path starts with the folder's own name.
    for (const part of path.split("/").slice(1).filter(Boolean)) at = await at.getDirectoryHandle(part);
    return at;
  };
  return {
    id: `local:${root.name}`,
    label: root.name,
    origin: "local",
    async list(path, page) {
      const key = path || root.name;
      let items = page ? cache.get(key) : undefined;
      if (!items) {
        const found: FileItem[] = [];
        for await (const entry of (await open(key)).values()) {
          if (entry.name.startsWith(".")) continue;
          if (entry.kind === "directory") found.push({ name: entry.name, path: `${key}/${entry.name}`, kind: "folder" });
          else {
            const file = await entry.getFile();
            const format = fileFormatByName(entry.name);
            found.push({ name: entry.name, path: `${key}/${entry.name}`, kind: "file", size: file.size, modified: new Date(file.lastModified).toISOString(), ...(format ? { format } : {}), file });
          }
        }
        items = inOrder(found);
        cache.set(key, items);
      }
      return paged(items, page, pageSize);
    },
  };
}

/** True when this browser has a folder picker that reads a folder as it is opened. Others use the folder input. */
export const hasDirectoryPicker = (): boolean => typeof window !== "undefined" && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

/** Asks the person for a folder with the browser's picker. Undefined when they cancel. Call from a click. */
export async function pickDirectory(): Promise<FilePlace | undefined> {
  const picker = (window as { showDirectoryPicker?: (options?: { mode?: "read" }) => Promise<unknown> }).showDirectoryPicker;
  if (!picker) return undefined;
  try {
    return directoryPlace(await picker({ mode: "read" }));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return undefined;
    throw error;
  }
}

/** A file or folder as a reference: its place and its path. Names only. */
export const fileRef = (place: Pick<FilePlace, "id">, item: Pick<FileItem, "path">): DataRef => ({ sourceId: place.id, kind: "file", table: "", path: item.path });
