// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Explorer, TOUCH_HOLD_MS } from "./Explorer.js";
import type { ExploreState } from "./model.js";

afterEach(cleanup);

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
const section = (name: string) => screen.getByRole("region", { name, hidden: true });
const group = (name: string) => screen.getByRole("group", { name });
const pill = (name: RegExp) => screen.getAllByRole("button", { name }).find((b) => b.classList.contains("sf-pill"))!;
const tableRows = () => Array.from(document.querySelectorAll(".sf-explore-table tbody tr")).map((r) => Array.from(r.querySelectorAll("td")).map((c) => c.textContent));

describe("Explorer", () => {
  it("starts with a view when asked, with calculations and filters folded until used", async () => {
    render(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" startWithView />);
    await waitFor(() => expect(within(group("Break down by")).getByText("Region")).toBeTruthy());
    expect(within(group("Measure")).getByText("Line amount")).toBeTruthy();
    const folds = Array.from(document.querySelectorAll("details.sf-explore-more"));
    expect(folds.map((d) => [d.querySelector("summary")?.textContent, (d as HTMLDetailsElement).open])).toEqual([
      ["Calculations", false],
      ["Filters", false],
    ]);
  });

  it("draws the host's actions under the view, with what they act on", async () => {
    render(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" startWithView actions={<button type="button">Put this chart on the page</button>} />);
    const put = await screen.findByRole("button", { name: "Put this chart on the page" });
    expect(put.closest(".sf-explore-result")).toBeTruthy();
  });

  it("generates pills from the query's columns, and a press puts one on its shelf", async () => {
    const onChange = vi.fn();
    render(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" onChange={onChange} />);
    await waitFor(() => expect(pill(/^Region \(attribute/)).toBeTruthy());
    expect(screen.getByRole("status").textContent).toMatch(/4 fields generated from the columns/);
    expect(onChange.mock.calls.at(-1)![0].fields.map((p: { id: string }) => p.id)).toEqual(["region", "line_amount", "refund_amount", "rows"]);
    fireEvent.click(pill(/^Line amount \(metric/));
    fireEvent.click(pill(/^Region \(attribute/));
    expect(within(group("Break down by")).getByText("Region")).toBeTruthy();
    expect(within(group("Measure")).getByText("Line amount")).toBeTruthy();
    expect(screen.getByText("Line amount by Region")).toBeTruthy();
    // A metric cannot break a view down; the explorer says so instead of doing nothing.
    fireEvent.contextMenu(pill(/^Refund amount \(metric/));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Measure thisEnter", "EditE", "Remove the fieldShift+Delete", "DuplicateD"]);
    void section;
  });

  it("suggests calculations, and the engine works one out per group", async () => {
    const state: ExploreState = { fields: [], rows: ["region"], values: [], filters: [], view: "table" };
    let latest = state;
    const { rerender } = render(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />);
    const again = () => rerender(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />);
    await waitFor(() => expect(latest.fields.length).toBe(4));
    again();
    // The shelf named a pill before the pills existed, and keeps it once they are generated.
    expect(latest.rows).toEqual(["region"]);
    fireEvent.click(screen.getByRole("button", { name: "Suggest calculations" }));
    again();
    expect(latest.fields.filter((p) => p.kind === "derived").map((p) => p.expression)).toContain("refund_amount / line_amount");
    fireEvent.click(pill(/^Refund amount share of line amount \(calculation/));
    again();
    await waitFor(() => expect(tableRows()).toEqual([["NA", "40%"], ["EU", "5%"]]));
  });

  it("makes and edits a pill in a form that refuses what cannot be worked out", async () => {
    let latest: ExploreState = { fields: [], rows: [], values: [], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} editor="Sam" />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    fireEvent.click(screen.getByRole("button", { name: "New calculation" }));
    const form = screen.getByRole("form", { name: "New calculation" });
    fireEvent.change(within(form).getByLabelText("Label"), { target: { value: "Refund rate" } });
    fireEvent.change(within(form).getByLabelText("Calculation"), { target: { value: "refund_amount / sales" } });
    expect(within(form).getByRole("alert").textContent).toMatch(/"sales" is not a measure here/);
    expect((within(form).getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText("Calculation"), { target: { value: "refund_amount / line_amount" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(latest.fields.at(-1)).toMatchObject({ id: "refund_rate", kind: "derived", expression: "refund_amount / line_amount", by: "Sam" });
    rerender(draw());

    // Changing how a metric is summarised changes the calculations that use it, and the form says so first.
    fireEvent.click(screen.getByRole("button", { name: "Edit Line amount" }));
    const edit = screen.getByRole("form", { name: "Edit Line amount" });
    fireEvent.change(within(edit).getByLabelText("Summarised as"), { target: { value: "avg" } });
    expect(within(edit).getByText(/A calculation uses this metric and will change with it: Refund rate/)).toBeTruthy();
    fireEvent.click(within(edit).getByRole("button", { name: "Save" }));
    expect(latest.fields.find((p) => p.id === "line_amount")).toMatchObject({ aggregate: "avg", by: "Sam" });
  });

  it("works from the keyboard and offers a box to ask in words only when a host listens", async () => {
    const onAsk = vi.fn();
    let latest: ExploreState = { fields: [], rows: [], values: [], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} onAsk={onAsk} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    fireEvent.keyDown(pill(/^Region \(attribute/), { key: "s" });
    expect(latest.split).toBe("region");
    rerender(draw());
    fireEvent.keyDown(pill(/^Region \(attribute/), { key: "Delete" });
    expect(latest.split).toBeUndefined();
    fireEvent.change(screen.getByLabelText("Ask for a field or a view"), { target: { value: "refund rate by region" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledWith("refund rate by region", expect.objectContaining({ rows: [] }));
  });

  describe("dragging by touch", () => {
    // jsdom has no PointerEvent; a mouse event with a pointer type is what the drag code reads.
    const pointer = (type: string, target: EventTarget, init: { x: number; y: number; pointerType?: string }) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.x, clientY: init.y, button: 0 });
      Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
      act(() => void target.dispatchEvent(event));
    };
    const ghost = () => document.querySelector(".sf-pill-ghost");
    const ready = async () => {
      // jsdom has no layout, so nothing is under a point; the drag asks anyway to find a shelf.
      document.elementFromPoint = () => null;
      render(<Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" />);
      await waitFor(() => expect(pill(/^Region \(attribute/)).toBeTruthy());
      vi.useFakeTimers();
    };
    afterEach(() => vi.useRealTimers());

    it("lets a finger that moves at once scroll the page instead of dragging", async () => {
      await ready();
      pointer("pointerdown", pill(/^Region \(attribute/), { x: 10, y: 10, pointerType: "touch" });
      pointer("pointermove", window, { x: 10, y: 60, pointerType: "touch" });
      act(() => void vi.advanceTimersByTime(TOUCH_HOLD_MS * 2));
      pointer("pointermove", window, { x: 10, y: 90, pointerType: "touch" });
      expect(ghost()).toBeNull();
    });

    it("drags once a finger has held the pill, keeps the page still, and lets go when the browser takes the touch", async () => {
      await ready();
      pointer("pointerdown", pill(/^Region \(attribute/), { x: 10, y: 10, pointerType: "touch" });
      act(() => void vi.advanceTimersByTime(TOUCH_HOLD_MS));
      expect(ghost()).not.toBeNull();
      const scroll = new Event("touchmove", { cancelable: true });
      window.dispatchEvent(scroll);
      expect(scroll.defaultPrevented).toBe(true);
      pointer("pointermove", window, { x: 10, y: 60, pointerType: "touch" });
      expect(ghost()).not.toBeNull();
      pointer("pointercancel", window, { x: 10, y: 60, pointerType: "touch" });
      expect(ghost()).toBeNull();
      const after = new Event("touchmove", { cancelable: true });
      window.dispatchEvent(after);
      expect(after.defaultPrevented).toBe(false);
    });

    it("drags at once with a mouse", async () => {
      await ready();
      pointer("pointerdown", pill(/^Region \(attribute/), { x: 10, y: 10 });
      pointer("pointermove", window, { x: 40, y: 10 });
      expect(ghost()).not.toBeNull();
      pointer("pointerup", window, { x: 40, y: 10 });
      expect(ghost()).toBeNull();
      // No click followed the drop, so nothing is left waiting to swallow the next one.
      act(() => void vi.runOnlyPendingTimers());
      const later = new MouseEvent("click", { bubbles: true, cancelable: true });
      const reached = vi.fn();
      document.body.addEventListener("click", reached);
      document.body.dispatchEvent(later);
      expect(reached).toHaveBeenCalled();
    });
  });

  it("shows the numbers as a table from Draw as, with no switch hidden in the corner", async () => {
    let latest: ExploreState = { fields: [], rows: ["region"], values: ["line_amount"], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    expect(screen.queryByRole("button", { name: /as a table/ })).toBeNull();
    fireEvent.click(within(group("Draw as")).getByRole("button", { name: "Table" }));
    expect(latest.view).toBe("table");
    rerender(draw());
    expect(within(group("Draw as")).getByRole("button", { name: "Table" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Swap axes" })).toBeNull();
    expect(within(group("Break down by")).queryByText("X axis")).toBeNull();
    expect(await screen.findByRole("region", { name: "The numbers behind the view" })).toBeTruthy();
    // Choosing a chart type draws the chart again.
    fireEvent.click(within(group("Draw as")).getByRole("button", { name: "Line" }));
    expect(latest.view).toBe("chart");
    expect(latest.chart?.type).toBe("line");
  });

  it("says which shelf is which axis, swaps them, and draws each measure as a person sets it", async () => {
    let latest: ExploreState = { fields: [], rows: ["region"], values: ["line_amount"], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    expect(within(group("Break down by")).getByText("X axis")).toBeTruthy();
    expect(within(group("Measure")).getByText("Y axis")).toBeTruthy();
    const swap = screen.getByRole("button", { name: "Swap axes" });
    expect(swap.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(swap);
    expect(latest.chart).toEqual({ swap: true });
    rerender(draw());
    expect(within(group("Break down by")).getByText("Y axis")).toBeTruthy();
    expect(within(group("Measure")).getByText("X axis")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Axes swapped/);

    // A line cannot be turned on its side: the button stays, greyed, and says why.
    fireEvent.click(within(group("Draw as")).getByRole("button", { name: "Line" }));
    expect(latest.chart?.type).toBe("line");
    rerender(draw());
    const greyed = screen.getByRole("button", { name: "Swap axes" });
    expect(greyed.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/Only bars on one scale/)).toBeTruthy();

    // Two measures: each has its own type and scale.
    fireEvent.click(within(group("Draw as")).getByRole("button", { name: "Bars" }));
    rerender(draw());
    fireEvent.click(pill(/^Refund amount \(metric/));
    rerender(draw());
    fireEvent.change(screen.getByLabelText("Draw Refund amount as"), { target: { value: "line" } });
    rerender(draw());
    fireEvent.change(screen.getByLabelText("Scale for Refund amount"), { target: { value: "right" } });
    expect(latest.chart?.measures).toEqual({ refund_amount: { type: "line", axis: "right" } });

    // With two scales, each measure's pill says which side's scale it is read against, and the shelf says there are two.
    rerender(draw());
    const measure = within(group("Measure"));
    expect(measure.getByText("Y axes")).toBeTruthy();
    expect(measure.getByRole("button", { name: /^Line amount \(metric, left scale\)/ })).toBeTruthy();
    expect(measure.getByRole("button", { name: /^Refund amount \(metric, right scale\)/ })).toBeTruthy();
    // Back on one scale, the marks go.
    fireEvent.change(screen.getByLabelText("Scale for Refund amount"), { target: { value: "left" } });
    rerender(draw());
    expect(measure.getByText("Y axis")).toBeTruthy();
    expect(measure.queryByText("right")).toBeNull();
  });

  it("takes a pill in use off from where it is picked, and removes a field with Shift+Delete", async () => {
    let latest: ExploreState = { fields: [], rows: ["region"], values: ["line_amount"], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    const fields = screen.getByRole("complementary", { name: "Fields" });
    fireEvent.click(within(fields).getByRole("button", { name: "Take Region off “Break down by”" }));
    expect(latest.rows).toEqual([]);
    rerender(draw());
    expect(within(fields).queryByRole("button", { name: /^Take Region off/ })).toBeNull();
    fireEvent.keyDown(pill(/^Refund amount \(metric/), { key: "Delete", shiftKey: true });
    expect(latest.fields.map((p) => p.id)).not.toContain("refund_amount");
  });

  it("moves a measure earlier or later with Alt and the arrows, or from its menu", async () => {
    let latest: ExploreState = { fields: [], rows: ["region"], values: ["line_amount", "refund_amount"], filters: [] };
    const draw = () => <Explorer dataSource={data()} sourceId="memory" sql="SELECT * FROM lines" value={latest} onChange={(next) => (latest = next)} />;
    const { rerender } = render(draw());
    await waitFor(() => expect(latest.fields.length).toBe(4));
    rerender(draw());
    const onMeasure = (name: RegExp) => within(group("Measure")).getAllByRole("button", { name }).find((b) => b.classList.contains("sf-pill"))!;
    fireEvent.keyDown(onMeasure(/^Refund amount \(/), { key: "ArrowLeft", altKey: true });
    expect(latest.values).toEqual(["refund_amount", "line_amount"]);
    expect(screen.getByRole("status").textContent).toBe("Refund amount moved to place 1 of 2 on “Measure”.");
    rerender(draw());
    fireEvent.contextMenu(onMeasure(/^Refund amount \(/));
    expect((screen.getByRole("menuitem", { name: /Move earlier/ }) as HTMLButtonElement).getAttribute("aria-disabled") ?? (screen.getByRole("menuitem", { name: /Move earlier/ }) as HTMLButtonElement).disabled.toString()).toMatch(/true/);
    fireEvent.click(screen.getByRole("menuitem", { name: /Move later/ }));
    expect(latest.values).toEqual(["line_amount", "refund_amount"]);
  });
});
