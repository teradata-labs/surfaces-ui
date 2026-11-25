// @vitest-environment jsdom
import { DataSourceProvider, ThemeProvider, useTheme } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { defaultTheme } from "@surfaces-ui/tokens";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION } from "../dynamic.js";
import { type PageDocument, editPage, editsFromMessages, pageSurface } from "../page.js";
import { type SurfaceMessage, applyMessages } from "../surface.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

const v = A2UI_VERSION;
const dataSource = memoryDataSource({ tables: { orders: [{ region: "EU", amount: 5 }, { region: "NA", amount: 7 }, { region: "EU", amount: 9 }] } });
const grid = { id: "table", component: "DataGrid", sourceId: "memory", sql: "SELECT * FROM orders", height: 300 };
const surfaceOf = (messages: SurfaceMessage[]) => applyMessages({}, messages).main!;
const messages = (component: Record<string, unknown>, theme?: Record<string, unknown>): SurfaceMessage[] => [
  { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id, ...(theme ? { metadata: { extensions: { surfaces_theme: theme } } } : {}) } },
  { version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Column", children: [component.id as string] }, component as never] } },
];
function Probe() {
  const { theme, mode } = useTheme();
  return <output data-testid="theme">{`${theme.name}|${mode}`}</output>;
}
const draw = (list: SurfaceMessage[]) =>
  render(
    <ThemeProvider storage={null}>
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView surface={surfaceOf(list)} catalog={analyticsCatalog} renderers={analyticsRenderers} />
        <Probe />
      </DataSourceProvider>
    </ThemeProvider>,
  );
const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent);

