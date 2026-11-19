import Anthropic from "@anthropic-ai/sdk";
import { type AgentEvent, agentEvent } from "@surfaces-ui/agent";
import { describe, expect, it } from "vitest";
import { anthropicAgent, toAnthropic } from "./index.js";

/** Server-sent events for one streamed message, as the Messages API sends them. */
function sse(blocks: ({ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown })[], stopReason: string, extra: Record<string, unknown> = {}): string {
  const events: [string, unknown][] = [
    ["message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 0 } } }],
  ];
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      events.push(["content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } }]);
      events.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } }]);
    } else {
      events.push(["content_block_start", { type: "content_block_start", index, content_block: { type: "tool_use", id: block.id, name: block.name, input: {} } }]);
      events.push(["content_block_delta", { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } }]);
    }
    events.push(["content_block_stop", { type: "content_block_stop", index }]);
  });
  events.push(["message_delta", { type: "message_delta", delta: { stop_reason: stopReason, ...extra }, usage: { output_tokens: 20 } }]);
  events.push(["message_stop", { type: "message_stop" }]);
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

/** A client whose transport answers each request with the next scripted stream, recording what was sent. */
function scripted(replies: string[]) {
  const sent: { body: Record<string, unknown>; headers: Headers }[] = [];
  const fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return new Response(replies.shift() ?? "", { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  return { client: new Anthropic({ apiKey: "test-key", fetch: fetch as typeof globalThis.fetch, maxRetries: 0 }), sent };
}

async function collectEvents(stream: AsyncIterable<AgentEvent>) {
  const out: AgentEvent[] = [];
  for await (const e of stream) out.push(e);
  return out;
}

const surface = { version: "1.0", createSurface: { surfaceId: "main", catalogId: "urn:surfaces:catalog:analytics:v1" } };

describe("anthropicAgent", () => {
  it("streams text, draws through render_surface, and sends the model's own turn back with the tool result", async () => {
    const { client, sent } = scripted([
      sse([{ type: "text", text: "Drawing it." }, { type: "tool_use", id: "tu_1", name: "render_surface", input: { messages: [surface] } }], "tool_use"),
      sse([{ type: "text", text: "Done." }], "end_turn"),
    ]);
    const agent = anthropicAgent({ client, system: "You draw with the catalog." });
    const events = await collectEvents(agent.send({ input: { case: "text", value: "Show revenue" } }));
    const kinds = events.map((e) => e.event.case);
    expect(kinds).toContain("surface");
    expect(events.filter((e) => e.event.case === "text").map((e) => (e.event.value as { delta: string }).delta).join("")).toBe("Drawing it.Done.");
    expect(events.at(-1)).toEqual(agentEvent.done(expect.any(String), "claude-sonnet-5-5"));

    const first = sent[0]!;
    expect(first.body.model).toBe("claude-sonnet-5-5");
    expect(first.body.output_config).toEqual({ effort: "high" });
    expect(first.body.fallbacks).toBe("default");
    expect(first.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(first.body.system).toEqual([{ type: "text", text: "You draw with the catalog.", cache_control: { type: "ephemeral" } }]);
    expect((first.body.tools as { name: string; eager_input_streaming: boolean }[])[0]).toMatchObject({ name: "render_surface", eager_input_streaming: true });

    const second = sent[1]!.body.messages as { role: string; content: unknown }[];
    expect(second[1]).toMatchObject({ role: "assistant", content: [{ type: "text", text: "Drawing it." }, { type: "tool_use", id: "tu_1", name: "render_surface" }] });
    expect(second[2]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1" }] });
  });

  it("stops on a refusal without running tools, and says so", async () => {
    const { client, sent } = scripted([sse([{ type: "tool_use", id: "tu_1", name: "render_surface", input: { messages: [surface] } }], "refusal", { stop_details: { type: "refusal", category: null, explanation: "Declined." } })]);
    const events = await collectEvents(anthropicAgent({ client, system: "s", fallbacks: false }).send({ input: { case: "text", value: "x" } }));
    expect(events.some((e) => e.event.case === "surface")).toBe(false);
    expect(events.find((e) => e.event.case === "error")?.event.value).toMatchObject({ code: "REFUSED" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body.fallbacks).toBeUndefined();
  });

  it("groups tool results into one user message and keeps failures marked", () => {
    const { history } = toAnthropic([
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "a", name: "x", input: {} }, { id: "b", name: "y", input: {} }] },
      { role: "tool", toolCallId: "a", content: "1" },
      { role: "tool", toolCallId: "b", content: "no", isError: true },
    ]);
    expect(history).toHaveLength(3);
    expect(history[2]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "1" }, { type: "tool_result", tool_use_id: "b", content: "no", is_error: true }] });
  });
});
