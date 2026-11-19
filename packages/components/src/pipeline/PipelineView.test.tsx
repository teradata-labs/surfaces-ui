// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import type { Pipelines } from "@surfaces-ui/data";
import {
  DatasetKind,
  ExpectationAction,
  GetPipelineResponseSchema,
  GetRunResponseSchema,
  InspectFilesResponseSchema,
  ListPipelinesResponseSchema,
  ListRunsResponseSchema,
  RefreshKind,
  type Run,
  RunSchema,
  RunState,
  StartRunResponseSchema,
  TableFormat,
} from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestWizard, type IngestDraft, emptyIngestDraft, ingestPlan } from "./IngestWizard.js";
import { PipelineView } from "./PipelineView.js";

afterEach(cleanup);

/** The text of every code block in `root`; highlighting splits code into many elements. */
const codeText = (root: ParentNode = document) => [...root.querySelectorAll("pre code")].map((c) => c.textContent).join("\n");


function fakePipelines() {
  const runs: Run[] = [];
  const started: Record<string, unknown>[] = [];
  const done = (id: string, extra: { refreshKind?: RefreshKind; datasets?: string[] } = {}) =>
    create(RunSchema, {
      id,
      pipelineId: "sales",
      state: RunState.COMPLETED,
      startTime: "2026-11-12T10:00:00Z",
      endTime: "2026-11-12T10:00:02Z",
      trigger: "manual",
      datasetRuns: [
        { name: "orders_raw", state: RunState.COMPLETED, rowsWritten: 5000n },
        {
          name: "orders_clean",
          state: RunState.COMPLETED,
          rowsWritten: 3750n,
          expectations: [{ name: "has_status", constraint: "status IS NOT NULL", action: ExpectationAction.DROP, passedRecords: 3750n, failedRecords: 1250n }],
        },
      ],
      ...extra,
    });
  const pipelines: Pipelines = {
    listPipelines: async () => create(ListPipelinesResponseSchema, {}),
    getPipeline: async () =>
      create(GetPipelineResponseSchema, {
        pipeline: {
          summary: { id: "sales", name: "Sales", description: "Cleans orders.", sourceId: "lake", datasetCount: 2 },
          recomputeOnly: true,
          datasets: [
            { name: "orders", kind: DatasetKind.SOURCE },
            { name: "orders_raw", kind: DatasetKind.TABLE, layer: "bronze", sql: "SELECT * FROM orders", inputs: ["orders"] },
            {
              name: "orders_clean",
              kind: DatasetKind.TABLE,
              layer: "silver",
              description: "Orders with a status.",
              sql: "SELECT * FROM orders_raw",
              inputs: ["orders_raw"],
              expectations: [{ name: "has_status", constraint: "status IS NOT NULL", action: ExpectationAction.DROP }],
            },
          ],
        },
      }),
    listRuns: async () => create(ListRunsResponseSchema, { runs }),
    getRun: async () => create(GetRunResponseSchema, { run: runs[0] }),
    startRun: async (request) => {
      started.push(request as Record<string, unknown>);
      const run = request.dryRun ? create(RunSchema, { id: `check-${runs.length}`, pipelineId: "sales", state: RunState.COMPLETED, dryRun: true, startTime: "2026-11-12T09:00:00Z" }) : done(`run-${runs.length + 1}`, { refreshKind: request.refreshKind ?? RefreshKind.UNSPECIFIED, datasets: request.datasets ?? [] });
      runs.unshift(run);
      return create(StartRunResponseSchema, { run });
    },
    cancelRun: async () => ({ cancelled: true }) as never,
    inspectFiles: vi.fn(async () =>
      create(InspectFilesResponseSchema, {
        rowCount: 5000n,
        columns: [
          { name: "Order ID", nativeType: "BIGINT" },
          { name: "amount", nativeType: "VARCHAR" },
          { name: "notes", nativeType: "VARCHAR" },
        ],
      }),
    ),
  };
  return { pipelines, started };
}

