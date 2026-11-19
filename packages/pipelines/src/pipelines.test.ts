import path from "node:path";
import type { Pipelines } from "@surfaces-ui/data";
import type { Engine } from "@surfaces-ui/engine";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { ExpectationAction, RefreshKind, type Run, RunState, TableFormat } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type PipelineDefinition, buildOrder, createPipelines, referencedNames } from "./index.js";

const lake = path.resolve(import.meta.dirname, "../../../fixtures/lake");
let engine: Engine;
let pipelines: Pipelines;

const sales: PipelineDefinition = {
  id: "sales",
  name: "Sales",
  sourceId: "lake",
  datasets: [
    { name: "daily_revenue", layer: "gold", sql: "SELECT CAST(ordered_at AS DATE) AS day, SUM(amount) AS revenue FROM orders_clean GROUP BY 1" },
    {
      name: "orders_clean",
      layer: "silver",
      sql: "SELECT * FROM orders_raw",
      expectations: [
        { name: "has_status", constraint: "status IS NOT NULL", action: "drop" },
        { name: "big_enough", constraint: "amount >= 1", action: "warn" },
      ],
    },
    { name: "orders_raw", layer: "bronze", sql: "SELECT * FROM orders -- not 'customers'" },
    { name: "top_regions", kind: "view", layer: "gold", sql: "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region" },
  ],
};
const strict: PipelineDefinition = {
  id: "strict",
  sourceId: "lake",
  datasets: [
    { name: "strict_orders", sql: "SELECT * FROM orders", expectations: [{ name: "never_null", constraint: "status IS NOT NULL", action: "fail" }] },
    { name: "strict_summary", sql: "SELECT COUNT(*) AS n FROM strict_orders" },
  ],
};

beforeAll(async () => {
  engine = await createDuckDbEngine({ tables: [{ name: "orders", format: "parquet", path: `${lake}/orders.parquet` }] });
  pipelines = await createPipelines({
    pipelines: [sales, strict, { id: "loop", sourceId: "lake", datasets: [{ name: "a", sql: "SELECT * FROM b" }, { name: "b", sql: "SELECT * FROM a" }] }, { id: "writes", sourceId: "lake", datasets: [{ name: "x", sql: "DROP TABLE orders" }] }],
    engineOf: (id) => (id === "lake" ? engine : undefined),
  });
}, 120_000);
afterAll(() => engine?.close());

