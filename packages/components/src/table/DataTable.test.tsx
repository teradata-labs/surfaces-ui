// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DataTableColumn, DataTable } from "./DataTable.js";

afterEach(cleanup);

interface Person {
  id: string;
  name: string;
  email: string;
  owns: number;
  off?: boolean;
}

const PEOPLE: Person[] = [
  { id: "a", name: "Ana Admin", email: "ana@example.com", owns: 2 },
  { id: "b", name: "Ben Brook", email: "ben@example.com", owns: 0, off: true },
  { id: "c", name: "Cleo Chen", email: "cleo@example.com", owns: 7 },
];

const COLUMNS: DataTableColumn<Person>[] = [
  { id: "name", label: "Name", sortable: true },
  { id: "email", label: "Email", show: "medium" },
  { id: "owns", label: "Owns", sortable: true, align: "end" },
];

const table = () => screen.getByRole("table", { name: "People" });

describe("DataTable", () => {
  it("draws the rows in the order given, each named by its header cell", () => {
    render(<DataTable label="People" columns={COLUMNS} rows={PEOPLE} rowKey={(p) => p.id} />);
    const rows = within(table()).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual(["Ana Admin", "Ben Brook", "Cleo Chen"]);
    expect(within(rows[0]!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["ana@example.com", "2"]);
    // A column that gives way on a narrow table is marked for the container query, not removed.
    expect(screen.getByRole("columnheader", { name: "Email" }).getAttribute("data-show")).toBe("medium");
  });

  it("asks the host to sort and sorts nothing itself", () => {
    const onSortChange = vi.fn();
    const { rerender } = render(<DataTable label="People" columns={COLUMNS} rows={PEOPLE} rowKey={(p) => p.id} sort={{ column: "name", desc: false }} onSortChange={onSortChange} />);
    expect(screen.getByRole("columnheader", { name: /Name/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("columnheader", { name: /Owns/ }).getAttribute("aria-sort")).toBeNull();
    // Email is not sortable: plain words, no button.
    expect(within(screen.getByRole("columnheader", { name: "Email" })).queryByRole("button")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", desc: true });
    fireEvent.click(screen.getByRole("button", { name: /Owns/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "owns", desc: false });
    // The rows are untouched until the host hands over sorted ones.
    expect(within(table()).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Ana Admin", "Ben Brook", "Cleo Chen"]);

    rerender(<DataTable label="People" columns={COLUMNS} rows={PEOPLE} rowKey={(p) => p.id} sort={{ column: "owns", desc: true }} onSortChange={onSortChange} />);
    expect(screen.getByRole("columnheader", { name: /Owns/ }).getAttribute("aria-sort")).toBe("descending");
  });

  it("ticks rows, the whole page from the heading, and leaves out rows that cannot be chosen", () => {
    const onSelectedChange = vi.fn();
    const props = { label: "People", columns: COLUMNS, rows: PEOPLE, rowKey: (p: Person) => p.id, selectable: (p: Person) => p.id !== "a", onSelectedChange };
    const { rerender } = render(<DataTable {...props} selected={new Set()} />);
    expect(screen.queryByRole("checkbox", { name: "Select Ana Admin" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Ben Brook" }));
    expect([...onSelectedChange.mock.lastCall![0]]).toEqual(["b"]);

    rerender(<DataTable {...props} selected={new Set(["b"])} />);
    const page = screen.getByRole("checkbox", { name: "Select every row on this page" }) as HTMLInputElement;
    expect(page.checked).toBe(false);
    expect(page.indeterminate).toBe(true);
    fireEvent.click(page);
    expect([...onSelectedChange.mock.lastCall![0]].sort()).toEqual(["b", "c"]);

    rerender(<DataTable {...props} selected={new Set(["b", "c"])} />);
    expect((screen.getByRole("checkbox", { name: "Select every row on this page" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    expect([...onSelectedChange.mock.lastCall![0]]).toEqual([]);
  });

  it("shows every box ticked when all that match are chosen, and goes back to row by row on a change", () => {
    const onSelectedChange = vi.fn();
    render(<DataTable label="People" columns={COLUMNS} rows={PEOPLE} rowKey={(p) => p.id} selected={new Set()} allSelected onSelectedChange={onSelectedChange} />);
    const boxes = within(table()).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((box) => box.checked)).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Cleo Chen" }));
    expect([...onSelectedChange.mock.lastCall![0]].sort()).toEqual(["a", "b"]);
  });

  it("gives each row its controls and its menu", () => {
    const off = vi.fn();
    const chosen = vi.fn();
    render(
      <DataTable
        label="People"
        columns={COLUMNS}
        rows={PEOPLE}
        rowKey={(p) => p.id}
        rowState={(p) => (p.off ? "off" : undefined)}
        rowControls={(p) => [{ id: "turn-off", label: `Turn off ${p.name}`, icon: "power", onSelect: () => off(p.id), disabled: p.off }]}
        rowMenu={(p) => [{ label: "Copy email", onSelect: () => chosen(p.email) }]}
      />,
    );
    const controls = screen.getByRole("toolbar", { name: "Cleo Chen actions" });
    fireEvent.click(within(controls).getByRole("button", { name: "Turn off Cleo Chen" }));
    expect(off).toHaveBeenCalledWith("c");
    expect(within(table()).getAllByRole("row")[2]!.getAttribute("data-state")).toBe("off");

    fireEvent.contextMenu(screen.getByRole("rowheader", { name: "Ben Brook" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy email" }));
    expect(chosen).toHaveBeenCalledWith("ben@example.com");
  });

  it("says when there is nothing, and marks itself busy while fetching", () => {
    const { rerender } = render(<DataTable label="People" columns={COLUMNS} rows={[]} rowKey={(p) => p.id} empty="No one matches." />);
    expect(screen.getByText("No one matches.")).toBeTruthy();
    rerender(<DataTable label="People" columns={COLUMNS} rows={[]} rowKey={(p) => p.id} loading />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(table().getAttribute("aria-busy")).toBe("true");
  });
});
