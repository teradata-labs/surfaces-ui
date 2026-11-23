import { describe, expect, it } from "vitest";
import { analyticsCatalog } from "./analytics.js";
import { besideMessages, gridShares, gridWidthsMessages, heightMessages, heightProp, moveComponentMessages, placeOfComponent, slideShares, spaceDefault, spaceMessages, spaceProps, stepComponentMessages, surfaceOutline } from "./arrange.js";
import { type PageDocument, editPage, editsFromMessages, pageSurface } from "./page.js";
import type { SurfaceMessage } from "./surface.js";

const page: PageDocument = {
  id: "main",
  title: "Sales",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["head", "numbers", "chart"] },
    { id: "head", component: "Text", text: "Sales", variant: "h1" },
    { id: "numbers", component: "Grid", columns: 2, children: ["revenue", "orders"] },
    { id: "revenue", component: "Metric", sourceId: "s", sql: "SELECT * FROM t", column: "amount", aggregate: "sum", label: "Revenue" },
    { id: "orders", component: "Metric", sourceId: "s", sql: "SELECT * FROM t", column: "id", aggregate: "count", label: "Orders" },
    { id: "chart", component: "Chart", sourceId: "s", sql: "SELECT * FROM t", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] },
  ],
};
const surface = pageSurface(page);
const ok = (result: { messages: SurfaceMessage[] } | { error: string }) => {
  if ("error" in result) throw new Error(result.error);
  return result.messages;
};
/** What a page looks like after a person's arrangement is taken in as page edits. */
const arranged = (messages: SurfaceMessage[]) => {
  const { page: next, rejected } = editPage(page, editsFromMessages(page, messages), analyticsCatalog);
  expect(rejected).toEqual([]);
  return next;
};
const children = (p: PageDocument, id: string) => p.components.find((c) => c.id === id)?.children;

describe("arranging a surface", () => {
  it("outlines a surface and finds where a component sits", () => {
    expect(surfaceOutline(surface).map((item) => `${"  ".repeat(item.depth)}${item.id}`)).toEqual(["root", "  head", "  numbers", "    revenue", "    orders", "  chart"]);
    expect(placeOfComponent(surface, "orders")).toEqual({ parent: "numbers", index: 1, count: 2 });
  });

  it("steps a component along its container", () => {
    expect(children(arranged(ok(stepComponentMessages(surface, "chart", -1))), "root")).toEqual(["head", "chart", "numbers"]);
  });

  it("moves a component into another container without losing it, whichever order the two containers arrive in", () => {
    const next = arranged(ok(moveComponentMessages(surface, "chart", "numbers", 1)));
    expect(children(next, "root")).toEqual(["head", "numbers"]);
    expect(children(next, "numbers")).toEqual(["revenue", "chart", "orders"]);
    expect(next.components.some((c) => c.id === "chart")).toBe(true);
    // The other way round: the target first, then the source without it.
    const [message] = ok(moveComponentMessages(surface, "chart", "numbers", 1));
    const update = message as Extract<SurfaceMessage, { updateComponents: unknown }>;
    const reversed = { ...update, updateComponents: { ...update.updateComponents, components: [...update.updateComponents.components].reverse() } };
    expect(arranged([reversed]).components.some((c) => c.id === "chart")).toBe(true);
  });

  it("puts two components side by side in a new grid", () => {
    const next = arranged(ok(besideMessages(surface, "chart", "head", "left")));
    expect(children(next, "root")).toEqual(["side-by-side", "numbers"]);
    expect(next.components.find((c) => c.id === "side-by-side")).toMatchObject({ component: "Grid", columns: 2, children: ["chart", "head"] });
  });

  it("sizes heights through the prop each component has, and widths as shares", () => {
    expect(heightProp("Chart")).toBe("height");
    expect(heightProp("Metric")).toBe("minHeight");
    expect(arranged(ok(heightMessages(surface, "chart", 333, { minimum: 120, maximum: 900 }))).components.find((c) => c.id === "chart")?.height).toBe(330);
    const shares = slideShares(gridShares(surface.components.numbers), 0, 0.2);
    expect(arranged(ok(gridWidthsMessages(surface, "numbers", shares))).components.find((c) => c.id === "numbers")?.widths).toEqual([0.7, 0.3]);
  });

  it("sets gap and padding as steps of the spacing scale, and sends nothing for the step already drawn", () => {
    expect(spaceProps("Row")).toEqual(["gap", "padding"]);
    expect(spaceProps("Grid")).toEqual(["gap"]);
    expect(spaceProps("Card")).toEqual(["padding"]);
    expect(spaceProps("Text")).toEqual([]);
    expect(spaceDefault("Column", "gap")).toBe(4);
    expect(spaceDefault("Column", "padding")).toBe("none");
    expect(spaceDefault("Card", "padding")).toBe(4);
    expect(arranged(ok(spaceMessages(surface, "numbers", "gap", 2))).components.find((c) => c.id === "numbers")).toMatchObject({ gap: 2, columns: 2, children: ["revenue", "orders"] });
    expect(ok(spaceMessages(surface, "root", "padding", "none"))).toEqual([]);
    expect(ok(spaceMessages(surface, "numbers", "gap", 4))).toEqual([]);
    expect(spaceMessages(surface, "numbers", "padding", 2)).toMatchObject({ error: "A Grid has no padding." });
    expect(spaceMessages(surface, "nothing", "gap", 2)).toMatchObject({ error: expect.stringContaining("nothing") });
  });

  it("gives a Row's children shares when they are resized by hand, in place of their sizes", () => {
    const sized: PageDocument = {
      ...page,
      components: [...page.components.map((c) => (c.id === "root" ? { ...c, children: ["head", "line"] } : c)), { id: "line", component: "Row", children: ["revenue", "orders"], sizes: ["hug", "fill"] }],
    };
    const next = editPage(sized, editsFromMessages(sized, ok(gridWidthsMessages(pageSurface(sized), "line", [0.6, 0.4]))), analyticsCatalog).page.components.find((c) => c.id === "line");
    expect(next).toMatchObject({ widths: [0.6, 0.4] });
    expect(next).not.toHaveProperty("sizes");
  });

  it("refuses what cannot be done and says why", () => {
    expect(moveComponentMessages(surface, "numbers", "numbers", 0)).toMatchObject({ error: expect.stringContaining("inside itself") });
    expect(moveComponentMessages(surface, "root", "numbers", 0)).toMatchObject({ error: expect.stringContaining("root") });
  });
});
