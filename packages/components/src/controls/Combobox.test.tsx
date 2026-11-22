// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ComboboxOption, Combobox } from "./Combobox.js";

afterEach(cleanup);

const PEOPLE: ComboboxOption[] = [
  { value: "ana@example.com", label: "Ana Admin", detail: "ana@example.com" },
  { value: "ben@example.com", label: "Ben Brook", detail: "ben@example.com" },
];

/** A host that searches the way a server would: by the text, returning matches. */
function Host({ onPick, loading }: { onPick?(option: ComboboxOption): void; loading?: boolean }) {
  const [value, setValue] = useState("");
  const options = value ? PEOPLE.filter((p) => p.label.toLowerCase().includes(value.toLowerCase())) : [];
  return <Combobox label="Hand to" type="email" value={value} onChange={setValue} options={options} onPick={onPick} loading={loading} />;
}

const input = () => screen.getByRole("combobox", { name: "Hand to" }) as HTMLInputElement;

describe("Combobox", () => {
  it("is a labelled combobox that controls its list", () => {
    render(<Host />);
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(input().getAttribute("aria-autocomplete")).toBe("list");
    fireEvent.change(input(), { target: { value: "b" } });
    expect(input().getAttribute("aria-expanded")).toBe("true");
    const list = screen.getByRole("listbox", { name: "Hand to" });
    expect(input().getAttribute("aria-controls")).toBe(list.id);
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Ben Brookben@example.com"]);
  });

  it("moves with the arrows and chooses with Enter, keeping focus in the box", () => {
    const onPick = vi.fn();
    render(<Host onPick={onPick} />);
    fireEvent.change(input(), { target: { value: "n" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const active = input().getAttribute("aria-activedescendant")!;
    expect(document.getElementById(active)!.textContent).toContain("Ben Brook");
    expect(document.getElementById(active)!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(PEOPLE[1]);
    expect(input().value).toBe("ben@example.com");
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });

  it("leaves Enter to the form when no suggestion is active, so what was typed stands", () => {
    const onPick = vi.fn();
    render(<Host onPick={onPick} />);
    fireEvent.change(input(), { target: { value: "zed@other.example" } });
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
    expect(document.querySelector(".sf-combobox-note")!.textContent).toBe("Nothing matches.");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("chooses with a click", () => {
    const onPick = vi.fn();
    render(<Host onPick={onPick} />);
    fireEvent.change(input(), { target: { value: "ana" } });
    fireEvent.click(screen.getByRole("option", { name: /Ana Admin/ }));
    expect(onPick).toHaveBeenCalledWith(PEOPLE[0]);
  });

  it("closes on Escape, then clears on a second", () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: "a" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(input().value).toBe("a");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().value).toBe("");
  });

  it("says it is looking while suggestions load, and how many it found", () => {
    const { rerender } = render(<Host loading />);
    fireEvent.change(input(), { target: { value: "zz" } });
    expect(document.querySelector(".sf-combobox-note")!.textContent).toBe("Looking…");
    rerender(<Host />);
    fireEvent.change(input(), { target: { value: "n" } });
    expect(screen.getByText("2 suggestions")).toBeTruthy();
  });
});
