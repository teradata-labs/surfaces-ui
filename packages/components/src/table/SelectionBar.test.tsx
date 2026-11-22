// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectionBar } from "./SelectionBar.js";

afterEach(cleanup);

const ACTIONS = (off = vi.fn(), on = vi.fn()) => [
  { id: "turn-off", label: "Turn off", onSelect: off, danger: true },
  { id: "turn-on", label: "Turn back on", onSelect: on },
];

describe("SelectionBar", () => {
  it("draws nothing with nothing chosen", () => {
    const { container } = render(<SelectionBar count={0} actions={ACTIONS()} onClear={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("says how many, runs an action, puts one that takes away last, and clears", () => {
    const off = vi.fn();
    const onClear = vi.fn();
    render(<SelectionBar count={2} actions={ACTIONS(off)} onClear={onClear} />);
    const bar = screen.getByRole("group", { name: "With the selected rows" });
    expect(within(bar).getByText("2 selected")).toBeTruthy();
    const names = within(bar).getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["Turn back on", "Turn off", "Clear"]);
    fireEvent.click(within(bar).getByRole("button", { name: "Turn off" }));
    expect(off).toHaveBeenCalledOnce();
    fireEvent.click(within(bar).getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("offers every row that matches once the page is ticked, and goes back to the page", () => {
    const onAllMatchingChange = vi.fn();
    const { rerender } = render(<SelectionBar count={50} total={126} pageSelected actions={ACTIONS()} onClear={() => {}} onAllMatchingChange={onAllMatchingChange} />);
    expect(screen.getByText(/All 50 on this page are selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select all 126 that match" }));
    expect(onAllMatchingChange).toHaveBeenLastCalledWith(true);

    rerender(<SelectionBar count={126} total={126} allMatching actions={ACTIONS()} onClear={() => {}} onAllMatchingChange={onAllMatchingChange} />);
    expect(screen.getByText("126 selected")).toBeTruthy();
    expect(screen.getByText(/All 126 that match are selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Only this page" }));
    expect(onAllMatchingChange).toHaveBeenLastCalledWith(false);
  });

  it("offers nothing past the page when every row is already on it, or the host cannot act on a search", () => {
    const { rerender } = render(<SelectionBar count={3} total={3} pageSelected actions={ACTIONS()} onClear={() => {}} onAllMatchingChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /that match/ })).toBeNull();
    rerender(<SelectionBar count={50} total={126} pageSelected actions={ACTIONS()} onClear={() => {}} />);
    expect(screen.queryByRole("button", { name: /that match/ })).toBeNull();
  });

  it("holds every button while an action runs, and shows a form an action opened", () => {
    render(
      <SelectionBar count={2} busy actions={[...ACTIONS(), { id: "hand-over", label: "Hand over…", onSelect: () => {}, expanded: true }]} onClear={() => {}}>
        <label>
          To <input />
        </label>
      </SelectionBar>,
    );
    expect(screen.getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByRole("button", { name: "Hand over…" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("textbox", { name: "To" })).toBeTruthy();
  });
});
