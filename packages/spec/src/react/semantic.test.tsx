// @vitest-environment jsdom
import { DataSourceProvider, SemanticsProvider } from "@surfaces-ui/components";
import { memoryDataSource, memorySemantics } from "@surfaces-ui/data";
import { AggregateFunction, DimensionKind } from "@surfaces-ui/proto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { type PageDocument, pageSurface, validatePage } from "../page.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const dataSource = memoryDataSource({
  tables: {
    lines: [
      { region: "EU", brand: "A", line_amount: 100, line_cost: 60 },
      { region: "NA", brand: "B", line_amount: 50, line_cost: 40 },
    ],
  },
});
const starter = {
  name: "lines",
  label: "Lines",
  sourceId: "memory",
  sql: "SELECT * FROM lines",
  dimensions: [
    { name: "region", label: "Region", column: "region", kind: DimensionKind.CATEGORY },
    { name: "brand", label: "Brand", column: "brand", kind: DimensionKind.CATEGORY },
  ],
  measures: [
    { name: "revenue", label: "Revenue", column: "line_amount", aggregate: AggregateFunction.SUM, format: "currency" },
    { name: "cost", label: "Cost", column: "line_cost", aggregate: AggregateFunction.SUM, format: "currency" },
  ],
};
const page = (components: PageDocument["components"]): PageDocument => ({ id: "p", title: "P", catalogId: analyticsCatalog.id, components: [{ id: "root", component: "Column", children: components.map((c) => c.id) }, ...components] });

function draw(doc: PageDocument, semantics = memorySemantics({ models: [starter] }), onAction = vi.fn(), onControls = vi.fn()) {
  expect(validatePage(doc, analyticsCatalog)).toEqual([]);
  render(
    <DataSourceProvider dataSource={dataSource}>
      <SemanticsProvider semantics={semantics}>
        <SurfaceView surface={pageSurface(doc)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onControlsChange={onControls} />
      </SemanticsProvider>
    </DataSourceProvider>,
  );
  return { semantics, onAction, onControls };
}

describe("semantic models in a surface", () => {
  it("shows an agent's proposal as a draft that only a person's save keeps", async () => {
    const doc = page([
      {
        id: "model",
        component: "SemanticModelEditor",
        model: "lines",
        proposed: { add: [{ id: "margin", kind: "derived", label: "Margin", expression: "(revenue - cost) / revenue", format: "percent" }], remove: ["brand"] },
        proposedBy: "the analytics agent",
        action: { event: { name: "model.saved" } },
      },
    ]);
    const { semantics, onAction } = draw(doc);
    const draft = await screen.findByRole("region", { name: "Changes not saved" });
    expect(draft.textContent).toMatch(/2 changes not saved, proposed by the analytics agent/);
    // Nothing is kept yet.
    expect((await semantics.getSemanticModel({ name: "lines" })).model?.metrics).toEqual([]);
    await act(async () => fireEvent.click(within(draft).getByRole("button", { name: "Save as version 2" })));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    const saved = (await semantics.getSemanticModel({ name: "lines" })).model!;
    expect(saved.version).toBe(2);
    expect(saved.metrics.map((m) => [m.name, m.definedBy])).toEqual([["margin", "the analytics agent"]]);
    expect(saved.dimensions.map((d) => d.name)).toEqual(["region"]);
    expect(onAction.mock.calls.at(-1)![0]).toMatchObject({ name: "model.saved", context: { model: "lines", version: 2, changes: { margin: "added", brand: "removed" } } });
  });

  it("gives an explorer named by model the model's query and pills", async () => {
    draw(page([{ id: "explore", component: "Explorer", model: "lines", rows: ["region"], values: ["revenue"] }]));
    await waitFor(() => expect(screen.getByText("Revenue by Region")).toBeTruthy());
    const revenue = screen.getAllByRole("button", { name: /^Revenue \(metric/ }).find((b) => b.classList.contains("sf-pill"))!;
    expect(within(revenue).getByText("model")).toBeTruthy();
  });

  it("says so in place of the component when the page has no models", async () => {
    render(
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView surface={pageSurface(page([{ id: "explore", component: "Explorer", model: "lines" }]))} catalog={analyticsCatalog} renderers={analyticsRenderers} />
      </DataSourceProvider>,
    );
    expect(await screen.findByText(/no store of semantic models here/)).toBeTruthy();
  });
});

describe("an agent's new semantic model in a surface", () => {
  const lines = memoryDataSource({ tables: { lines: [{ line_id: 1, region: "EU", line_amount: 100 }, { line_id: 2, region: "NA", line_amount: 50 }] } });

  it("shows a proposed new model as a draft with its rows, and only a person's save keeps it", async () => {
    const semantics = memorySemantics();
    const onAction = vi.fn();
    const onControls = vi.fn();
    const doc = page([
      {
        id: "model",
        component: "SemanticModelEditor",
        model: "order_lines",
        create: { label: "Order lines", sourceId: "memory" },
        proposed: {
          rows: { grain: "One order line.", primaryKey: ["line_id"], tables: ["lines"] },
          add: [
            { id: "region", kind: "attribute", label: "Region", column: "region" },
            { id: "revenue", kind: "metric", label: "Revenue", column: "line_amount", aggregate: "sum", format: "currency" },
          ],
        },
        proposedBy: "the analytics agent",
        action: { event: { name: "model.saved" } },
      },
    ]);
    expect(validatePage(doc, analyticsCatalog)).toEqual([]);
    render(
      <DataSourceProvider dataSource={lines}>
        <SemanticsProvider semantics={semantics}>
          <SurfaceView surface={pageSurface(doc)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onControlsChange={onControls} />
        </SemanticsProvider>
      </DataSourceProvider>,
    );
    const draft = await screen.findByRole("region", { name: "Changes not saved" });
    expect(draft.textContent).toMatch(/New model, not saved, proposed by the analytics agent/);
    expect(screen.getAllByText("the analytics agent", { selector: "td" })).toHaveLength(2);
    expect((screen.getByLabelText("One row is") as HTMLInputElement).value).toBe("One order line.");
    expect((await semantics.listSemanticModels({})).models).toEqual([]);

    // The person asks for more in words; it goes to the agent as the declared event.
    fireEvent.change(screen.getByLabelText(/what this model should measure/), { target: { value: "Add a count of lines" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAction.mock.calls.at(-1)![0]).toMatchObject({ name: "model.saved", context: { text: "Add a count of lines" } });

    const save = within(draft).getByRole("button", { name: "Save as version 1" });
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false));
    await act(async () => fireEvent.click(save));
    await waitFor(() => expect(onAction.mock.calls.at(-1)![0]).toMatchObject({ context: { model: "order_lines", version: 1 } }));
    const saved = (await semantics.getSemanticModel({ name: "order_lines" })).model!;
    expect([saved.grain, saved.primaryKey, saved.tables, saved.sql]).toEqual(["One order line.", ["line_id"], ["lines"], "SELECT *\nFROM lines"]);
    expect(saved.dimensions.map((d) => d.definedBy)).toEqual(["the analytics agent"]);
  });

  it("proposes a change to an existing model's rows as a draft part of the change list", async () => {
    draw(page([{ id: "model", component: "SemanticModelEditor", model: "lines", proposed: { rows: { grain: "One sale." } }, proposedBy: "the analytics agent" }]));
    const draft = await screen.findByRole("region", { name: "Changes not saved" });
    expect(draft.textContent).toMatch(/1 change not saved.*Changed what one row is/);
  });
});
