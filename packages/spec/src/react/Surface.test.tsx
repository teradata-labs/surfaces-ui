// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION } from "../dynamic.js";
import type { SurfaceAction, SurfaceMessage } from "../surface.js";
import { SurfaceView, type UseSurfaces, analyticsRenderers, useSurfaces } from "./index.js";

afterEach(cleanup);
const v = A2UI_VERSION;
const create: SurfaceMessage = { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } };
const components = (list: Record<string, unknown>[]): SurfaceMessage => ({ version: v, updateComponents: { surfaceId: "main", components: list as never } });
const data = (path: string, value: unknown): SurfaceMessage => ({ version: v, updateDataModel: { surfaceId: "main", path, value } });

function Host({ initial, onAction, expose }: { initial: SurfaceMessage[]; onAction?: (a: SurfaceAction) => void; expose?: (s: UseSurfaces) => void }) {
  const state = useSurfaces(analyticsCatalog, initial);
  expose?.(state);
  const surface = state.surfaces.main;
  return (
    <DataSourceProvider dataSource={memoryDataSource({ tables: { orders: [{ region: "EU", amount: 5 }, { region: "NA", amount: 7 }] } })}>
      {surface && <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />}
      <output data-testid="problems">{state.problems.map((p) => `${p.code} ${p.path} ${p.message}`).join("\n")}</output>
    </DataSourceProvider>
  );
}

describe("SurfaceView", () => {
  it("draws a surface, binds to data, and updates as messages stream in", () => {
    let api!: UseSurfaces;
    render(
      <Host
        expose={(s) => (api = s)}
        initial={[
          create,
          components([
            { id: "root", component: "Column", children: ["title", "stats", "later"] },
            { id: "title", component: "Text", text: { "@path": "/title" }, variant: "h1" },
            { id: "stats", component: "Row", children: ["revenue"] },
            { id: "revenue", component: "Stat", label: "Revenue", value: { "@call": "formatCurrency", args: { value: { "@path": "/revenue" }, currency: "USD" } }, delta: "+5%", tone: "positive" },
          ]),
          data("/", { title: "Sales", revenue: 1200 }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Sales" })).toBeTruthy();
    expect(screen.getByText("$1,200.00")).toBeTruthy();
    expect(screen.getByText("+5%").getAttribute("data-tone")).toBe("positive");
    // "later" has not arrived yet: nothing is drawn for it and nothing breaks.
    act(() => api.apply([data("/revenue", 1500), components([{ id: "later", component: "Badge", text: "Live" }])]));
    expect(screen.getByText("$1,500.00")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("repeats a template over a data list with item-relative paths", () => {
    render(
      <Host
        initial={[
          create,
          components([
            { id: "root", component: "Column", children: { componentId: "row", path: "/people" } },
            { id: "row", component: "Text", text: { "@call": "formatString", args: { value: "${name} (${/team})" } } },
          ]),
          data("/", { team: "Data", people: [{ name: "Ada" }, { name: "Lin" }] }),
        ]}
      />,
    );
    expect(screen.getByText("Ada (Data)")).toBeTruthy();
    expect(screen.getByText("Lin (Data)")).toBeTruthy();
  });

  it("sends button events with resolved context and switches tabs", () => {
    const onAction = vi.fn();
    render(
      <Host
        onAction={onAction}
        initial={[
          create,
          components([
            { id: "root", component: "Column", children: ["go", "tabs"] },
            { id: "go", component: "Button", child: "go-label", variant: "primary", action: { event: { name: "drill", context: { region: { "@path": "/region" }, fixed: 1 } } } },
            { id: "go-label", component: "Text", text: "Drill in" },
            { id: "tabs", component: "Tabs", tabs: [{ title: "One", child: "a" }, { title: "Two", child: "b" }] },
            { id: "a", component: "Text", text: "First panel" },
            { id: "b", component: "Text", text: "Second panel" },
          ]),
          data("/region", "Europe"),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Drill in" }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "drill", surfaceId: "main", sourceComponentId: "go", context: { region: "Europe", fixed: 1 } }));
    expect(onAction.mock.calls[0]![0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(screen.queryByText("Second panel")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Second panel")).toBeTruthy();
  });

  it("draws data components through the DataSource", async () => {
    render(
      <Host
        initial={[
          create,
          components([
            { id: "root", component: "Column", children: ["grid"] },
            { id: "grid", component: "DataGrid", sourceId: "memory", sql: { "@path": "/sql" }, height: 300 },
          ]),
          data("/sql", "SELECT * FROM orders"),
        ]}
      />,
    );
    expect(await screen.findByText("2 rows")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("EU")).toBeTruthy());
  });

  it("refuses what the catalog does not allow and says why", () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <Host
        initial={[
          create,
          components([
            { id: "root", component: "Column", children: ["evil", "bad", "loop", "link", "ok"] },
            { id: "evil", component: "Script", src: "https://example.com/x.js" },
            { id: "bad", component: "Text", text: "x", dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" } },
            { id: "loop", component: "Card", child: "loop" },
            { id: "link", component: "Button", child: "link-label", action: { functionCall: { "@call": "openUrl", args: { url: "javascript:alert(1)" } } } },
            { id: "link-label", component: "Text", text: "Open" },
            { id: "ok", component: "Text", text: "<b>not markup</b>" },
          ]),
          { version: v, updateComponents: { surfaceId: "ghost", components: [{ id: "root", component: "Divider" }] } } as SurfaceMessage,
          { version: "v0.1", deleteSurface: { surfaceId: "main" } } as SurfaceMessage,
        ]}
      />,
    );
    const notes = screen.getAllByRole("note").map((n) => n.textContent);
    expect(notes.some((n) => /Unknown component "Script"/.test(n!))).toBe(true);
    expect(notes.some((n) => /Unrecognized key/.test(n!))).toBe(true);
    expect(notes.some((n) => /contains itself/.test(n!))).toBe(true);
    expect(document.querySelector("script[src], img")).toBeNull();
    expect(screen.getByText("<b>not markup</b>")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(opened).not.toHaveBeenCalled();
    const problems = screen.getByTestId("problems").textContent!;
    expect(problems).toMatch(/UNKNOWN_SURFACE/);
    expect(problems).toMatch(/VALIDATION_FAILED \/version/);
    // The surface survived the bad messages.
    expect(screen.getByText("Open")).toBeTruthy();
    opened.mockRestore();
  });
});
