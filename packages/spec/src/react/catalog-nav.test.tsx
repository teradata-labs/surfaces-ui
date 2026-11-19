// @vitest-environment jsdom
import { DataSourceProvider, DiscoveryProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { createDiscovery } from "@surfaces-ui/discovery";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { type PageDocument, pageSurface, validatePage } from "../page.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const data = memoryDataSource({
  sourceId: "shop",
  tables: {
    orders: Array.from({ length: 6 }, (_, i) => ({ order_id: i + 1, customer_id: (i % 2) + 1 })),
    customers: [
      { customer_id: 1, full_name: "A" },
      { customer_id: 2, full_name: "B" },
    ],
  },
});

/** A saved catalog surface: search, detail and graph share /table, so it navigates with no agent. */
const catalogPage: PageDocument = {
  id: "shop-catalog",
  title: "Shop catalog",
  catalogId: analyticsCatalog.id,
  data: { table: "orders" },
  components: [
    { id: "root", component: "Column", children: ["search", "detail", "around"] },
    { id: "search", component: "DataSearch", sourceId: "shop", opened: { "@path": "/table" }, action: { event: { name: "open_table" } } },
    { id: "detail", component: "ObjectDetail", sourceId: "shop", table: { "@path": "/table" }, opened: { "@path": "/table" } },
    { id: "around", component: "RelationshipGraph", sourceId: "shop", table: { "@path": "/table" }, opened: { "@path": "/table" } },
  ],
};

describe("a workspace an agent lays out and a person rearranges", () => {
  const page = (columns: string[][]): PageDocument => ({
    id: "explore",
    title: "Explore",
    catalogId: analyticsCatalog.id,
    components: [
      { id: "root", component: "Workspace", label: "Explore", panels: [{ id: "search", title: "Table search", child: "s" }, { id: "map", title: "Relationship map", child: "m" }], layout: { columns } },
      { id: "s", component: "Text", text: "search body" },
      { id: "m", component: "Text", text: "map body" },
    ],
  });
  const columnsOf = (container: HTMLElement) => [...container.querySelectorAll(".sf-workspace-column")].map((column) => [...column.querySelectorAll(".sf-workspace-panel-title")].map((t) => t.textContent));

  it("puts panels where the agent says, reports a person's change as `layout`, and takes the agent's next layout", () => {
    expect(validatePage(page([["map"], ["search"]]), analyticsCatalog)).toEqual([]);
    const onControlsChange = vi.fn();
    const view = (doc: PageDocument) => (
      <DataSourceProvider dataSource={data}>
        <SurfaceView surface={pageSurface(doc)} catalog={analyticsCatalog} renderers={analyticsRenderers} onControlsChange={onControlsChange} />
      </DataSourceProvider>
    );
    const { container, rerender } = render(view(page([["map"], ["search"]])));
    expect(columnsOf(container)).toEqual([["Relationship map"], ["Table search"]]);
    expect(screen.getByText("search body")).toBeTruthy();
    // By hand: hide the map from the rail.
    fireEvent.click(screen.getByRole("button", { name: "Relationship map" }));
    expect(columnsOf(container)).toEqual([["Table search"]]);
    expect(onControlsChange).toHaveBeenLastCalledWith("root", { layout: expect.objectContaining({ columns: [["search"]], hidden: ["map"] }) });
    // The agent: "search on the left, the map on the right".
    rerender(view(page([["search"], ["map"]])));
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map"]]);
  });

  it("refuses a layout that is not lists of panel ids", () => {
    const bad = page([["search"]]);
    (bad.components[0] as Record<string, unknown>).layout = { columns: "search, map" };
    expect(validatePage(bad, analyticsCatalog).length).toBeGreaterThan(0);
  });
});

describe("sizes a person or an agent gives", () => {
  const page = (extra: Record<string, unknown> = {}): PageDocument => ({
    id: "sized",
    title: "Sized",
    catalogId: analyticsCatalog.id,
    components: [
      { id: "root", component: "Column", children: ["pair", "tiles"] },
      { id: "pair", component: "Row", children: ["a", "b"], widths: [2, 1], ...extra },
      { id: "a", component: "Text", text: "wide", minHeight: 120 },
      { id: "b", component: "Text", text: "narrow" },
      { id: "tiles", component: "Grid", columns: 2, widths: [3, 1], children: ["c", "d"] },
      { id: "c", component: "Text", text: "c" },
      { id: "d", component: "Text", text: "d" },
    ],
  });
  const view = (doc: PageDocument) => (
    <DataSourceProvider dataSource={data}>
      <SurfaceView surface={pageSurface(doc)} catalog={analyticsCatalog} renderers={analyticsRenderers} />
    </DataSourceProvider>
  );

  it("gives a row's children and a grid's columns their shares, and a component's box its least height", () => {
    expect(validatePage(page(), analyticsCatalog)).toEqual([]);
    const { container } = render(view(page()));
    const cells = [...container.querySelectorAll<HTMLElement>(".sf-a2-row > .sf-a2-row-cell")];
    expect(cells.map((cell) => cell.style.flex)).toEqual(["2 1 0px", "1 1 0px"]);
    expect(cells[0]!.textContent).toBe("wide");
    expect(container.querySelector<HTMLElement>(".sf-a2-grid")!.style.getPropertyValue("--sf-grid-template")).toBe("minmax(0, 3fr) minmax(0, 1fr)");
    expect(container.querySelector<HTMLElement>(".sf-surface-sized")!.style.minHeight).toBe("120px");
    expect(container.querySelectorAll(".sf-surface-sized").length).toBe(1);
  });

  it("leaves children equal when the shares do not match them", () => {
    const { container } = render(view(page({ widths: [1, 1, 1] })));
    expect(container.querySelector(".sf-a2-row")!.hasAttribute("data-widths")).toBe(false);
    expect(container.querySelectorAll(".sf-a2-row-cell").length).toBe(0);
  });

  it("offers a least height to every component that has no height of its own, and only to those", () => {
    for (const [name, definition] of Object.entries(analyticsCatalog.components)) {
      expect("minHeight" in definition.props, name).toBe(!("height" in definition.props));
    }
    const bad = page();
    (bad.components[2] as Record<string, unknown>).minHeight = "tall";
    expect(validatePage(bad, analyticsCatalog).length).toBeGreaterThan(0);
  });
});

