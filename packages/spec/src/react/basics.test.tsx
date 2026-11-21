// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { basicComponents, basicsCatalog } from "../basics.js";
import { catalogJson } from "../generate.js";
import { A2UI_VERSION } from "../dynamic.js";
import { type SurfaceAction, type SurfaceComponent, applyMessages } from "../surface.js";
import { SurfaceView, analyticsRenderers, basicsRenderers } from "./index.js";

afterEach(cleanup);

const names = Object.keys(basicComponents);

describe("the basics catalog", () => {
  it("holds the components every catalog shares, each with a valid example", () => {
    expect(basicsCatalog.names).toEqual(names);
    expect(names).toEqual(expect.arrayContaining(["Text", "Grid", "Button", "Form", "Markdown", "Link", "SideNav", "ThemeSwitch"]));
    for (const name of names) expect(basicsCatalog.validateComponent(basicsCatalog.components[name]!.example), name).toEqual([]);
  });

  it("means the same thing under the analytics catalog: the same props, events and examples", () => {
    const basics = catalogJson(basicsCatalog).components as Record<string, unknown>;
    const analytics = catalogJson(analyticsCatalog).components as Record<string, unknown>;
    for (const name of names) {
      // The envelope names its own catalog; everything the component itself takes is the same.
      const strip = (schema: unknown) => JSON.parse(JSON.stringify(schema).replaceAll(basicsCatalog.id, "ID").replaceAll(analyticsCatalog.id, "ID"));
      expect(strip(basics[name]), name).toEqual(strip(analytics[name]));
      expect(analyticsCatalog.components[name]!.events, name).toEqual(basicsCatalog.components[name]!.events);
    }
    expect(basicsCatalog.components.Button!.events).toHaveProperty("press");
    expect(basicsCatalog.components.Form!.events).toHaveProperty("submit");
  });

  it("refuses what only the analytics catalog draws", () => {
    expect(basicsCatalog.validateComponent({ id: "m", component: "Metric", sourceId: "s", sql: "SELECT 1", label: "Rows" })[0]!.message).toMatch(/Unknown component "Metric"/);
  });

  it("is drawn by the same renderers as the analytics catalog", () => {
    expect(Object.keys(basicsRenderers)).toEqual(names);
    for (const name of names) expect(basicsRenderers[name], name).toBe(analyticsRenderers[name]);
  });

  it("draws a surface with its own renderers and sends its events", () => {
    const components: SurfaceComponent[] = [
      { id: "root", component: "Column", children: ["title", "note", "go"] },
      { id: "title", component: "Text", text: "Welcome", variant: "h1" },
      { id: "note", component: "Markdown", text: "Start **here**." },
      { id: "label", component: "Text", text: "Begin" },
      { id: "go", component: "Button", child: "label", action: { event: { name: "begin" } } },
    ];
    const surface = applyMessages({}, [
      { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: basicsCatalog.id } },
      { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components } },
    ]).main!;
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    const onProblem = vi.fn();
    render(
      <DataSourceProvider dataSource={memoryDataSource({ tables: {} })}>
        <SurfaceView surface={surface} catalog={basicsCatalog} renderers={basicsRenderers} onAction={onAction} onProblem={onProblem} />
      </DataSourceProvider>,
    );
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("here").tagName).toBe("STRONG");
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "begin" }));
    expect(onProblem).not.toHaveBeenCalled();
  });
});
