// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { basicsCatalog } from "../basics.js";
import { A2UI_VERSION } from "../dynamic.js";
import { nextSpaceStep, rowSizes, spaceStep } from "../layout.js";
import { type SurfaceComponent, applyMessages } from "../surface.js";
import { SurfaceView, basicsRenderers } from "./index.js";

afterEach(cleanup);

const texts = ["a", "b", "c"].map((id): SurfaceComponent => ({ id, component: "Text", text: id.toUpperCase() }));

function draw(root: SurfaceComponent, extra: SurfaceComponent[] = []) {
  const surface = applyMessages({}, [
    { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: basicsCatalog.id } },
    { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ ...root, id: "root" }, ...texts, ...extra] } },
  ]).main!;
  const onProblem = vi.fn();
  const { container } = render(
    <DataSourceProvider dataSource={memoryDataSource({ tables: {} })}>
      <SurfaceView surface={surface} catalog={basicsCatalog} renderers={basicsRenderers} onProblem={onProblem} />
    </DataSourceProvider>,
  );
  return { container, onProblem };
}

const attributes = (element: Element | null) => (element ? element.getAttributeNames().sort() : []);

describe("layout props left out", () => {
  it("draw a Row, Column, Grid and Card with the attributes and structure they always had", () => {
    let drawn = draw({ id: "root", component: "Row", children: ["a", "b"] });
    let row = drawn.container.querySelector(".sf-a2-row")!;
    expect(attributes(row)).toEqual(["class", "data-arrange-container", "style"]);
    // The children sit straight in the row, with no cell around them.
    expect([...row.children].map((child) => child.className)).toEqual(["sf-a2-text", "sf-a2-text"]);
    cleanup();

    // A Row with widths keeps its cells and shares.
    drawn = draw({ id: "root", component: "Row", children: ["a", "b"], widths: [2, 1] });
    row = drawn.container.querySelector(".sf-a2-row")!;
    expect(attributes(row)).toEqual(["class", "data-arrange-container", "data-widths", "style"]);
    expect([...row.children].map((cell) => (cell as HTMLElement).style.flex)).toEqual(["2 1 0px", "1 1 0px"]);
    cleanup();

    drawn = draw({ id: "root", component: "Column", children: ["a", "b"] });
    expect(attributes(drawn.container.querySelector(".sf-a2-column"))).toEqual(["class", "style"]);
    cleanup();

    drawn = draw({ id: "root", component: "Grid", columns: 2, children: ["a", "b"] });
    expect(attributes(drawn.container.querySelector(".sf-a2-grid"))).toEqual(["class", "data-arrange-container", "style"]);
    cleanup();

    drawn = draw({ id: "root", component: "Card", child: "a" });
    expect(attributes(drawn.container.querySelector(".sf-a2-card"))).toEqual(["class"]);
    expect(drawn.onProblem).not.toHaveBeenCalled();
  });
});

describe("gap and padding", () => {
  it("are steps of the spacing scale, drawn as data-gap and data-padding", () => {
    let { container, onProblem } = draw({ id: "root", component: "Row", children: ["a", "b"], gap: 2, padding: "none" });
    expect(container.querySelector(".sf-a2-row")!.getAttribute("data-gap")).toBe("2");
    expect(container.querySelector(".sf-a2-row")!.getAttribute("data-padding")).toBe("none");
    cleanup();
    ({ container } = draw({ id: "root", component: "Column", children: ["a"], gap: "none", padding: 8 }));
    expect(container.querySelector(".sf-a2-column")!.getAttribute("data-gap")).toBe("none");
    expect(container.querySelector(".sf-a2-column")!.getAttribute("data-padding")).toBe("8");
    cleanup();
    ({ container } = draw({ id: "root", component: "Grid", children: ["a"], gap: 6 }));
    expect(container.querySelector(".sf-a2-grid")!.getAttribute("data-gap")).toBe("6");
    cleanup();
    ({ container } = draw({ id: "root", component: "Card", child: "a", padding: 2 }));
    expect(container.querySelector(".sf-a2-card")!.getAttribute("data-padding")).toBe("2");
    expect(onProblem).not.toHaveBeenCalled();
  });

  it("refuses a value off the scale, and padding where a component has none", () => {
    const check = (component: Record<string, unknown>) => basicsCatalog.validateComponent({ id: "x", ...component }).map((p) => p.message);
    expect(check({ component: "Row", children: [], gap: 5 })).not.toEqual([]);
    expect(check({ component: "Row", children: [], gap: "16px" })).not.toEqual([]);
    expect(check({ component: "Column", children: [], padding: 0 })).not.toEqual([]);
    expect(check({ component: "Grid", children: [], padding: 4 })).not.toEqual([]);
    expect(check({ component: "Card", child: "a", gap: 4 })).not.toEqual([]);
    for (const step of ["none", 1, 2, 3, 4, 6, 8]) {
      expect(check({ component: "Row", children: [], gap: step, padding: step })).toEqual([]);
      expect(check({ component: "Card", child: "a", padding: step })).toEqual([]);
    }
  });

  it("step along the scale and stop at its ends", () => {
    expect(spaceStep(4)).toBe(4);
    expect(spaceStep("4")).toBeUndefined();
    expect(nextSpaceStep(4, 1)).toBe(6);
    expect(nextSpaceStep(1, -1)).toBe("none");
    expect(nextSpaceStep("none", -1)).toBe("none");
    expect(nextSpaceStep(8, 1)).toBe(8);
  });
});

