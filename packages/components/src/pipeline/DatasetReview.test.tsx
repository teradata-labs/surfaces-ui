// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { type Pipelines, memoryPipelines, pipelineDigest } from "@surfaces-ui/data";
import { CheckKind, CheckSeverity, DatasetKind, GetPipelineResponseSchema, ListRunsResponseSchema, PipelineDraftSchema, RunSchema, RunState } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatasetReview, checkText, datasetChanges } from "./DatasetReview.js";
import { PipelineView, checkOutcomes } from "./PipelineView.js";

afterEach(cleanup);

const saved = {
  summary: { id: "sales", name: "Sales", sourceId: "lake" },
  version: 1,
  datasets: [{ name: "orders_clean", sql: "SELECT * FROM orders", grain: "one row per order", primaryKey: ["order_id"] }],
};
const proposal = create(PipelineDraftSchema, {
  id: "sales",
  name: "Sales",
  sourceId: "lake",
  datasets: [
    { name: "orders_clean", sql: "SELECT * FROM orders", grain: "one row per order", primaryKey: ["order_id"] },
    {
      name: "region_revenue",
      sql: "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region",
      inputs: ["orders_clean"],
      inputsDeclared: true,
      grain: "one row per region",
      primaryKey: ["region"],
      columns: [{ name: "region", type: "VARCHAR" }, { name: "revenue", type: "DOUBLE", description: "Sum of amount." }],
      checks: [{ name: "accepted_values_region", kind: CheckKind.ACCEPTED_VALUES, columns: ["region"], values: ["EU", "US"], severity: CheckSeverity.FAIL }],
    },
  ],
});

