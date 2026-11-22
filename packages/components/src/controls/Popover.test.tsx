// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Popover } from "./Popover.js";

afterEach(cleanup);

function Panel() {
  return (
    <>
      <label>
        Width
        <select defaultValue="fit">
          <option value="fit">Fit</option>
          <option value="phone">Phone</option>
        </select>
      </label>
      <label>
        Zoom
        <select defaultValue="100">
          <option value="100">100%</option>
        </select>
      </label>
    </>
  );
}

function Page(props: Partial<Parameters<typeof Popover>[0]>) {
  return (
    <>
      <button type="button">Before</button>
      <Popover label="View" summary="Fit · 100% · Real data" {...props}>
        <Panel />
      </Popover>
      <button type="button">After</button>
    </>
  );
}

const button = () => screen.getByRole("button", { name: /^View/ });
const panel = () => document.querySelector<HTMLElement>(".sf-popover-panel")!;

describe("Popover", () => {
  it("is a button that says whether it is open and which panel it controls, named with its summary", () => {
    render(<Page />);
    expect(button().textContent).toBe("ViewFit · 100% · Real data");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(button().getAttribute("aria-haspopup")).toBe("dialog");
    expect(button().getAttribute("aria-controls")).toBe(panel().id);
    expect(panel().getAttribute("role")).toBe("dialog");
    expect(panel().getAttribute("aria-label")).toBe("View");
    expect(panel().hasAttribute("aria-modal")).toBe(false);
    expect(panel().hidden).toBe(true);
  });

  it("opens on a press and moves focus to the panel's first control", () => {
    render(<Page />);
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(panel().hidden).toBe(false);
    expect(screen.getByRole("dialog", { name: "View" })).toBe(panel());
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Width" }));
  });

  it("focuses the panel itself when it holds nothing to focus", () => {
    render(
      <Popover label="About">
        <p>Read only.</p>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(document.activeElement).toBe(panel());
  });

  it("closes on Escape and puts focus back on the button", () => {
    render(<Page />);
    fireEvent.click(button());
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(button());
  });

  it("leaves Escape to a control inside that used it", () => {
    render(<Page />);
    fireEvent.click(button());
    const select = screen.getByRole("combobox", { name: "Width" });
    select.addEventListener("keydown", (event) => event.preventDefault());
    fireEvent.keyDown(select, { key: "Escape" });
    expect(button().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on a press outside, without taking focus anywhere", () => {
    render(<Page />);
    fireEvent.click(button());
    fireEvent.pointerDown(screen.getByRole("combobox", { name: "Zoom" }));
    expect(button().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(panel().hidden).toBe(true);
  });

  it("stays open while focus moves through the panel, and closes when it moves past it", () => {
    render(<Page />);
    fireEvent.click(button());
    act(() => screen.getByRole("combobox", { name: "Zoom" }).focus());
    act(() => button().focus());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    act(() => screen.getByRole("button", { name: "After" }).focus());
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles closed from its button, keeping focus there", () => {
    render(<Page />);
    fireEvent.click(button());
    act(() => button().focus());
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button());
  });

  it("can be held by the host: it asks, and shows what it is told", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Page open={false} onOpenChange={onOpenChange} />);
    fireEvent.click(button());
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(button().getAttribute("aria-expanded")).toBe("false");
    rerender(<Page open onOpenChange={onOpenChange} />);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Width" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(button().getAttribute("aria-expanded")).toBe("true");
  });

  it("works with a host that keeps the state", () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <output>{open ? "open" : "shut"}</output>
          <Page open={open} onOpenChange={setOpen} />
        </>
      );
    }
    render(<Host />);
    fireEvent.click(button());
    expect(screen.getByRole("status").textContent).toBe("open");
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("status").textContent).toBe("shut");
  });

  it("starts open with defaultOpen without taking focus from the page, and reports changes", () => {
    const onOpenChange = vi.fn();
    render(<Page defaultOpen onOpenChange={onOpenChange} />);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(button());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not open when disabled", () => {
    render(<Page disabled />);
    fireEvent.click(button());
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("places the panel below the button, inside the window", () => {
    render(<Page align="end" />);
    vi.spyOn(button(), "getBoundingClientRect").mockReturnValue({ left: 900, right: 1000, top: 10, bottom: 40, width: 100, height: 30, x: 900, y: 10, toJSON() {} });
    Object.defineProperty(panel(), "offsetWidth", { configurable: true, value: 300 });
    fireEvent.click(button());
    // jsdom has no layout, so the margin reads as nothing: the panel's right edge meets the button's.
    expect(panel().style.left).toBe("700px");
    expect(panel().style.top).toBe("40px");
    expect(panel().dataset.side).toBe("below");
  });
});
