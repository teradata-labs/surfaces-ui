// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportBuilder } from "./ReportBuilder.js";
import type { Pill } from "./model.js";
import { type ReportState, draftState, editTile, keepDraft, moveTile, normalizeReport, removeTile, setTile, tileState, withDraft } from "./report.js";

afterEach(cleanup);

const fields: Pill[] = [
  { id: "region", kind: "attribute", label: "Region", column: "region" },
  { id: "line_amount", kind: "metric", label: "Revenue", column: "line_amount", aggregate: "sum", format: "currency" },
  { id: "refund_amount", kind: "metric", label: "Refunds", column: "refund_amount", aggregate: "sum", format: "currency" },
  { id: "rate", kind: "derived", label: "Refund rate", expression: "refund_amount / line_amount", format: "percent" },
];
const report = (extra: Partial<ReportState> = {}): ReportState => ({ fields, filters: [], tiles: [], ...extra });

describe("a report as data", () => {
  it("keeps the draft as a tile, headline numbers across the row, and leaves the shelves for the next one", () => {
    const one = keepDraft(report({ draft: { rows: [], values: ["line_amount", "rate"] } }));
    expect(one.tiles).toEqual([{ id: "tile-1", rows: [], values: ["line_amount", "rate"], span: 3 }]);
    const two = keepDraft({ ...one, draft: { rows: ["region"], values: ["rate"], view: "table" } }, "Rate by region");
    expect(two.tiles[1]).toEqual({ id: "tile-2", title: "Rate by region", rows: ["region"], values: ["rate"], view: "table", span: 1 });
    expect(two.draft).toEqual({ rows: ["region"], values: ["rate"], view: "table" });
    // Nothing to measure: nothing is kept.
    const empty = report({ draft: { rows: ["region"], values: [] } });
    expect(keepDraft(empty)).toBe(empty);
  });

  it("changes a tile in place, and moves, resizes and removes tiles", () => {
    const base = report({ tiles: [{ id: "a", rows: ["region"], values: ["line_amount"] }, { id: "b", rows: [], values: ["rate"], span: 3 }] });
    const editing = editTile(base, "a");
    expect([editing.editing, editing.draft]).toEqual(["a", { rows: ["region"], values: ["line_amount"] }]);
    const updated = keepDraft({ ...editing, draft: { rows: ["region"], values: ["rate"] } });
    expect(updated.tiles.map((t) => [t.id, t.values])).toEqual([["a", ["rate"]], ["b", ["rate"]]]);
    expect(updated.editing).toBeUndefined();
    expect(moveTile(base, "b", -1).tiles.map((t) => t.id)).toEqual(["b", "a"]);
    expect(moveTile(base, "a", -1)).toBe(base);
    expect(setTile(base, "a", { span: 2, title: "Revenue" }).tiles[0]).toMatchObject({ span: 2, title: "Revenue" });
    expect(removeTile(editing, "a")).toMatchObject({ tiles: [{ id: "b" }], editing: undefined });
  });

  it("shares pills and filters between the builder and every tile", () => {
    const base = report({ filters: [{ column: "region", op: "eq", values: ["EU"] }], tiles: [{ id: "a", rows: ["region"], values: ["rate"] }], draft: { rows: [], values: ["line_amount"] } });
    expect(tileState(base, base.tiles[0]!)).toMatchObject({ fields, filters: base.filters, rows: ["region"], values: ["rate"] });
    const renamed = fields.map((p) => (p.id === "rate" ? { ...p, label: "Share refunded" } : p));
    const next = withDraft(base, { ...draftState(base), fields: renamed, filters: [] });
    // A pill edited in the builder is the report's pill: the tile reads the new one, and the cleared filter clears for all.
    expect(tileState(next, next.tiles[0]!).fields.find((p) => p.id === "rate")?.label).toBe("Share refunded");
    expect(next.filters).toEqual([]);
  });

  it("drops what cannot be drawn, whatever sent it, but waits until the pills exist", () => {
    const messy = report({ tiles: [{ id: "a", rows: ["gone"], values: ["rate", "gone"] }, { id: "a", rows: [], values: ["nothing"] }, { id: "", rows: ["region"], values: ["line_amount"], span: 9 as never }], editing: "zzz" });
    const clean = normalizeReport(messy);
    expect(clean.tiles).toEqual([
      { id: "a", rows: [], values: ["rate"], span: 1 },
      { id: "tile-2", rows: ["region"], values: ["line_amount"], span: 1 },
    ]);
    expect(clean.editing).toBeUndefined();
    const early = { fields: [], filters: [], tiles: [{ id: "a", rows: ["region"], values: ["line_amount"] }] };
    expect(normalizeReport(early)).toBe(early);
  });
});

