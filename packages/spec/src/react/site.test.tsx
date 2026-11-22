// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { removeComponentMessages, surfaceOutline } from "../arrange.js";
import { basicsCatalog } from "../basics.js";
import { A2UI_VERSION } from "../dynamic.js";
import { SITE_COMPONENT_NAMES, siteCatalog } from "../site.js";
import { type SurfaceAction, type SurfaceComponent, applyMessages } from "../surface.js";
import { SurfaceView } from "./Surface.js";
import { MediaPolicyProvider, mediaAddress, siteLink, siteRenderers } from "./site.js";

afterEach(cleanup);

const surfaceOf = (components: SurfaceComponent[]) =>
  applyMessages({}, [
    { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: siteCatalog.id } },
    { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components } },
  ]).main!;

function draw(components: SurfaceComponent[], wrap: (node: ReactNode) => ReactNode = (node) => node) {
  const onAction = vi.fn<(a: SurfaceAction) => void>();
  const onProblem = vi.fn();
  const onControlsChange = vi.fn();
  const view = render(
    <DataSourceProvider dataSource={memoryDataSource({ tables: {} })}>
      {wrap(<SurfaceView surface={surfaceOf(components)} catalog={siteCatalog} renderers={siteRenderers} onAction={onAction} onProblem={onProblem} onControlsChange={onControlsChange} />)}
    </DataSourceProvider>,
  );
  return { ...view, onAction, onProblem, onControlsChange };
}

/** An example as a whole surface: the component as root, and a Text for each child it names. */
function exampleSurface(name: string): SurfaceComponent[] {
  const example = siteCatalog.components[name]!.example as SurfaceComponent;
  const named = [
    ...(Array.isArray(example.children) ? (example.children as string[]) : []),
    ...(typeof example.child === "string" ? [example.child] : []),
    ...(Array.isArray(example.examples) ? (example.examples as { child: string }[]).map((e) => e.child) : []),
  ];
  return [{ ...example, id: "root" }, ...named.map((id) => ({ id, component: "Text", text: `Child ${id}` }))];
}

describe("the site catalog", () => {
  it("is the basics and the site's own components, each with a valid example", () => {
    expect(siteCatalog.names).toEqual([...basicsCatalog.names, ...SITE_COMPONENT_NAMES]);
    for (const name of siteCatalog.names) expect(siteCatalog.validateComponent(siteCatalog.components[name]!.example), name).toEqual([]);
    expect(Object.keys(siteRenderers).sort()).toEqual([...siteCatalog.names].sort());
  });

  it("keeps the two catalogs apart: no data components for a site, no site components for data", () => {
    expect(siteCatalog.validateComponent({ id: "m", component: "Metric", sourceId: "s", sql: "SELECT 1", label: "Rows" })[0]!.message).toMatch(/Unknown component/);
    expect(analyticsCatalog.validateComponent(siteCatalog.components.Hero!.example)[0]!.message).toMatch(/Unknown component/);
  });

  it("draws every example with no problems", () => {
    for (const name of SITE_COMPONENT_NAMES) {
      const { onProblem, unmount } = draw(exampleSurface(name));
      expect(onProblem, name).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("finds the children a hero, a frame and a showcase hold, and can take a showcase example off", () => {
    const surface = surfaceOf([
      { id: "root", component: "Column", children: ["hero", "show"] },
      { id: "hero", component: "Hero", title: "Hi", children: ["go"] },
      { id: "go", component: "Button", child: "go-label", action: { event: { name: "go" } } },
      { id: "go-label", component: "Text", text: "Go" },
      { id: "show", component: "Showcase", label: "Pick", examples: [{ id: "a", name: "A", child: "a-view" }, { id: "b", name: "B", child: "b-view" }] },
      { id: "a-view", component: "Text", text: "A" },
      { id: "b-view", component: "Text", text: "B" },
    ]);
    expect(surfaceOutline(surface).map((item) => item.id)).toEqual(["root", "hero", "go", "go-label", "show", "a-view", "b-view"]);
    const removed = removeComponentMessages(surface, "a-view");
    const sent = "messages" in removed ? (removed.messages[0] as { updateComponents: { components: { examples?: unknown[] }[] } }) : undefined;
    expect(sent?.updateComponents.components[0]!.examples).toHaveLength(1);
  });
});

describe("site renderers", () => {
  it("send the id of a card, a nav item, a footer link or a post that is not a link", () => {
    const { onAction } = draw([
      { id: "root", component: "Column", children: ["cards", "posts"] },
      { id: "cards", component: "FeatureGrid", items: [{ id: "analyst", title: "Analyst" }], action: { event: { name: "select" } } },
      { id: "posts", component: "PostList", posts: [{ id: "p1", title: "First" }], action: { event: { name: "open" } } },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Analyst" }));
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(onAction.mock.calls.map(([a]) => [a.name, a.context])).toEqual([
      ["select", { id: "analyst" }],
      ["open", { id: "p1" }],
    ]);
  });

  it("draws only safe links: http, https or a path on the site", () => {
    expect(siteLink("/pricing")).toBe("/pricing");
    expect(siteLink("https://example.com/a")).toBe("https://example.com/a");
    for (const bad of ["javascript:alert(1)", "//evil.example.com", "data:text/html,x", "/a b", 3]) expect(siteLink(bad), String(bad)).toBeUndefined();
    draw([
      {
        id: "root",
        component: "Footer",
        groups: [{ items: [{ id: "x", label: "Bad", href: "javascript:alert(1)" }, { id: "y", label: "Docs", href: "/docs" }] }],
      },
    ]);
    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/docs");
  });

  it("loads an image only from an address the page gives or an origin it allows", () => {
    expect(mediaAddress("https://cdn.example.com/a.png", {})).toBeUndefined();
    expect(mediaAddress("https://cdn.example.com/a.png", { origins: ["https://cdn.example.com"] })).toBe("https://cdn.example.com/a.png");
    expect(mediaAddress("https://other.example.com/a.png", { origins: ["https://cdn.example.com"] })).toBeUndefined();
    expect(mediaAddress("hero", { resolve: (src) => (src === "hero" ? "/img/hero.png" : undefined) })).toBe("/img/hero.png");
    expect(mediaAddress("hero", { resolve: () => "javascript:alert(1)" })).toBeUndefined();

    const media: SurfaceComponent[] = [{ id: "root", component: "Media", src: "hero", alt: "The product" }];
    draw(media);
    expect(screen.getByRole("img", { name: "The product" }).tagName).toBe("DIV");
    cleanup();
    draw(media, (node) => <MediaPolicyProvider policy={{ resolve: () => "/img/hero.png" }}>{node}</MediaPolicyProvider>);
    expect(screen.getByRole("img", { name: "The product" }).getAttribute("src")).toBe("/img/hero.png");
  });

  it("reports which showcase example a person chose", () => {
    const { onControlsChange } = draw(exampleSurface("Showcase"));
    fireEvent.click(screen.getByRole("radio", { name: "Data steward" }));
    expect(onControlsChange).toHaveBeenCalledWith("root", { selected: "steward" });
    expect(screen.getByText("Child steward-view")).toBeTruthy();
  });

  it("draws a callout's text as Markdown, under its kind", () => {
    draw(exampleSurface("Callout"));
    expect(screen.getByRole("complementary", { name: "Warning" })).toBeTruthy();
    expect(screen.getByText("rebuilds every table").tagName).toBe("STRONG");
  });
});
