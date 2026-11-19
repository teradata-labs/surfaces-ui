import type { SavedSurface } from "@surfaces-ui/proto";
import type { PageDocument } from "@surfaces-ui/spec";

/** The link to one saved surface in the Library area. */
export const surfaceLink = (id: string) => `#library?surface=${encodeURIComponent(id)}`;

/** The link that opens a saved surface in the composer. */
export const composerLink = (id: string) => `#composer?surface=${encodeURIComponent(id)}`;

/** The `surface` parameter of an address like `#library?surface=<id>`, or undefined. */
export function surfaceFromHash(hash = location.hash): string | undefined {
  const query = hash.indexOf("?");
  if (query < 0) return undefined;
  return new URLSearchParams(hash.slice(query + 1)).get("surface") || undefined;
}

/** A saved surface's document as a page. The library keeps it as plain JSON. */
export function pageOf(surface: Pick<SavedSurface, "document">): PageDocument | undefined {
  const doc = surface.document as unknown as PageDocument | undefined;
  return doc && typeof doc === "object" && Array.isArray(doc.components) ? doc : undefined;
}

/** A page as the JSON a saved surface holds. */
export const documentOf = (page: PageDocument) => JSON.parse(JSON.stringify(page)) as SavedSurface["document"];

/** Every source a page reads, so an area can load those models before drawing it. */
export function sourcesOf(page: PageDocument): string[] {
  const found = new Set<string>();
  for (const component of page.components) if (typeof component.sourceId === "string") found.add(component.sourceId);
  const data = page.data as { sourceId?: unknown; source?: unknown } | undefined;
  for (const value of [data?.sourceId, data?.source]) if (typeof value === "string") found.add(value);
  return [...found];
}