const finish = async (pipelineId: string, run: Run): Promise<Run> => {
  for (let i = 0; i < 200; i++) {
    const current = (await pipelines.getRun({ pipelineId, runId: run.id })).run!;
    if (current.state !== RunState.RUNNING) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("the run did not finish");
};
const count = async (sql: string) => {
  const result = await engine.execute(sql, []);
  let n = 0;
  for await (const batch of result.batches) n = Number(batch.getChildAt(0)?.get(0));
  return n;
};

describe("graph", () => {
  it("finds what a query reads, ignoring text and comments, and orders datasets", () => {
    expect(referencedNames("SELECT * FROM orders o JOIN regions r ON 1=1 WHERE note = 'customers' -- products", ["orders", "customers", "regions", "products", "order"])).toEqual(["orders", "regions"]);
    expect(buildOrder(new Map([["c", ["b"]], ["a", []], ["b", ["a"]]]))).toEqual(["a", "b", "c"]);
    expect(() => buildOrder(new Map([["a", ["b"]], ["b", ["a"]]]))).toThrow("a → b → a");
  });

  it("describes a pipeline with its sources and dependencies", async () => {
    const { pipeline } = await pipelines.getPipeline({ id: "sales" });
    expect(pipeline!.recomputeOnly).toBe(true);
    expect(pipeline!.datasets.map((d) => [d.name, d.inputs])).toEqual([
      ["orders", []],
      ["orders_raw", ["orders"]],
      ["orders_clean", ["orders_raw"]],
      ["daily_revenue", ["orders_clean"]],
      ["top_regions", ["orders_clean"]],
    ]);
    expect((await pipelines.listPipelines({})).pipelines.map((p) => [p.id, p.datasetCount])).toContainEqual(["sales", 4]);
  });
});

describe("runs", () => {
  it("builds every dataset in order, applies rules, and makes the tables queryable", async () => {
    const started = (await pipelines.startRun({ pipelineId: "sales" })).run!;
    const run = await finish("sales", started);
    expect(run.state).toBe(RunState.COMPLETED);
    expect(run.datasetRuns.map((d) => [d.name, d.state])).toEqual([
      ["orders_raw", RunState.COMPLETED],
      ["orders_clean", RunState.COMPLETED],
      ["daily_revenue", RunState.COMPLETED],
      ["top_regions", RunState.COMPLETED],
    ]);
    const clean = run.datasetRuns[1]!;
    const withoutStatus = await count("SELECT COUNT(*) FROM orders WHERE status IS NULL");
    expect(withoutStatus).toBeGreaterThan(0);
    expect(clean.expectations[0]).toMatchObject({ name: "has_status", action: ExpectationAction.DROP, failedRecords: BigInt(withoutStatus) });
    // Dropped records are left out; warned ones are kept.
    expect(clean.rowsWritten).toBe(BigInt(5000 - withoutStatus));
    expect(await count("SELECT COUNT(*) FROM orders_clean WHERE status IS NULL")).toBe(0);
    expect(await count("SELECT COUNT(*) FROM top_regions")).toBeGreaterThan(0);

    const listed = (await engine.listTables({ catalog: "", schema: "", search: "" })).map((t) => t.ref?.table);
    expect(listed).toEqual(expect.arrayContaining(["orders", "daily_revenue", "orders_clean", "orders_raw", "top_regions"]));
    const detail = await engine.describeTable({ table: "daily_revenue" } as never, true);
    expect(detail.columns?.map((c) => c.name)).toEqual(["day", "revenue"]);
    expect((await pipelines.getPipeline({ id: "sales" })).pipeline!.datasets.find((d) => d.name === "orders_raw")).toMatchObject({ state: RunState.COMPLETED, rowsWritten: 5000n });
  });

  it("rebuilds a chosen dataset and what depends on it, and asks before a full refresh", async () => {
    const run = await finish("sales", (await pipelines.startRun({ pipelineId: "sales", datasets: ["orders_clean"], refreshKind: RefreshKind.REFRESH })).run!);
    expect(run.datasetRuns.map((d) => d.name)).toEqual(["orders_clean", "daily_revenue", "top_regions"]);
    await expect(pipelines.startRun({ pipelineId: "sales", refreshKind: RefreshKind.FULL_REFRESH })).rejects.toThrow(/Confirm/);
    const full = await finish("sales", (await pipelines.startRun({ pipelineId: "sales", refreshKind: RefreshKind.FULL_REFRESH, confirmFullRefresh: true })).run!);
    expect(full.state).toBe(RunState.COMPLETED);
    expect((await pipelines.listRuns({ pipelineId: "sales" })).runs.map((r) => r.id)).toEqual([full.id, run.id, expect.any(String)]);
  });

  it("stops at a rule that fails the run and skips what depends on it", async () => {
    const run = await finish("strict", (await pipelines.startRun({ pipelineId: "strict" })).run!);
    expect(run.state).toBe(RunState.FAILED);
    expect(run.errorMessage).toMatch(/strict_orders: \d+ records broke the rule never_null/);
    expect(run.datasetRuns.map((d) => d.state)).toEqual([RunState.FAILED, RunState.SKIPPED]);
    expect((await engine.listTables({ catalog: "", schema: "", search: "strict" })).length).toBe(0);
  });

  it("checks a pipeline without building it, and refuses circles and anything that is not a query", async () => {
    const dry = (await pipelines.startRun({ pipelineId: "sales", dryRun: true })).run!;
    expect(dry).toMatchObject({ state: RunState.COMPLETED, dryRun: true, datasetRuns: [] });
    expect((await pipelines.startRun({ pipelineId: "loop" })).run).toMatchObject({ state: RunState.FAILED, errorMessage: expect.stringContaining("circle") });
    expect((await pipelines.startRun({ pipelineId: "writes" })).run).toMatchObject({ state: RunState.FAILED, errorMessage: expect.stringContaining("Only queries") });
    expect((await pipelines.startRun({ pipelineId: "sales", datasets: ["nope"] })).run!.errorMessage).toBe("There is no dataset called nope.");
    expect(await count("SELECT COUNT(*) FROM orders")).toBe(5000);
  });
});

describe("ingest", () => {
  it("reads the schema of files the source may reach, and nothing else", async () => {
    const found = await pipelines.inspectFiles({ sourceId: "lake", format: TableFormat.PARQUET, location: `${lake}/orders.parquet` });
    expect(found.columns.map((c) => c.name)).toEqual(["order_id", "customer", "region", "status", "amount", "quantity", "ordered_at"]);
    expect(found.rowCount).toBe(5000n);
    await expect(pipelines.inspectFiles({ sourceId: "lake", format: TableFormat.CSV, location: "/etc/passwd" })).rejects.toThrow(/disabled|Permission/i);
    await expect(pipelines.inspectFiles({ sourceId: "lake", format: TableFormat.PARQUET, location: "orders.parquet" })).rejects.toThrow(/full path/);
  });
});
