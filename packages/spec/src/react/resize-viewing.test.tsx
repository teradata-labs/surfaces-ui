// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { type PageDocument, editPage, pageSurface } from "../page.js";
import { layoutEdits } from "../personal.js";
import type { SurfaceMessage } from "../surface.js";
import { ArrangeToggle, useArrange } from "./arrange.js";
import { analyticsRenderers } from "./renderers.js";
import { SurfaceView } from "./Surface.js";

afterEach(cleanup);

const sql = "SELECT * FROM orders";
const locked = { "@metadata": { extensions: { surfaces_locked: true } } };
const shipped: PageDocument = {
  id: "sales",
  title: "Sales",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["numbers", "table", "note"] },
    { id: "numbers", component: "Grid", columns: 3, children: ["revenue", "orders", "average"] },
    { id: "revenue", component: "Metric", sourceId: "shop", sql, column: "amount", aggregate: "sum", label: "Revenue", ...locked },
    { id: "orders", component: "Metric", sourceId: "shop", sql, aggregate: "count", label: "Orders" },
    { id: "average", component: "Metric", sourceId: "shop", sql, column: "amount", aggregate: "avg", label: "Average" },
    { id: "table", component: "DataGrid", sourceId: "shop", sql, height: 260, ...locked },
    { id: "note", component: "Text", text: "Figures are in euros." },
  ],
};
const data = memoryDataSource({ sourceId: "shop", tables: { orders: [{ id: 1, amount: 10 }, { id: 2, amount: 32 }] } });

/** A host that keeps each arrangement as page edits, the way a host that stores a person's layout would. */
function Host({ viewing, steps }: { viewing: boolean; steps: { title: string; messages: SurfaceMessage[] }[] }) {
  const [page, setPage] = useState(shipped);
  const surface = useMemo(() => pageSurface(page), [page]);
  const arrange = useArrange({
    surface,
    apply: (messages, title) => {
      steps.push({ title, messages });
      setPage((now) => editPage(now, layoutEdits(now, messages).edits, analyticsCatalog).page);
    },
    say: () => undefined,
    remove: () => undefined,
    resizeWhileViewing: viewing,
  });
  return (
    <DataSourceProvider dataSource={data}>
      <ArrangeToggle arrange={arrange} />
      <div {...arrange.region}>
        <SurfaceView surface={arrange.shown(surface)} catalog={analyticsCatalog} renderers={analyticsRenderers} {...(arrange.surfaceFrame ? { frame: arrange.surfaceFrame } : {})} />
      </div>
      <output data-testid="page">{JSON.stringify(page.components)}</output>
    </DataSourceProvider>
  );
}

const component = (id: string) => (JSON.parse(screen.getByTestId("page").textContent ?? "[]") as Record<string, unknown>[]).find((c) => c.id === id);

describe("resizing while viewing", () => {
  it("draws nothing extra unless asked", () => {
    render(<Host viewing={false} steps={[]} />);
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(document.querySelector(".sf-arrange-view, .sf-arrange-frame")).toBeNull();
  });

  it("keeps the width handles between columns and the height handle under a sized component, and nothing to move or remove", () => {
    render(<Host viewing steps={[]} />);
    const names = screen.getAllByRole("separator").map((s) => s.getAttribute("aria-label"));
    // Two lines between three columns (none after the last), and the table whose height is set; the note has none.
    expect(names).toEqual([
      "Resize Metric revenue and what is to its right: wider or narrower",
      "Resize Metric orders and what is to its right: wider or narrower",
      "Resize DataGrid table: taller or shorter",
    ]);
    expect(document.querySelector(".sf-arrange-frame, .sf-arrange-bar")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("sends what Arrange sends, one step per change, kept by layoutEdits, even for a locked component", () => {
    const steps: { title: string; messages: SurfaceMessage[] }[] = [];
    render(<Host viewing steps={steps} />);
    fireEvent.keyDown(screen.getByRole("separator", { name: /Resize Metric revenue/ }), { key: "ArrowRight" });
    expect(steps).toHaveLength(1);
    expect(steps[0]!.title).toBe('Resized "numbers" to 37% and 29% and 33%');
    expect(component("numbers")?.widths).toEqual([0.373, 0.293, 0.333]);

    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize DataGrid table: taller or shorter" }), { key: "ArrowDown" });
    expect(steps).toHaveLength(2);
    expect(component("table")?.height).toBe(280);
    // The lock stays with it.
    expect(component("table")?.["@metadata"]).toEqual(locked["@metadata"]);

    // Enter puts each back: equal widths, and the height the component picks.
    fireEvent.keyDown(screen.getByRole("separator", { name: /Resize Metric revenue/ }), { key: "Enter" });
    expect(component("numbers")?.widths).toEqual([0.333, 0.333, 0.333]);
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize DataGrid table: taller or shorter" }), { key: "Enter" });
    expect(component("table")?.height).toBeUndefined();
    expect(steps).toHaveLength(4);
  });

  it("draws the size as it is dragged and sends it once on release", () => {
    const steps: { title: string; messages: SurfaceMessage[] }[] = [];
    render(<Host viewing steps={steps} />);
    const handle = screen.getByRole("separator", { name: "Resize DataGrid table: taller or shorter" });
    fireEvent.pointerDown(handle, { pointerType: "pen", clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 0, clientY: 104 });
    // Drawn at its new height already; nothing is sent yet.
    expect(screen.getByRole("separator", { name: "Resize DataGrid table: taller or shorter" }).getAttribute("aria-valuenow")).toBe("360");
    expect(steps).toHaveLength(0);
    fireEvent.pointerUp(window, { clientX: 0, clientY: 104 });
    expect(steps).toHaveLength(1);
    expect(component("table")?.height).toBe(360);
  });

  it("shows one layer at a time: Arrange's frames replace the viewing handles", () => {
    render(<Host viewing steps={[]} />);
    expect(document.querySelectorAll(".sf-arrange-view").length).toBeGreaterThan(0);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Arrange" })));
    expect(document.querySelector(".sf-arrange-view")).toBeNull();
    expect(document.querySelectorAll(".sf-arrange-frame").length).toBeGreaterThan(0);
    // Arrange draws the same handles inside its frames.
    expect(document.querySelectorAll(".sf-arrange-frame > .sf-resize-handle").length).toBeGreaterThan(0);
  });
});
