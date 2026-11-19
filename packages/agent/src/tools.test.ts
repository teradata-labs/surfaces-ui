import { describe, expect, it } from "vitest";
import { type ModelChunk, type ModelMessage, toolCallingAgent } from "./tools.js";
import { turnText } from "./turn.js";

const collect = async <T>(items: AsyncIterable<T>) => {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
};

describe("toolCallingAgent", () => {
  it("draws through render_surface, runs other tools, and hands the person's reply back with its state", async () => {
    const seen: ModelMessage[][] = [];
    const replies: ModelChunk[][] = [
      [
        { type: "tool_call", call: { id: "t1", name: "list_tables", input: {} } },
      ],
      [
        { type: "text", delta: "Pick one." },
        {
          type: "tool_call",
          call: {
            id: "t2",
            name: "render_surface",
            input: {
              messages: [
                { version: "1.0", createSurface: { surfaceId: "main", catalogId: "c", metadata: { extensions: { surfaces_expects: { choose: { type: "object", required: ["choice"] } } } } } },
                { version: "1.0", updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Chips" }] } },
              ],
            },
          },
        },
      ],
      [{ type: "text", delta: "Done." }, { type: "done", model: "test-model" }],
      [{ type: "text", delta: "Got it." }],
    ];
    const agent = toolCallingAgent({
      system: "catalog prompt",
      tools: [{ name: "list_tables", description: "Tables", inputSchema: { type: "object" }, run: async () => ["orders"] }],
      complete: async function* ({ messages, tools }) {
        seen.push(structuredClone(messages));
        expect(tools.map((t) => t.name)).toEqual(["render_surface", "list_tables"]);
        yield* replies.shift()!;
      },
    });

    const first = await collect(agent.send({ input: { case: "text", value: "Which region?" } }));
    expect(first.filter((e) => e.event.case === "surface")).toHaveLength(2);
    expect(first.some((e) => e.event.case === "step" && e.event.value.status === 2)).toBe(true);
    const done = first.at(-1)!;
    expect(done.event.case).toBe("done");
    const sessionId = done.event.case === "done" ? done.event.value.sessionId : "";
    expect(done.event.case === "done" && done.event.value.generatedBy).toBe("test-model");
    expect(seen[1]!.find((m) => m.role === "tool")!.content).toBe('["orders"]');

    await collect(
      agent.send({
        sessionId,
        input: { case: "action", value: { name: "choose", surfaceId: "main", sourceComponentId: "root", context: { choice: "Europe" } } },
        surfaces: [{ surfaceId: "main", dataModel: { note: "urgent" }, controls: { grid: { sorts: [{ column: "amount", desc: true }] } }, expects: [{ event: "choose", schema: { type: "object" } }] }],
        surfaceErrors: [{ surfaceId: "main", code: "VALIDATION_FAILED", path: "/root/values", message: "Required" }],
      }),
    );
    const last = seen.at(-1)!.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content).toContain('"choose"');
    expect(last.content).toContain('{"choice":"Europe"}');
    expect(last.content).toContain('"grid" controls {"sorts":[{"column":"amount","desc":true}]}');
    expect(last.content).toContain("VALIDATION_FAILED");
    expect(seen.at(-1)![0]).toEqual({ role: "system", content: "catalog prompt" });
  });

  it("stops a turn that never ends", async () => {
    const agent = toolCallingAgent({
      system: "",
      maxSteps: 2,
      complete: async function* () {
        yield { type: "tool_call", call: { id: "x", name: "missing", input: {} } } as ModelChunk;
      },
    });
    const events = await collect(agent.send({ input: { case: "text", value: "hi" } }));
    expect(events.at(-1)!.event.case).toBe("error");
  });
});

describe("turnText", () => {
  it("says only what the turn carries", () => {
    expect(turnText({ input: { case: "text", value: "hello" } })).toBe("hello");
  });
});

describe("toolCallingAgent checkSurface", () => {
  it("returns catalog problems to the model in the same turn instead of drawing a broken message", async () => {
    const { toolCallingAgent } = await import("./tools.js");
    const seen: string[] = [];
    let call = 0;
    const agent = toolCallingAgent({
      system: "s",
      checkSurface: (m) => ((m as Record<string, unknown>).createSurface ? [] : [{ path: "/", message: "Expected one of createSurface" }]),
      async *complete({ messages }) {
        seen.push(messages.at(-1)!.content);
        if (call++ === 0) {
          yield { type: "tool_call", call: { id: "1", name: "render_surface", input: { messages: [{ catalogId: "x" }] } } };
          yield { type: "done" };
        } else if (call === 2) {
          yield { type: "tool_call", call: { id: "2", name: "render_surface", input: { messages: [{ version: "1.0", createSurface: { surfaceId: "main", catalogId: "x" } }] } } };
          yield { type: "done" };
        } else yield { type: "done" };
      },
    });
    const kinds: string[] = [];
    for await (const e of agent.send({ input: { case: "text", value: "draw" } })) kinds.push(e.event.case ?? "");
    expect(kinds.filter((k) => k === "surface")).toHaveLength(1);
    expect(seen[1]).toContain("Expected one of createSurface");
  });
});
