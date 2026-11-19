import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { semanticModelJson } from "@surfaces-ui/data";
import { create } from "@bufbuild/protobuf";
import { AggregateFunction, SemanticModelSchema } from "@surfaces-ui/proto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { type SurfacesConfig, serverOptions } from "./config.js";

// The dbt package's own fixtures: a jaffle_shop-like project with a semantic model named "orders".
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "pipelines-dbt", "fixtures");
const store = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-dbt-"));
afterAll(() => fs.rmSync(store, { recursive: true, force: true }));

const taken = create(SemanticModelSchema, {
  name: "orders",
  label: "Orders",
  sourceId: "retail",
  sql: "SELECT * FROM orders",
  grain: "One order.",
  primaryKey: ["order_id"],
  measures: [{ name: "amount", column: "amount", aggregate: AggregateFunction.SUM }],
});

const config = (dbt: SurfacesConfig["dbt"], models = [semanticModelJson(taken)]): SurfacesConfig => ({
  sources: [],
  discovery: { storeDir: path.join(store, String(Math.random()).slice(2)) },
  semantic: { models },
  dbt,
});

describe("dbt projects in the dev server", () => {
  it("serves the project beside the reference runner, reading its tables under the source's name for dbt's database", async () => {
    const options = await serverOptions(config([{ sourceId: "warehouse", targetDir: FIXTURES, relationPrefix: "wh" }]), [], store);
    const [dbt] = options.externalPipelines?.({ onFinished: () => {} }) ?? [];
    const { pipeline } = await dbt!.getPipeline({ id: "jaffle_shop" });
    expect(pipeline?.datasets.find((d) => d.name === "orders")?.relation).toBe("wh.analytics.orders");
    // Read only without a project directory to build in.
    expect(pipeline?.canBuild).toBe(false);
  });

  it("renames a dbt semantic model whose name is taken after its project, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const options = await serverOptions(config([{ sourceId: "warehouse", targetDir: FIXTURES, relationPrefix: "wh" }]), [], store);
    const { models } = await options.semantics!.listSemanticModels({});
    expect(models.map((m) => m.name).sort()).toEqual(["jaffle_shop_orders", "orders"]);
    const { model } = await options.semantics!.getSemanticModel({ name: "jaffle_shop_orders" });
    expect(model).toMatchObject({ sourceId: "warehouse", sql: "SELECT * FROM wh.analytics.orders", dataset: { pipelineId: "jaffle_shop", dataset: "orders" } });
    expect((await options.semantics!.getSemanticModel({ name: "orders" })).model?.sourceId).toBe("retail");
    expect(warn.mock.calls.flat().join(" ")).toMatch(/dbt's semantic model orders is named jaffle_shop_orders here/);
    warn.mockRestore();
  });

  it("keeps dbt's name when it is free, and leaves out the semantic layer when asked", async () => {
    const free = await serverOptions(config([{ sourceId: "warehouse", targetDir: FIXTURES }], []), [], store);
    expect((await free.semantics!.listSemanticModels({})).models.map((m) => m.name)).toEqual(["orders"]);
    const off = await serverOptions(config([{ sourceId: "warehouse", targetDir: FIXTURES, semanticModels: false }], []), [], store);
    expect((await off.semantics!.listSemanticModels({})).models).toEqual([]);
  });

  it("leaves out a project whose artifacts cannot be read, and starts anyway", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const options = await serverOptions(config([{ sourceId: "warehouse", targetDir: path.join(store, "nowhere") }], []), [], store);
    expect(options.externalPipelines).toBeUndefined();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/dbt project at .*nowhere was left out/);
    warn.mockRestore();
  });
});
