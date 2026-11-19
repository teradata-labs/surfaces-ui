import { analyticsCatalog, applyMessage, type Surfaces } from "@surfaces-ui/spec";
import { describe, expect, it } from "vitest";
import { toPage } from "./areas/ComposerPage.js";
import { exampleMessages } from "./areas/ComposerPage.js";
import { exampleProps } from "./catalogExamples.js";
import { addComponentMessages, besideMessages, gridShares, heightProp, gridWidthsMessages, heightMessages, moveComponentMessages, slideShares, placeOfComponent, removeComponentMessages, setComponentMessages, stepComponentMessages, surfaceOutline } from "./composerAdd.js";
import { focusFor } from "./focus.js";
import type { ActiveSource } from "./source.js";

const source = { sourceId: "retail", sampleId: "lake", sources: [{ id: "retail", table: "orders" }] } as unknown as ActiveSource;
const apply = (surfaces: Surfaces, messages: Parameters<typeof applyMessage>[1][]) => messages.reduce(applyMessage, surfaces);
const start = () => apply({}, exampleMessages(focusFor("retail", "orders")));

describe("addComponentMessages", () => {
  it("adds a component with the dataset's props to the end of the root", () => {
    const surfaces = start();
    const result = addComponentMessages(surfaces.main, "main", "Chart", exampleProps("Chart", source));
    if ("error" in result) throw new Error(result.error);
    for (const m of result.messages) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
    const after = apply(surfaces, result.messages).main!;
    expect(after.components.root!.children).toEqual(["title", "numbers", "breakdown", "note", "send", "chart"]);
    expect(after.components.chart).toMatchObject({ component: "Chart", sourceId: "retail" });
  });

  it("never reuses an id and gives a layout's children placeholders of their own", () => {
    let surfaces = start();
    for (let i = 0; i < 2; i++) {
      const result = addComponentMessages(surfaces.main, "main", "Grid", exampleProps("Grid", source));
      if ("error" in result) throw new Error(result.error);
      for (const m of result.messages) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
      surfaces = apply(surfaces, result.messages);
    }
    const ids = Object.keys(surfaces.main!.components);
    expect(ids).toContain("grid");
    expect(ids).toContain("grid-2");
    expect(surfaces.main!.components["grid-2"]!.children).toEqual(["grid-2-revenue", "grid-2-orders", "grid-2-average"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("creates a surface when there is none", () => {
    const result = addComponentMessages(undefined, "main", "Metric", exampleProps("Metric", source));
    if ("error" in result) throw new Error(result.error);
    const after = apply({}, result.messages).main!;
    expect(after.components.root!.children).toEqual(["metric"]);
  });
});

describe("changing one component", () => {
  it("lists what is drawn, from the root down", () => {
    expect(surfaceOutline(start().main).map((i) => [i.id, i.depth, i.parent])).toEqual([
      ["root", 0, undefined],
      ["title", 1, "root"],
      ["numbers", 1, "root"],
      ["headline", 2, "numbers"],
      ["trend", 2, "numbers"],
      ["breakdown", 1, "root"],
      ["note", 1, "root"],
      ["send", 1, "root"],
      ["send-label", 2, "send"],
    ]);
    expect(surfaceOutline(undefined)).toEqual([]);
  });

  it("removes one component by sending its container without it, and leaves the rest", () => {
    const surfaces = start();
    const result = removeComponentMessages(surfaces.main, "trend");
    if ("error" in result) throw new Error(result.error);
    for (const m of result.messages) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
    const after = apply(surfaces, result.messages).main!;
    expect(after.components.numbers!.children).toEqual(["headline"]);
    expect(surfaceOutline(after).map((i) => i.id)).not.toContain("trend");
    expect(surfaceOutline(after).map((i) => i.id)).toContain("breakdown");
    // What was removed is not saved either.
    expect(toPage(after, "Retail")!.components.map((c) => c.id)).not.toContain("trend");
  });

  it("says why the root, or the only thing inside a button, cannot be removed", () => {
    const surface = start().main;
    expect(removeComponentMessages(surface, "root")).toEqual({ error: expect.stringContaining("cannot be removed") });
    expect(removeComponentMessages(surface, "send-label")).toEqual({ error: expect.stringContaining('Remove "send" instead') });
    expect(removeComponentMessages(surface, "nope")).toEqual({ error: expect.stringContaining("no component") });
  });

  it("gives one component new props, keeping its id and kind, and refuses what the catalog does not allow", () => {
    const surfaces = start();
    const result = setComponentMessages(surfaces.main, "breakdown", { sourceId: "retail", sql: "SELECT * FROM stores", type: "bar", x: "region", y: [{ aggregate: "count", label: "Stores" }] });
    if ("error" in result) throw new Error(result.error);
    const after = apply(surfaces, result.messages).main!;
    expect(after.components.breakdown).toMatchObject({ id: "breakdown", component: "Chart", sql: "SELECT * FROM stores", x: "region" });
    expect(after.components.headline).toEqual(surfaces.main!.components.headline);
    expect(setComponentMessages(surfaces.main, "breakdown", { sourceId: "retail", sql: "SELECT 1", type: "doughnut" })).toEqual({ error: expect.stringContaining("catalog does not accept") });
  });
});

describe("moving one component", () => {
  const childrenOf = (surfaces: Surfaces, id: string) => surfaces.main!.components[id]!.children;
  const run = (surfaces: Surfaces, result: ReturnType<typeof moveComponentMessages>) => {
    if ("error" in result) throw new Error(result.error);
    for (const m of result.messages) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
    return apply(surfaces, result.messages);
  };

  it("reorders within a container, by a drop or one step at a time", () => {
    let surfaces = start();
    expect(placeOfComponent(surfaces.main, "breakdown")).toEqual({ parent: "root", index: 2, count: 5 });
    // Dropped before the title.
    surfaces = run(surfaces, moveComponentMessages(surfaces.main, "breakdown", "root", 0));
    expect(childrenOf(surfaces, "root")).toEqual(["breakdown", "title", "numbers", "note", "send"]);
    // One step later, twice.
    surfaces = run(surfaces, stepComponentMessages(surfaces.main, "breakdown", 1));
    surfaces = run(surfaces, stepComponentMessages(surfaces.main, "breakdown", 1));
    expect(childrenOf(surfaces, "root")).toEqual(["title", "numbers", "breakdown", "note", "send"]);
    surfaces = run(surfaces, stepComponentMessages(surfaces.main, "breakdown", -1));
    expect(childrenOf(surfaces, "root")).toEqual(["title", "breakdown", "numbers", "note", "send"]);
  });

  it("moves a component into another container, beside what is there", () => {
    let surfaces = start();
    surfaces = run(surfaces, moveComponentMessages(surfaces.main, "breakdown", "numbers", 1));
    expect(childrenOf(surfaces, "numbers")).toEqual(["headline", "breakdown", "trend"]);
    expect(childrenOf(surfaces, "root")).toEqual(["title", "numbers", "note", "send"]);
    surfaces = run(surfaces, moveComponentMessages(surfaces.main, "trend", "root", 99));
    expect(childrenOf(surfaces, "root")).toEqual(["title", "numbers", "note", "send", "trend"]);
  });

  it("does nothing when dropped where it already is, and at either end of its container", () => {
    const surface = start().main;
    expect(moveComponentMessages(surface, "breakdown", "root", 2)).toEqual({ messages: [] });
    expect(moveComponentMessages(surface, "breakdown", "root", 3)).toEqual({ messages: [] });
    expect(stepComponentMessages(surface, "title", -1)).toEqual({ messages: [] });
    expect(stepComponentMessages(surface, "send", 1)).toEqual({ messages: [] });
  });

  it("says why a move cannot be made", () => {
    const surface = start().main;
    expect(moveComponentMessages(surface, "numbers", "numbers", 0)).toEqual({ error: expect.stringContaining("inside itself") });
    expect(moveComponentMessages(surface, "root", "numbers", 0)).toEqual({ error: expect.stringContaining("cannot be moved") });
    expect(moveComponentMessages(surface, "send-label", "root", 0)).toEqual({ error: expect.stringContaining("fixed place") });
    expect(moveComponentMessages(surface, "title", "breakdown", 0)).toEqual({ error: expect.stringContaining("does not hold a list") });
  });
});

describe("resizing by hand", () => {
  const run = (surfaces: Surfaces, result: ReturnType<typeof heightMessages>) => {
    if ("error" in result) throw new Error(result.error);
    for (const m of result.messages) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
    return apply(surfaces, result.messages);
  };

  it("sets a height within what the catalog allows, to the nearest ten pixels, and keeps the other props", () => {
    let surfaces = start();
    const bounds = { minimum: 160, maximum: 1200 };
    surfaces = run(surfaces, heightMessages(surfaces.main, "breakdown", 437, bounds));
    expect(surfaces.main!.components.breakdown).toMatchObject({ component: "Chart", type: "bar", height: 440 });
    surfaces = run(surfaces, heightMessages(surfaces.main, "breakdown", 40, bounds));
    expect(surfaces.main!.components.breakdown!.height).toBe(160);
    surfaces = run(surfaces, heightMessages(surfaces.main, "breakdown", 9000, bounds));
    expect(surfaces.main!.components.breakdown!.height).toBe(1200);
    // The same height again is no message.
    expect(heightMessages(surfaces.main, "breakdown", 1200, bounds)).toEqual({ messages: [] });
  });

  it("makes a component with no height of its own taller through its box", () => {
    expect(heightProp("Chart")).toBe("height");
    expect(heightProp("Text")).toBe("minHeight");
    expect(heightProp("Metric")).toBe("minHeight");
    expect(heightProp("Nope")).toBeUndefined();
    let surfaces = start();
    surfaces = run(surfaces, heightMessages(surfaces.main, "headline", 203, { minimum: 24, maximum: 1600 }));
    expect(surfaces.main!.components.headline).toMatchObject({ component: "Metric", minHeight: 200 });
    expect(surfaces.main!.components.headline!.height).toBeUndefined();
  });

  it("gives a row's children their shares, one per child", () => {
    const row = { id: "r", component: "Row", children: ["a", "b", "c"] };
    expect(gridShares(row)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(gridShares({ ...row, widths: [2, 1, 1] })).toEqual([0.5, 0.25, 0.25]);
    expect(gridShares({ id: "r", component: "Row", children: [] })).toEqual([]);
  });

  it("puts a component beside another in a stack by wrapping the two in a grid", () => {
    let surfaces = start();
    // The chart to the left of the title, both children of the root column.
    surfaces = run(surfaces, besideMessages(surfaces.main, "breakdown", "title", "left"));
    expect(surfaces.main!.components.root!.children).toEqual(["side-by-side", "numbers", "note", "send"]);
    expect(surfaces.main!.components["side-by-side"]).toMatchObject({ component: "Grid", columns: 2, children: ["breakdown", "title"] });
    // Beside something already in a grid is just before or after it.
    surfaces = run(surfaces, besideMessages(surfaces.main, "note", "headline", "right"));
    expect(surfaces.main!.components.numbers!.children).toEqual(["headline", "note", "trend"]);
    expect(surfaces.main!.components.root!.children).toEqual(["side-by-side", "numbers", "send"]);
    // From another container, and a second wrap gets its own id.
    surfaces = run(surfaces, besideMessages(surfaces.main, "trend", "send", "right"));
    expect(surfaces.main!.components["side-by-side-2"]!.children).toEqual(["send", "trend"]);
    expect(surfaces.main!.components.numbers!.children).toEqual(["headline", "note"]);
    expect(besideMessages(surfaces.main, "numbers", "headline", "left")).toEqual({ error: expect.stringContaining("inside itself") });
    expect(besideMessages(surfaces.main, "title", "send-label", "left")).toEqual({ error: expect.stringContaining("fixed place") });
  });

  it("reads a grid's column shares, and moves the line between two of them", () => {
    expect(gridShares({ id: "g", component: "Grid", columns: 2 })).toEqual([0.5, 0.5]);
    expect(gridShares({ id: "g", component: "Grid", columns: 2, widths: [3, 1] })).toEqual([0.75, 0.25]);
    // Widths that do not match the columns are ignored, as the grid itself ignores them.
    expect(gridShares({ id: "g", component: "Grid", columns: 3, widths: [3, 1] })).toEqual([1 / 3, 1 / 3, 1 / 3]);
    const wider = slideShares([0.5, 0.5], 0, 0.2);
    expect(wider[0]).toBeCloseTo(0.7);
    expect(wider[1]).toBeCloseTo(0.3);
    const squeezed = slideShares([0.5, 0.5], 0, 0.9);
    expect(squeezed[1]).toBeCloseTo(0.12);
    expect(slideShares([0.5, 0.5], 1, 0.2)).toEqual([0.5, 0.5]);
  });

  it("gives a grid its new column widths in a message the catalog accepts", () => {
    let surfaces = start();
    surfaces = run(surfaces, gridWidthsMessages(surfaces.main, "numbers", slideShares(gridShares(surfaces.main!.components.numbers), 0, 0.2)));
    expect(surfaces.main!.components.numbers).toMatchObject({ component: "Grid", columns: 2, children: ["headline", "trend"], widths: [0.7, 0.3] });
    expect(gridWidthsMessages(surfaces.main, "numbers", [0.7, 0.3])).toEqual({ messages: [] });
    expect(gridWidthsMessages(surfaces.main, "breakdown", [0.5, 0.5])).toEqual({ error: expect.stringContaining("not a Grid or a Row") });
  });
});

describe("toPage", () => {
  it("saves what a person changed on the surface: controls over props, typed values over the data", () => {
    const surface = start().main!;
    const page = toPage(surface, "Retail", { breakdown: { filters: [{ column: "channel", op: "eq", values: ["web"] }] } }, { note: "check web" })!;
    expect(page.components.find((c) => c.id === "breakdown")).toMatchObject({ filters: [{ column: "channel", op: "eq", values: ["web"] }] });
    expect(page.data).toEqual({ note: "check web" });
    expect(page.components[0]!.id).toBe("root");
  });
});
