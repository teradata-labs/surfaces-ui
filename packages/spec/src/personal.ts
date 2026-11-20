import type { Catalog } from "./catalog.js";
import { type PageDocument, type PageEdit, editPage, editsFromMessages } from "./page.js";
import type { SurfaceComponent, SurfaceMessage } from "./surface.js";

/**
 * A person's own arrangement of a shipped page.
 *
 * A host ships a page (a view, a dashboard) and lets each person arrange it. What a person changes is kept as the
 * list of edits they made, against the version of the page they made them on, and not as a copy of the page. So
 * when the shipped page improves, their edits are replayed over the new one, and only those that no longer fit are
 * dropped. Where the list is kept, and for whom, is the host's: this is only the arithmetic.
 */
export interface PersonalLayout {
  /** The version of the shipped page these edits were made on. */
  base: number;
  edits: PageEdit[];
}

/** The extension a shipped page puts on a component a person may not take off it. */
export const SURFACES_LOCKED = "surfaces_locked";

/** True for a component marked `surfaces_locked` in its `@metadata`: it stays on the page, though it may be moved and sized. */
export function isLocked(component: SurfaceComponent | undefined): boolean {
  const metadata = component?.["@metadata"];
  const extensions = metadata !== null && typeof metadata === "object" ? (metadata as { extensions?: unknown }).extensions : undefined;
  return extensions !== null && typeof extensions === "object" && (extensions as Record<string, unknown>)[SURFACES_LOCKED] === true;
}

export interface PersonalisedPage {
  page: PageDocument;
  /** Edits that no longer apply to the shipped page and were left out, with why. */
  dropped: { edit: PageEdit; reason: string }[];
  /** True when the edits were made on another version of the shipped page than this one. */
  rebased: boolean;
}

/** The shipped page with a person's edits replayed over it. With no edits it is the shipped page itself. */
export function personalisePage(shipped: PageDocument, version: number, personal: PersonalLayout | undefined, catalog: Catalog): PersonalisedPage {
  if (!personal || personal.edits.length === 0) return { page: shipped, dropped: [], rebased: false };
  const result = editPage(shipped, personal.edits, catalog);
  return { page: result.page, dropped: result.rejected, rebased: personal.base !== version };
}

/**
 * What an arrangement did (the A2UI messages `useArrange` hands to `apply`), as edits to keep. A change that would
 * take a locked component off the page is refused: its ids are returned, and nothing of that change is kept, so a
 * page is never left half arranged.
 */
export function layoutEdits(page: PageDocument, messages: SurfaceMessage[]): { edits: PageEdit[]; refused: string[] } {
  const edits = editsFromMessages(page, messages);
  const refused = edits.flatMap((edit) => (edit.op === "remove" && isLocked(page.components.find((c) => c.id === edit.id)) ? [edit.id] : []));
  return refused.length > 0 ? { edits: [], refused } : { edits, refused };
}

/** The most edits kept for one page. A host that stores them keeps the newest. */
export const PERSONAL_EDIT_LIMIT = 400;

/**
 * A stored arrangement, checked: it comes from storage or another machine, so it is read as untrusted. Returns
 * undefined for anything that is not one. The edits themselves are checked against the catalog when replayed.
 */
export function parsePersonalLayout(value: unknown): PersonalLayout | undefined {
  const layout = value as Partial<PersonalLayout> | null;
  if (!layout || typeof layout !== "object" || typeof layout.base !== "number" || !Array.isArray(layout.edits)) return undefined;
  const ops = new Set(["set", "update", "remove", "title", "move", "theme"]);
  const edits = layout.edits.filter((edit): edit is PageEdit => edit !== null && typeof edit === "object" && ops.has((edit as { op?: string }).op ?? ""));
  return { base: layout.base, edits: edits.slice(-PERSONAL_EDIT_LIMIT) };
}

/** A person's layout with more edits added, for a host to store. */
export function addLayoutEdits(personal: PersonalLayout | undefined, version: number, edits: PageEdit[]): PersonalLayout {
  return { base: version, edits: [...(personal?.edits ?? []), ...edits].slice(-PERSONAL_EDIT_LIMIT) };
}
