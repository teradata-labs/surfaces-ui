// @vitest-environment jsdom
import { FormsProvider } from "@surfaces-ui/components";
import { memoryForms } from "@surfaces-ui/data";
import { FieldType } from "@surfaces-ui/proto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION } from "../dynamic.js";
import { pageSurface, surfaceKind } from "../page.js";
import { patternById } from "../patterns.js";
import { type SurfaceAction, type SurfaceComponent, type SurfaceMessage, applyMessages } from "../surface.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;
const surfaceOf = (components: SurfaceComponent[], sendDataModel = false, data?: unknown) => {
  const messages: SurfaceMessage[] = [
    { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id, ...(sendDataModel ? { sendDataModel } : {}) } },
    { version: v, updateComponents: { surfaceId: "main", components } },
  ];
  if (data !== undefined) messages.push({ version: v, updateDataModel: { surfaceId: "main", path: "/", value: data } });
  return applyMessages({}, messages).main!;
};

describe("inputs", () => {
  it("every input example is valid", () => {
    for (const name of ["TextField", "NumberField", "ChoicePicker", "CheckBox", "DateTimeInput", "Slider", "Form"]) {
      expect(analyticsCatalog.validateComponent(analyticsCatalog.components[name]!.example), name).toEqual([]);
    }
    expect(analyticsCatalog.validateComponent({ id: "x", component: "TextField", label: "Name", value: "literal" })).not.toEqual([]);
  });

  it("write to the data model, which bindings and the agent's event then read", () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    const onDataChange = vi.fn();
    const surface = surfaceOf(
      [
        { id: "root", component: "Column", children: ["name", "count", "ok", "echo", "send"] },
        { id: "name", component: "TextField", label: "Name", value: { "@path": "/name" } },
        { id: "count", component: "NumberField", label: "Count", value: { "@path": "/count" } },
        { id: "ok", component: "CheckBox", label: "Agree", value: { "@path": "/ok" } },
        { id: "echo", component: "Text", text: { "@path": "/name" } },
        { id: "send", component: "Button", child: "send-label", action: { event: { name: "go", context: { name: { "@path": "/name" } } } } },
        { id: "send-label", component: "Text", text: "Go" },
      ],
      true,
      { name: "Ada" },
    );
    render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onDataChange={onDataChange} />);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Grace" } });
    fireEvent.change(screen.getByLabelText("Count"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("Agree"));
    expect(screen.getByText("Grace")).toBeTruthy();
    expect(onDataChange).toHaveBeenLastCalledWith({ name: "Grace", count: 3, ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onAction.mock.calls[0]![0]).toMatchObject({ name: "go", context: { name: "Grace" }, dataModel: { name: "Grace", count: 3, ok: true } });
  });

  it("leaves the data model out of actions unless the surface asks for it", () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    const surface = surfaceOf([
      { id: "root", component: "Column", children: ["b"] },
      { id: "b", component: "Button", child: "l", action: { event: { name: "go" } } },
      { id: "l", component: "Text", text: "Go" },
    ]);
    render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onAction.mock.calls[0]![0]).not.toHaveProperty("dataModel");
  });
});

