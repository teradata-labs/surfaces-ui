// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { type Pipelines, memoryDataSource, semanticModelFromDataset } from "@surfaces-ui/data";
import { CheckKind, CheckSeverity, PipelineSchema, RunSchema, RunState, SemanticModelSchema } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataSourceProvider } from "../data/DataSourceProvider.js";
import { PipelinesProvider } from "../pipeline/PipelineView.js";
import { Explorer } from "./Explorer.js";
import { ModelLineage } from "./ModelLineage.js";
import { SemanticModelEditor } from "./SemanticModelEditor.js";
import { applyProposal, proposalFrom } from "./semantic-proposal.js";

afterEach(cleanup);

const pipeline = create(PipelineSchema, {
  summary: { id: "refunds", name: "Refunds", sourceId: "memory" },
  datasets: [
    {
      name: "lines_clean",
      description: "Order lines, cleaned.",
      grain: "One order line.",
      primaryKey: ["line_id"],
      inputs: ["lines"],
      inputsDeclared: true,
      columns: [
        { name: "line_id", type: "BIGINT" },
        { name: "region", type: "VARCHAR", description: "Sales region." },
        { name: "line_amount", type: "DOUBLE" },
      ],
      checks: [
        { name: "unique_line_id", kind: CheckKind.UNIQUE, columns: ["line_id"], implied: true },
        { name: "not_null_line_id", kind: CheckKind.NOT_NULL, columns: ["line_id"], implied: true },
        { name: "accepted_values_region", kind: CheckKind.ACCEPTED_VALUES, columns: ["region"], severity: CheckSeverity.WARN },
      ],
      state: RunState.COMPLETED,
      builtAt: "2026-11-14T08:30:00Z",
      lastRunId: "run-1",
    },
  ],
});
const run = create(RunSchema, {
  id: "run-1",
  pipelineId: "refunds",
  datasetRuns: [
    {
      name: "lines_clean",
      checks: [
        { name: "unique_line_id", failedRecords: 0n },
        { name: "not_null_line_id", failedRecords: 0n },
        { name: "accepted_values_region", severity: CheckSeverity.WARN, failedRecords: 2n, summary: "2 rows have a region not in the list." },
      ],
    },
  ],
});
const pipelines = {
  listPipelines: vi.fn(async () => ({ pipelines: [pipeline.summary] })),
  getPipeline: vi.fn(async () => ({ pipeline })),
  getRun: vi.fn(async () => ({ run })),
} as unknown as Pipelines;

const data = () =>
  memoryDataSource({
    tables: {
      lines_clean: [
        { line_id: 1, region: "EU", line_amount: 100 },
        { line_id: 2, region: "NA", line_amount: 50 },
      ],
    },
  });

const wrap = (node: React.ReactNode) => (
  <DataSourceProvider dataSource={data()}>
    <PipelinesProvider pipelines={pipelines}>{node}</PipelinesProvider>
  </DataSourceProvider>
);

describe("models built on pipeline datasets", () => {
  it("starts a new model from a dataset: its query, grain, key and columns", async () => {
    const onSave = vi.fn((draft) => draft);
    render(wrap(<SemanticModelEditor model={create(SemanticModelSchema, { sourceId: "memory", version: 0 })} onSave={onSave} />));
    const picker = await screen.findByLabelText("Start from a pipeline dataset");
    fireEvent.change(picker, { target: { value: "0:0" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this dataset" }));
    expect(await screen.findByText(/Started from the dataset lines_clean of the pipeline Refunds/)).toBeTruthy();
    const lineage = await screen.findByRole("region", { name: "From a pipeline" });
    expect(within(lineage).getByText(/line_id · checked unique and not empty by the latest run/)).toBeTruthy();
    expect(within(lineage).getByText("lines")).toBeTruthy();
    expect(within(lineage).getByText(/warns: 2 rows have a region not in the list/)).toBeTruthy();
    expect(screen.getByText("Sales region.")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Save as version 1" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0]![0];
    expect(saved).toMatchObject({ name: "lines_clean", sql: "SELECT * FROM lines_clean", grain: "One order line.", primaryKey: ["line_id"], dataset: { pipelineId: "refunds", dataset: "lines_clean" } });
  });

  it("says when a model's key has drifted from the dataset's, and puts it back", async () => {
    const model = create(SemanticModelSchema, { ...semanticModelFromDataset(pipeline, "lines_clean"), version: 2, primaryKey: ["region"] });
    const onDraftChange = vi.fn();
    render(wrap(<SemanticModelEditor model={model} onSave={(d) => d} onDraftChange={onDraftChange} draft={undefined} />));
    expect(await screen.findByText(/The model's key \(region\) is not the dataset's \(line_id\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use the dataset's grain and key" }));
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toMatchObject({ primaryKey: ["line_id"] });
  });

  it("puts one line over an explorer on the model, and nothing for a model without a pipeline", async () => {
    const model = create(SemanticModelSchema, { ...semanticModelFromDataset(pipeline, "lines_clean"), version: 1 });
    render(wrap(<Explorer model={model} />));
    const note = await screen.findByRole("note");
    await waitFor(() => expect(note.textContent).toMatch(/Rows from lines_clean, built by the pipeline Refunds · .+ · 1 warning, no check failing/));
    cleanup();
    const { container } = render(<ModelLineage model={create(SemanticModelSchema, { sql: "SELECT 1" })} pipelines={pipelines} />);
    expect(container.textContent).toBe("");
  });
});

describe("an agent's proposal of a model on a dataset", () => {
  it("reads the dataset in place of tables or a query, and comes back in the same form", () => {
    const start = create(SemanticModelSchema, { name: "lines", sourceId: "memory", tables: ["lines"], sql: "SELECT * FROM lines" });
    const next = applyProposal(start, { rows: { dataset: { pipeline: "refunds", dataset: "lines_clean" }, grain: "One order line.", primaryKey: ["line_id"] } }, "the agent");
    expect(next).toMatchObject({ sql: "SELECT * FROM lines_clean", tables: [], joins: [], dataset: { pipelineId: "refunds", dataset: "lines_clean" }, primaryKey: ["line_id"] });
    expect(proposalFrom(start, next).rows).toEqual({ grain: "One order line.", primaryKey: ["line_id"], tables: [], joins: [], dataset: { pipeline: "refunds", dataset: "lines_clean" } });
    expect(applyProposal(next, { rows: { sql: "SELECT * FROM lines" } }, "the agent").dataset).toBeUndefined();
  });
});
