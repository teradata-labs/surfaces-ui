import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memorySemantics, semanticModelProblems, datasetStanding } from "@surfaces-ui/data";
import { CheckKind, CheckSeverity, DatasetKind, RefreshKind, RunState } from "@surfaces-ui/proto";
import { describe, expect, it, vi } from "vitest";
import { dbtPipelines } from "./index.js";
import { targetDir } from "./node.js";
import { readArtifacts } from "./artifacts.js";
import { semanticModelsFromDbt } from "./semantic.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const read = targetDir(FIXTURES);

describe("a dbt project as a pipeline", () => {
  it("reads datasets, what each reads, keys, columns and tests from the manifest", async () => {
    const pipelines = dbtPipelines({ sourceId: "warehouse", read });
    const { pipeline } = await pipelines.getPipeline({ id: "jaffle_shop" });
    expect(pipeline?.summary).toMatchObject({ id: "jaffle_shop", name: "jaffle_shop", sourceId: "warehouse", datasetCount: 7 });
    expect(pipeline).toMatchObject({ canBuild: false, canSave: false, externalRuns: true, recomputeOnly: false });
    expect(pipeline?.datasets.map((d) => d.name)).toEqual(["raw.customers", "raw.orders", "country_codes", "stg_customers", "stg_orders", "customers", "orders"]);

    const orders = pipeline!.datasets.find((d) => d.name === "orders")!;
    expect(orders).toMatchObject({
      kind: DatasetKind.TABLE,
      relation: "analytics.orders",
      inputs: ["stg_orders", "customers"],
      inputsDeclared: true,
      grain: "One order.",
      primaryKey: ["order_id"],
      owner: "Finance analytics",
      tags: ["finance"],
      sql: 'select * from "warehouse"."staging"."stg_orders"',
    });
    // Types from the catalog, in the warehouse's order, under the project's names and descriptions.
    expect(orders.columns.map((c) => [c.name, c.type, c.description])).toEqual([
      ["order_id", "INTEGER", "The order."],
      ["customer_id", "INTEGER", "Who ordered."],
      ["ordered_at", "TIMESTAMP", "When."],
      ["status", "VARCHAR", "Where it is."],
      ["amount", "DECIMAL(10,2)", "What it cost."],
    ]);
    expect(orders.checks.map((c) => [c.kind, c.columns.join(","), c.severity])).toEqual([
      [CheckKind.UNIQUE, "order_id", CheckSeverity.FAIL],
      [CheckKind.NOT_NULL, "order_id", CheckSeverity.FAIL],
      [CheckKind.RELATIONSHIPS, "customer_id", CheckSeverity.FAIL],
      [CheckKind.ACCEPTED_VALUES, "status", CheckSeverity.WARN],
      [CheckKind.UNSPECIFIED, "", CheckSeverity.FAIL],
    ]);
    expect(orders.checks[2]).toMatchObject({ toTable: "customers", toColumn: "customer_id" });
    expect(orders.checks[3]?.values).toEqual(["placed", "shipped", "completed", "returned"]);
    expect(orders.checks[4]?.description).toBe("No order has a negative amount.");

    const stg = pipeline!.datasets.find((d) => d.name === "stg_orders")!;
    expect(stg).toMatchObject({ kind: DatasetKind.VIEW, relation: "staging.stg_orders" });
    const customers = pipeline!.datasets.find((d) => d.name === "customers")!;
    expect(customers.primaryKey).toEqual(["customer_id"]);
    expect(customers.checks.at(-1)).toMatchObject({ kind: CheckKind.UNSPECIFIED, description: "dbt_utils.expression_is_true: lifetime_value >= 0" });
    const raw = pipeline!.datasets.find((d) => d.name === "raw.orders")!;
    expect(raw).toMatchObject({ kind: DatasetKind.SOURCE, relation: "raw.orders" });
    expect(raw.checks[0]).toMatchObject({ name: "freshness", description: "Loaded recently, by _loaded_at: warns after 12 hours, fails after 24 hours." });
  });

  it("reports dbt's runs: what was built, test results as counts, and source freshness", async () => {
    const pipelines = dbtPipelines({ sourceId: "warehouse", read });
    const { runs } = await pipelines.listRuns({ pipelineId: "jaffle_shop" });
    expect(runs.map((r) => [r.id, r.startedBy, r.state])).toEqual([
      ["inv-2", "dbt build", RunState.COMPLETED],
      ["inv-1", "dbt source freshness", RunState.FAILED],
    ]);
    const build = runs[0]!;
    const orders = build.datasetRuns.find((d) => d.name === "orders")!;
    expect(orders).toMatchObject({ state: RunState.COMPLETED, rowsWritten: 99n });
    expect(orders.checks.find((c) => c.name.startsWith("accepted_values"))).toMatchObject({ failedRecords: 2n, severity: CheckSeverity.WARN, summary: "2 rows break it (a warning)." });
    expect(runs[1]!.datasetRuns[0]?.checks[0]).toMatchObject({ name: "freshness", failedRecords: 1n, summary: "Last loaded 30 hours ago; warns after 12 hours, fails after 24 hours." });

    const { pipeline } = await pipelines.getPipeline({ id: "jaffle_shop" });
    const dataset = pipeline!.datasets.find((d) => d.name === "orders")!;
    expect(dataset).toMatchObject({ state: RunState.COMPLETED, builtAt: "2026-11-14T06:05:00Z", lastRunId: "inv-2" });
    const standing = datasetStanding(pipeline!, "orders", build)!;
    expect(standing).toMatchObject({ built: true, failing: 0, warnings: 1, keyChecked: true });
    expect(standing.summary).toMatch(/^Built by the pipeline jaffle_shop on 2026-11-14 06:05 UTC; 1 warning among 5 checks, none failing/);
  });

  it("takes what one row is from the primary entity of a semantic model when the model's meta does not say", async () => {
    // The same project with no meta grain anywhere.
    const withoutGrain: typeof read = async (file) => {
      const text = await read(file);
      if (file !== "manifest.json" || !text) return text;
      const manifest = JSON.parse(text);
      for (const node of Object.values(manifest.nodes) as { meta?: { grain?: string }; config?: { meta?: { grain?: string } } }[]) {
        delete node.meta?.grain;
        delete node.config?.meta?.grain;
      }
      return JSON.stringify(manifest);
    };
    const { pipeline } = await dbtPipelines({ sourceId: "warehouse", read: withoutGrain }).getPipeline({ id: "jaffle_shop" });
    expect(pipeline?.datasets.find((d) => d.name === "orders")?.grain).toBe("One order.");
    // A model no semantic model reads says nothing rather than guess.
    expect(pipeline?.datasets.find((d) => d.name === "customers")?.grain).toBe("");
  });

  it("builds nothing without dbt, and nothing can be saved", async () => {
    const pipelines = dbtPipelines({ sourceId: "warehouse", read });
    await expect(pipelines.startRun({ pipelineId: "jaffle_shop" })).rejects.toThrow(/built by dbt itself/);
    expect(pipelines.savePipeline).toBeUndefined();
    await expect(pipelines.getPipeline({ id: "other" })).rejects.toThrow(/No pipeline/);
  });
});

