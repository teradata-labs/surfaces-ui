// @vitest-environment jsdom
import { memoryForms } from "@surfaces-ui/data";
import { FieldType } from "@surfaces-ui/proto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Form, type FormFieldSpec, FormsProvider } from "./Form.js";

afterEach(cleanup);

const fields: FormFieldSpec[] = [
  { name: "case_id", label: "Case", type: "text", required: true, pattern: "C-\\d+" },
  { name: "amount", label: "Amount", type: "number", min: 0 },
  { name: "decision", label: "Decision", type: "choice", required: true, options: ["fraud", "not fraud"] },
  { name: "confirmed", label: "Confirmed", type: "boolean" },
];

describe("Form", () => {
  it("announces each wrong field and sends nothing", async () => {
    const onSubmit = vi.fn();
    render(<Form formId="case" fields={fields} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Case/), { target: { value: "bad" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit" })));
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toEqual(["Not in the expected format.", "Decision is required."]);
    expect(screen.getByLabelText(/Case/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(/Nothing was sent/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits to the backend and reports back", async () => {
    const forms = memoryForms({
      forms: [
        {
          id: "case",
          fields: [
            { name: "case_id", label: "Case", type: FieldType.TEXT, required: true },
            { name: "amount", label: "Amount", type: FieldType.NUMBER },
            { name: "decision", label: "Decision", type: FieldType.CHOICE, options: ["fraud", "not fraud"], required: true },
            { name: "confirmed", label: "Confirmed", type: FieldType.BOOLEAN },
          ],
        },
      ],
    });
    const onSubmit = vi.fn();
    render(
      <FormsProvider forms={forms}>
        <Form formId="case" fields={fields} onSubmit={onSubmit} />
      </FormsProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Case/), { target: { value: "C-7" } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "12.5" } });
    fireEvent.click(screen.getByLabelText("fraud"));
    fireEvent.click(screen.getByLabelText("Confirmed"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit" })));
    expect(onSubmit).toHaveBeenCalledWith({ submissionId: "sub-1", values: { case_id: "C-7", amount: 12.5, decision: "fraud", confirmed: true } });
    expect(forms.submissions()).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Saved.");
    expect((screen.getByLabelText(/Case/) as HTMLInputElement).value).toBe("");
  });

  it("shows the backend's own field errors", async () => {
    const forms = memoryForms({ forms: [{ id: "case", fields: [{ name: "case_id", label: "Case", type: FieldType.TEXT, maxLength: 2 }] }] });
    render(<Form formId="case" forms={forms} fields={[{ name: "case_id", label: "Case", type: "text" }]} />);
    fireEvent.change(screen.getByLabelText(/Case/), { target: { value: "C-123" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Submit" })));
    expect(screen.getByRole("alert").textContent).toBe("At most 2 characters.");
    expect(forms.submissions()).toHaveLength(0);
  });
});
