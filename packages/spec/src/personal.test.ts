import { describe, expect, it } from "vitest";
import { z } from "zod";
import { analyticsCatalog } from "./analytics.js";
import { removeComponentMessages } from "./arrange.js";
import { extendCatalog } from "./catalog.js";
import { A2UI_VERSION } from "./dynamic.js";
import { type PageDocument, pageSurface, validatePage } from "./page.js";
import { PERSONAL_EDIT_LIMIT, addLayoutEdits, isLocked, layoutEdits, parsePersonalLayout, personalisePage } from "./personal.js";
import type { SurfaceMessage } from "./surface.js";

const catalog = analyticsCatalog;
const shipped: PageDocument = {
  id: "view",
  title: "Glossary",
  catalogId: catalog.id,
  a2ui: A2UI_VERSION,
  components: [
    { id: "root", component: "Grid", columns: 2, widths: [1, 2], children: ["intro", "status", "detail"] },
    { id: "intro", component: "Text", text: "Welcome" },
    { id: "status", component: "Text", text: "Certified", "@metadata": { extensions: { surfaces_locked: true } } },
    { id: "detail", component: "Text", text: "Detail" },
  ],
};
const widths = (shares: number[]): SurfaceMessage[] => [{ version: A2UI_VERSION, updateComponents: { surfaceId: "view", components: [{ ...shipped.components[0]!, widths: shares }] } }];
const removal = (id: string) => (removeComponentMessages(pageSurface(shipped), id) as { messages: SurfaceMessage[] }).messages;

describe("a person's own layout", () => {
  it("is kept as edits and replayed over the shipped page, which is left as it was", () => {
    const { edits, refused } = layoutEdits(shipped, widths([2, 1]));
    expect(refused).toEqual([]);
    const mine = personalisePage(shipped, 1, addLayoutEdits(undefined, 1, edits), catalog);
    expect(mine.page.components[0]!.widths).toEqual([2, 1]);
    expect(mine).toMatchObject({ dropped: [], rebased: false });
    expect(shipped.components[0]!.widths).toEqual([1, 2]);
    expect(personalisePage(shipped, 1, undefined, catalog).page).toBe(shipped);
  });

  it("lets a person take a part off, but not one the page keeps", () => {
    const { edits } = layoutEdits(shipped, removal("intro"));
    expect(personalisePage(shipped, 1, { base: 1, edits }, catalog).page.components.some((c) => c.id === "intro")).toBe(false);

    expect(isLocked(shipped.components.find((c) => c.id === "status"))).toBe(true);
    expect(isLocked(shipped.components.find((c) => c.id === "intro"))).toBe(false);
    // Arrange refuses outright, and says the part can still be moved.
    expect(removeComponentMessages(pageSurface(shipped), "status")).toEqual({ error: expect.stringContaining("stays on it") });
    // A change from anywhere else that drops it is refused whole.
    const dropping: SurfaceMessage[] = [{ version: A2UI_VERSION, updateComponents: { surfaceId: "view", components: [{ ...shipped.components[0]!, widths: [3, 1], children: ["intro", "detail"] }] } }];
    expect(layoutEdits(shipped, dropping)).toEqual({ edits: [], refused: ["status"] });
  });

  it("keeps its metadata when a locked part is moved or sized", () => {
    const moved: SurfaceMessage[] = [{ version: A2UI_VERSION, updateComponents: { surfaceId: "view", components: [{ ...shipped.components[0]!, children: ["status", "intro", "detail"] }, { ...shipped.components[2]!, minHeight: 120 }] } }];
    const { edits, refused } = layoutEdits(shipped, moved);
    expect(refused).toEqual([]);
    const mine = personalisePage(shipped, 1, { base: 1, edits }, catalog).page;
    expect(mine.components[0]!.children).toEqual(["status", "intro", "detail"]);
    expect(isLocked(mine.components.find((c) => c.id === "status"))).toBe(true);
    expect(validatePage(mine, catalog)).toEqual([]);
  });

  it("drops only what no longer fits when the shipped page moves on, and says why", () => {
    const { edits } = layoutEdits(shipped, widths([3, 1]));
    const mine = personalisePage(shipped, 2, { base: 1, edits: [...edits, { op: "update", id: "gone", props: { minHeight: 200 } }] }, catalog);
    expect(mine.dropped).toHaveLength(1);
    expect(mine.dropped[0]!.reason).toBeTruthy();
    expect(mine.rebased).toBe(true);
    expect(mine.page.components[0]!.widths).toEqual([3, 1]);
  });

  it("reads a stored layout as untrusted, and keeps the newest edits", () => {
    expect(parsePersonalLayout("nonsense")).toBeUndefined();
    expect(parsePersonalLayout({ base: "1", edits: [] })).toBeUndefined();
    expect(parsePersonalLayout({ base: 2, edits: [{ op: "title", title: "Mine" }, { op: "explode" }, null] })).toEqual({ base: 2, edits: [{ op: "title", title: "Mine" }] });
    const many = Array.from({ length: PERSONAL_EDIT_LIMIT + 5 }, (_, i) => ({ op: "title" as const, title: `t${i}` }));
    const kept = addLayoutEdits(undefined, 1, many);
    expect(kept.edits).toHaveLength(PERSONAL_EDIT_LIMIT);
    expect(kept.edits.at(-1)).toEqual({ op: "title", title: `t${PERSONAL_EDIT_LIMIT + 4}` });
  });
});