describe("an editor's frame around each component", () => {
  it("wraps what is drawn without changing the surface: the event is still sent", () => {
    const page: PageDocument = {
      id: "framed",
      title: "Framed",
      catalogId: analyticsCatalog.id,
      components: [
        { id: "root", component: "Column", children: ["title", "pick"] },
        { id: "title", component: "Text", text: "Hello" },
        { id: "pick", component: "Chips", items: ["a"], action: { event: { name: "choose" } } },
      ],
    };
    const onAction = vi.fn();
    const { container } = render(
      <DataSourceProvider dataSource={data}>
        <SurfaceView
          surface={pageSurface(page)}
          catalog={analyticsCatalog}
          renderers={analyticsRenderers}
          onAction={onAction}
          frame={(component, drawn) => (
            <div data-framed={component.id} data-kind={String(component.component)}>
              {drawn}
            </div>
          )}
        />
      </DataSourceProvider>,
    );
    expect([...container.querySelectorAll("[data-framed]")].map((f) => `${f.getAttribute("data-kind")} ${f.getAttribute("data-framed")}`)).toEqual(["Column root", "Text title", "Chips pick"]);
    // The children are framed inside their container's frame.
    expect(container.querySelector('[data-framed="root"] [data-framed="title"]')!.textContent).toBe("Hello");
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "choose", sourceComponentId: "pick" }));
  });
});

describe("chips that switch a view inside a surface", () => {
  const page: PageDocument = {
    id: "pick-table",
    title: "Pick a table",
    catalogId: analyticsCatalog.id,
    data: { sql: "SELECT * FROM orders" },
    components: [
      { id: "root", component: "Column", children: ["tables", "shown"] },
      {
        id: "tables",
        component: "Chips",
        items: [{ label: "orders", value: "SELECT * FROM orders" }, { label: "customers", value: "SELECT * FROM customers" }, "plain"],
        selected: { "@path": "/sql" },
        action: { event: { name: "choose_table" } },
      },
      { id: "shown", component: "Text", text: { "@path": "/sql" } },
    ],
  };

  it("writes the pressed chip's value where the other component reads it, marks it pressed, and still sends the event", () => {
    expect(validatePage(page, analyticsCatalog)).toEqual([]);
    const onAction = vi.fn();
    render(
      <DataSourceProvider dataSource={data}>
        <SurfaceView surface={pageSurface(page)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />
      </DataSourceProvider>,
    );
    expect(screen.getByRole("button", { name: "orders" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("SELECT * FROM orders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "customers" }));
    expect(screen.getByText("SELECT * FROM customers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "customers" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "orders" }).getAttribute("aria-pressed")).toBe("false");
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "choose_table", context: expect.objectContaining({ value: "SELECT * FROM customers" }) }));
    // A plain item is its own value.
    fireEvent.click(screen.getByRole("button", { name: "plain" }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ context: expect.objectContaining({ value: "plain" }) }));
  });

  it("without `selected`, a chip only sends its event and is not a toggle", () => {
    const plain = { ...page, components: page.components.map((c) => (c.id === "tables" ? { id: "tables", component: "Chips", items: ["a", "b"], action: { event: { name: "choose" } } } : c)) };
    render(
      <DataSourceProvider dataSource={data}>
        <SurfaceView surface={pageSurface(plain)} catalog={analyticsCatalog} renderers={analyticsRenderers} />
      </DataSourceProvider>,
    );
    expect(screen.getByRole("button", { name: "a" }).hasAttribute("aria-pressed")).toBe(false);
  });
});

describe("catalog navigation inside a surface", () => {
  it("opens a search result in the detail and graph, and still sends the event", async () => {
    expect(validatePage(catalogPage, analyticsCatalog)).toEqual([]);
    const onAction = vi.fn();
    const onDataChange = vi.fn();
    render(
      <DataSourceProvider dataSource={data}>
        <DiscoveryProvider discovery={createDiscovery({ dataSource: data })}>
          <SurfaceView surface={pageSurface(catalogPage)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onDataChange={onDataChange} />
        </DiscoveryProvider>
      </DataSourceProvider>,
    );
    expect(await screen.findByRole("heading", { name: "orders" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search data"), { target: { value: "customers" } });
    const result = await screen.findByText("Name matches “customers” · Has column customer_id");
    fireEvent.click(result.closest("button")!);
    expect(await screen.findByRole("heading", { name: "customers" })).toBeTruthy();
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "open_table", context: expect.objectContaining({ table: "customers" }) }));
    expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({ table: "customers" }));
  });

  it("asks for a table when none is open", async () => {
    const page = { ...catalogPage, data: {} };
    render(
      <DiscoveryProvider discovery={createDiscovery({ dataSource: data })}>
        <SurfaceView surface={pageSurface(page)} catalog={analyticsCatalog} renderers={analyticsRenderers} />
      </DiscoveryProvider>,
    );
    expect(await screen.findByText("Open a table to see what is known about it.")).toBeTruthy();
  });
});
