import { describe, expect, it } from "vitest";
import { combinePipelines, memoryPipelines } from "./pipelines.js";

describe("combinePipelines", () => {
  it("lists every backend's pipelines and sends each call to the one that has it", async () => {
    const a = memoryPipelines([{ summary: { id: "sales", name: "Sales", sourceId: "lake" }, datasets: [{ name: "orders_clean", sql: "SELECT 1" }] }]);
    const b = memoryPipelines([{ summary: { id: "jaffle", name: "jaffle_shop", sourceId: "warehouse" }, datasets: [{ name: "orders", sql: "SELECT 1" }] }], { editable: false });
    const both = combinePipelines([a, b]);
    expect((await both.listPipelines({})).pipelines.map((p) => p.id)).toEqual(["sales", "jaffle"]);
    expect((await both.getPipeline({ id: "jaffle" })).pipeline?.datasets[0]?.name).toBe("orders");
    const { run } = await both.startRun({ pipelineId: "jaffle" });
    expect((await both.getRun({ pipelineId: "jaffle", runId: run!.id })).run?.pipelineId).toBe("jaffle");
    expect((await a.listRuns({ pipelineId: "sales" })).runs).toHaveLength(0);
    await expect(both.getPipeline({ id: "nope" })).rejects.toThrow(/No pipeline "nope"/);
  });
});
