import { AggregateFunction, DimensionKind, MetricSchema } from "@surfaces-ui/proto";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { memoryDataSource } from "./memory.js";
import { SemanticModelError, StaleSemanticModelError, memorySemantics, semanticModelDataProblems, semanticModelProblems } from "./semantic.js";
import { draftSemanticModel, semanticKeyProblem } from "./semantic-draft.js";

const sales = {
  name: "sales_lines",
  label: "Sales lines",
  sourceId: "retail",
  sql: "SELECT * FROM sales_lines",
  primaryKey: ["line_id"],
  grain: "One order line.",
  dimensions: [
    { name: "category", label: "Category", column: "category", kind: DimensionKind.CATEGORY },
    { name: "ordered", label: "Ordered", column: "ordered_at", kind: DimensionKind.TIME, grain: "month" },
  ],
  measures: [
    { name: "revenue", label: "Revenue", column: "amount", aggregate: AggregateFunction.SUM, format: "currency" },
    { name: "refunded", label: "Refunded", column: "refund", aggregate: AggregateFunction.SUM, format: "currency" },
  ],
  metrics: [{ name: "refund_rate", label: "Refund rate", expression: "refunded / revenue", format: "percent" }],
};

describe("semanticModelProblems", () => {
  it("accepts a model whose metrics are over its measures", () => {
    expect(semanticModelProblems(sales)).toEqual([]);
  });

  it("says why a model cannot be used", () => {
    const problems = semanticModelProblems({
      ...sales,
      name: "Sales Lines",
      dimensions: [...sales.dimensions, { name: "revenue", column: "x" }],
      measures: [...sales.measures, { name: "avg_price", aggregate: AggregateFunction.AVG }],
      metrics: [{ name: "odd", expression: "refund_rate * 2" }],
    });
    expect(problems.join(" ")).toMatch(/lowercase/);
    expect(problems.join(" ")).toMatch(/"revenue" is used for more than one field/);
    expect(problems.join(" ")).toMatch(/"avg_price" needs a column/);
    // A metric over another metric could loop; only measures are allowed.
    expect(problems.join(" ")).toMatch(/"refund_rate" is not a measure/);
  });

  it("asks a new model for its grain, its key and joins over its own tables", () => {
    const fresh = { ...sales, grain: "", primaryKey: [], tables: ["lines"], joins: [{ left: "lines", right: "stores", keys: [] }] };
    expect(semanticModelProblems(fresh)).toEqual([
      "A join names the table stores, which is not one of the model's tables.",
      "The join of lines and stores needs a column from each.",
    ]);
    const problems = semanticModelProblems(fresh, { isNew: true }).join(" ");
    expect(problems).toMatch(/Say what one row is/);
    expect(problems).toMatch(/columns that make a row unique/);
  });
});

describe("drafting and checking a model against the data", () => {
  const data = memoryDataSource({
    sourceId: "shop",
    tables: {
      lines: [
        { line_id: 1, order_id: 10, store_id: 1, ordered_at: new Date("2026-01-02"), channel: "web", line_amount: 9.5, email: "a@b.c" },
        { line_id: 2, order_id: 10, store_id: 1, ordered_at: new Date("2026-02-02"), channel: "app", line_amount: 3, email: "d@e.f" },
      ],
    },
  });

  it("drafts fields from names and types, leaving out keys and personal data", () => {
    const model = draftSemanticModel({
      name: "lines",
      sourceId: "shop",
      sql: "SELECT * FROM lines",
      grain: "One order line.",
      primaryKey: ["line_id"],
      columns: [
        { name: "line_id", type: "BIGINT" },
        { name: "ordered_at", type: "TIMESTAMP" },
        { name: "channel", type: "VARCHAR" },
        { name: "line_amount", type: "DECIMAL(10,2)" },
        { name: "email", type: "VARCHAR", personal: true },
      ],
    });
    expect(model.dimensions.map((d) => [d.name, d.kind])).toEqual([["ordered_at", DimensionKind.TIME], ["channel", DimensionKind.CATEGORY]]);
    expect(model.measures.map((m) => [m.name, m.format])).toEqual([["line_amount", "currency"], ["row_count", "compact"]]);
    expect(model.measures[1]?.description).toBe("How many rows: one order line.");
    expect(new Set([...model.dimensions, ...model.measures].map((f) => f.definedBy))).toEqual(new Set(["generated from the columns"]));
    expect(semanticModelProblems(model, { isNew: true })).toEqual([]);
  });

  it("asks the engine whether the key is unique, and refuses a key that repeats", async () => {
    expect(await semanticKeyProblem({ sourceId: "shop", sql: "SELECT * FROM lines", primaryKey: ["line_id"] }, data)).toBeUndefined();
    expect(await semanticKeyProblem({ sourceId: "shop", sql: "SELECT * FROM lines", primaryKey: ["order_id"] }, data)).toMatch(/order_id repeats: some rows share it, up to 2 times/);
    expect(await semanticModelDataProblems({ sourceId: "shop", sql: "SELECT * FROM lines", primaryKey: ["missing"] }, data)).toEqual(["The key names missing, which the model's query does not return."]);
  });
});

describe("memorySemantics", () => {
  it("starts from starter models, saves versions and refuses a stale save", async () => {
    const semantics = memorySemantics({ models: [sales] });
    expect((await semantics.listSemanticModels({ sourceId: "retail" })).models.map((m) => [m.name, m.metricCount, m.version])).toEqual([["sales_lines", 1, 1]]);
    expect((await semantics.listSemanticModels({ sourceId: "other" })).models).toEqual([]);

    const { model } = await semantics.getSemanticModel({ name: "sales_lines" });
    const saved = await semantics.saveSemanticModel({ model: { ...model!, metrics: [...model!.metrics, create(MetricSchema, { name: "net", expression: "revenue - refunded", definedBy: "Ana" })], savedBy: "Ana" }, expectedVersion: 1, note: "Added net" });
    expect(saved.model?.version).toBe(2);
    await expect(semantics.saveSemanticModel({ model: model!, expectedVersion: 1 })).rejects.toBeInstanceOf(StaleSemanticModelError);
    // Creating a model under a name already taken says so.
    await expect(semantics.saveSemanticModel({ model: model!, expectedVersion: 0 })).rejects.toThrow(/already a model named "sales_lines"/);
    expect((await semantics.listSemanticModelVersions({ name: "sales_lines" })).versions.map((v) => [v.version, v.note])).toEqual([
      [2, "Added net"],
      [1, "Starter"],
    ]);
    expect((await semantics.getSemanticModel({ name: "sales_lines", version: 1 })).model?.metrics).toHaveLength(1);
  });

  it("refuses a model that does not check, with the backend's own checks too", async () => {
    const semantics = memorySemantics({ check: (m) => (/drop/i.test(m.sql) ? ["Only a single read-only query can define a model."] : []) });
    await expect(semantics.saveSemanticModel({ model: { ...sales, metrics: [{ name: "x", expression: "nope" }] } })).rejects.toBeInstanceOf(SemanticModelError);
    await expect(semantics.saveSemanticModel({ model: { ...sales, sql: "DROP TABLE t" } })).rejects.toThrow(/read-only/);
  });

  it("keeps models in storage and reads them back", async () => {
    let kept: string | undefined;
    const storage = { load: () => kept, save: (_: string, value: string) => void (kept = value) };
    await memorySemantics({ storage }).saveSemanticModel({ model: sales });
    const again = memorySemantics({ storage });
    expect((await again.getSemanticModel({ name: "sales_lines" })).model?.metrics[0]?.expression).toBe("refunded / revenue");
  });
});
