import type { AgentEvent } from "@surfaces-ui/agent";
import { ApprovalKind, StepStatus } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { type LoomProgress, loomAgent, mapLoomProgress, newLoomTurn, splitLoomModel } from "./index.js";

const sse = (frames: (LoomProgress | string)[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        // Frames are split mid-line to prove the reader does not depend on chunk boundaries.
        const text = frames.map((f) => (typeof f === "string" ? f : `data: ${JSON.stringify(f)}\n\n`)).join("");
        for (let i = 0; i < text.length; i += 37) controller.enqueue(encoder.encode(text.slice(i, i + 37)));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
const collect = async (stream: AsyncIterable<AgentEvent>) => {
  const out: AgentEvent["event"][] = [];
  for await (const event of stream) out.push(event.event);
  return out;
};
const kinds = (events: AgentEvent["event"][]) => events.map((e) => e.case);

describe("mapLoomProgress", () => {
  it("turns accumulated text into deltas and tool calls into steps", () => {
    const state = newLoomTurn();
    const run = (frame: LoomProgress) => mapLoomProgress(frame, state, "s1").map((e) => e.event);
    expect(run({ stage: 3, is_token_stream: true, partial_content: "Rev" })).toEqual([{ case: "text", value: expect.objectContaining({ delta: "Rev" }) }]);
    expect(run({ stage: 3, is_token_stream: true, partial_content: "Revenue is up." })[0]).toMatchObject({ value: { delta: "enue is up." } });
    const started = run({ stage: 4, is_tool_started: true, tool_name: "run_sql", tool_call_id: "c1", tool_input: { sql: "SELECT 1" } });
    expect(started[0]).toMatchObject({ case: "step", value: { id: "c1", title: "Run sql", status: StepStatus.RUNNING, detail: "SELECT 1" } });
    const failed = run({ stage: 4, is_tool_completed: true, tool_name: "run_sql", tool_call_id: "c1", tool_error: "no such table", tool_duration_ms: 12 });
    expect(failed[0]).toMatchObject({ case: "step", value: { id: "c1", status: StepStatus.FAILED, detail: "no such table", durationMs: 12n } });
    const done = run({ stage: 7, partial_content: "Revenue is up.", cost: { total_cost_usd: 0.02, llm_cost: { input_tokens: 900, output_tokens: 40, model: "some-model" } }, context_state: { context_tokens_used: 1200, context_tokens_max: 200000 } });
    expect(kinds(done)).toEqual(["usage", "done"]);
    expect(done[1]).toMatchObject({ value: { sessionId: "s1", generatedBy: "Loom · some-model" } });
  });

  it("draws surfaces from a render_surface call instead of listing it as a step", () => {
    const message = { version: "1.0", createSurface: { surfaceId: "main", catalogId: "urn:surfaces:catalog:analytics:v1" } };
    const events = mapLoomProgress({ stage: 4, is_tool_started: true, tool_name: "render_surface", tool_input: { messages: [message] } }, newLoomTurn(), "s1");
    expect(events.map((e) => e.event)).toEqual([{ case: "surface", value: message }]);
  });

  it("asks once per question and ignores the early hint", () => {
    const state = newLoomTurn();
    expect(mapLoomProgress({ stage: 9, hitl_request: { question: "Run it?" } }, state, "s1")).toEqual([]);
    const frame: LoomProgress = { stage: 9, hitl_request: { request_id: "r1", question_id: "q1", question: "Run this query?", request_type: "approval", params_json: '{"sql":"SELECT 1"}' } };
    expect(mapLoomProgress(frame, state, "s1")[0]!.event).toMatchObject({ case: "approval", value: { id: "q1", kind: ApprovalKind.PERMISSION, title: "Run this query?", sql: "SELECT 1" } });
    expect(mapLoomProgress(frame, state, "s1")).toEqual([]);
    expect(mapLoomProgress({ hitl_request: { request_id: "r2", question: "Which?", options: ["a", "b"] } }, state, "s1")[0]!.event).toMatchObject({ value: { kind: ApprovalKind.CHOICE, options: ["a", "b"] } });
  });
});

describe("loomAgent", () => {
  it("streams a turn, sending the session, agent and bearer token", async () => {
    const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
    const agent = loomAgent({
      baseUrl: "http://loom.test/",
      token: () => "t0ken",
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
        if (url.endsWith("/v1/sessions")) return Response.json({ id: "sess-1" });
        return sse([": heartbeat\n\n", { stage: 3, is_token_stream: true, partial_content: "Hi" }, { stage: 3, is_token_stream: true, partial_content: "Hi there" }, { stage: 7, partial_content: "Hi there" }]);
      }) as typeof fetch,
    });
    const events = await collect(agent.send({ agentId: "analyst", input: { case: "text", value: "hello" } }));
    expect(kinds(events)).toEqual(["text", "text", "done"]);
    expect(events.at(-1)).toMatchObject({ value: { sessionId: "sess-1", generatedBy: "Loom" } });
    expect(calls.map((c) => c.url)).toEqual(["http://loom.test/v1/sessions", "http://loom.test/v1/weave:stream"]);
    expect(calls[1]!.body).toMatchObject({ query: "hello", session_id: "sess-1", agent_id: "analyst" });
    expect(calls[1]!.headers).toMatchObject({ Authorization: "Bearer t0ken", "X-Loom-Slot-Origin": "interactive" });
  });

  it("pauses on a question and carries on the same stream once it is answered", async () => {
    let release!: () => void;
    const answered = new Promise<void>((resolve) => (release = resolve));
    const posted: { url: string; body: Record<string, unknown> }[] = [];
    const agent = loomAgent({
      baseUrl: "http://loom.test",
      fetch: (async (url: string, init: RequestInit) => {
        posted.push({ url, body: JSON.parse(String(init.body)) });
        if (url.includes("/clarifications/")) {
          release();
          return Response.json({ success: true });
        }
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 9, hitl_request: { request_id: "r1", question_id: "q1", question: "Run it?", request_type: "approval" } })}\n\n`));
              await answered;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 7, partial_content: "Done." })}\n\n`));
              controller.close();
            },
          }),
        );
      }) as typeof fetch,
    });
    const first = await collect(agent.send({ sessionId: "s1", input: { case: "text", value: "count orders" } }));
    expect(kinds(first)).toEqual(["approval"]);
    const second = await collect(agent.send({ sessionId: "s1", input: { case: "approval", value: { id: "q1", allow: true } } }));
    expect(kinds(second)).toEqual(["text", "done"]);
    expect(posted[1]).toEqual({ url: "http://loom.test/v1/clarifications/s1/answer", body: { session_id: "s1", question_id: "q1", answer: "approved", agent_id: "" } });
    expect(posted).toHaveLength(2);
  });

  it("reports a server that cannot be reached or refuses", async () => {
    const down = loomAgent({ baseUrl: "http://loom.test", fetch: (async () => new Response("no", { status: 503 })) as typeof fetch });
    expect((await collect(down.send({ sessionId: "s", input: { case: "text", value: "hi" } }))).at(-1)).toMatchObject({ case: "error", value: { message: "Loom answered 503." } });
    const failing = loomAgent({ baseUrl: "http://loom.test", fetch: (async () => sse([{ error: "agent not found", stage: "EXECUTION_STAGE_FAILED" }])) as typeof fetch });
    expect(await collect(failing.send({ sessionId: "s", input: { case: "text", value: "hi" } }))).toMatchObject([{ case: "error", value: { message: "agent not found" } }]);
  });

  it("lists Loom's agents with its models, and switches a session's model only when the choice changes", async () => {
    const calls: { url: string; body?: unknown }[] = [];
    const agent = loomAgent({
      baseUrl: "http://loom.test",
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
        if (url.endsWith("/v1/agents")) return Response.json({ agents: [{ name: "analyst", metadata: { description: "Draws charts" } }] });
        if (url.endsWith("/v1/models")) return Response.json({ models: [{ id: "claude-opus-5-5", name: "Claude Opus 5.5", provider: "anthropic" }, { id: "qwen3:8b", provider: "ollama" }] });
        if (url.includes(":switch-model")) return Response.json({ success: true });
        return sse([{ stage: 7, partial_content: "ok" }]);
      }) as typeof fetch,
    });
    const described = await agent.describeAgents();
    expect(described.agents.map((a) => [a.id, a.description, a.models.map((m) => m.id)])).toEqual([["analyst", "Draws charts", ["anthropic/claude-opus-5-5", "ollama/qwen3:8b"]]]);
    const turn = (model: string) => collect(agent.send({ sessionId: "s1", agentId: "analyst", model, input: { case: "text", value: "hi" } }));
    await turn("ollama/qwen3:8b");
    await turn("ollama/qwen3:8b");
    await turn("anthropic/claude-opus-5-5");
    const switches = calls.filter((c) => c.url.includes(":switch-model"));
    expect(switches.map((c) => c.body)).toEqual([
      { session_id: "s1", agent_id: "analyst", provider: "ollama", model: "qwen3:8b", preserve_context: true },
      { session_id: "s1", agent_id: "analyst", provider: "anthropic", model: "claude-opus-5-5", preserve_context: true },
    ]);
    expect(splitLoomModel("ollama/library/x")).toEqual({ provider: "ollama", model: "library/x" });
  });

  it("stops the turn when Loom refuses the switch", async () => {
    const agent = loomAgent({ baseUrl: "http://loom.test", fetch: (async (url: string) => (url.includes(":switch-model") ? new Response("no", { status: 404 }) : sse([{ stage: 7, partial_content: "ok" }]))) as typeof fetch });
    const events = await collect(agent.send({ sessionId: "s", model: "ollama/gone", input: { case: "text", value: "hi" } }));
    expect(events.at(-1)).toMatchObject({ case: "error", value: { message: "Loom could not switch to ollama/gone (404)." } });
  });
});
