// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { fromJsonRender } from "../jsonrender.js";
import { toJsonRender, toMarkup } from "../markup.js";
import { applyMessages } from "../surface.js";
import { analyticsMarkup as Ui, markupComponents } from "./markup.js";

afterEach(cleanup);

// The same surface written three ways. The JSX below is real (Vitest compiles it); MARKUP is the text toMarkup must
// print for the components it compiles to, which is that same JSX.
const tree = (
  <Ui.Column align="start">
    <Ui.Text text="Sales" variant="h2" />
    <Ui.Row>
      <Ui.Stat label="Revenue" value={{ "@path": "/revenue" }} />
      <Ui.Stat id="orders" label="Orders" value={1200} />
    </Ui.Row>
    <Ui.Card>
      <Ui.Text text="Updated nightly" variant="caption" />
    </Ui.Card>
  </Ui.Column>
);

const MARKUP = `<Ui.Column align="start">
  <Ui.Text text="Sales" variant="h2" />
  <Ui.Row>
    <Ui.Stat label="Revenue" value={{ "@path": "/revenue" }} />
    <Ui.Stat id="orders" label="Orders" value={1200} />
  </Ui.Row>
  <Ui.Card>
    <Ui.Text text="Updated nightly" variant="caption" />
  </Ui.Card>
</Ui.Column>`;

describe("markup", () => {
  it("compiles JSX into the catalog's components, naming each by its kind", () => {
    const { components, ignored } = markupComponents(tree);
    expect(ignored).toEqual([]);
    expect(components).toEqual([
      { id: "root", component: "Column", align: "start", children: ["text", "row", "card"] },
      { id: "text", component: "Text", text: "Sales", variant: "h2" },
      { id: "row", component: "Row", children: ["stat", "orders"] },
      { id: "stat", component: "Stat", label: "Revenue", value: { "@path": "/revenue" } },
      { id: "orders", component: "Stat", label: "Orders", value: 1200 },
      { id: "card", component: "Card", child: "text-2" },
      { id: "text-2", component: "Text", text: "Updated nightly", variant: "caption" },
    ]);
    // Every component is valid against the catalog.
    for (const component of components) expect(analyticsCatalog.validateComponent(component), component.id).toEqual([]);
  });

  it("writes components back as the same JSX", () => {
    expect(toMarkup(markupComponents(tree).components)).toBe(MARKUP);
  });

  it("writes json-render that reads back as the same components, bindings and data", () => {
    const { components } = markupComponents(tree);
    const spec = toJsonRender(components, { data: { revenue: 5 } });
    expect(spec.elements.stat!.props!.value).toEqual({ $state: "/revenue" });
    const surface = applyMessages({}, fromJsonRender(spec, analyticsCatalog)).main!;
    expect(Object.values(surface.components)).toEqual(components);
    expect(surface.data).toEqual({ revenue: 5 });
  });

  it("round-trips every catalog component's example through json-render and markup", () => {
    for (const [name, entry] of Object.entries(analyticsCatalog.components)) {
      const example = { ...(entry.example as Record<string, unknown>), id: "root", component: name } as import("../surface.js").SurfaceComponent;
      // Children an example names are not in it; give each a placeholder so the tree is whole.
      const kids = [...(Array.isArray(example.children) ? example.children : []), ...(typeof example.child === "string" ? [example.child] : [])] as string[];
      const components = [example, ...kids.map((id) => ({ id, component: "Text", text: id }))];
      const back = Object.values(applyMessages({}, fromJsonRender(toJsonRender(components), analyticsCatalog)).main!.components);
      expect(back, name).toEqual(components);
      const markup = toMarkup(components);
      expect(markup.startsWith(`<Ui.${name}`), name).toBe(true);
      expect(markup.match(/<Ui\./g)!.length, name).toBe(components.length);
    }
  });

  it("draws the tree through the catalog, and says what it left out", async () => {
    render(
      <Ui.Column data={{ revenue: 42 }}>
        <Ui.Stat label="Revenue" value={{ "@path": "/revenue" }} />
        some loose text
      </Ui.Column>,
    );
    // The renderers load on first use.
    expect(await screen.findByText("Revenue")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain('the text "some loose text"');
  });
});