describe("DatasetReview", () => {
  it("describes checks and changes in words", () => {
    expect(checkText({ kind: CheckKind.RELATIONSHIPS, columns: ["customer_id"], toTable: "customers", toColumn: "id", values: [] })).toBe("customer_id is found in customers.id");
    expect(checkText({ kind: CheckKind.ROW_COUNT, columns: [], toTable: "", toColumn: "", values: [], minRows: 1n })).toBe("at least 1 rows");
    expect(datasetChanges(undefined, proposal.datasets[1]!)).toEqual(["New dataset"]);
    expect(datasetChanges(proposal.datasets[0]!, { ...proposal.datasets[0]!, grain: "one row per line" })).toEqual(["Grain"]);
  });

  it("saves only on approval, with the digest of what the person left, and builds nothing", async () => {
    const pipelines = memoryPipelines([saved]);
    const onDecide = vi.fn();
    const onContext = vi.fn();
    render(<DatasetReview pipelines={pipelines} pipeline={proposal} dataset="region_revenue" expectedVersion={1} digest={await pipelineDigest(proposal)} proposedBy="the agent" onDecide={onDecide} onContext={onContext} />);
    expect(screen.getByText("Add region_revenue in Sales")).toBeTruthy();
    expect(screen.getByText(/Proposed by the agent/)).toBeTruthy();
    expect(screen.getByText(/no two rows share it/)).toBeTruthy();

    // The person makes the check a warning and names themselves.
    fireEvent.click(screen.getByRole("checkbox", { name: /Stops what reads it/ }));
    expect(onContext).toHaveBeenCalledWith(expect.objectContaining({ kind: "field.changed", summary: "accepted_values_region now only warns" }));
    await screen.findByText(/You changed the proposal/);
    fireEvent.click(screen.getByRole("button", { name: "Approve and save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/who is approving/);
    fireEvent.change(screen.getByLabelText("Approved by"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve and save" }));

    await waitFor(() => expect(onDecide).toHaveBeenCalled());
    expect(onDecide.mock.calls[0]![0]).toMatchObject({ approved: true, version: 2, approvedBy: "Ada" });
    const { pipeline } = await pipelines.getPipeline({ id: "sales" });
    expect(pipeline!.datasets.find((d) => d.name === "region_revenue")!.checks[0]!.severity).toBe(CheckSeverity.WARN);
    expect((await pipelines.listPipelineVersions({ pipelineId: "sales" })).versions[0]).toMatchObject({ approvedBy: "Ada" });
    expect((await pipelines.listRuns({ pipelineId: "sales" })).runs).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toMatch(/Nothing has been built yet/);
  });

  it("shows a stale save's refusal, and reports a rejection without saving", async () => {
    const pipelines = memoryPipelines([saved]);
    render(<DatasetReview pipelines={pipelines} pipeline={proposal} dataset="region_revenue" expectedVersion={0} approver="Ada" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve and save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/changed since/);
    cleanup();

    const onDecide = vi.fn();
    render(<DatasetReview pipelines={pipelines} pipeline={proposal} dataset="region_revenue" expectedVersion={1} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenCalledWith({ approved: false });
    expect((await pipelines.getPipeline({ id: "sales" })).pipeline!.version).toBe(1);
  });

  it("marks a changed dataset against the saved one, with the saved query to compare", async () => {
    const changed = create(PipelineDraftSchema, { ...proposal, datasets: [{ ...proposal.datasets[0]!, sql: "SELECT * FROM orders WHERE status IS NOT NULL" }] });
    render(<DatasetReview pipelines={memoryPipelines([saved])} pipeline={changed} dataset="orders_clean" expectedVersion={1} />);
    expect(await screen.findByText("Change orders_clean in Sales")).toBeTruthy();
    expect(screen.getByText("Query changed")).toBeTruthy();
    expect(screen.getByText("The saved query")).toBeTruthy();
  });
});

describe("PipelineView checks", () => {
  const pipeline = {
    summary: { id: "sales", name: "Sales", sourceId: "lake", datasetCount: 1 },
    datasets: [
      { name: "orders", kind: DatasetKind.SOURCE },
      {
        name: "orders_clean",
        sql: "SELECT * FROM orders",
        inputs: ["orders"],
        inputsDeclared: true,
        grain: "one row per order",
        primaryKey: ["order_id"],
        columns: [{ name: "order_id", type: "INTEGER", description: "The order." }],
        checks: [
          { name: "unique_order_id", kind: CheckKind.UNIQUE, columns: ["order_id"], implied: true, severity: CheckSeverity.FAIL },
          { name: "row_count", kind: CheckKind.ROW_COUNT, minRows: 1n, severity: CheckSeverity.WARN },
        ],
      },
    ],
  };
  const run = create(RunSchema, {
    id: "run-0001",
    pipelineId: "sales",
    state: RunState.FAILED,
    startTime: "2026-11-15T10:00:00Z",
    datasetRuns: [
      {
        name: "orders_clean",
        state: RunState.FAILED,
        rowsWritten: 10n,
        errorMessage: "Built, but the check unique_order_id failed: 4 rows share order_id with another row.",
        checks: [
          { name: "unique_order_id", kind: CheckKind.UNIQUE, severity: CheckSeverity.FAIL, failedRecords: 4n, summary: "4 rows share order_id with another row.", failingRowsSql: "SELECT order_id FROM orders_clean" },
          { name: "row_count", kind: CheckKind.ROW_COUNT, severity: CheckSeverity.WARN, failedRecords: 0n, summary: "10 rows." },
        ],
      },
    ],
  });

  it("puts a run's check results beside each check, failures first", () => {
    const [unique, rows] = checkOutcomes(create(GetPipelineResponseSchema, { pipeline }).pipeline!.datasets[1]!, run);
    expect(unique).toMatchObject({ name: "unique_order_id", description: "order_id never repeats", severity: "fail", failedRecords: 4, fromKey: true });
    expect(rows).toMatchObject({ severity: "warn", failedRecords: 0 });
  });

  it("shows grain, key, columns and check results, and offers what breaks a check", async () => {
    const onOpenSql = vi.fn();
    const pipelines = {
      getPipeline: async () => create(GetPipelineResponseSchema, { pipeline }),
      listRuns: async () => create(ListRunsResponseSchema, { runs: [run] }),
    } as unknown as Pipelines;
    render(<PipelineView pipelineId="sales" pipelines={pipelines} onOpenSql={onOpenSql} />);
    const node = async () => (await screen.findAllByRole("button", { name: /^.?orders_clean/ }))[0]!;
    fireEvent.click(await node());
    expect(screen.getByText("One row: one row per order · Key order_id")).toBeTruthy();
    expect(screen.getByText("The order.")).toBeTruthy();
    expect(screen.getByText("! Failed")).toBeTruthy();
    expect(screen.getByText("4 rows share order_id with another row.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See what breaks it" }));
    expect(onOpenSql).toHaveBeenCalledWith("SELECT order_id FROM orders_clean", "lake");
    expect((await node()).textContent).toContain("1 check failed");
  });

  it("reports a run it started when it begins and ends", async () => {
    const pipelines = memoryPipelines([{ ...saved, datasets: [{ name: "orders_clean", sql: "SELECT 1" }] }]);
    const onRun = vi.fn();
    const onContext = vi.fn();
    render(<PipelineView pipelineId="sales" pipelines={pipelines} onRun={onRun} onContext={onContext} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2));
    expect(onRun.mock.calls.map((c) => [c[0].kind, c[0].state])).toEqual([
      ["started", "completed"],
      ["finished", "completed"],
    ]);
    expect(onContext.mock.calls.map((c) => c[0].kind)).toEqual(["run.started", "run.finished"]);
  });
});