describe("a Button that waits for inputs", () => {
  const components = (requires?: string[]): SurfaceComponent[] => [
    { id: "root", component: "Column", children: ["kind", "table", "url", "size", "send"] },
    { id: "kind", component: "ChoicePicker", label: "Source", value: { "@path": "/kind" }, options: ["Table", "Website"], required: true },
    { id: "table", component: "TextField", label: "Table name", value: { "@path": "/table" }, required: true, visibleWhen: { path: "/kind", equals: "Table" } },
    { id: "url", component: "TextField", label: "URL to crawl", value: { "@path": "/url" }, required: true, visibleWhen: { path: "/kind", equals: "Website" } },
    { id: "size", component: "NumberField", label: "Chunk size", value: { "@path": "/size" }, min: 200, max: 2000, required: true },
    { id: "send", component: "Button", child: "send-label", ...(requires ? { requires } : {}), action: { event: { name: "create", context: { kind: { "@path": "/kind" }, size: { "@path": "/size" } } } } },
    { id: "send-label", component: "Text", text: "Create" },
  ];

  it("sends nothing while one is missing or wrong, says what is wrong beside each and moves to the first", () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    expect(analyticsCatalog.validateComponent(components(["kind", "table", "url", "size"])[5]!)).toEqual([]);
    render(<SurfaceView surface={surfaceOf(components(["kind", "table", "url", "size"]), false, { size: 50 })} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />);
    const button = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    // Marked unavailable, yet not disabled: it can be reached, and a press explains itself.
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Source is required.", "Must be at least 200."]);
    expect(screen.getByRole("status").textContent).toBe("Nothing was sent. 2 fields need attention: Source, Chunk size.");
    expect(document.activeElement).toBe(screen.getByLabelText("Table"));

    // The field the choice calls for is waited for; the one it hides is not.
    fireEvent.click(screen.getByLabelText("Table"));
    fireEvent.change(screen.getByLabelText(/Chunk size/), { target: { value: "500" } });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Nothing was sent. Table name is required.");
    expect(document.activeElement).toBe(screen.getByLabelText(/Table name/));
    fireEvent.change(screen.getByLabelText(/Table name/), { target: { value: "docs.articles" } });
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(button);
    expect(onAction.mock.calls[0]![0]).toMatchObject({ name: "create", context: { kind: "Table", size: 500 } });
  });

  it("does not wait unless it names them", () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    render(<SurfaceView surface={surfaceOf(components())} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />);
    const button = screen.getByRole("button", { name: "Create" });
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("Form on a surface", () => {
  const pattern = patternById("collect-a-decision-in-a-form")!;

  it("submits to the forms backend and tells the agent, with only declared context", async () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    const onProblem = vi.fn();
    const forms = memoryForms({
      forms: [
        {
          id: "case-review",
          fields: [
            { name: "decision", label: "Decision", type: FieldType.CHOICE, options: ["Fraud", "Not fraud", "Needs more information"], required: true },
            { name: "amount_at_risk", label: "Amount at risk", type: FieldType.NUMBER, min: 0 },
            { name: "note", label: "Note", type: FieldType.TEXT, maxLength: 500 },
          ],
        },
      ],
    });
    render(
      <FormsProvider forms={forms}>
        <SurfaceView surface={surfaceOf(pattern.components)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onProblem={onProblem} />
      </FormsProvider>,
    );
    fireEvent.click(screen.getByLabelText("Fraud"));
    fireEvent.change(screen.getByLabelText("Amount at risk"), { target: { value: "2700" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save decision" })));
    expect(forms.submissions()[0]?.values).toEqual({ decision: "Fraud", amount_at_risk: 2700, note: null });
    expect(onAction.mock.calls[0]![0]).toMatchObject({ name: "case_reviewed", context: { formId: "case-review", submissionId: "sub-1", values: { decision: "Fraud", amount_at_risk: 2700 } } });
    expect(onProblem).not.toHaveBeenCalled();
  });

  it("takes a field that waits on another, and refuses one that waits on a field the form does not have", () => {
    const form = (field: string) => ({
      id: "f",
      component: "Form",
      formId: "source",
      fields: [
        { name: "kind", label: "Source", type: "choice", options: ["Table", "Website"], required: true },
        { name: "table", label: "Table name", type: "text", required: true, visibleWhen: { field, equals: "Table" } },
      ],
    });
    expect(analyticsCatalog.validateComponent(form("kind"))).toEqual([]);
    expect(analyticsCatalog.validateComponent(form("sort"))[0]?.message).toMatch(/no field "sort".*kind, table/);
    expect(analyticsCatalog.validateComponent(form("table"))[0]?.message).toMatch(/cannot wait on itself/);
    render(<SurfaceView surface={surfaceOf([{ id: "root", component: "Column", children: ["f"] }, form("kind") as SurfaceComponent])} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.queryByLabelText(/Table name/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Table"));
    expect(screen.getByLabelText(/Table name/)).toBeTruthy();
  });

  it("reports a renderer that adds context its catalog entry does not declare", () => {
    const onProblem = vi.fn();
    const surface = surfaceOf([
      { id: "root", component: "Column", children: ["c"] },
      { id: "c", component: "Chips", items: ["a"], action: { event: { name: "pick" } } },
    ]);
    const renderers = { ...analyticsRenderers, Chips: ({ component, dispatch }: Parameters<(typeof analyticsRenderers)["Chips"]>[0]) => <button onClick={() => dispatch(component.action, { secret: 1 })}>a</button> };
    render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={renderers} onProblem={onProblem} />);
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    expect(onProblem).toHaveBeenCalledWith(expect.objectContaining({ code: "UNDECLARED_EVENT" }));
  });
});

describe("surfaceKind", () => {
  const c = (...names: string[]) => ({ components: names.map((component, i) => ({ id: i === 0 ? "root" : `c${i}`, component })) });
  it.each([
    [c("Column", "Chart"), "chart"],
    [c("Grid", "Metric", "Metric", "Chart", "Chart"), "dashboard"],
    [c("Column", "Text", "Form"), "form"],
    [c("Column", "PipelineGraph"), "dag"],
    [c("Column", "DataGrid"), "data-explorer"],
    [c("Column", "ObjectBrowser", "ObjectDetail"), "metadata-explorer"],
    [c("Column", "Text"), "other"],
  ])("%j is a %s", (page, kind) => {
    expect(surfaceKind(page as never)).toBe(kind);
  });
});

describe("swapping components", () => {
  it("replaces a component that uses hooks with another kind in the same place", () => {
    const page = (component: Record<string, unknown>) =>
      pageSurface({ id: "p", title: "p", catalogId: analyticsCatalog.id, components: [{ id: "root", ...component } as never], data: { v: 3 } });
    const view = render(<SurfaceView surface={page({ component: "Slider", label: "Level", value: { "@path": "/v" }, min: 0, max: 5 })} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.getByRole("slider", { name: /Level/ })).toBeTruthy();
    view.rerender(<SurfaceView surface={page({ component: "Text", text: "Now text" })} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.getByText("Now text")).toBeTruthy();
    view.rerender(<SurfaceView surface={page({ component: "Slider", label: "Level", value: { "@path": "/v" }, min: 0, max: 5 })} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.getByRole("slider", { name: /Level/ })).toBeTruthy();
  });
});
