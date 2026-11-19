// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTROLS_HOST, CONTROLS_QUIET, ItemControls, standardControls } from "./ItemControls.js";

afterEach(cleanup);

describe("standardControls", () => {
  it("gives the shared actions one order, one wording and one icon each, wherever they are used", () => {
    const noop = () => undefined;
    const all = standardControls("Refund rate", { remove: noop, later: noop, edit: noop, wider: noop, narrower: false, earlier: false, duplicate: noop, view: { now: "chart", toggle: noop } });
    expect(all.map((c) => [c.id, c.label, c.icon, c.disabled ?? false])).toEqual([
      ["edit", "Change Refund rate", "edit", false],
      ["view", "Show Refund rate as a table", "table", false],
      ["wider", "Make Refund rate wider", "wider", false],
      ["narrower", "Make Refund rate narrower", "narrower", true],
      ["earlier", "Move Refund rate earlier", "earlier", true],
      ["later", "Move Refund rate later", "later", false],
      ["duplicate", "Duplicate Refund rate", "duplicate", false],
      ["remove", "Remove Refund rate", "remove", false],
    ]);
    expect(all.at(-1)?.danger).toBe(true);
    // What an item cannot do is left out, not shown and dead.
    expect(standardControls("Chart", { up: noop, down: noop }).map((c) => c.id)).toEqual(["up", "down"]);
    expect(standardControls("Chart", { view: { now: "table", toggle: noop } })[0]).toMatchObject({ label: "Show Chart as a chart", icon: "chart" });
  });
});

describe("ItemControls", () => {
  const draw = (on: { edit: () => void; remove: () => void }) =>
    render(
      <section className={CONTROLS_HOST}>
        <ItemControls label="Refund rate controls" controls={standardControls("Refund rate", { edit: on.edit, earlier: false, remove: on.remove })} />
      </section>,
    );

  it("is one stop in the tab order, with arrows moving between controls that are named at once", () => {
    const on = { edit: vi.fn(), remove: vi.fn() };
    draw(on);
    const bar = screen.getByRole("toolbar", { name: "Refund rate controls" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    act(() => buttons[0]!.focus());
    // The name is shown the moment a control has focus, with no delay.
    expect(bar.querySelector(".sf-item-tip")?.textContent).toBe("Change Refund rate");
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.map((b) => b.tabIndex)).toEqual([-1, 0, -1]);
    // A control that cannot be used can still be reached and says why; pressing it does nothing.
    expect(buttons[1]!.getAttribute("aria-disabled")).toBe("true");
    expect(bar.querySelector(".sf-item-tip")?.textContent).toBe("Move Refund rate earlier (not available here)");
    fireEvent.keyDown(bar, { key: "Escape" });
    expect(bar.querySelector(".sf-item-tip")).toBeNull();
    fireEvent.keyDown(bar, { key: "End" });
    expect(document.activeElement).toBe(buttons[2]);
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("runs a control on a press, and shows its name on hover", () => {
    const on = { edit: vi.fn(), remove: vi.fn() };
    draw(on);
    const remove = screen.getByRole("button", { name: "Remove Refund rate" });
    fireEvent.pointerEnter(remove);
    expect(remove.querySelector(".sf-item-tip")?.textContent).toBe("Remove Refund rate");
    fireEvent.pointerLeave(remove);
    expect(remove.querySelector(".sf-item-tip")).toBeNull();
    fireEvent.click(remove);
    fireEvent.click(screen.getByRole("button", { name: "Move Refund rate earlier" }));
    expect(on.remove).toHaveBeenCalledTimes(1);
    expect(on.edit).not.toHaveBeenCalled();
    expect(remove.dataset.danger).toBe("true");
  });

  it("keeps a pinned control in sight, unless it cannot be used", () => {
    const control = (id: string, extra: object) => ({ id, label: id, icon: "add" as const, onSelect: () => undefined, ...extra });
    render(<ItemControls label="View controls" controls={[control("view", {}), control("keep", { pinned: true }), control("full", { pinned: true, disabled: true })]} />);
    const pinned = screen.getAllByRole("button").map((b) => [b.dataset.control, b.dataset.pinned ?? "no"]);
    expect(pinned).toEqual([["view", "no"], ["keep", "true"], ["full", "no"]]);
  });

  it("marks what an outer layer may hide, and what it may not", () => {
    render(
      <div className={CONTROLS_QUIET}>
        <ItemControls label="Tile controls" controls={standardControls("Tile", { remove: () => undefined })} />
        <ItemControls label="Frame controls" show="always" quietable={false} controls={standardControls("Frame", { remove: () => undefined })} />
      </div>,
    );
    expect(screen.getByRole("toolbar", { name: "Tile controls" }).dataset.quietable).toBe("true");
    expect(screen.getByRole("toolbar", { name: "Frame controls" }).dataset.quietable).toBeUndefined();
    expect(screen.getByRole("toolbar", { name: "Frame controls" }).dataset.show).toBe("always");
    expect(render(<ItemControls label="None" controls={[]} />).container.querySelector(".sf-item-controls")).toBeNull();
  });
});
