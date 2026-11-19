// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionReceipt } from "./ActionReceipt.js";

afterEach(cleanup);

describe("ActionReceipt", () => {
  const base = { title: "Rebuilt orders_clean", outcome: "done" as const, approvedBy: [{ by: "Ada", reason: "Checked" }], changes: [{ label: "Rows", before: "58,000", after: "57,963" }] };

  it("shows who approved it, what changed, and reports an undo request without acting", () => {
    const onUndo = vi.fn();
    render(<ActionReceipt {...base} undo={{ label: "Restore", until: "2099-01-01T00:00:00Z" }} onUndo={onUndo} />);
    expect(screen.getByText(/Ada/).textContent).toContain("Checked");
    expect(screen.getByRole("rowheader", { name: "Rows" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toMatch(/asked to confirm/);
  });

  it("says plainly when it cannot be undone, or no longer can", () => {
    render(<ActionReceipt {...base} />);
    expect(screen.getByText("This cannot be undone from here.")).toBeTruthy();
    cleanup();
    render(<ActionReceipt {...base} undo={{ label: "Restore", until: "2000-01-01T00:00:00Z" }} onUndo={() => {}} />);
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    expect(screen.getByText(/has passed/)).toBeTruthy();
  });

  it("says when no one approved it", () => {
    render(<ActionReceipt title="Ran" outcome="failed" />);
    expect(screen.getByText("No one approved this.")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
  });
});
