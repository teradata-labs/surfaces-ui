import { memoryPipelines, pipelineDigest } from "@surfaces-ui/data";
import { ApprovalRisk, DatasetKind, RunState } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { approvalDigest } from "./approvals.js";
import type { AgentEvent } from "./backend.js";
import { pipelineTools } from "./pipeline-tools.js";
import { type ModelChunk, type ModelMessage, toolCallingAgent } from "./tools.js";

const collect = async (items: AsyncIterable<AgentEvent>) => {
  const out: AgentEvent[] = [];
  for await (const item of items) out.push(item);
  return out;
};

const backend = () =>
  memoryPipelines([
    {
      summary: { id: "sales", name: "Sales", sourceId: "lake" },
      version: 2,
      datasets: [
        { name: "orders", kind: DatasetKind.SOURCE },
        { name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL", inputs: ["orders"], inputsDeclared: true, grain: "one row per order", primaryKey: ["order_id"], checks: [{ name: "unique_order_id", kind: 1, columns: ["order_id"], implied: true }] },
      ],
    },
  ]);
const tool = (tools: ReturnType<typeof pipelineTools>, name: string) => tools.find((t) => t.name === name)!;

describe("pipelineTools", () => {
  it("lists and describes pipelines, with queries, grain, keys and checks", async () => {
    const tools = pipelineTools(backend());
    expect(await tool(tools, "list_pipelines").run({})).toEqual({ pipelines: [{ pipelineId: "sales", name: "Sales", sourceId: "lake", datasets: 1 }] });
    const described = (await tool(tools, "describe_pipeline").run({ pipelineId: "sales" })) as { sources: string[]; datasets: Record<string, unknown>[] };
    expect(described.sources).toEqual(["orders"]);
    expect(described.datasets[0]).toMatchObject({ name: "orders_clean", reads: ["orders"], grain: "one row per order", primaryKey: ["order_id"], checks: [{ name: "unique_order_id", kind: "unique", fromKey: true }] });
    await expect(tool(tools, "describe_pipeline").run({ pipelineId: "other" })).rejects.toThrow(/Unknown pipeline/);
    await expect(tool(pipelineTools(backend(), { pipelineIds: [] }), "describe_pipeline").run({ pipelineId: "sales" })).rejects.toThrow(/none/);
  });

  it("asks a person before a run, marks a full refresh irreversible, and runs only what they allowed", async () => {
    const pipelines = backend();
    const run = tool(pipelineTools(pipelines), "run_pipeline");
    const ask = await run.approval!({ pipelineId: "sales", select: ["orders_clean+"] });
    expect(ask).toMatchObject({ risk: ApprovalRisk.HIGH, subject: { pipelineId: "sales", version: 2, select: ["orders_clean+"], refresh: "rebuild" } });
    expect((await run.approval!({ pipelineId: "sales", fullRefresh: true }))?.risk).toBe(ApprovalRisk.IRREVERSIBLE);
    await expect(run.run({ pipelineId: "sales" })).rejects.toThrow(/approval/);

    // What runs comes from the approved subject, not the model's input.
    const result = (await run.run({ pipelineId: "sales", fullRefresh: true }, undefined, { sql: "", subject: ask!.subject as never, edited: false, approvals: [{ decidedBy: { id: "u1", name: "Ada" }, decidedAt: "", reason: "" }] })) as Record<string, unknown>;
    expect(result).toMatchObject({ state: "completed", trigger: "agent", startedBy: "agent, approved by Ada" });
    const { runs } = await pipelines.listRuns({ pipelineId: "sales" });
    expect(runs[0]).toMatchObject({ refreshKind: 1, trigger: "agent" });
    await expect(run.run({}, undefined, { sql: "", subject: { ...(ask!.subject as object), version: 1 } as never, edited: false, approvals: [] })).rejects.toThrow(/changed after it was approved/);
  });

  it("pauses the turn on run_pipeline until the person answers", async () => {
    const pipelines = backend();
    const seen: ModelMessage[][] = [];
    const agent = toolCallingAgent({
      system: "s",
      tools: pipelineTools(pipelines),
      complete: async function* ({ messages }): AsyncIterable<ModelChunk> {
        seen.push(messages.map((m) => ({ ...m })));
        if (messages.at(-1)!.role === "user") yield { type: "tool_call", call: { id: "c1", name: "run_pipeline", input: { pipelineId: "sales" } } };
        else yield { type: "text", delta: "Done." };
        yield { type: "done", model: "m" };
      },
    });
    const events = await collect(agent.send({ sessionId: "s", input: { case: "text", value: "Rebuild sales" } }));
    const approval = events.find((e) => e.event.case === "approval")?.event.value as { id: string; subject: unknown };
    expect(approval).toBeDefined();
    expect((await pipelines.listRuns({ pipelineId: "sales" })).runs).toHaveLength(0);
    const subject = { pipelineId: "sales", version: 2, select: [], refresh: "rebuild" };
    await collect(agent.send({ sessionId: "s", input: { case: "approval", value: { id: approval.id, allow: true, digest: await approvalDigest({ subject }), decidedBy: { id: "u1", name: "Ada" } } } }));
    expect((await pipelines.listRuns({ pipelineId: "sales" })).runs.map((r) => r.state)).toEqual([RunState.COMPLETED]);
    expect(seen.at(-1)!.at(-1)).toMatchObject({ role: "tool", toolCallId: "c1" });
  });

  it("proposes a dataset without saving it, with a digest the save accepts", async () => {
    const pipelines = backend();
    const proposed = (await tool(pipelineTools(pipelines), "propose_dataset").run({
      pipelineId: "sales",
      name: "region_revenue",
      sql: "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region",
      depends: ["orders_clean"],
      grain: "one row per region",
      primaryKey: ["region"],
      checks: [{ kind: "accepted_values", columns: ["region"], values: ["EU", "US"], warnOnly: true }],
    })) as { digest: string; expectedVersion: number; pipeline: never; change: string };
    expect(proposed).toMatchObject({ change: "adds a dataset", expectedVersion: 2 });
    expect((await pipelines.getPipeline({ id: "sales" })).pipeline!.version).toBe(2);
    const { pipeline } = await pipelines.savePipeline({ pipeline: { ...(await import("@bufbuild/protobuf")).fromJson((await import("@surfaces-ui/proto")).PipelineDraftSchema, proposed.pipeline) }, expectedVersion: 2, approvedBy: "Ada", approvalDigest: proposed.digest });
    expect(pipeline!.datasets.map((d) => d.name)).toEqual(["orders_clean", "region_revenue"]);
    expect(proposed.digest).toBe(await pipelineDigest((await import("@surfaces-ui/data")).draftOf(pipeline!)));
    await expect(tool(pipelineTools(pipelines), "propose_dataset").run({ pipelineId: "sales", name: "1bad", sql: "SELECT 1", grain: "x" })).rejects.toThrow(/letters/);
  });

  it("proposes a new pipeline when given a source, refused where pipelines are limited", async () => {
    const pipelines = backend();
    const propose = tool(pipelineTools(pipelines), "propose_dataset");
    const proposed = (await propose.run({ pipelineId: "extras", sourceId: "lake", pipelineName: "Extras", name: "t", sql: "SELECT 1 AS a", grain: "one row" })) as { change: string; expectedVersion: number; digest: string; pipeline: never };
    expect(proposed).toMatchObject({ change: "a new pipeline", expectedVersion: 0 });
    const { fromJson } = await import("@bufbuild/protobuf");
    const { PipelineDraftSchema } = await import("@surfaces-ui/proto");
    expect((await pipelines.savePipeline({ pipeline: fromJson(PipelineDraftSchema, proposed.pipeline), expectedVersion: 0, approvedBy: "Ada", approvalDigest: proposed.digest })).pipeline!.version).toBe(1);
    await expect(tool(pipelineTools(pipelines, { pipelineIds: ["sales"] }), "propose_dataset").run({ pipelineId: "more", sourceId: "lake", name: "t", sql: "SELECT 1", grain: "x" })).rejects.toThrow(/cannot be proposed/);
  });
});
