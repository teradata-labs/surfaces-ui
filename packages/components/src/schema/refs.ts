import { SCHEMA_REF_MIME, type SchemaRef } from "./SchemaExplorer.js";

/**
 * A table, a column, or a file or folder, by name: what a person drags out
 * of a browser and drops on a chat, a context builder or an editor. It says
 * which data is meant and carries no values and no file contents.
 */
export interface DataRef {
  /** The source, or `local:<folder>` for a folder a person opened from their own computer. */
  sourceId: string;
  kind: "table" | "column" | "file";
  catalog?: string;
  /** The schema, or the database on an engine that has no catalog above it. */
  schema?: string;
  /** The table. Empty for a file. */
  table: string;
  column?: string;
  /** A file or folder: its path in the source's storage, or within the folder a person opened (never above it). */
  path?: string;
}

/** MIME type carrying a list of `DataRef`s as JSON during drag and drop. */
export const DATA_REFS_MIME = "application/x-surfaces-refs+json";

const isFile = (ref: DataRef) => typeof ref.path === "string" && ref.path !== "";
const isRef = (value: unknown): value is DataRef =>
  !!value && typeof value === "object" && typeof (value as DataRef).sourceId === "string" && ((typeof (value as DataRef).table === "string" && (value as DataRef).table !== "") || isFile(value as DataRef));
const kindOf = (ref: DataRef): DataRef["kind"] => (isFile(ref) && !ref.table ? "file" : ref.column ? "column" : "table");

/** A reference's name as a person reads it: `schema.table`, or `schema.table.column`. */
export function dataRefLabel(ref: Pick<DataRef, "schema" | "table" | "column" | "path">): string {
  // A file is named by the end of its path: its folder and its own name.
  if (!ref.table && ref.path) return ref.path.replace(/\/+$/, "").split("/").slice(-2).join("/");
  return [ref.schema, ref.table, ref.column].filter(Boolean).join(".");
}

/** The same thing twice is one reference. */
export function sameDataRef(a: DataRef, b: DataRef): boolean {
  const key = (r: DataRef) => [r.sourceId, r.catalog ?? "", r.schema ?? "", r.table, r.column ?? "", r.path ?? ""].join("\u0000").toLowerCase();
  return key(a) === key(b);
}

/** `more` added to `list`, leaving out what is already there. */
export function addDataRefs(list: DataRef[], more: DataRef[]): DataRef[] {
  const next = [...list];
  for (const ref of more) if (!next.some((have) => sameDataRef(have, ref))) next.push(ref);
  return next;
}

/** Puts references on a drag: the list, the first one in the older single form, and the names as plain text for anything else. */
export function writeDataRefs(transfer: Pick<DataTransfer, "setData">, refs: DataRef[], text?: string): void {
  if (refs.length === 0) return;
  transfer.setData(DATA_REFS_MIME, JSON.stringify(refs));
  // The older single form names a table, so a file has none.
  const first = refs.find((ref) => ref.table);
  if (first) transfer.setData(SCHEMA_REF_MIME, JSON.stringify({ sourceId: first.sourceId, table: first.table, column: first.column } satisfies SchemaRef));
  transfer.setData("text/plain", text ?? refs.map(dataRefLabel).join(", "));
}

/** True when a drag carries references, so a drop target can say it will take it. */
export function hasDataRefs(transfer: Pick<DataTransfer, "types"> | null | undefined): boolean {
  const types = Array.from(transfer?.types ?? []);
  return types.includes(DATA_REFS_MIME) || types.includes(SCHEMA_REF_MIME);
}

/** The references a drop carries. Anything that is not a well-formed reference is left out. */
export function readDataRefs(transfer: Pick<DataTransfer, "getData"> | null | undefined): DataRef[] {
  if (!transfer) return [];
  try {
    const many = JSON.parse(transfer.getData(DATA_REFS_MIME) || "null") as unknown;
    if (Array.isArray(many)) return many.filter(isRef).map((ref) => ({ ...ref, table: ref.table ?? "", kind: kindOf(ref) }));
  } catch {
    // Not ours, or not JSON: try the single form.
  }
  try {
    const one = JSON.parse(transfer.getData(SCHEMA_REF_MIME) || "null") as unknown;
    if (isRef(one)) return [{ ...one, kind: one.column ? "column" : "table" }];
  } catch {
    // Nothing to read.
  }
  return [];
}