describe("dbt build, on request", () => {
  const project = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "surfaces-dbt-"));
    await cp(FIXTURES, dir, { recursive: true });
    return dir;
  };

  it("runs dbt itself with the project's own names, and takes in what it reports", async () => {
    const dir = await project();
    const invoke = vi.fn(async (args: string[]) => {
      // dbt writes a new run_results.json for its invocation.
      const results = JSON.parse(await readFile(path.join(dir, "run_results.json"), "utf8"));
      results.metadata.invocation_id = "inv-3";
      results.metadata.generated_at = "2026-11-15T09:00:00Z";
      results.results = results.results.filter((r: { unique_id: string }) => r.unique_id.includes("orders"));
      await writeFile(path.join(dir, "run_results.json"), JSON.stringify(results));
      return { exitCode: args[0] === "build" ? 0 : 1 };
    });
    const onFinished = vi.fn();
    const pipelines = dbtPipelines({ sourceId: "warehouse", read: targetDir(dir), invoke, onFinished, now: () => new Date("2026-11-15T09:00:00Z") });
    expect((await pipelines.getPipeline({ id: "jaffle_shop" })).pipeline?.canBuild).toBe(true);

    const { run } = await pipelines.startRun({ pipelineId: "jaffle_shop", select: ["stg_orders+"], trigger: "agent", startedBy: "the analytics agent" });
    expect(run).toMatchObject({ state: RunState.RUNNING, trigger: "agent", startedBy: "the analytics agent", datasets: ["stg_orders+"] });
    await vi.waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(invoke.mock.calls[0]![0]).toEqual(["build", "--select", "stg_orders+"]);
    const done = (await pipelines.getRun({ pipelineId: "jaffle_shop", runId: run!.id })).run!;
    expect(done).toMatchObject({ state: RunState.COMPLETED, startedBy: "the analytics agent" });
    expect(done.datasetRuns.map((d) => d.name).sort()).toEqual(["orders", "stg_orders"]);
    // dbt's own record of that invocation is not listed a second time.
    expect((await pipelines.listRuns({ pipelineId: "jaffle_shop" })).runs.map((r) => r.id)).toEqual([run!.id, "inv-2", "inv-1"]);
  });

  it("refuses a name that is not the project's, and a full refresh not confirmed", async () => {
    const invoke = vi.fn(async () => ({ exitCode: 0 }));
    const pipelines = dbtPipelines({ sourceId: "warehouse", read, invoke });
    await expect(pipelines.startRun({ pipelineId: "jaffle_shop", select: ["--vars"] })).rejects.toThrow(/not a model, seed or snapshot/);
    await expect(pipelines.startRun({ pipelineId: "jaffle_shop", select: ["raw.orders"] })).rejects.toThrow(/not a model, seed or snapshot/);
    await expect(pipelines.startRun({ pipelineId: "jaffle_shop", refreshKind: RefreshKind.FULL_REFRESH })).rejects.toThrow(/Confirm it/);
    await pipelines.startRun({ pipelineId: "jaffle_shop", refreshKind: RefreshKind.FULL_REFRESH, confirmFullRefresh: true, datasets: ["orders"] });
    await pipelines.startRun({ pipelineId: "jaffle_shop", dryRun: true });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls.map((c) => (c as unknown as [string[]])[0])).toEqual([["build", "--select", "orders+", "--full-refresh"], ["compile"]]);
  });
});

