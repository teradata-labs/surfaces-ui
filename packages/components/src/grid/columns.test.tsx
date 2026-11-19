// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { FilterOperator } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filtersFromSpec, sortsFromSpec, valueFilter } from "../data/controls.js";
import { DataGrid, type GridColumns, arrangeColumns, moveColumn } from "./DataGrid.js";

afterEach(cleanup);

const dataSource = memoryDataSource({
  tables: {
    people: [
      { id: 1, name: "Ada", city: "Paris" },
      { id: 2, name: "Bo", city: "Oslo" },
      { id: 3, name: "Cy", city: null },
    ],
  },
});
const headers = () => screen.getAllByRole("columnheader").map((h) => h.textContent);
const header = (name: string) => screen.getByRole("button", { name });
const grid = (extra: Partial<Parameters<typeof DataGrid>[0]> = {}) => render(<DataGrid dataSource={dataSource} sourceId="memory" sql="SELECT * FROM people" height={300} rowHeight={30} {...extra} />);
const ready = () => waitFor(() => expect(screen.getAllByRole("gridcell").length).toBeGreaterThan(0));

describe("column layout", () => {
  it("orders, hides and moves columns as plain data", () => {
    const names = ["id", "name", "city"];
    expect(arrangeColumns(names)).toEqual(names);
    expect(arrangeColumns(names, { order: ["city", "gone", "city"], hidden: ["name"] })).toEqual(["city", "id"]);
    expect(moveColumn(names, {}, "city", "id").order).toEqual(["city", "id", "name"]);
    expect(moveColumn(names, {}, "id", undefined).order).toEqual(["name", "city", "id"]);
  });

  it("moves and resizes a column from the keyboard and reports the layout", async () => {
    const changes: GridColumns[] = [];
    grid({ onColumnsChange: (c) => changes.push(c) });
    await ready();
    fireEvent.keyDown(header("id"), { key: "ArrowRight", altKey: true });
    expect(headers()).toEqual(["name", "id", "city"]);
    fireEvent.keyDown(header("id"), { key: "ArrowRight", shiftKey: true });
    expect(changes.at(-1)!.widths!.id).toBeGreaterThan(120);
    // The cells follow their headers.
    expect(screen.getAllByRole("gridcell").slice(0, 3).map((c) => c.textContent)).toEqual(["Ada", "1", "Paris"]);
  });

  it("drags a column onto another to reorder", async () => {
    grid();
    await ready();
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", types: ["application/x-surfaces-grid-column"], effectAllowed: "" };
    const from = screen.getByRole("columnheader", { name: /city/ });
    const to = screen.getByRole("columnheader", { name: /id/ });
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer, clientX: -1 });
    expect(headers()).toEqual(["city", "id", "name"]);
  });

  it("offers a menu on a column: hide it, bring it back, and generate SQL", async () => {
    const onUseSql = vi.fn();
    grid({ onUseSql });
    await ready();
    fireEvent.contextMenu(screen.getByRole("columnheader", { name: /name/ }), { clientX: 10, clientY: 10 });
    const menu = screen.getByRole("menu", { name: "name column" });
    // The menu takes the keyboard: arrows move, Escape closes.
    expect(document.activeElement?.textContent).toContain("Sort ascending");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Sort descending");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Hide column/ }));
    expect(headers()).toEqual(["id", "city"]);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 hidden column" }));
    expect(headers()).toEqual(["id", "name", "city"]);

    fireEvent.contextMenu(screen.getByRole("columnheader", { name: /city/ }), { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole("menuitem", { name: "SQL: count each value" }));
    expect(onUseSql).toHaveBeenCalledWith("SELECT city, COUNT(*) AS row_count\nFROM (SELECT * FROM people) AS t\nGROUP BY city\nORDER BY row_count DESC");
    fireEvent.contextMenu(screen.getByRole("columnheader", { name: /city/ }), { clientX: 10, clientY: 10 });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moves through cells with the keyboard and filters from a cell's menu", async () => {
    const onCellFilter = vi.fn();
    const onRowClick = vi.fn();
    grid({ onCellFilter, onRowClick });
    await ready();
    const scroller = screen.getByRole("grid");
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    fireEvent.keyDown(scroller, { key: "ArrowDown" });
    fireEvent.keyDown(scroller, { key: "End" });
    const active = document.getElementById(scroller.getAttribute("aria-activedescendant")!)!;
    expect(active.textContent).toBe("Oslo");
    fireEvent.keyDown(scroller, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: "Bo" }), 1);
    fireEvent.keyDown(scroller, { key: "End", ctrlKey: true });
    fireEvent.contextMenu(document.getElementById(scroller.getAttribute("aria-activedescendant")!)!, { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Leave this value out" }));
    expect(onCellFilter).toHaveBeenCalledWith("city", null, true);
  });
});

describe("controls as plain data", () => {
  it("turns filters and sorts an agent wrote into what a query sends", () => {
    expect(filtersFromSpec([{ column: "city", op: "in", values: ["Paris", "Oslo"] }, { column: "id", op: "gte", values: [2] }, { column: "city", op: "is_null" }])).toEqual([
      { column: "city", operator: FilterOperator.IN, values: [{ kind: { case: "stringValue", value: "Paris" } }, { kind: { case: "stringValue", value: "Oslo" } }] },
      { column: "id", operator: FilterOperator.GTE, values: [{ kind: { case: "intValue", value: 2n } }] },
      { column: "city", operator: FilterOperator.IS_NULL, values: [] },
    ]);
    expect(() => filtersFromSpec([{ column: "id", op: "between", values: [1] }])).toThrow("The filter on id (between) needs 2 values, but has 1.");
    expect(sortsFromSpec([{ column: "id" }, { column: "name", desc: true }])).toEqual([{ column: "id", desc: false }, { column: "name", desc: true }]);
    expect(valueFilter("city", null, false).operator).toBe(FilterOperator.IS_NULL);
    expect(valueFilter("id", 3n, true)).toEqual({ column: "id", operator: FilterOperator.NEQ, values: [{ kind: { case: "intValue", value: 3n } }] });
  });
});
