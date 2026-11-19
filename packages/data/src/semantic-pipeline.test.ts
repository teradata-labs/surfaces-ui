import { create } from "@bufbuild/protobuf";
import { CheckKind, CheckSeverity, PipelineSchema, RunSchema, RunState } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { semanticModelProblems } from "./semantic.js";
import { datasetSql, datasetStanding, semanticDatasetProblems, semanticModelFromDataset } from "./semantic-pipeline.js";

const pipeline = create(PipelineSchema, {
  summary: { id: "refunds", name: "Refunds", sourceId: "retail" },
  datasets: [
    {
      name: "order_lines_clean",
      description: "One row per order line, with its refund.",
      grain: "One order line.",
      primaryKey: ["line_id"],
      inputs: ["SALES_LINES", "REFUNDS"],
      inputsDeclared: true,
      owner: "data team",
      columns: [
        { name: "line_id", type: "BIGINT", description: "The line." },
        { name: "order_date", type: "DATE" },
        { name: "store", type: "VARCHAR", description: "Where it was sold." },
        { name: "amount", type: "DECIMAL(12,2)" },
        { name: "refund_amount", type: "DECIMAL(12,2)" },
      ],
      checks: [
        { name: "unique_line_id", kind: CheckKind.UNIQUE, columns: ["line_id"], implied: true },
        { name: "not_null_line_id", kind: CheckKind.NOT_NULL, columns: ["line_id"], implied: true },
        { name: "accepted_values_store", kind: CheckKind.ACCEPTED_VALUES, columns: ["store"], severity: CheckSeverity.WARN },
      ],
      state: RunState.COMPLETED,
      builtAt: "2026-11-14T08:30:00Z",
      lastRunId: "run-7",
    },
    { name: "never_built", grain: "One thing.", primaryKey: ["id"] },
  ],
});

const run = create(RunSchema, {
  id: "run-7",
  pipelineId: "refunds",
  state: RunState.COMPLETED,
  datasetRuns: [
    {
      name: "order_lines_clean",
      state: RunState.COMPLETED,
      checks: [
        { name: "unique_line_id", failedRecords: 0n, summary: "No line_id repeats." },
        { name: "not_null_line_id", failedRecords: 0n, summary: "No line_id is empty." },
        { name: "accepted_values_store", severity: CheckSeverity.WARN, failedRecords: 3n, summary: "3 rows have a store not in the list." },
      ],
    },
  ],
});

