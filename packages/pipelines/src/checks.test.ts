import path from "node:path";
import { create } from "@bufbuild/protobuf";
import { type Pipelines, draftOf, pipelineDigest } from "@surfaces-ui/data";
import type { Engine } from "@surfaces-ui/engine";
import { createDuckDbEngine } from "@surfaces-ui/engine-duckdb";
import { CheckKind, CheckSeverity, PipelineDraftSchema, type Run, RunSchema, RunState } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type PipelineDefinition, createPipelines, datasetChecks, definitionFromDraft, memoryPipelineStore, memoryRunStore, selectDatasets } from "./index.js";

const lake = path.resolve(import.meta.dirname, "../../../fixtures/lake");
let engine: Engine;

const checked: PipelineDefinition = {
  id: "checked",
  sourceId: "lake",
  datasets: [
    {
      name: "c_orders",
      sql: "SELECT order_id, customer, region, status, amount FROM orders WHERE status IS NOT NULL",
      depends: ["orders"],
      grain: "one row per order",
      primaryKey: ["order_id"],
      columns: [{ name: "order_id", type: "INTEGER", description: "The order." }],
      checks: [{ kind: "row_count", min: 1 }],
      tags: ["sales"],
      owner: "data team",
    },
    {
      name: "c_regions",
      sql: "SELECT region, COUNT(*) AS orders FROM c_orders GROUP BY region",
      depends: ["c_orders"],
      primaryKey: ["region"],
      checks: [{ kind: "relationships", columns: ["region"], to: { table: "c_orders", column: "region" } }],
    },
  ],
};
// A key that repeats: one row per order is not one row per region.
const broken: PipelineDefinition = {
  id: "broken",
  sourceId: "lake",
  datasets: [
    { name: "b_status", sql: "SELECT region, status FROM orders", depends: ["orders"], primaryKey: ["region"] },
    { name: "b_after", sql: "SELECT COUNT(*) AS n FROM b_status", depends: ["b_status"] },
    { name: "b_warned", sql: "SELECT status FROM orders", depends: ["orders"], checks: [{ kind: "accepted_values", columns: ["status"], values: ["nothing"], severity: "warn" }] },
  ],
};

beforeAll(async () => {
  engine = await createDuckDbEngine({ tables: [{ name: "orders", format: "parquet", path: `${lake}/orders.parquet` }] });
}, 120_000);
afterAll(() => engine?.close());

