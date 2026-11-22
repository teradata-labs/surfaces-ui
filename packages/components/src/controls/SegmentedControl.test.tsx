// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl.js";

afterEach(cleanup);

const OPTIONS = [
  { value: "build", label: "Build" },
  { value: "view", label: "View" },
] as const;

describe("SegmentedControl", () => {
  it("is a named radio group with the chosen option checked", () => {
    render(<SegmentedControl label="Mode" options={OPTIONS} value="build" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Mode" });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.checked)).toEqual([true, false]);
    // One group name, so the arrow keys move between the options and the bar is one tab stop.
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    // The thumb is placed from the markup: which segment is marked chosen.
    expect(group.querySelectorAll(".sf-segment[data-checked]")).toHaveLength(1);
    expect(group.querySelector(".sf-segment[data-checked]")!.textContent).toBe("Build");
  });

  it("reports the option a person picks", () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Mode" options={OPTIONS} value="build" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "View" }));
    expect(onChange).toHaveBeenCalledWith("view");
  });

  it("keeps a disabled option reachable and does not choose it", () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Show" options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table", disabled: true }]} value="chart" onChange={onChange} />);
    const table = screen.getByRole("radio", { name: "Table" }) as HTMLInputElement;
    expect(table.disabled).toBe(false);
    expect(table.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(table);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps two bars on one page apart", () => {
    render(
      <>
        <SegmentedControl label="One" options={OPTIONS} value="build" onChange={() => {}} />
        <SegmentedControl label="Two" options={OPTIONS} value="view" onChange={() => {}} />
      </>,
    );
    const name = (label: string) => (within(screen.getByRole("radiogroup", { name: label })).getAllByRole("radio")[0] as HTMLInputElement).name;
    expect(name("One")).not.toBe(name("Two"));
  });
});
