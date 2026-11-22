// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../locale/locale.js";
import { Pagination } from "./Pagination.js";

afterEach(() => {
  cleanup();
  setLocale("en-US");
});

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Pagination", () => {
  it("says which rows are shown and moves a page at a time", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Pagination offset={0} pageSize={50} total={126} onChange={onChange} />);
    expect(screen.getByRole("navigation", { name: "Pages" }).textContent).toContain("1–50 of 126");
    expect(button("Previous").disabled).toBe(true);
    fireEvent.click(button("Next"));
    expect(onChange).toHaveBeenLastCalledWith(50);

    rerender(<Pagination offset={100} pageSize={50} total={126} onChange={onChange} />);
    expect(screen.getByText("101–126 of 126")).toBeTruthy();
    expect(button("Next").disabled).toBe(true);
    fireEvent.click(button("Previous"));
    expect(onChange).toHaveBeenLastCalledWith(50);
  });

  it("draws nothing when everything fits on one page", () => {
    const { container } = render(<Pagination offset={0} pageSize={50} total={12} onChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("can still go back from a page past the end, after rows were removed", () => {
    const onChange = vi.fn();
    render(<Pagination offset={50} pageSize={50} total={30} onChange={onChange} />);
    fireEvent.click(button("Previous"));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("writes numbers in the page's locale", () => {
    setLocale("de-DE");
    render(<Pagination offset={1000} pageSize={50} total={12000} onChange={() => {}} />);
    expect(screen.getByText("1.001–1.050 of 12.000")).toBeTruthy();
  });
});