describe("a Row's wrap and sizes", () => {
  it("keeps to one line with wrap: false", () => {
    const { container } = draw({ id: "root", component: "Row", children: ["a", "b"], wrap: false });
    expect(container.querySelector(".sf-a2-row")!.getAttribute("data-wrap")).toBe("false");
    cleanup();
    // true is the default, and adds nothing.
    expect(draw({ id: "root", component: "Row", children: ["a"], wrap: true }).container.querySelector(".sf-a2-row")!.hasAttribute("data-wrap")).toBe(false);
  });

  it("puts each child in a cell sized hug, fill or fixed", () => {
    const { container, onProblem } = draw({ id: "root", component: "Row", children: ["a", "b", "c"], sizes: ["hug", "fill", { fixed: 240 }] });
    const row = container.querySelector(".sf-a2-row")!;
    expect(row.hasAttribute("data-sizes")).toBe(true);
    const cells = [...row.children] as HTMLElement[];
    expect(cells.map((cell) => cell.className)).toEqual(["sf-a2-row-cell", "sf-a2-row-cell", "sf-a2-row-cell"]);
    expect(cells.map((cell) => cell.dataset.size)).toEqual(["hug", "fill", "fixed"]);
    expect(cells[2]!.style.getPropertyValue("--sf-row-cell-size")).toBe("240px");
    expect(cells[0]!.style.getPropertyValue("--sf-row-cell-size")).toBe("");
    expect(onProblem).not.toHaveBeenCalled();
  });

  it("wins over widths when both have one entry per child, and gives way when it does not fit", () => {
    let row = draw({ id: "root", component: "Row", children: ["a", "b"], widths: [2, 1], sizes: ["hug", "fill"] }).container.querySelector(".sf-a2-row")!;
    expect(row.hasAttribute("data-sizes")).toBe(true);
    expect(row.hasAttribute("data-widths")).toBe(false);
    expect((row.children[0] as HTMLElement).style.flex).toBe("");
    cleanup();
    // Three sizes for two children: the widths are used, as if sizes were not there.
    row = draw({ id: "root", component: "Row", children: ["a", "b"], widths: [2, 1], sizes: ["hug", "fill", "fill"] }).container.querySelector(".sf-a2-row")!;
    expect(row.hasAttribute("data-sizes")).toBe(false);
    expect(row.hasAttribute("data-widths")).toBe(true);
  });

  it("refuses a size that is not one, and a fixed width out of bounds", () => {
    const check = (sizes: unknown) => basicsCatalog.validateComponent({ id: "r", component: "Row", children: ["a"], sizes }).map((p) => p.message);
    expect(check(["hug"])).toEqual([]);
    expect(check([{ fixed: 24 }, { fixed: 1600 }])).toEqual([]);
    expect(check(["auto"])).not.toEqual([]);
    expect(check([{ fixed: 10 }])).not.toEqual([]);
    expect(check([{ fixed: 2000 }])).not.toEqual([]);
    expect(check([{ fixed: 100, grow: 1 }])).not.toEqual([]);
    expect(check([])).not.toEqual([]);
    expect(check(Array.from({ length: 13 }, () => "fill"))).not.toEqual([]);
    expect(check(["hug"]).join(" ")).not.toMatch(/^Invalid input$/);
  });

  it("is read only when every entry is a size", () => {
    expect(rowSizes(["hug", { fixed: 30 }], 2)).toEqual(["hug", { fixed: 30 }]);
    expect(rowSizes(["hug"], 2)).toBeUndefined();
    expect(rowSizes(["hug", { fixed: 3 }], 2)).toBeUndefined();
    expect(rowSizes(undefined, 0)).toBeUndefined();
  });
});

describe("a Workspace panel's icon", () => {
  it("can name every icon the rail draws, and nothing else", async () => {
    const { WORKSPACE_ICONS } = await import("@surfaces-ui/components");
    const { analyticsCatalog } = await import("../analytics.js");
    const schema = (await import("../generate.js")).catalogJson(analyticsCatalog).components as Record<string, { properties: { panels: { items: { properties: { icon: { enum: string[] } } } } } }>;
    expect([...schema.Workspace!.properties.panels.items.properties.icon.enum].sort()).toEqual([...WORKSPACE_ICONS].sort());
    expect(WORKSPACE_ICONS).toEqual(expect.arrayContaining(["bell", "person"]));
  });
});