describe("dbt's semantic layer", () => {
  it("becomes models on the dbt datasets, leaving out what has no form here", async () => {
    const artifacts = await readArtifacts(read);
    const { models, skipped } = semanticModelsFromDbt(artifacts, { sourceId: "warehouse" });
    expect(models).toHaveLength(1);
    const orders = models[0]!;
    expect(orders).toMatchObject({ name: "orders", sourceId: "warehouse", sql: "SELECT * FROM analytics.orders", grain: "One order.", primaryKey: ["order_id"], dataset: { pipelineId: "jaffle_shop", dataset: "orders" } });
    expect(orders.dimensions?.map((d) => [d.name, d.kind, d.grain ?? ""])).toEqual([
      ["ordered_at", 2, "day"],
      ["status", 1, ""],
      ["customer", 1, ""],
    ]);
    expect(orders.measures?.map((m) => m.name)).toEqual(["order_total", "order_count", "customers_with_orders", "median_order"]);
    expect(orders.metrics?.map((m) => [m.name, m.expression])).toEqual([
      ["revenue", "order_total"],
      ["orders", "order_count"],
      ["customers", "customers_with_orders"],
      ["average_order_value", "(order_total) / (order_count)"],
      ["revenue_per_customer", "(order_total) / (customers_with_orders)"],
    ]);
    expect(skipped).toEqual([
      "orders.is_large is worked out by an expression (amount > 100); add it as a column of the dbt model to use it here.",
      "orders.p90_order uses the aggregate percentile, which has no form here.",
      "large_revenue has a filter, which a metric here cannot hold.",
      "cumulative_revenue is a cumulative metric, which has no form here.",
    ]);
    expect(semanticModelProblems(orders, { isNew: true })).toEqual([]);
    // A store takes them as starter models.
    const semantics = memorySemantics({ models });
    expect((await semantics.getSemanticModel({ name: "orders" })).model?.version).toBe(1);
  });
});