const finish = async (pipelines: Pipelines, pipelineId: string, run: Run): Promise<Run> => {
  for (let i = 0; i < 300; i++) {
    const current = (await pipelines.getRun({ pipelineId, runId: run.id })).run!;
    if (current.state !== RunState.RUNNING) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("the run did not finish");
};

describe("selection", () => {
  const inputs = new Map([
    ["raw", ["orders"]],
    ["clean", ["raw"]],
    ["daily", ["clean"]],
    ["other", ["orders"]],
  ]);
  it("selects a dataset alone, with what reads it, with what it reads, or both", () => {
    expect([...selectDatasets(["clean"], inputs).selected]).toEqual(["clean"]);
    expect([...selectDatasets(["clean+"], inputs).selected].sort()).toEqual(["clean", "daily"]);
    expect([...selectDatasets(["+clean"], inputs).selected].sort()).toEqual(["clean", "raw"]);
    expect([...selectDatasets(["+CLEAN+"], inputs).selected].sort()).toEqual(["clean", "daily", "raw"]);
    expect(selectDatasets(["nope+"], inputs).unknown).toEqual(["nope"]);
  });

  it("adds a unique and a not-null check for a primary key, unless the dataset has its own", () => {
    expect(datasetChecks({ name: "t", sql: "", primaryKey: ["a", "b"] }).map((c) => [c.kind, c.columns, c.implied])).toEqual([
      ["unique", ["a", "b"], true],
      ["not_null", ["a"], true],
      ["not_null", ["b"], true],
    ]);
    expect(datasetChecks({ name: "t", sql: "", primaryKey: ["a"], checks: [{ kind: "unique", columns: ["a"], severity: "warn" }] }).map((c) => [c.kind, c.severity, c.implied])).toEqual([
      ["not_null", undefined, true],
      ["unique", "warn", undefined],
    ]);
  });
});

describe("checks", () => {
  it("describes declared inputs, grain, key, columns and checks", async () => {
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine });
    const { pipeline } = await pipelines.getPipeline({ id: "checked" });
    const orders = pipeline!.datasets.find((d) => d.name === "c_orders")!;
    expect(orders).toMatchObject({ inputs: ["orders"], inputsDeclared: true, grain: "one row per order", primaryKey: ["order_id"], tags: ["sales"], owner: "data team" });
    expect(orders.columns[0]).toMatchObject({ name: "order_id", description: "The order." });
    expect(orders.checks.map((c) => [c.name, c.kind, c.implied])).toEqual([
      ["unique_order_id", CheckKind.UNIQUE, true],
      ["not_null_order_id", CheckKind.NOT_NULL, true],
      ["row_count", CheckKind.ROW_COUNT, false],
    ]);
    expect(pipeline!.canSave).toBe(false);
  });

  it("runs every check after a build and keeps counts, never values", async () => {
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine });
    const run = await finish(pipelines, "checked", (await pipelines.startRun({ pipelineId: "checked", trigger: "cli", startedBy: "ci" })).run!);
    expect(run).toMatchObject({ state: RunState.COMPLETED, trigger: "cli", startedBy: "ci" });
    const orders = run.datasetRuns[0]!;
    expect(orders.checks.map((c) => [c.name, c.failedRecords])).toEqual([
      ["unique_order_id", 0n],
      ["not_null_order_id", 0n],
      ["row_count", 0n],
    ]);
    expect(orders.checks[2]!.summary).toMatch(/^[\d,]+ rows\.$/);
    expect(orders.checks[0]!.failingRowsSql).toContain('HAVING COUNT(*) > 1');
    const { pipeline } = await pipelines.getPipeline({ id: "checked" });
    expect(pipeline!.datasets.find((d) => d.name === "c_orders")).toMatchObject({ state: RunState.COMPLETED, lastRunId: run.id, builtAt: run.endTime });
  });

  it("fails a dataset whose key repeats, skips what reads it, and only reports a warning", async () => {
    const pipelines = await createPipelines({ pipelines: [broken], engineOf: () => engine });
    const run = await finish(pipelines, "broken", (await pipelines.startRun({ pipelineId: "broken" })).run!);
    expect(run.state).toBe(RunState.FAILED);
    expect(run.datasetRuns.map((d) => [d.name, d.state])).toEqual([
      ["b_status", RunState.FAILED],
      ["b_after", RunState.SKIPPED],
      ["b_warned", RunState.COMPLETED],
    ]);
    const status = run.datasetRuns[0]!;
    expect(status.errorMessage).toMatch(/^Built, but the check unique_region failed: [\d,]+ rows share region with another row\.$/);
    expect(status.rowsWritten).toBeGreaterThan(0n);
    const warned = run.datasetRuns[2]!.checks[0]!;
    expect(warned).toMatchObject({ name: "accepted_values_status", severity: CheckSeverity.WARN });
    expect(warned.failedRecords).toBeGreaterThan(0n);
  });

  it("refuses a declared input or a check target that does not exist", async () => {
    const pipelines = await createPipelines({
      pipelines: [{ id: "bad", sourceId: "lake", datasets: [{ name: "x", sql: "SELECT * FROM orders", depends: ["nowhere"], checks: [{ kind: "relationships", columns: ["region"], to: { table: "missing", column: "region" } }] }] }],
      engineOf: () => engine,
    });
    const run = (await pipelines.startRun({ pipelineId: "bad" })).run!;
    expect(run.state).toBe(RunState.FAILED);
    expect(run.errorMessage).toContain("x says it reads nowhere");
    expect(run.errorMessage).toContain("looks in missing");
  });

  it("runs a selection with what it reads", async () => {
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine });
    const run = await finish(pipelines, "checked", (await pipelines.startRun({ pipelineId: "checked", select: ["+c_regions"] })).run!);
    expect(run.datasetRuns.map((d) => d.name)).toEqual(["c_orders", "c_regions"]);
    const only = await finish(pipelines, "checked", (await pipelines.startRun({ pipelineId: "checked", select: ["c_regions"] })).run!);
    expect(only.datasetRuns.map((d) => d.name)).toEqual(["c_regions"]);
  });
});