describe("a catalog built on another", () => {
  const mine = extendCatalog(analyticsCatalog, {
    id: "urn:acme:catalog:v1",
    title: "Acme",
    description: "The analytics components and Acme's own.",
    components: {
      TermCard: { description: "One term.", props: { term: z.string() }, example: { id: "t", component: "TermCard", term: "order" } },
      Sized: { description: "Has its own height.", props: { height: z.number().optional() }, example: { id: "s", component: "Sized" } },
    },
  });

  it("draws everything the base draws and its own, under its own id", () => {
    expect(mine.id).toBe("urn:acme:catalog:v1");
    expect(mine.names).toContain("Chart");
    expect(mine.names).toContain("TermCard");
    expect(mine.validateComponent({ id: "t", component: "TermCard", term: "order", "@metadata": { extensions: { acme_note: 1 } } })).toEqual([]);
    expect(mine.validateComponent(analyticsCatalog.components.Chart!.example)).toEqual([]);
    expect(mine.validateMessage({ version: A2UI_VERSION, createSurface: { surfaceId: "s", catalogId: "urn:acme:catalog:v1" } })).toEqual([]);
    expect(mine.validateMessage({ version: A2UI_VERSION, createSurface: { surfaceId: "s", catalogId: analyticsCatalog.id } })).not.toEqual([]);
    expect(Object.keys(mine.functions)).toEqual(Object.keys(analyticsCatalog.functions));
  });

  it("gives an added component room to be sized, unless it sizes itself", () => {
    expect(mine.validateComponent({ id: "t", component: "TermCard", term: "order", minHeight: 200 })).toEqual([]);
    expect(mine.validateComponent({ id: "s", component: "Sized", minHeight: 200 })).not.toEqual([]);
    expect(mine.validateComponent({ id: "s", component: "Sized", height: 200 })).toEqual([]);
  });

  it("refuses a name the base already has, and the base's own id", () => {
    const text = { description: "x", props: {}, example: { id: "x", component: "Text" } };
    expect(() => extendCatalog(analyticsCatalog, { id: "urn:acme:catalog:v1", title: "A", description: "B", components: { Text: text } })).toThrowError(/already has Text/);
    expect(() => extendCatalog(analyticsCatalog, { id: analyticsCatalog.id, title: "A", description: "B", components: {} })).toThrowError(/id of its own/);
  });
});