describe("an agent sets the controls", () => {
  it("accepts sorts, filters and a column layout on a grid, and refuses nonsense", () => {
    const ok = { ...grid, sorts: [{ column: "amount", desc: true }], filters: [{ column: "region", op: "eq", values: ["EU"] }], columns: { order: ["amount"], hidden: [], widths: { amount: 200 } } };
    expect(analyticsCatalog.validateComponent(ok)).toEqual([]);
    expect(analyticsCatalog.validateComponent({ ...grid, filters: [{ column: "region", op: "like", values: ["EU"] }] })).not.toEqual([]);
    expect(analyticsCatalog.validateComponent({ ...grid, columns: { widths: { amount: 5 } } })).not.toEqual([]);
  });

  it("draws the grid sorted, filtered and laid out as asked, and a person can still change it", async () => {
    draw(messages({ ...grid, sorts: [{ column: "amount", desc: true }], filters: [{ column: "region", op: "eq", values: ["EU"] }], columns: { order: ["amount"] } }));
    await waitFor(() => expect(screen.getAllByRole("gridcell").map((c) => c.textContent)).toEqual(["9", "EU", "5", "EU"]));
    expect(headers()).toEqual(["amount↓", "region"]);
    fireEvent.click(screen.getByRole("button", { name: /region/ }));
    await waitFor(() => expect(headers()).toEqual(["amount", "region↑"]));
  });

  it("reports filters that cannot be applied instead of showing unfiltered data", () => {
    draw(messages({ ...grid, filters: [{ column: "amount", op: "between", values: [1] }] }));
    expect(screen.getByRole("note").textContent).toContain("needs 2 values, but has 1");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("styles its own surface without touching the page", () => {
    const { container } = draw(messages({ id: "t", component: "Text", text: "Hello" }, { preset: "Mono", mode: "dark", radius: 4 }));
    expect(screen.getByTestId("theme").textContent).toBe("Ink|system");
    const scope = container.querySelector("[data-sf-scope]")!;
    expect(scope.getAttribute("data-theme")).toBe("dark");
    expect(document.querySelector(`style[data-sf-theme="${scope.getAttribute("data-sf-scope")}"]`)!.textContent).toContain("--sf-radius: 4px;");
  });

  it("styles its own surface in one of the host's themes, by name", () => {
    const acme = { ...defaultTheme, name: "Acme", radius: 3 };
    const { container } = render(
      <ThemeProvider storage={null} themes={[acme]}>
        <DataSourceProvider dataSource={dataSource}>
          <SurfaceView surface={surfaceOf(messages({ id: "t", component: "Text", text: "Hello" }, { preset: "acme" }))} catalog={analyticsCatalog} renderers={analyticsRenderers} />
        </DataSourceProvider>
      </ThemeProvider>,
    );
    expect(screen.queryByRole("note")).toBeNull();
    const scope = container.querySelector("[data-sf-scope]")!;
    expect(document.querySelector(`style[data-sf-theme="${scope.getAttribute("data-sf-scope")}"]`)!.textContent).toContain("--sf-radius: 3px;");
    cleanup();
    draw(messages({ id: "t", component: "Text", text: "Hello" }, { preset: "Acme" }));
    expect(screen.getByRole("note").textContent).toContain("There is no theme called Acme.");
  });

  it("changes the whole page's theme with a visible, undoable switch", async () => {
    draw(messages({ id: "look", component: "ThemeSwitch", preset: "Aurora", mode: "dark" }));
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("Aurora|dark"));
    expect(screen.getByText("The page now uses Aurora, dark.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("theme").textContent).toBe("Ink|system");
  });
});

describe("an agent changes a page's layout and look", () => {
  const page: PageDocument = {
    id: "p",
    title: "Page",
    catalogId: analyticsCatalog.id,
    components: [
      { id: "root", component: "Column", children: ["tiles", "table"] },
      { id: "tiles", component: "Grid", columns: 2, children: ["a", "b"] },
      { id: "a", component: "Text", text: "A" },
      { id: "b", component: "Text", text: "B" },
      { ...grid },
    ],
  };
  const childrenOf = (doc: PageDocument, id: string) => doc.components.find((c) => c.id === id)!.children;

  it("moves components between and within containers", () => {
    const moved = editPage(page, [{ op: "move", id: "table", parent: "root", index: 0 }, { op: "move", id: "b", parent: "root" }, { op: "update", id: "tiles", props: { columns: 4 } }], analyticsCatalog);
    expect(moved.rejected).toEqual([]);
    expect(childrenOf(moved.page, "root")).toEqual(["table", "tiles", "b"]);
    expect(childrenOf(moved.page, "tiles")).toEqual(["a"]);
    const refused = editPage(page, [{ op: "move", id: "root", parent: "tiles" }, { op: "move", id: "tiles", parent: "tiles" }, { op: "move", id: "a", parent: "table" }], analyticsCatalog);
    expect(refused.rejected.map((r) => r.reason)).toEqual(["The top of the page cannot be moved.", "A container cannot be moved inside itself.", '"table" is not a container on this page.']);
    expect(refused.page.components).toEqual(page.components);
  });

  it("sets the page's theme, merges later changes, and refuses a bad one", () => {
    const themed = editPage(page, [{ op: "theme", theme: { preset: "Berry" } }, { op: "theme", theme: { density: "compact" } }, { op: "theme", theme: { preset: "Neon" } }], analyticsCatalog);
    expect(themed.page.theme).toEqual({ preset: "Berry", density: "compact" });
    expect(themed.rejected).toHaveLength(1);
    expect(pageSurface(themed.page).theme).toEqual({ preset: "Berry", density: "compact" });
    expect(editPage(themed.page, [{ op: "theme", theme: null }], analyticsCatalog).page.theme).toBeUndefined();
    // A host's own theme is a name a page may choose, once the host says it has it.
    const acme = { ...defaultTheme, name: "Acme" };
    expect(editPage(page, [{ op: "theme", theme: { preset: "Acme" } }], analyticsCatalog).rejected).toHaveLength(1);
    expect(editPage(page, [{ op: "theme", theme: { preset: "Acme" } }], analyticsCatalog, { themes: [acme] }).page.theme).toEqual({ preset: "Acme" });
    // Any agent that speaks A2UI restyles a page by sending the theme with the surface.
    expect(editsFromMessages(page, [{ version: v, createSurface: { surfaceId: "p", catalogId: analyticsCatalog.id, metadata: { extensions: { surfaces_theme: { mode: "dark" } } } } }])).toEqual([{ op: "theme", theme: { mode: "dark" } }]);
  });
});
