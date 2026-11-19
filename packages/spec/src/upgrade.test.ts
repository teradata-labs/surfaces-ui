import { describe, expect, it } from "vitest";
import { analyticsCatalog } from "./analytics.js";
import { A2UI_VERSION } from "./dynamic.js";
import { fromJsonRender } from "./jsonrender.js";
import { toJsonRender } from "./markup.js";
import { type PageDocument, editPage, pageMessages, pageSurface, upgradePage, validatePage } from "./page.js";
import { type SurfaceMessage, SurfaceError, applyMessages, upgradeSurface } from "./surface.js";
import { upgradeComponent, upgradeMessage, upgradeValue } from "./upgrade.js";

const catalog = analyticsCatalog;
const old = (body: Record<string, unknown>) => ({ version: "v0.9", ...body }) as unknown as SurfaceMessage;

describe("reading A2UI v0.9", () => {
  it("rewrites bindings and function calls, and nothing that only looks like one", () => {
    expect(upgradeValue({ path: "/a" })).toEqual({ "@path": "/a" });
    expect(upgradeValue({ call: "formatCurrency", args: { value: { path: "/revenue" } }, returnType: "string" })).toEqual({ "@call": "formatCurrency", args: { value: { "@path": "/revenue" } } });
    // A repeated child names a list, not a binding: it keeps `path`.
    expect(upgradeValue({ componentId: "row", path: "/items" })).toEqual({ componentId: "row", path: "/items" });
    expect(upgradeValue([{ path: "/a" }, "text", 3, null])).toEqual([{ "@path": "/a" }, "text", 3, null]);
  });

  it("moves a component's envelope keys and leaves its metadata alone", () => {
    const component = { id: "t", component: "Text", text: { path: "/title" }, accessibility: { label: "Title" }, "@metadata": { extensions: { acme_note: { path: "/kept" } } } };
    expect(upgradeComponent(component)).toEqual({ id: "t", component: "Text", text: { "@path": "/title" }, "@accessibility": { label: "Title" }, "@metadata": { extensions: { acme_note: { path: "/kept" } } } });
  });

  it("turns each kind of message into the current version, and leaves a current one as it is", () => {
    const created = upgradeMessage(old({ createSurface: { surfaceId: "s", catalogId: catalog.id, theme: { mode: "dark" }, expects: { go: { type: "object" } }, sendDataModel: true } }));
    expect(created).toEqual({
      version: A2UI_VERSION,
      createSurface: { surfaceId: "s", catalogId: catalog.id, sendDataModel: true, metadata: { extensions: { surfaces_theme: { mode: "dark" }, surfaces_expects: { go: { type: "object" } } } } },
    });
    expect(upgradeMessage(old({ updateDataModel: { surfaceId: "s", path: "/gone" } }))).toEqual({ version: A2UI_VERSION, updateDataModel: { surfaceId: "s", path: "/gone", value: null } });
    const current: SurfaceMessage = { version: A2UI_VERSION, updateDataModel: { surfaceId: "s", path: "/a", value: { path: "kept as data" } } };
    expect(upgradeMessage(current)).toBe(current);
  });

  it("checks and applies a v0.9 stream as what it becomes", () => {
    const stream = [
      old({ createSurface: { surfaceId: "main", catalogId: catalog.id, theme: { preset: "Mono" } } }),
      old({ updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Column", children: ["title"] }, { id: "title", component: "Text", text: { path: "/title" } }] } }),
      old({ updateDataModel: { surfaceId: "main", path: "/title", value: "Hello" } }),
      old({ updateDataModel: { surfaceId: "main", path: "/extra", value: 1 } }),
      old({ updateDataModel: { surfaceId: "main", path: "/extra" } }),
    ];
    for (const message of stream) expect(catalog.validateMessage(message)).toEqual([]);
    const surface = applyMessages({}, stream).main!;
    expect(surface.a2ui).toBe(A2UI_VERSION);
    expect(surface.theme).toEqual({ preset: "Mono" });
    expect(surface.components.title).toEqual({ id: "title", component: "Text", text: { "@path": "/title" } });
    expect(surface.data).toEqual({ title: "Hello" });
  });

  it("refuses a version it does not read", () => {
    expect(catalog.validateMessage({ version: "v0.8", deleteSurface: { surfaceId: "s" } })[0]?.path).toBe("/version");
  });

  it("opens a page and a surface saved before the move", () => {
    const saved: PageDocument = {
      id: "p",
      title: "Saved",
      catalogId: catalog.id,
      components: [{ id: "root", component: "Column", children: ["title"] }, { id: "title", component: "Text", text: { path: "/title" } }],
      data: { title: "Hello" },
    };
    expect(validatePage(saved, catalog)).toEqual([]);
    expect(pageSurface(saved).components.title).toEqual({ id: "title", component: "Text", text: { "@path": "/title" } });
    const edited = editPage(saved, [{ op: "title", title: "Renamed" }], catalog).page;
    expect(edited.a2ui).toBe(A2UI_VERSION);
    expect(upgradePage(edited)).toBe(edited);
    const kept = { surfaceId: "p", catalogId: catalog.id, components: Object.fromEntries(saved.components.map((c) => [c.id, c])), data: {} };
    expect(upgradeSurface(kept).components.title).toEqual({ id: "title", component: "Text", text: { "@path": "/title" } });
  });
});

describe("A2UI v1.0", () => {
  const v = A2UI_VERSION;

  it("takes components and data with the surface, and makes a surface only once", () => {
    const create: SurfaceMessage = {
      version: v,
      createSurface: { surfaceId: "main", catalogId: catalog.id, components: [{ id: "root", component: "Text", text: { "@path": "/title" } }], dataModel: { title: "Hello" } },
    };
    expect(catalog.validateMessage(create)).toEqual([]);
    const surfaces = applyMessages({}, [create]);
    expect(surfaces.main!.components.root).toEqual({ id: "root", component: "Text", text: { "@path": "/title" } });
    expect(surfaces.main!.data).toEqual({ title: "Hello" });
    expect(() => applyMessages(surfaces, [create])).toThrowError(SurfaceError);
    expect(applyMessages(applyMessages(surfaces, [{ version: v, deleteSurface: { surfaceId: "main" } }]), [create]).main).toBeDefined();
  });

  it("reports a problem in a component sent with the surface at that component", () => {
    const issues = catalog.validateMessage({ version: v, createSurface: { surfaceId: "main", catalogId: catalog.id, components: [{ id: "root", component: "Text", text: "ok", colour: "red" }] } });
    expect(issues[0]?.path.startsWith("/createSurface/components/0")).toBe(true);
  });

  it("asks updateDataModel for a value, and removes on null", () => {
    expect(catalog.validateMessage({ version: v, updateDataModel: { surfaceId: "main", path: "/a" } })[0]?.path).toBe("/updateDataModel/value");
    const start = applyMessages({}, [{ version: v, createSurface: { surfaceId: "main", catalogId: catalog.id, dataModel: { a: 1, b: 2 } } }]);
    expect(applyMessages(start, [{ version: v, updateDataModel: { surfaceId: "main", path: "/a", value: null } }]).main!.data).toEqual({ b: 2 });
  });

  it("no longer takes a theme or the v0.9 spellings", () => {
    expect(catalog.validateMessage({ version: v, createSurface: { surfaceId: "s", catalogId: catalog.id, theme: { mode: "dark" } } })).not.toEqual([]);
    expect(catalog.validateComponent({ id: "t", component: "Text", text: { path: "/title" } })).not.toEqual([]);
    expect(catalog.validateComponent({ id: "t", component: "Text", text: "x", accessibility: { label: "Title" } })).not.toEqual([]);
  });
});

describe("metadata", () => {
  const tile = { id: "root", component: "Text", text: "Revenue", "@metadata": { extensions: { surfaces_locked: true, acme_source: { question: "Revenue by state", terms: ["invoice-line"] } } } };

  it("is accepted on any component and on the surface, by name", () => {
    expect(catalog.validateComponent(tile)).toEqual([]);
    expect(catalog.validateComponent({ ...tile, "@catalogId": catalog.id, "@accessibility": { label: "Revenue", live: "polite" } })).toEqual([]);
    expect(catalog.validateMessage({ version: A2UI_VERSION, createSurface: { surfaceId: "s", catalogId: catalog.id, metadata: { extensions: { acme_base: 3 } } } })).toEqual([]);
  });

  it("holds extensions only, under names that are identifiers, within a size", () => {
    expect(catalog.validateComponent({ ...tile, "@metadata": { locked: true } })).not.toEqual([]);
    expect(catalog.validateComponent({ ...tile, "@metadata": { extensions: { "not a name": 1 } } })).not.toEqual([]);
    expect(catalog.validateComponent({ ...tile, "@metadata": { extensions: { acme_big: "x".repeat(20_000) } } })).not.toEqual([]);
    expect(catalog.validateComponent({ ...tile, "@catalogId": "another" })).not.toEqual([]);
  });

  it("survives an edit to the component, a move, and the trip to json-render and back", () => {
    const page: PageDocument = {
      id: "p",
      title: "Page",
      catalogId: catalog.id,
      a2ui: A2UI_VERSION,
      components: [{ id: "root", component: "Column", children: ["tile", "box"] }, { ...tile, id: "tile" }, { id: "box", component: "Column", children: [] }],
    };
    const edited = editPage(page, [{ op: "update", id: "tile", props: { text: "Sales" } }, { op: "move", id: "tile", parent: "box" }], catalog);
    expect(edited.rejected).toEqual([]);
    const moved = edited.page.components.find((c) => c.id === "tile")!;
    expect(moved.text).toBe("Sales");
    expect(moved["@metadata"]).toEqual(tile["@metadata"]);

    const spec = toJsonRender(edited.page.components, { metadata: { extensions: { acme_base: 3 } } });
    expect(spec.elements.tile!.metadata).toEqual(tile["@metadata"]);
    expect(spec.elements.tile!.props).toEqual({ text: "Sales" });
    const back = fromJsonRender(spec, catalog, { surfaceId: "p" });
    for (const message of back) expect(catalog.validateMessage(message)).toEqual([]);
    const surface = applyMessages({}, back).p!;
    expect(surface.components.tile).toEqual(moved);
    expect(surface.metadata).toEqual({ extensions: { acme_base: 3 } });
  });

  it("puts a page's theme in the surface's metadata", () => {
    const page: PageDocument = { id: "p", title: "Page", catalogId: catalog.id, a2ui: A2UI_VERSION, components: [{ id: "root", component: "Text", text: "x" }], theme: { mode: "dark" } };
    const [create] = pageMessages(page);
    expect(create).toEqual({ version: A2UI_VERSION, createSurface: { surfaceId: "p", catalogId: catalog.id, metadata: { extensions: { surfaces_theme: { mode: "dark" } } } } });
    expect(catalog.validateMessage(create)).toEqual([]);
  });
});

describe("making a surface twice", () => {
  it("starts over for a v0.9 stream, as v0.9 did, and is an error in v1.0", () => {
    const first = old({ createSurface: { surfaceId: "main", catalogId: catalog.id } });
    const filled = applyMessages({}, [first, old({ updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "one" }] } })]);
    expect(applyMessages(filled, [first]).main!.components).toEqual({});
    expect(() => applyMessages(filled, [{ version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: catalog.id } }])).toThrowError(/already exists/);
  });
});
