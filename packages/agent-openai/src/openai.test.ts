import type { AgentEvent } from "@surfaces-ui/agent";
import { describe, expect, it } from "vitest";
import { openAiCompatibleAgent } from "./index.js";

const line = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;
const surface = { version: "1.0", createSurface: { surfaceId: "main", catalogId: "urn:surfaces:catalog:analytics:v1" } };

function scripted(replies: string[]) {
  const sent: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return new Response(replies.shift() ?? "data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  return { fetch: fetch as typeof globalThis.fetch, sent };
}

async function run(stream: AsyncIterable<AgentEvent>) {
  const out: AgentEvent[] = [];
  for await (const e of stream) out.push(e);
  return out;
}

describe("openAiCompatibleAgent", () => {
  it("assembles streamed tool calls, draws, and sends the result back", async () => {
    const args = JSON.stringify({ messages: [surface] });
    const { fetch, sent } = scripted([
      [
        line({ model: "llama3.2", choices: [{ delta: { content: "Drawing." } }] }),
        line({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "render_surface", arguments: args.slice(0, 10) } }] } }] }),
        line({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(10) } }] }, finish_reason: "tool_calls" }] }),
        line({ choices: [], usage: { prompt_tokens: 50, completion_tokens: 9 } }),
        "data: [DONE]\n\n",
      ].join(""),
      [line({ choices: [{ delta: { content: "Done." }, finish_reason: "stop" }] }), "data: [DONE]\n\n"].join(""),
    ]);
    const agent = openAiCompatibleAgent({ baseUrl: "http://localhost:11434/v1/", model: "llama3.2", system: "Use the catalog.", fetch, headers: () => ({ authorization: "Bearer test" }) });
    const events = await run(agent.send({ input: { case: "text", value: "Show revenue" } }));
    expect(events.some((e) => e.event.case === "surface")).toBe(true);
    expect(events.find((e) => e.event.case === "usage")?.event.value).toMatchObject({ inputTokens: 50n, outputTokens: 9n });
    expect(sent[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(sent[0]!.headers.get("authorization")).toBe("Bearer test");
    expect(sent[0]!.body).toMatchObject({ model: "llama3.2", stream: true, messages: [{ role: "system" }, { role: "user" }] });
    const second = sent[1]!.body.messages as Record<string, unknown>[];
    expect(second[2]).toMatchObject({ role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "render_surface" } }] });
    expect(second[3]).toMatchObject({ role: "tool", tool_call_id: "c1" });
  });

  it("reports a server error and a cut-off tool call instead of running it", async () => {
    const failing = (async () => new Response("model not found", { status: 404 })) as unknown as typeof globalThis.fetch;
    const failed = await run(openAiCompatibleAgent({ baseUrl: "http://x/v1", model: "m", system: "s", fetch: failing }).send({ input: { case: "text", value: "x" } }));
    expect(failed.find((e) => e.event.case === "error")?.event.value).toMatchObject({ message: expect.stringContaining("404") });

    const { fetch } = scripted([line({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "render_surface", arguments: '{"messa' } }] }, finish_reason: "length" }] })]);
    const cut = await run(openAiCompatibleAgent({ baseUrl: "http://x/v1", model: "m", system: "s", fetch }).send({ input: { case: "text", value: "x" } }));
    expect(cut.some((e) => e.event.case === "surface")).toBe(false);
    expect(cut.find((e) => e.event.case === "error")?.event.value).toMatchObject({ code: "CUT_OFF" });
  });
});