describe("history", () => {
  it("keeps runs in a store, so they outlive the process, and marks one cut short", async () => {
    const store = memoryRunStore();
    const first = await createPipelines({ pipelines: [checked], engineOf: () => engine, runs: store });
    const run = await finish(first, "checked", (await first.startRun({ pipelineId: "checked" })).run!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    store.runs.unshift(create(RunSchema, { id: "run-0099", pipelineId: "checked", state: RunState.RUNNING, startTime: "2026-11-15T00:00:00Z" }));

    const second = await createPipelines({ pipelines: [checked], engineOf: () => engine, runs: store });
    const runs = (await second.listRuns({ pipelineId: "checked" })).runs;
    expect(runs.map((r) => r.id)).toEqual(["run-0099", run.id]);
    expect(runs[0]).toMatchObject({ state: RunState.CANCELLED, errorMessage: "The server stopped during this run." });
    expect((await second.getPipeline({ id: "checked" })).pipeline!.datasets.find((d) => d.name === "c_orders")!.lastRunId).toBe(run.id);
    // New runs carry on from the highest number kept.
    expect((await second.startRun({ pipelineId: "checked", dryRun: true })).run!.id).toBe("run-0100");
  });
});

describe("saves", () => {
  const draft = create(PipelineDraftSchema, {
    id: "proposed",
    name: "Proposed",
    sourceId: "lake",
    datasets: [{ name: "p_regions", sql: "SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region", inputs: ["orders"], primaryKey: ["region"], grain: "one row per region" }],
  });

  it("keeps only a version a person approved, unchanged, against the version it was made on", async () => {
    const store = memoryPipelineStore();
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine, saved: store });
    const digest = await pipelineDigest(draft);
    await expect(pipelines.savePipeline!({ pipeline: draft, expectedVersion: 0, approvedBy: "", approvalDigest: digest })).rejects.toThrow(/who approved/);
    await expect(pipelines.savePipeline!({ pipeline: { ...draft, name: "Changed" }, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest })).rejects.toThrow(/changed after it was approved/);
    await expect(pipelines.savePipeline!({ pipeline: { ...draft, id: "checked" }, expectedVersion: 0, approvedBy: "Ana", approvalDigest: await pipelineDigest({ ...draft, id: "checked" }) })).rejects.toThrow(/config/);

    const { pipeline } = await pipelines.savePipeline!({ pipeline: draft, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest, note: "first" });
    expect(pipeline).toMatchObject({ version: 1, canSave: true });
    await expect(pipelines.savePipeline!({ pipeline: draft, expectedVersion: 0, approvedBy: "Ana", approvalDigest: digest })).rejects.toThrow(/changed since/);
    expect((await pipelines.listPipelineVersions!({ pipelineId: "proposed" })).versions.map((v) => [v.version, v.approvedBy, v.note])).toEqual([[1, "Ana", "first"]]);

    // A save stores; it does not build. The run is its own call.
    expect((await engine.listTables({ catalog: "", schema: "", search: "p_regions" })).length).toBe(0);
    const run = await finish(pipelines, "proposed", (await pipelines.startRun({ pipelineId: "proposed" })).run!);
    expect(run).toMatchObject({ state: RunState.COMPLETED, version: 1 });

    // A new process reads it back.
    const again = await createPipelines({ pipelines: [], engineOf: () => engine, saved: store });
    expect((await again.listPipelines({})).pipelines.map((p) => p.id)).toEqual(["proposed"]);
  });

  it("refuses a draft that writes, even when approved", async () => {
    const pipelines = await createPipelines({ pipelines: [], engineOf: () => engine, saved: memoryPipelineStore() });
    const writes = create(PipelineDraftSchema, { id: "writes", sourceId: "lake", datasets: [{ name: "w", sql: "DELETE FROM orders" }] });
    await expect(pipelines.savePipeline!({ pipeline: writes, expectedVersion: 0, approvedBy: "Ana", approvalDigest: await pipelineDigest(writes) })).rejects.toThrow(/Only queries/);
  });

  it("has no save without a store", async () => {
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine });
    expect(pipelines.savePipeline).toBeUndefined();
  });

  it("round-trips a definition through a draft", async () => {
    const pipelines = await createPipelines({ pipelines: [checked], engineOf: () => engine });
    const back = definitionFromDraft(draftOf((await pipelines.getPipeline({ id: "checked" })).pipeline!));
    expect(back).toEqual(checked);
  });
});

