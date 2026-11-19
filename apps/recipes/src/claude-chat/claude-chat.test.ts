import Anthropic from "@anthropic-ai/sdk";
import { createConnectTransport } from "@connectrpc/connect-node";
import { connectAgent } from "@surfaces-ui/client-connect";
import type { SurfacesServer } from "@surfaces-ui/dev-server";
import { A2UI_VERSION, analyticsCatalog, catalogPrompt } from "@surfaces-ui/spec";
import { afterAll, describe, expect, it } from "vitest";
import { createClaudeChatServer } from "./server.js";

/** Server-sent events for one streamed message, as the Messages API sends them. */
function sse(blocks: ({ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown })[], stopReason: string): string {
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
  events.push(["message_delta", { type: "message_delta", delta: { stop_reason: stopReason }, usage: { output_tokens: 20 } }]);
  events.push(["message_stop", { type: "message_stop" }]);
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

/** An Anthropic client whose transport answers each request with the next scripted stream, recording what was sent. */
function scripted(replies: string[]) {
  const sent: Record<string, unknown>[] = [];
  const fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(replies.shift() ?? "", { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  return { client: new Anthropic({ apiKey: "test-key", fetch: fetch as typeof globalThis.fetch, maxRetries: 0 }), sent };
}

const surface = [
  { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
  { version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "No sources are set up yet." }] } },
];

let server: SurfacesServer | undefined;
afterAll(async () => server?.close());

describe("chat with Claude over your own data", () => {
  it("serves Claude as AgentService: lists tables, draws a checked surface, and streams the reply", async () => {
    for (const m of surface) expect(analyticsCatalog.validateMessage(m)).toEqual([]);
    const { client, sent } = scripted([
      sse([{ type: "tool_use", id: "tu_1", name: "list_tables", input: {} }], "tool_use"),
      sse([{ type: "text", text: "Here it is." }, { type: "tool_use", id: "tu_2", name: "render_surface", input: { messages: surface } }], "tool_use"),
      sse([{ type: "text", text: " Done." }], "end_turn"),
    ]);
    // No sources and no discovery, so the test needs no engine and downloads nothing.
    server = await createClaudeChatServer({ sources: [], discovery: false }, client);
    const { url } = await server.listen(0);
    const remote = connectAgent({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });

    const events = [];
    for await (const e of remote.send({ input: { case: "text", value: "What data is there?" } })) events.push(e.event);
    const kinds = events.map((e) => e.case);
    expect(kinds).toContain("surface");
    expect(kinds.at(-1)).toBe("done");
    expect(events.filter((e) => e.case === "text").map((e) => (e.value as { delta: string }).delta).join("")).toBe("Here it is. Done.");

    // What Claude received: the catalog prompt, both tools, and the list_tables result.
    const first = sent[0]!;
    expect(first.model).toBe("claude-sonnet-5-5");
    expect((first.system as { text: string }[])[0]!.text).toContain(catalogPrompt(analyticsCatalog));
    expect((first.tools as { name: string }[]).map((t) => t.name).sort()).toEqual(["list_tables", "render_surface"]);
    const toolResult = (sent[1]!.messages as { content: unknown }[]).at(-1)!.content as { type: string; content: string }[];
    expect(toolResult[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    expect(toolResult[0]!.content).toContain("No data sources are configured");
  });
});
