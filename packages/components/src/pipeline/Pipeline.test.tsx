// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpectationsPanel, type PipelineEdge, PipelineGraph, type PipelineNode, RunHistory, SchemaDiff, StreamMetrics, durationText, layoutPipeline, lineageOf, sparkline } from "./Pipeline.js";

afterEach(cleanup);

const nodes: PipelineNode[] = [
  { id: "files", name: "landing files", kind: "source" },
  { id: "raw", name: "orders_raw", kind: "streamingTable", layer: "bronze", status: "completed", rowsWritten: 12000 },
  { id: "clean", name: "orders_clean", kind: "streamingTable", layer: "silver", status: "failed", expectationsFailed: 40 },
  { id: "customers", name: "customers", kind: "materializedView", layer: "silver", status: "completed" },
  { id: "daily", name: "daily_revenue", kind: "materializedView", layer: "gold", status: "skipped" },
];
const edges: PipelineEdge[] = [
  { from: "files", to: "raw", mode: "streaming" },
  { from: "raw", to: "clean", mode: "streaming" },
  { from: "clean", to: "daily" },
  { from: "customers", to: "daily" },
];

describe("PipelineGraph", () => {
  it("lays nodes out by what feeds them and survives a cycle", () => {
    const layout = layoutPipeline(nodes, edges);
    expect(Object.fromEntries(Object.entries(layout.positions).map(([id, p]) => [id, p.column]))).toEqual({ files: 0, raw: 1, clean: 2, customers: 0, daily: 3 });
    expect(layoutPipeline(nodes.slice(0, 2), [{ from: "files", to: "raw" }, { from: "raw", to: "files" }]).positions.raw).toBeTruthy();
    expect([...lineageOf("clean", edges)].sort()).toEqual(["clean", "daily", "files", "raw"]);
  });

  it("names each node with its kind, status and what it feeds, and dims what is unrelated to the selection", () => {
    const onSelect = vi.fn();
    render(<PipelineGraph nodes={nodes} edges={edges} selected="clean" onSelect={onSelect} />);
    const clean = screen.getByRole("button", { name: "orders_clean (Streaming table, failed, feeds daily_revenue)" });
    expect(clean.getAttribute("aria-pressed")).toBe("true");
    expect(clean.textContent).toContain("40 records broke rules");
    expect(screen.getByRole("button", { name: /^customers/ }).hasAttribute("data-dim")).toBe(true);
    expect(screen.getByRole("button", { name: /^orders_raw/ }).hasAttribute("data-dim")).toBe(false);
    expect(document.querySelectorAll('path[data-mode="streaming"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^daily_revenue/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "daily" }));
  });
});

describe("pipeline panels", () => {
  it("lists runs newest first with how they ended", () => {
    const onSelect = vi.fn();
    render(
      <RunHistory
        onSelect={onSelect}
        runs={[
          { id: "u1", state: "completed", startTime: "2026-11-10T02:00:00Z", endTime: "2026-11-10T02:01:05Z", trigger: "schedule" },
          { id: "u2", state: "failed", startTime: "2026-11-11T02:00:00Z", endTime: "2026-11-11T02:00:20Z", refreshKind: "fullRefresh", datasets: ["orders_clean"], errorMessage: "Expectation valid_amount failed" },
        ]}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getByRole("rowheader").textContent)).toEqual(["u2", "u1"]);
    expect(rows[0]!.textContent).toContain("Expectation valid_amount failed");
    expect(rows[0]!.textContent).toContain("Full refresh · 1 dataset");
    expect(rows[1]!.textContent).toContain("1 min 5 s");
    fireEvent.click(screen.getByRole("button", { name: "u1" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
    expect(durationText(3_725_000)).toBe("1 h 2 min");
  });

  it("puts the worst data quality rule first and offers its failing rows", () => {
    const onOpenFailing = vi.fn();
    render(
      <ExpectationsPanel
        onOpenFailing={onOpenFailing}
        expectations={[
          { name: "has_customer", dataset: "orders_clean", constraint: "customer_id IS NOT NULL", action: "warn", passedRecords: 1000, failedRecords: 0 },
          { name: "valid_amount", dataset: "orders_clean", constraint: "amount >= 0", action: "drop", passedRecords: 960, failedRecords: 40 },
        ]}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]!.textContent).toContain("valid_amount");
    expect(rows[0]!.textContent).toContain("Dropped");
    expect(rows[0]!.textContent).toContain("40 of 1,000");
    expect(screen.getByRole("img", { name: "4.0% failing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See failing rows" }));
    expect(onOpenFailing).toHaveBeenCalledWith(expect.objectContaining({ name: "valid_amount" }));
  });

  it("shows schema changes and streaming progress as reported", () => {
    render(
      <>
        <SchemaDiff
          mode="rescue"
          rescuedCount={12}
          changes={[
            { column: "coupon_code", change: "added", after: "string" },
            { column: "amount", change: "typeChanged", before: "int", after: "double" },
          ]}
        />
        <StreamMetrics
          progress={[
            { timestamp: "2026-11-12T10:00:00Z", numInputRows: 500, inputRowsPerSecond: 50, processedRowsPerSecond: 80, batchDurationMs: 900 },
            { timestamp: "2026-11-12T10:00:10Z", numInputRows: 900, inputRowsPerSecond: 90, processedRowsPerSecond: 70, batchDurationMs: 1400 },
          ]}
        />
      </>,
    );
    expect(screen.getByText("New columns: rescue · 12 records had fields set aside")).toBeTruthy();
    expect(screen.getByText("int → double")).toBeTruthy();
    expect(screen.getByText(/Falling behind/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Input rate over the last 2 reports, from 50 to 90" })).toBeTruthy();
    expect(screen.queryByText("Rows in state")).toBeNull();
    expect(sparkline([0, 10])).toBe("0,26 100,2");
  });
});