describe("semantic models from pipeline datasets", () => {
  it("drafts a model that reads the dataset, with its grain, key and columns", () => {
    const model = semanticModelFromDataset(pipeline, "order_lines_clean");
    expect(model).toMatchObject({ name: "order_lines_clean", sourceId: "retail", sql: "SELECT * FROM order_lines_clean", grain: "One order line.", primaryKey: ["line_id"], version: 0 });
    expect(model.dataset).toMatchObject({ pipelineId: "refunds", dataset: "order_lines_clean" });
    expect(model.dimensions.map((d) => d.name)).toEqual(["order_date", "store"]);
    expect(model.dimensions[1]?.description).toBe("Where it was sold.");
    expect(model.measures.map((m) => [m.name, m.format])).toEqual([
      ["amount", "currency"],
      ["refund_amount", "currency"],
      ["row_count", "compact"],
    ]);
    expect(model.measures[0]?.definedBy).toBe("from the pipeline Refunds");
    expect(semanticModelProblems(model, { isNew: true })).toEqual([]);
    expect(semanticDatasetProblems(model, pipeline)).toEqual([]);
    expect(() => semanticModelFromDataset(pipeline, "gone")).toThrow(/no dataset "gone"/);
  });

  it("quotes a dataset name that is not a plain identifier", () => {
    expect(datasetSql("order lines")).toBe('SELECT * FROM "order lines"');
  });

  it("says when it was built, how its checks went and what it reads", () => {
    const standing = datasetStanding(pipeline, "order_lines_clean", run)!;
    expect(standing).toMatchObject({ built: true, state: "completed", failing: 0, warnings: 1, keyChecked: true, inputs: ["SALES_LINES", "REFUNDS"], inputsDeclared: true });
    expect(standing.checks[0]?.name).toBe("accepted_values_store");
    expect(standing.summary).toBe("Built by the pipeline Refunds on 2026-11-14 08:30 UTC; 1 warning among 3 checks, none failing; key line_id checked unique. Reads SALES_LINES, REFUNDS.");
    const never = datasetStanding(pipeline, "never_built")!;
    expect(never).toMatchObject({ built: false, state: "never", keyChecked: false });
    expect(never.summary).toMatch(/^Not built yet by the pipeline Refunds; no check results; key id not checked/);
    expect(datasetStanding(pipeline, "gone")).toBeUndefined();
  });

  it("counts a tool's own unique and not-null tests on the key as checking it", () => {
    const tested = create(PipelineSchema, {
      summary: { id: "shop", name: "shop" },
      datasets: [
        {
          name: "orders",
          primaryKey: ["order_id"],
          builtAt: "2026-11-14T08:30:00Z",
          checks: [
            { name: "unique_orders_order_id", kind: CheckKind.UNIQUE, columns: ["order_id"] },
            { name: "not_null_orders_order_id", kind: CheckKind.NOT_NULL, columns: ["order_id"] },
          ],
        },
      ],
    });
    const passed = (failed: bigint) =>
      create(RunSchema, { id: "r", datasetRuns: [{ name: "orders", checks: [{ name: "unique_orders_order_id", failedRecords: failed }, { name: "not_null_orders_order_id", failedRecords: 0n }] }] });
    expect(datasetStanding(tested, "orders", passed(0n))?.keyChecked).toBe(true);
    expect(datasetStanding(tested, "orders", passed(2n))?.keyChecked).toBe(false);
    const untested = create(PipelineSchema, { ...tested, datasets: [{ ...tested.datasets[0]!, checks: [tested.datasets[0]!.checks[0]!] }] });
    expect(datasetStanding(untested, "orders", passed(0n))?.keyChecked).toBe(false);
  });

  it("finds a model that has drifted from its dataset", () => {
    const model = semanticModelFromDataset(pipeline, "order_lines_clean");
    expect(semanticDatasetProblems({ ...model, primaryKey: ["order_id"], sourceId: "lake", sql: "SELECT * FROM orders" }, pipeline)).toEqual([
      "The dataset lives on the source retail, not lake.",
      "The model's query does not read the dataset order_lines_clean.",
      "The model's key (order_id) is not the dataset's (line_id), which is the one the pipeline checks.",
    ]);
    expect(semanticDatasetProblems(model, undefined)).toEqual(["The pipeline refunds is not there any more."]);
    expect(semanticDatasetProblems({ ...model, dataset: { pipelineId: "refunds", dataset: "gone" } } as never, pipeline)).toEqual(['The pipeline Refunds has no dataset "gone" any more.']);
    expect(semanticModelProblems({ ...model, tables: ["a"], dataset: { pipelineId: "refunds", dataset: "x" } } as never)).toContain("A model from a pipeline dataset reads that dataset, not tables and joins.");
  });
});

describe("a dataset read under another name", () => {
  it("reads its relation, quoting only the parts that need it, and still recognises the query", () => {
    expect(datasetSql({ name: "orders", relation: "analytics.orders" })).toBe("SELECT * FROM analytics.orders");
    expect(datasetSql({ name: "orders", relation: "my db.orders" })).toBe('SELECT * FROM "my db".orders');
    const dbt = create(PipelineSchema, { summary: { id: "jaffle", name: "jaffle_shop", sourceId: "warehouse" }, datasets: [{ name: "orders", relation: "analytics.orders", primaryKey: ["order_id"], grain: "One order." }] });
    const model = semanticModelFromDataset(dbt, "orders");
    expect(model.sql).toBe("SELECT * FROM analytics.orders");
    expect(semanticDatasetProblems(model, dbt)).toEqual([]);
    expect(semanticDatasetProblems({ ...model, sql: "SELECT * FROM analytics.orders_old" }, dbt)).toEqual(["The model's query does not read the dataset orders."]);
  });
});
