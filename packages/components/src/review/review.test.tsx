// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PiiReview } from "./PiiReview.js";
import { type PlanDecision, PlanReview } from "./PlanReview.js";
import { StepFlow } from "./StepFlow.js";
import { piiHints } from "./pii.js";

afterEach(cleanup);

const steps = [
  { id: "trim", title: "Trim spaces", sql: "SELECT TRIM(region) FROM orders" },
  { id: "key", title: "Keep the key", required: true },
  { id: "dedupe", title: "Remove repeats", risk: "high" as const },
];

describe("PlanReview", () => {
  it("leaves high-risk steps unticked and reports only what was approved", () => {
    const onDecide = vi.fn<(d: PlanDecision) => void>();
    render(<PlanReview title="Clean orders" steps={steps} proposedBy="Agent" onDecide={onDecide} />);
    expect((screen.getByLabelText("3. Remove repeats") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("2. Keep the key") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Changes or removes data/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve 2 steps" }));
    expect(onDecide).toHaveBeenCalledWith({ approved: true, stepIds: ["trim", "key"] });
    // Settled: no second decision can be made.
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Approved 2 of 3 steps.");
  });

  it("rejects with a note and runs nothing", () => {
    const onDecide = vi.fn<(d: PlanDecision) => void>();
    render(<PlanReview title="Clean orders" steps={steps} onDecide={onDecide} />);
    fireEvent.change(screen.getByLabelText("Note for the record (optional)"), { target: { value: "Repeats are amendments" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenCalledWith({ approved: false, stepIds: [], note: "Repeats are amendments" });
  });
});

describe("personal data", () => {
  it("guesses from names only, in any naming style", () => {
    const hints = piiHints(["customer_id", "Email", "firstName", "birth_date", "ip_address", "ssn", "amount", "zip_code", "card_number", "description"]);
    expect(Object.fromEntries(hints.map((h) => [h.column, h.category]))).toEqual({
      Email: "email",
      firstName: "name",
      birth_date: "date_of_birth",
      ip_address: "network",
      ssn: "government_id",
      zip_code: "address",
      card_number: "financial",
    });
    expect(hints.every((h) => h.basis === "name")).toBe(true);
  });

  it("proposes the cautious treatment and needs a person to confirm", () => {
    const onDecide = vi.fn();
    render(
      <PiiReview
        table="customers"
        columns={[{ name: "id" }, { name: "email", category: "email", basis: "name" }, { name: "ssn", category: "government_id" }]}
        onDecide={onDecide}
      />,
    );
    expect((screen.getByLabelText("Treatment for email") as HTMLSelectElement).value).toBe("hash");
    expect((screen.getByLabelText("Treatment for ssn") as HTMLSelectElement).value).toBe("drop");
    expect((screen.getByLabelText("Treatment for id") as HTMLSelectElement).value).toBe("keep");
    const record = screen.getByRole("button", { name: "Record decision" }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    // Loosening a flagged column is allowed, and is called out.
    fireEvent.change(screen.getByLabelText("Treatment for email"), { target: { value: "keep" } });
    expect(screen.getByRole("note").textContent).toContain("email is flagged and will be kept as is.");
    fireEvent.click(screen.getByLabelText(/I have checked every column/));
    fireEvent.click(record);
    expect(onDecide).toHaveBeenCalledWith({
      table: "customers",
      confirmed: true,
      columns: [{ name: "id", action: "keep" }, { name: "email", category: "email", action: "keep" }, { name: "ssn", category: "government_id", action: "drop" }],
    });
  });
});

describe("StepFlow", () => {
  it("says where the work is paused for a person, in words", () => {
    render(
      <StepFlow
        label="Connect the lake"
        steps={[{ id: "a", title: "Find tables", status: "done" }, { id: "b", title: "Add the credential", status: "waiting" }, { id: "c", title: "Test", status: "pending" }]}
      />,
    );
    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    const current = screen.getByText("Add the credential").closest("li")!;
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(current.textContent).toContain("Waiting for you");
  });
});
