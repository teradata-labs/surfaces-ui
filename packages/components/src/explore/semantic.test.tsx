// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { memoryDataSource, memorySemantics } from "@surfaces-ui/data";
import { AggregateFunction, DimensionKind, SemanticModelSchema } from "@surfaces-ui/proto";
import { Float64, Utf8 } from "apache-arrow";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Explorer } from "./Explorer.js";
import type { ExploreState, Pill } from "./model.js";
import { SemanticModelEditor } from "./SemanticModelEditor.js";
import { SemanticsProvider, useSemanticModel } from "./SemanticsProvider.js";
import { mergeModelPills, pillsFromModel, pillsWithModel, promotePill } from "./semantic.js";

afterEach(cleanup);

const init = {
  name: "lines",
  label: "Order lines",
  sourceId: "memory",
  sql: "SELECT * FROM lines",
  dimensions: [{ name: "region", label: "Sales region", column: "region", kind: DimensionKind.CATEGORY, definedBy: "Ana" }],
  measures: [
    { name: "revenue", label: "Revenue", column: "line_amount", aggregate: AggregateFunction.SUM, format: "currency" },
    { name: "refunded", label: "Refunded", column: "refund_amount", aggregate: AggregateFunction.SUM, format: "currency" },
  ],
  metrics: [{ name: "refund_rate", label: "Refund rate", expression: "refunded / revenue", format: "percent" }],
};
const model = create(SemanticModelSchema, { ...init, version: 1 });
const data = () =>
  memoryDataSource({
    tables: {
      lines: [
        { region: "EU", channel: "web", line_amount: 100, refund_amount: 10 },
        { region: "EU", channel: "store", line_amount: 100, refund_amount: 0 },
        { region: "NA", channel: "web", line_amount: 50, refund_amount: 20 },
      ],
    },
  });

describe("pills from a semantic model", () => {
  it("makes the model's fields pills that say where they come from", () => {
    const pills = pillsFromModel(model);
    expect(pills.map((p) => [p.id, p.kind, p.by, p.model])).toEqual([
      ["region", "attribute", "Ana", "lines"],
      ["revenue", "metric", "the Order lines model", "lines"],
      ["refunded", "metric", "the Order lines model", "lines"],
      ["refund_rate", "derived", "the Order lines model", "lines"],
    ]);
  });

  it("generates pills only for the columns the model leaves out", () => {
    const columns = ["region", "channel", "line_amount", "refund_amount"].map((name) => ({ name, type: name.endsWith("amount") ? new Float64() : new Utf8() }));
    const ids = pillsWithModel(model, columns).map((p) => p.id);
    expect(ids.slice(0, 4)).toEqual(["region", "revenue", "refunded", "refund_rate"]);
    expect(ids).not.toContain("line_amount");
  });

  it("follows the model without overwriting a pill changed by hand", () => {
    const fields: Pill[] = [...pillsFromModel(model)];
    const handEdited = fields.map((p) => (p.id === "revenue" ? { ...p, label: "Gross", by: "you", model: undefined } : p));
    const next = create(SemanticModelSchema, { ...init, version: 2, dimensions: [{ ...init.dimensions[0]!, label: "Region" }] });
    const merged = mergeModelPills(handEdited, next);
    expect(merged.find((p) => p.id === "region")?.label).toBe("Region");
    expect(merged.find((p) => p.id === "revenue")).toMatchObject({ label: "Gross", by: "you" });
  });

  it("adds a calculation to the model with the metrics it uses", () => {
    const all: Pill[] = [...pillsFromModel(model), { id: "line_count", kind: "metric", label: "Lines", aggregate: "count", by: "you" }, { id: "avg_line", kind: "derived", label: "Revenue per line", expression: "revenue / line_count", format: "currency", by: "you" }];
    const next = promotePill(model, all.at(-1)!, all, "Ana");
    expect(next.measures.map((m) => [m.name, m.definedBy])).toEqual([
      ["revenue", ""],
      ["refunded", ""],
      ["line_count", "Ana"],
    ]);
    expect(next.metrics.at(-1)).toMatchObject({ name: "avg_line", expression: "revenue / line_count", definedBy: "Ana" });
  });
});

function Host({ initial }: { initial?: ExploreState }) {
  const { model: loaded, promote } = useSemanticModel("lines", { editor: "Ana" });
  const [state, setState] = useState<ExploreState>(initial ?? { fields: [], rows: [], values: [], filters: [] });
  return loaded ? <Explorer dataSource={data()} model={loaded} value={state} onChange={setState} onPromote={promote} editor="Ana" /> : null;
}

