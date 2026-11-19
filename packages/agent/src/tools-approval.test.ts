import { ApprovalRisk } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { approvalDigest } from "./approvals.js";
import type { AgentEvent, SendInit } from "./backend.js";
import { type ApprovedRun, type ModelChunk, type ModelMessage, type RunnableTool, toolCallingAgent } from "./tools.js";

const collect = async (items: AsyncIterable<AgentEvent>) => {
  const out: AgentEvent[] = [];
  for await (const item of items) out.push(item);
  return out;
};

const SQL = "DELETE FROM staging.orders WHERE loaded_at < DATE '2025-01-01'";

/** A model that calls `run_change` once, then answers with whatever the tool said. */
function setup(extra: Partial<RunnableTool> = {}, approvalsRequired = 1) {
  const ran: { input: unknown; approved?: ApprovedRun }[] = [];
  const seen: ModelMessage[][] = [];
  const tool: RunnableTool = {
    name: "run_change",
    description: "Runs a change after a person allows it",
    inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
    approval: (input) => ({
      title: "Delete old staging rows",
      sql: (input as { sql: string }).sql,
      risk: ApprovalRisk.IRREVERSIBLE,
      editable: true,
      reasonRequired: true,
      approvalsRequired,
    }),
    run: async (input, _signal, approved) => {
      ran.push({ input, approved });
      return { rowsDeleted: 42 };
    },
    ...extra,
  };
  const agent = toolCallingAgent({
    system: "s",
    tools: [tool],
    mayDecide: (actor) => actor?.id !== "intruder",
    complete: async function* ({ messages }): AsyncIterable<ModelChunk> {
      seen.push(messages.map((m) => ({ ...m })));
      const last = messages.at(-1)!;
      if (last.role === "user" && !last.content.startsWith("The person")) {
        yield { type: "tool_call", call: { id: "c1", name: "run_change", input: { sql: SQL } } };
      } else yield { type: "text", delta: `Result: ${last.content}` };
      yield { type: "done", model: "m" };
    },
  });
  return { agent, ran, seen };
}

async function ask(agent: ReturnType<typeof setup>["agent"]) {
  const events = await collect(agent.send({ sessionId: "s", input: { case: "text", value: "Clear old staging rows" } }));
  const approval = events.find((e) => e.event.case === "approval")?.event.value as { id: string; sql: string; digest: string };
  return { events, approval };
}

const answer = (value: Extract<NonNullable<SendInit["input"]>, { case: "approval" }>["value"]): SendInit => ({ sessionId: "s", input: { case: "approval", value } });

describe("toolCallingAgent approvals", () => {
  it("pauses before a tool that asks, and runs the person's edited SQL once it is allowed", async () => {
    const { agent, ran } = setup();
    const { events, approval } = await ask(agent);
    expect(events.map((e) => e.event.case)).toEqual(["approval", "done"]);
    expect(approval).toMatchObject({ id: "approval-c1", sql: SQL, digest: await approvalDigest({ sql: SQL }) });
    expect(ran).toHaveLength(0);

    const edited = `${SQL} AND region = 'EU'`;
    const after = await collect(agent.send(answer({ id: approval.id, allow: true, editedSql: edited, digest: await approvalDigest({ sql: edited }), reason: "EU only", decidedBy: { id: "u1", name: "Ada" } })));
    expect(ran).toEqual([{ input: { sql: SQL }, approved: { sql: edited, subject: {}, edited: true, approvals: [{ decidedBy: { id: "u1", name: "Ada" }, decidedAt: expect.any(String), reason: "EU only" }] } }]);
    expect(after.filter((e) => e.event.case === "text").map((e) => (e.event.value as { delta: string }).delta).join("")).toContain("rowsDeleted");
    expect(after.at(-1)?.event.case).toBe("done");
  });

  it("does not run on a refusal, a stale digest or a person who may not decide, and tells the model", async () => {
    for (const bad of [
      { allow: false, reason: "Not today", decidedBy: { id: "u1", name: "Ada" } },
      { allow: true, reason: "ok", digest: "sha256:stale", decidedBy: { id: "u1", name: "Ada" } },
      { allow: true, reason: "ok", digest: await approvalDigest({ sql: SQL }), decidedBy: { id: "intruder", name: "Eve" } },
      { allow: true, reason: "", digest: await approvalDigest({ sql: SQL }), decidedBy: { id: "u1", name: "Ada" } },
    ]) {
      const { agent, ran, seen } = setup();
      const { approval } = await ask(agent);
      const after = await collect(agent.send(answer({ id: approval.id, ...bad })));
      expect(ran).toHaveLength(0);
      expect(after.find((e) => e.event.case === "step")?.event.value).toMatchObject({ status: 3 });
      const toolResult = seen.at(-1)!.at(-1)!;
      expect(toolResult).toMatchObject({ role: "tool", toolCallId: "c1", isError: true });
      expect(toolResult.content).toContain('"ran":false');
    }
  });

  it("asks again until enough different people allow it", async () => {
    const { agent, ran } = setup({}, 2);
    const { approval } = await ask(agent);
    const digest = await approvalDigest({ sql: SQL });
    const first = await collect(agent.send(answer({ id: approval.id, allow: true, digest, reason: "ok", decidedBy: { id: "u1", name: "Ada" } })));
    expect(first.map((e) => e.event.case)).toEqual(["approval", "done"]);
    expect(first[0]!.event.value).toMatchObject({ approvals: [{ allow: true, decidedBy: { name: "Ada" } }] });
    expect(ran).toHaveLength(0);

    const again = await collect(agent.send(answer({ id: approval.id, allow: true, digest, reason: "ok", decidedBy: { id: "u1", name: "Ada" } })));
    expect(ran).toHaveLength(0);
    expect(again.find((e) => e.event.case === "step")?.event.value).toMatchObject({ detail: expect.stringContaining("already decided") });
  });

  it("runs after the second person allows it", async () => {
    const { agent, ran } = setup({}, 2);
    const { approval } = await ask(agent);
    const digest = await approvalDigest({ sql: SQL });
    await collect(agent.send(answer({ id: approval.id, allow: true, digest, reason: "ok", decidedBy: { id: "u1", name: "Ada" } })));
    await collect(agent.send(answer({ id: approval.id, allow: true, digest, reason: "agreed", decidedBy: { id: "u2", name: "Grace" } })));
    expect(ran).toHaveLength(1);
    expect(ran[0]!.approved?.approvals.map((a) => a.decidedBy?.name)).toEqual(["Ada", "Grace"]);
  });

  it("treats a message instead of an answer as not allowed, and keeps the conversation valid", async () => {
    const { agent, ran, seen } = setup();
    await ask(agent);
    await collect(agent.send({ sessionId: "s", input: { case: "text", value: "Actually, show me the rows first" } }));
    expect(ran).toHaveLength(0);
    const history = seen.at(-1)!;
    const toolIndex = history.findIndex((m) => m.role === "tool" && m.toolCallId === "c1");
    expect(toolIndex).toBeGreaterThan(0);
    expect(history[toolIndex + 1]).toMatchObject({ role: "user" });
  });
});
