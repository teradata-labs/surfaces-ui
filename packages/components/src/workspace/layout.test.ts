import { describe, expect, it } from "vitest";
import { MAX_COLUMNS, MIN_SHARE, collapsePanel, expandPanel, hidePanel, movePanel, movePanelToNewColumn, normalizeLayout, placeOf, resizeColumns, resizeRows, shiftPanel, showPanel } from "./layout.js";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("workspace layout", () => {
  it("fills in shares, and makes anything it is given drawable", () => {
    const full = normalizeLayout({ columns: [["search"], ["map", "detail"]] });
    expect(full.columnWidths).toEqual([0.5, 0.5]);
    expect(full.rowHeights).toEqual([[1], [0.5, 0.5]]);
    expect(full.hidden).toEqual([]);
    // From an agent or storage: unknown and repeated ids go, empty columns go, panels not placed are added.
    const checked = normalizeLayout({ columns: [["search", "nope"], [], ["search", "map"]], hidden: ["gone", "notes"] }, ["search", "map", "detail", "notes"]);
    expect(checked.columns).toEqual([["search"], ["map", "detail"]]);
    expect(checked.hidden).toEqual(["notes"]);
    expect(normalizeLayout(undefined, ["a", "b"]).columns).toEqual([["a", "b"]]);
    expect(normalizeLayout({ columns: "x" as never }, ["a"]).columns).toEqual([["a"]]);
  });

  it("keeps widths a person set while the columns stay, and scales them to add up to one", () => {
    const full = normalizeLayout({ columns: [["a"], ["b"]], columnWidths: [3, 1] });
    expect(full.columnWidths).toEqual([0.75, 0.25]);
    expect(normalizeLayout({ columns: [["a"], ["b"]], columnWidths: [0.99, 0.01] }).columnWidths[1]).toBeGreaterThan(0.1);
    // A width per column that no longer matches the columns is dropped.
    expect(normalizeLayout({ columns: [["a"], ["b"]], columnWidths: [1] }).columnWidths).toEqual([0.5, 0.5]);
  });

  it("never draws more columns than the limit", () => {
    const many = normalizeLayout({ columns: [["a"], ["b"], ["c"], ["d"], ["e"], ["f"]] });
    expect(many.columns).toHaveLength(MAX_COLUMNS);
    expect(many.columns.flat()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("moves a panel between columns and within one, and drops a column left empty", () => {
    const start = { columns: [["search"], ["map", "detail"]] };
    expect(movePanel(start, "detail", 0, 0).columns).toEqual([["detail", "search"], ["map"]]);
    expect(movePanel(start, "map", 1, 2).columns).toEqual([["search"], ["detail", "map"]]);
    const merged = movePanel(start, "search", 1, 0);
    expect(merged.columns).toEqual([["search", "map", "detail"]]);
    expect(merged.columnWidths).toEqual([1]);
    // Dropping a panel where it already is changes nothing.
    expect(movePanel(start, "map", 1, 0).columns).toEqual(start.columns);
    expect(movePanel(start, "map", 1, 1).columns).toEqual(start.columns);
    expect(movePanel(start, "nope", 0, 0).columns).toEqual(start.columns);
  });

  it("gives a panel a column of its own, at either edge or between two", () => {
    const start = { columns: [["search"], ["map", "detail"]] };
    expect(movePanelToNewColumn(start, "detail", 0).columns).toEqual([["detail"], ["search"], ["map"]]);
    expect(movePanelToNewColumn(start, "detail", 2).columns).toEqual([["search"], ["map"], ["detail"]]);
    // A panel alone in its column swaps sides rather than adding a column.
    expect(movePanelToNewColumn(start, "search", 2).columns).toEqual([["map", "detail"], ["search"]]);
  });

  it("moves one step at a time, for a keyboard: the agent's 'search left, map right' by hand", () => {
    let layout = normalizeLayout({ columns: [["map", "search"]] });
    layout = shiftPanel(layout, "search", "left");
    expect(layout.columns).toEqual([["search"], ["map"]]);
    expect(shiftPanel(layout, "search", "left").columns).toEqual([["search"], ["map"]]);
    expect(shiftPanel(layout, "search", "right").columns).toEqual([["map", "search"]]);
    const stacked = normalizeLayout({ columns: [["a", "b", "c"]] });
    expect(shiftPanel(stacked, "c", "up").columns).toEqual([["a", "c", "b"]]);
    expect(shiftPanel(stacked, "a", "down").columns).toEqual([["b", "a", "c"]]);
    expect(shiftPanel(stacked, "a", "up").columns).toEqual([["a", "b", "c"]]);
  });

  it("hides and shows a panel without losing it, and keeps the last one showing", () => {
    const start = { columns: [["search"], ["map"]] };
    const hidden = hidePanel(start, "map");
    expect(hidden.columns).toEqual([["search"]]);
    expect(hidden.hidden).toEqual(["map"]);
    expect(placeOf(hidden, "map")).toBeUndefined();
    expect(hidePanel(hidden, "search").columns).toEqual([["search"]]);
    // It had a column to itself, so it gets it back.
    const back = showPanel(hidden, "map");
    expect(back.columns).toEqual([["search"], ["map"]]);
    expect(back.hidden).toEqual([]);
    expect(back.places).toEqual({});
    expect(showPanel(back, "map")).toEqual(back);
  });

  it("brings a panel back to its place in a shared column", () => {
    const start = { columns: [["a", "b", "c"], ["d"]] };
    const hidden = hidePanel(start, "b");
    expect(hidden.columns).toEqual([["a", "c"], ["d"]]);
    expect(showPanel(hidden, "b").columns).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("opens a third and fourth panel in new columns rather than squeezing one column", () => {
    const ids = ["surface", "agent", "components", "json", "history", "save", "data"];
    let layout = normalizeLayout({ columns: [["surface"], ["agent"]], hidden: ids.slice(2) }, ids);
    layout = showPanel(layout, "components");
    expect(layout.columns).toEqual([["surface"], ["agent", "components"]]);
    layout = showPanel(layout, "json");
    expect(layout.columns).toEqual([["surface"], ["agent", "components"], ["json"]]);
    layout = showPanel(layout, "history");
    expect(layout.columns).toEqual([["surface"], ["agent", "components"], ["json", "history"]]);
    layout = showPanel(layout, "save");
    expect(layout.columns).toEqual([["surface"], ["agent", "components"], ["json", "history"], ["save"]]);
    // The last column still has room for a second.
    layout = showPanel(layout, "data");
    expect(layout.columns).toEqual([["surface"], ["agent", "components"], ["json", "history"], ["save", "data"]]);
    expect(layout.collapsed).toEqual([]);
  });

  it("keeps a wide panel wide when another column is added", () => {
    const start = normalizeLayout({ columns: [["surface"], ["agent"]], columnWidths: [0.66, 0.34], hidden: ["json"] }, ["surface", "agent", "json"]);
    const three = showPanel(showPanel(start, "json"), "json");
    expect(three.columns).toEqual([["surface"], ["agent", "json"]]);
    const moved = movePanelToNewColumn(three, "json", 2);
    expect(moved.columns).toEqual([["surface"], ["agent"], ["json"]]);
    expect(moved.columnWidths[0]).toBeGreaterThan(0.45);
    expect(moved.columnWidths[0]! / moved.columnWidths[1]!).toBeCloseTo(0.66 / 0.34);
    expect(moved.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("folds the other panels of a crowded column when one is opened, and never leaves a column all folded", () => {
    let layout = normalizeLayout({ columns: [["a", "b", "c"]] });
    expect(layout.collapsed).toEqual([]);
    // Moving a panel into a column with two open folds the one nearest the top.
    layout = movePanel({ columns: [["a", "b"], ["c"]] }, "c", 0, 2);
    expect(layout.columns).toEqual([["a", "b", "c"]]);
    expect(layout.collapsed).toEqual(["a"]);
    layout = expandPanel(layout, "a");
    expect(layout.collapsed).toEqual(["b"]);
    layout = collapsePanel(layout, "c");
    expect(layout.collapsed).toEqual(["b", "c"]);
    // The last open panel of a column stays open.
    expect(collapsePanel(layout, "a").collapsed).toEqual(["b", "c"]);
    // Whatever arrives, a column has something open.
    expect(normalizeLayout({ columns: [["a", "b"]], collapsed: ["a", "b", "nope"] }).collapsed).toEqual(["b"]);
  });

  it("resizes by moving the line between two shares, never below the minimum", () => {
    const start = { columns: [["a"], ["b"], ["c"]] };
    const wider = resizeColumns(start, 0, 0.1);
    expect(wider.columnWidths[0]).toBeCloseTo(1 / 3 + 0.1);
    expect(wider.columnWidths[1]).toBeCloseTo(1 / 3 - 0.1);
    expect(wider.columnWidths[2]).toBeCloseTo(1 / 3);
    expect(sum(wider.columnWidths)).toBeCloseTo(1);
    const squeezed = resizeColumns(start, 0, 5);
    expect(squeezed.columnWidths[1]).toBeCloseTo(MIN_SHARE);
    expect(sum(squeezed.columnWidths)).toBeCloseTo(1);
    const rows = resizeRows({ columns: [["a", "b"]] }, 0, 0, -0.2);
    expect(rows.rowHeights[0]![0]).toBeCloseTo(0.3);
    expect(rows.rowHeights[0]![1]).toBeCloseTo(0.7);
    expect(resizeRows(start, 9, 0, 0.1).rowHeights).toEqual(normalizeLayout(start).rowHeights);
  });
});
