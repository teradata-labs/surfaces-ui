import type { JsonObject, JsonValue } from "@bufbuild/protobuf";
import type { SendInit } from "./backend.js";

/**
 * Everything a turn carries besides what the person typed, written for a
 * model that reads text: the event a control sent (and whether it met the
 * agent's own contract), every surface as it now stands, the replies the
 * agent said it expects, and problems with what it drew. Adapters for
 * text-only runtimes (Loom, tool-calling models) send this; an adapter for a
 * runtime that reads structured input can send `SendRequest` as it is.
 */
export function turnText(request: SendInit): string {
  const input = request.input;
  const lines: string[] = [];
  if (input?.case === "text") lines.push(input.value);
  else if (input?.case === "approval") {
    const a = input.value;
    const who = a.decidedBy?.name || a.decidedBy?.id;
    lines.push(a.answer || `${a.allow ? "Approved" : "Denied"}${who ? ` by ${who}` : ""}.`);
    if (a.reason) lines.push(`Reason: ${a.reason}`);
    if (a.editedSql !== undefined) lines.push(`They changed the SQL before approving. Run this version, not yours:\n${a.editedSql}`);
    if (a.editedSubject) lines.push(`They changed what was approved. Use this version, not yours: ${json(a.editedSubject)}`);
  }
  else if (input?.case === "action") {
    const a = input.value;
    lines.push(`The person used "${a.name}" on surface "${a.surfaceId}" (component "${a.sourceComponentId}"), with context: ${json(a.context ?? {})}`);
    if (a.dataModel && Object.keys(a.dataModel).length > 0) lines.push(`The surface's data model: ${json(a.dataModel)}`);
  }

  // What the person attached to the message: names, so the model knows which data is meant. Never values.
  const references = (request.references ?? []).filter((ref) => ref.table || ref.path);
  if (references.length > 0) {
    lines.push("", `The person attached ${references.length === 1 ? "this" : "these"} to the message (use ${references.length === 1 ? "it" : "them"} as what the message is about):`);
    for (const ref of references) {
      if (!ref.table) {
        // A file or folder: its path only. Nothing has been read from it.
        const local = (ref.sourceId ?? "").startsWith("local:");
        lines.push(`- file or folder ${ref.path}, ${local ? "in a folder the person opened on their own computer (you cannot read it; ask them to load it if you need its data)" : `in the storage of source "${ref.sourceId}"`}`);
        continue;
      }
      // A schema with no catalog above it is a database, and part of the table's name in SQL.
      const table = [ref.schema, ref.table].filter(Boolean).join(".");
      lines.push(ref.column ? `- column ${ref.column} of table ${table}, source "${ref.sourceId}"` : `- table ${table}, source "${ref.sourceId}"`);
    }
  }

  // What the person did since the last turn: context, not a request.
  const activity = (request.surfaces ?? []).flatMap((s) => (s.activity ?? []).map((a) => ({ surfaceId: s.surfaceId, ...a })));
  if (activity.length > 0) {
    lines.push("", `Since your last reply the person did ${activity.length === 1 ? "this on the page" : "these on the page, oldest first"} (for your context; ${activity.length === 1 ? "it is" : "they are"} not ${activity.length === 1 ? "a request" : "requests"}):`);
    for (const item of activity) {
      const subject = item.subject && Object.keys(item.subject).length > 0 ? ` ${json(item.subject)}` : "";
      lines.push(`- [${item.kind}] ${item.summary} (in "${item.componentId}" of surface "${item.surfaceId}")${subject}`);
    }
  }

  const surfaces = (request.surfaces ?? []).filter((s) => hasContent(s.dataModel) || Object.keys(s.controls ?? {}).length > 0 || (s.expects ?? []).length > 0);
  if (surfaces.length > 0) {
    lines.push("", "Surfaces on the page now:");
    for (const s of surfaces) {
      const parts = [`- "${s.surfaceId}"`];
      if (hasContent(s.dataModel)) parts.push(`data ${json(s.dataModel!)}`);
      for (const [component, controls] of Object.entries(s.controls ?? {})) parts.push(`"${component}" controls ${json(controls)}`);
      for (const contract of s.expects ?? []) parts.push(`expects "${contract.event}" matching ${json(contract.schema ?? {})}`);
      lines.push(parts.join("; "));
    }
    lines.push("A person's control changes are in catalog prop form; send them back in updateComponents to keep or change them.");
  }

  const errors = request.surfaceErrors ?? [];
  if (errors.length > 0) {
    lines.push("", "Problems with surfaces you drew (fix them with a new message):");
    for (const e of errors) lines.push(`- ${e.code}${e.surfaceId ? ` on "${e.surfaceId}"` : ""}${e.path && e.path !== "/" ? ` at ${e.path}` : ""}: ${e.message}`);
  }
  return lines.join("\n").trim();
}

function hasContent(value: JsonObject | undefined | { [key: string]: JsonValue }): boolean {
  return !!value && Object.keys(value).length > 0;
}

function json(value: unknown): string {
  const text = JSON.stringify(value);
  // Long data models are cut so one turn cannot fill a context window.
  return text.length > 4000 ? `${text.slice(0, 4000)}… (cut)` : text;
}
