// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResizeHandle } from "./ResizeHandle.js";
import { clampResize, defaultResizeStep, dragResize, keyResize } from "./resize.js";

afterEach(cleanup);

describe("resize arithmetic", () => {
  it("keeps a value within its bounds and on its snap", () => {
    expect(clampResize(123, { snap: 10 })).toBe(120);
    expect(clampResize(5, { min: 40, max: 900, snap: 10 })).toBe(40);
    expect(clampResize(995, { min: 40, max: 900, snap: 10 })).toBe(900);
    // A bound that is not a multiple of the snap: the nearest multiple inside it.
    expect(clampResize(0, { min: 45, max: 900, snap: 10 })).toBe(50);
    expect(clampResize(Number.NaN, { min: 0.25 })).toBe(0.25);
  });

  it("turns pixels dragged into value, whatever a unit is on screen", () => {
    expect(dragResize(300, 37, 1, { snap: 10 })).toBe(340);
    // A share of an 800-pixel row: 80 pixels is a tenth.
    expect(dragResize(0.5, 80, 800, { min: 0.25, max: 0.75 })).toBeCloseTo(0.6);
    expect(dragResize(0.5, 800, 800, { min: 0.25, max: 0.75 })).toBe(0.75);
    // A unit with no size on screen yet counts as one pixel rather than dividing by zero.
    expect(dragResize(10, 5, 0, {})).toBe(15);
  });

  it("moves by the keys along its own axis only", () => {
    const bounds = { min: 0, max: 100 };
    expect(keyResize("ArrowRight", 50, "right", 4, bounds)).toBe(54);
    expect(keyResize("ArrowLeft", 50, "right", 4, bounds, true)).toBe(30);
    expect(keyResize("ArrowDown", 50, "right", 4, bounds)).toBeUndefined();
    expect(keyResize("ArrowDown", 200, "bottom", 20, {})).toBe(220);
    expect(keyResize("ArrowUp", 200, "bottom", 20, {})).toBe(180);
    expect(keyResize("Home", 50, "right", 4, bounds)).toBe(0);
    expect(keyResize("End", 50, "right", 4, bounds)).toBe(100);
    expect(keyResize("End", 50, "bottom", 4, {})).toBeUndefined();
    expect(defaultResizeStep({ min: 0.25, max: 0.75 })).toBeCloseTo(0.025);
    expect(defaultResizeStep({})).toBe(10);
  });
});

describe("ResizeHandle", () => {
  it("is a separator that says its value and bounds, and moves by key", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ResizeHandle edge="right" value={0.5} min={0.25} max={0.75} step={0.05} label="Resize the map and the list" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const handle = screen.getByRole("separator", { name: "Resize the map and the list" });
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("0.5");
    expect(handle.getAttribute("aria-valuemin")).toBe("0.25");
    expect(handle.getAttribute("aria-valuemax")).toBe("0.75");
    expect(handle.tabIndex).toBe(0);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(0.55);
    expect(onChangeEnd).toHaveBeenLastCalledWith(0.55, { committed: true, via: "keyboard" });
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(0.25);
    // A key it does not use is left for the page.
    onChange.mockClear();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is reset by Enter and by a double click, and only when the host can reset", () => {
    const onReset = vi.fn();
    const { rerender } = render(<ResizeHandle edge="bottom" value={300} label="Resize the chart" onReset={onReset} />);
    const handle = screen.getByRole("separator", { name: "Resize the chart" });
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledTimes(2);
    rerender(<ResizeHandle edge="bottom" value={300} label="Resize the chart" />);
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    screen.getByRole("separator").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("is dragged with pointer events, live, and sends the end once on release", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ResizeHandle edge="bottom" value={undefined} startFrom={() => 200} snap={10} min={100} label="Resize" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const handle = screen.getByRole("separator");
    // No size set yet: no value is claimed, and a drag starts from what is drawn.
    expect(handle.hasAttribute("aria-valuenow")).toBe(false);
    fireEvent.pointerDown(handle, { pointerType: "touch", clientX: 0, clientY: 50 });
    expect(handle.hasAttribute("data-dragging")).toBe(true);
    fireEvent.pointerMove(window, { clientX: 0, clientY: 94 });
    expect(onChange).toHaveBeenLastCalledWith(240);
    fireEvent.pointerMove(window, { clientX: 0, clientY: -500 });
    expect(onChange).toHaveBeenLastCalledWith(100);
    expect(onChangeEnd).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 0, clientY: -500 });
    expect(onChangeEnd).toHaveBeenCalledWith(100, { committed: true, via: "pointer" });
    expect(handle.hasAttribute("data-dragging")).toBe(false);
  });

  it("gives up a drag on Escape, back where it started", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    render(<ResizeHandle edge="right" value={50} unitPixels={4} label="Resize" onChange={onChange} onChangeEnd={onChangeEnd} />);
    const handle = screen.getByRole("separator");
    fireEvent.pointerDown(handle, { pointerType: "mouse", button: 0, clientX: 100, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 140, clientY: 0 });
    expect(onChange).toHaveBeenLastCalledWith(60);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onChange).toHaveBeenLastCalledWith(50);
    expect(onChangeEnd).toHaveBeenCalledWith(50, { committed: false, via: "pointer" });
    // The drag is over: moving on changes nothing.
    fireEvent.pointerMove(window, { clientX: 300, clientY: 0 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
  });

  it("gives up a drag when it goes away mid-drag, and stops listening", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { unmount } = render(<ResizeHandle edge="bottom" value={200} label="Resize" onChange={onChange} onChangeEnd={onChangeEnd} />);
    fireEvent.pointerDown(screen.getByRole("separator"), { pointerType: "mouse", button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 0, clientY: 50 });
    expect(onChange).toHaveBeenLastCalledWith(250);
    unmount();
    expect(onChange).toHaveBeenLastCalledWith(200);
    expect(onChangeEnd).toHaveBeenCalledWith(200, { committed: false, via: "pointer" });
    // Releasing afterwards commits nothing.
    fireEvent.pointerUp(window, { clientX: 0, clientY: 50 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
  });

  it("is shown all the time when asked", () => {
    render(<ResizeHandle edge="right" value={1} label="Resize" always />);
    expect(screen.getByRole("separator").hasAttribute("data-always")).toBe(true);
  });
});