describe("Explorer over a semantic model", () => {
  it("takes the query and the fields from the model, and adds a field made by hand to it", async () => {
    const semantics = memorySemantics({ models: [init] });
    render(
      <SemanticsProvider semantics={semantics}>
        <Host />
      </SemanticsProvider>,
    );
    const pill = (name: RegExp) => screen.getAllByRole("button", { name }).find((b) => b.classList.contains("sf-pill"))!;
    await waitFor(() => expect(pill(/^Refund rate \(calculation/)).toBeTruthy());
    expect(screen.getByRole("status").textContent).toMatch(/4 fields from the Order lines model/);
    // The model's own fields are marked as such; a column the model leaves out is generated.
    expect(within(pill(/^Sales region \(attribute/)).getByText("model")).toBeTruthy();
    expect(pill(/^Channel \(attribute/)).toBeTruthy();
    // A model field offers nothing to add; a generated one does.
    fireEvent.contextMenu(pill(/^Sales region \(attribute/));
    expect(screen.queryByRole("menuitem", { name: /model/ })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.contextMenu(pill(/^Channel \(attribute/));
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: /Add to the model/ })));
    await waitFor(() => expect(within(pill(/^Channel \(attribute/)).getByText("model")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toMatch(/Channel added to the Order lines model \(version 2\)/);
    const saved = (await semantics.getSemanticModel({ name: "lines" })).model!;
    expect(saved.dimensions.map((d) => [d.name, d.definedBy])).toEqual([
      ["region", "Ana"],
      ["channel", "Ana"],
    ]);
    expect(saved.savedBy).toBe("Ana");
    // The model's metric is worked out by the engine from its measures.
    fireEvent.click(pill(/^Refund rate \(calculation/));
    fireEvent.click(pill(/^Sales region \(attribute/));
    expect(screen.getByText("Refund rate by Sales region")).toBeTruthy();
  });
});

describe("creating a semantic model", () => {
  it("asks what one row is and a key the engine finds unique, drafts fields from the columns and saves version 1", async () => {
    const dataSource = memoryDataSource({
      tables: {
        lines: [
          { line_id: 1, region: "EU", line_amount: 100 },
          { line_id: 2, region: "EU", line_amount: 40 },
          { line_id: 3, region: "NA", line_amount: 50 },
        ],
      },
    });
    const semantics = memorySemantics();
    const asked: string[] = [];
    const start = create(SemanticModelSchema, { sourceId: "memory" });
    render(
      <SemanticModelEditor
        model={start}
        defaultDraft={create(SemanticModelSchema, { sourceId: "memory", sql: "SELECT * FROM lines", tables: ["lines"] })}
        dataSource={dataSource}
        onAsk={(text) => asked.push(text)}
        onSave={async (draft, note) => (await semantics.saveSemanticModel({ model: draft, expectedVersion: 0, note })).model}
      />,
    );
    // The agent comes first: a new model opens with the box to ask it.
    fireEvent.change(screen.getByLabelText(/what this model should measure/), { target: { value: "Order lines by region" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(asked).toEqual(["Order lines by region"]);

    fireEvent.change(screen.getByLabelText("Name for people"), { target: { value: "Order lines" } });
    expect((screen.getByLabelText("Name in calculations and files") as HTMLInputElement).value).toBe("order_lines");

    const draftButton = await screen.findByRole("button", { name: "Draft fields from the columns" });
    await act(async () => fireEvent.click(draftButton));
    const draft = screen.getByRole("region", { name: "Changes not saved" });
    expect(draft.textContent).toMatch(/New model, not saved/);
    // Keys are left out of the draft; the amount is a sum and a count of rows is added.
    expect(screen.getAllByText("generated from the columns").length).toBe(3);
    expect(within(draft).getByRole("alert").textContent).toMatch(/Say what one row is.*make a row unique/);
    expect((within(draft).getByRole("button", { name: "Save as version 1" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("One row is"), { target: { value: "One order line." } });
    // region repeats, so the engine refuses it as a key.
    fireEvent.click(screen.getByRole("checkbox", { name: "region" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Check the key" })));
    expect((await screen.findByText(/region repeats: some rows share it, up to 2 times/)).getAttribute("role")).toBe("alert");
    fireEvent.click(screen.getByRole("checkbox", { name: "region" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "line_id" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Check the key" })));
    expect(await screen.findByText(/Unique: each line_id names one row/)).toBeTruthy();

    await act(async () => fireEvent.click(within(screen.getByRole("region", { name: "Changes not saved" })).getByRole("button", { name: "Save as version 1" })));
    const saved = (await semantics.getSemanticModel({ name: "order_lines" })).model!;
    expect([saved.version, saved.grain, saved.primaryKey, saved.tables]).toEqual([1, "One order line.", ["line_id"], ["lines"]]);
    expect(saved.measures.map((m) => m.name)).toEqual(["line_amount", "row_count"]);
  });
});