describe("PipelineView", () => {
  it("runs a pipeline and shows each dataset's result, its query and its data quality", async () => {
    const { pipelines, started } = fakePipelines();
    const onOpenSql = vi.fn();
    render(<PipelineView pipelines={pipelines} pipelineId="sales" onOpenSql={onOpenSql} />);
    expect(await screen.findByRole("heading", { name: "Sales" })).toBeTruthy();
    expect(screen.getByText(/Each run rebuilds whole tables/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^orders_clean \(Table, idle/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Check only" }));
    expect(await screen.findByText("The check found no problems. Nothing was built.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    const clean = await screen.findByRole("button", { name: /^orders_clean \(Table, completed/ });
    expect(clean.textContent).toContain("3.8K rows");
    expect(clean.textContent).toContain("1.3K records broke rules");
    fireEvent.click(clean);
    const detail = within(screen.getByRole("region", { name: "Dataset orders_clean" }));
    expect(codeText(screen.getByRole("region", { name: "Dataset orders_clean" }))).toContain("SELECT * FROM orders_raw");
    expect(detail.getByText(/1,250 of 5,000/)).toBeTruthy();
    fireEvent.click(detail.getByRole("button", { name: "See failing rows" }));
    expect(onOpenSql).toHaveBeenCalledWith("SELECT * FROM (SELECT * FROM orders_raw) AS d WHERE NOT COALESCE((status IS NOT NULL), FALSE)", "lake");

    fireEvent.click(detail.getByRole("button", { name: "Rebuild this and what uses it" }));
    await waitFor(() => expect(started.at(-1)).toMatchObject({ refreshKind: RefreshKind.REFRESH, datasets: ["orders_clean"] }));
  });

  it("asks before a full refresh, which deletes tables", async () => {
    const { pipelines, started } = fakePipelines();
    render(<PipelineView pipelines={pipelines} pipelineId="sales" />);
    fireEvent.click(await screen.findByRole("button", { name: "Full refresh…" }));
    expect(started).toHaveLength(0);
    const dialog = within(screen.getByRole("alertdialog", { name: "Confirm full refresh" }));
    fireEvent.click(dialog.getByRole("button", { name: "Keep the tables" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Full refresh…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete and rebuild" }));
    await waitFor(() => expect(started[0]).toMatchObject({ refreshKind: RefreshKind.FULL_REFRESH, confirmFullRefresh: true }));
  });
});

describe("IngestWizard", () => {
  it("looks at the files, lets columns be renamed, retyped and dropped, and writes config without loading anything", async () => {
    const { pipelines } = fakePipelines();
    function Harness() {
      const [draft, setDraft] = useState<IngestDraft>({ ...emptyIngestDraft, location: "s3://acme-lake/landing/orders/*.parquet" });
      return <IngestWizard pipelines={pipelines} sourceId="lake" value={draft} onChange={setDraft} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Look at the files" }));
    expect(await screen.findByText("Found 3 columns and 5,000 rows.")).toBeTruthy();
    expect(pipelines.inspectFiles).toHaveBeenCalledWith({ sourceId: "lake", format: TableFormat.PARQUET, location: "s3://acme-lake/landing/orders/*.parquet" });
    expect((screen.getByLabelText("Name for Order ID") as HTMLInputElement).value).toBe("order_id");

    fireEvent.change(screen.getByLabelText("Type for amount"), { target: { value: "DECIMAL(18,2)" } });
    fireEvent.click(screen.getByLabelText("Keep notes"));
    fireEvent.change(screen.getByLabelText("Table for the files as they are"), { target: { value: "orders_landing" } });
    fireEvent.change(screen.getByLabelText("Cleaned table (optional)"), { target: { value: "orders_typed" } });
    expect(codeText()).toContain('{ name: "orders_landing", format: "parquet", path: "s3://acme-lake/landing/orders/*.parquet" },');
    expect(codeText()).toMatch(/CAST\(amount AS DECIMAL\(18,2\)\) AS amount/);
    expect(screen.getByText("Nothing has been loaded. Restart the server after adding these, then run the pipeline.")).toBeTruthy();
  });

  it("explains what is missing before offering config", () => {
    const columns = [
      { source: "a", sourceType: "INT", include: true, target: "x", targetType: "" },
      { source: "b", sourceType: "INT", include: true, target: "x", targetType: "" },
    ];
    expect(ingestPlan({ ...emptyIngestDraft, location: "s3://b/k", rawTable: "raw", targetTable: "raw", columns }).problems).toEqual([
      "The cleaned table needs a different name from the raw one.",
      "Two columns have the same name.",
    ]);
    expect(ingestPlan({ ...emptyIngestDraft, location: "s3://b/k", rawTable: "raw", targetTable: "clean", columns: [{ ...columns[0]!, source: "Order ID", target: "order_id" }] }).dataset).toContain('\\"Order ID\\" AS order_id');
  });
});
