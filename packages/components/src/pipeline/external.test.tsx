// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { CheckKind, CheckSeverity, DatasetKind, PipelineSchema, RunSchema, RunState } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChecksPanel } from "./Pipeline.js";
import { checkOutcomes, pipelineGraph } from "./PipelineView.js";

afterEach(cleanup);

const datasets = [
  {
    name: "orders",
    kind: DatasetKind.TABLE,
    checks: [
      { name: "unique_order_id", kind: CheckKind.UNIQUE, columns: ["order_id"] },
      { name: "status_known", kind: CheckKind.ACCEPTED_VALUES, columns: ["status"], severity: CheckSeverity.WARN },
      { name: "amount_positive", kind: CheckKind.UNSPECIFIED, description: "No order has a negative amount." },
    ],
  },
  { name: "empty_table", kind: DatasetKind.TABLE },
];
const run = create(RunSchema, {
  id: "inv-1",
  state: RunState.COMPLETED,
  datasetRuns: [
    {
      name: "orders",
      state: RunState.COMPLETED,
      // dbt-duckdb reports no row count for a table it builds.
      rowsWritten: 0n,
      checks: [
        { name: "unique_order_id", failedRecords: 0n },
        { name: "status_known", severity: CheckSeverity.WARN, failedRecords: 2n, summary: "2 rows break it (a warning).", failingRowsSql: "select status from orders where status not in ('placed')" },
        { name: "amount_positive", severity: CheckSeverity.FAIL, failedRecords: 1n, summary: "1 row breaks it." },
      ],
    },
    { name: "empty_table", state: RunState.COMPLETED, rowsWritten: 0n },
  ],
});

describe("a pipeline another tool builds", () => {
  it("counts warnings apart from failing checks, and says nothing of rows it was not told about", () => {
    const external = create(PipelineSchema, { summary: { id: "shop" }, externalRuns: true, datasets });
    const orders = pipelineGraph(external, run).nodes.find((n) => n.id === "orders")!;
    expect(orders).toMatchObject({ checksFailed: 1, checksWarned: 1 });
    expect(orders.rowsWritten).toBeUndefined();
    // A pipeline built here reports what it wrote, none included.
    const own = create(PipelineSchema, { summary: { id: "shop" }, datasets });
    expect(pipelineGraph(own, run).nodes.find((n) => n.id === "empty_table")?.rowsWritten).toBe(0);
  });

  it("offers the rows that break a check only when there is a query for them", () => {
    const pipeline = create(PipelineSchema, { summary: { id: "shop" }, externalRuns: true, datasets });
    const outcomes = checkOutcomes(pipeline.datasets[0]!, run);
    expect(outcomes.map((o) => [o.name, o.canOpenFailing])).toEqual([
      ["unique_order_id", false],
      ["status_known", true],
      ["amount_positive", false],
    ]);
    expect(outcomes[2]?.description).toBe("No order has a negative amount.");
    const open = vi.fn();
    render(<ChecksPanel checks={outcomes} onOpenFailing={open} />);
    const buttons = screen.getAllByRole("button", { name: "See what breaks it" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(open.mock.calls[0]?.[0]).toMatchObject({ name: "status_known" });
  });
});