describe("ReportBuilder", () => {
  const data = () =>
    memoryDataSource({
      tables: {
        lines: [
          { region: "EU", line_amount: 100, refund_amount: 10 },
          { region: "EU", line_amount: 100, refund_amount: 0 },
          { region: "NA", line_amount: 50, refund_amount: 20 },
        ],
      },
    });
  const numbers = (tile: HTMLElement) => Array.from(tile.querySelectorAll(".sf-explore-numbers dd")).map((d) => d.textContent);

  it("builds a view, keeps it as a tile, and shows the dashboard alone in view mode", async () => {
    let latest: ReportState = report({ title: "Refunds", draft: { rows: [], values: ["line_amount", "rate"] } });
    const notes: { kind: string; summary: string; subject?: Record<string, unknown> }[] = [];
    const draw = () => <ReportBuilder dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} onContext={(note) => notes.push(note)} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(screen.getByRole("button", { name: "Add to report" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Add to report" }));
    expect(latest.tiles).toHaveLength(1);
    // What was done is told as context, in words and as data, without asking the agent for anything.
    expect(notes.at(-1)).toEqual({ kind: "view.added", summary: "Added to the report: Revenue and Refund rate. The shelves are as you left them, for the next one.", subject: { tile: "tile-1", rows: [], split: null, values: ["line_amount", "rate"], view: "chart" } });
    rerender(draw());
    const tile = screen.getByRole("region", { name: "Revenue and Refund rate" });
    // The numbers come from the engine: revenue summed, and the rate worked out from the two sums.
    await waitFor(() => expect(numbers(tile)).toEqual(["$250.00", "12%"]));

    fireEvent.change(within(tile).getByLabelText("Title of Revenue and Refund rate"), { target: { value: "Headline" } });
    expect(latest.tiles[0]!.title).toBe("Headline");
    rerender(draw());
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.queryByRole("button", { name: "Add to report" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Refunds" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Headline" })).queryByRole("button")).toBeNull();
    // One filter bar for the whole report: a filter there changes every tile.
    await waitFor(() => expect(screen.getByLabelText("Column")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Column"), { target: { value: "region" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "NA" } });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(latest.filters).toEqual([{ column: "region", op: "contains", values: ["NA"] }]);
    expect(notes.map((n) => n.kind)).toEqual(["view.added", "mode.changed", "filter.changed"]);
    expect(notes.at(-1)!.summary).toBe("Filters are now: region contains NA.");
    rerender(draw());
    await waitFor(() => expect(numbers(screen.getByRole("region", { name: "Headline" }))).toEqual(["$50.00", "40%"]));
  });

  it("opens a tile on the shelves to change it, and offers nothing to add until there is a view", async () => {
    let latest: ReportState = report({ tiles: [{ id: "a", rows: [], values: ["line_amount"], span: 3 }], draft: { rows: [], values: [] } });
    const draw = () => <ReportBuilder dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />;
    const { rerender } = render(draw());
    // With nothing on the shelves there is no view to add, so no button to add one.
    expect(screen.queryByRole("button", { name: "Add to report" })).toBeNull();
    fireEvent.click(within(screen.getByRole("region", { name: "Revenue" })).getByRole("button", { name: "Change Revenue" }));
    expect([latest.editing, latest.draft?.values]).toEqual(["a", ["line_amount"]]);
    rerender(draw());
    expect(screen.getByText(/Changing “Revenue”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update view" }));
    expect(latest.editing).toBeUndefined();
  });
});
