import { ConnectorStatus } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "./backend.js";
import { scriptedAgent } from "./backend.js";
import { type AgentOffer, agentRouter, resolveChoices } from "./choices.js";
import { type ModelChunk, type ModelMessage, type ToolDefinition, toolCallingAgent } from "./tools.js";

const collect = async (items: AsyncIterable<AgentEvent>) => {
  const out: AgentEvent[] = [];
  for await (const item of items) out.push(item);
  return out;
};

const offer: AgentOffer = {
  id: "analyst",
  name: "Analyst",
  defaultModel: "small",
  models: [{ id: "small" }, { id: "large", label: "Large" }],
  skills: [
    { id: "charts", name: "Chart standards", text: "Bars start at zero." },
    { id: "names", name: "Naming", text: "Name things for readers.", defaultOn: false },
  ],
  connectors: [
    { id: "warehouse", name: "Warehouse", tools: ["list_tables"] },
    { id: "jira", name: "Jira", tools: ["create_issue"], status: "needs-sign-in", signInUrl: "https://example.com/sign-in", defaultOn: false },
  ],
};

describe("turn choices", () => {
  it("uses defaults when the client sets none, and refuses what is not offered", () => {
    const defaults = resolveChoices({}, offer);
    expect(defaults).toMatchObject({ model: "", skills: [{ id: "charts" }], connectors: [{ id: "warehouse" }] });
    expect(resolveChoices({ model: "huge" }, offer)).toEqual({ refused: "This agent does not offer the model huge." });
    expect(resolveChoices({ choicesSet: true, skillIds: ["poems"] }, offer)).toEqual({ refused: "This agent has no skill poems." });
    expect(resolveChoices({ choicesSet: true, connectorIds: ["jira"] }, offer)).toEqual({ refused: "Jira is not connected." });
    expect(resolveChoices({ choicesSet: true, skillIds: ["names"], connectorIds: [] }, offer)).toMatchObject({ skills: [{ id: "names" }], connectors: [] });
  });

  it("gives the model only the skills, tools and model that are on, and describes what it offers", async () => {
    const seen: { system: string; tools: string[]; model?: string }[] = [];
    const agent = toolCallingAgent({
      system: "Base.",
      offer,
      tools: [
        { name: "list_tables", description: "", inputSchema: {}, run: async () => ["orders"] },
        { name: "create_issue", description: "", inputSchema: {}, run: async () => "made" },
        { name: "now", description: "", inputSchema: {}, run: async () => "noon" },
      ],
      complete: async function* ({ messages, tools, model }: { messages: ModelMessage[]; tools: ToolDefinition[]; model?: string }): AsyncIterable<ModelChunk> {
        seen.push({ system: messages[0]!.content, tools: tools.map((t) => t.name), model });
        // Asks for a tool that is off: it must not run.
        if (messages.at(-1)!.role === "user") yield { type: "tool_call", call: { id: "c1", name: "list_tables", input: {} } };
        else yield { type: "text", delta: "ok" };
        yield { type: "done", model: "m" };
      },
    });
    const info = (await agent.describeAgents()).agents[0]!;
    expect(info).toMatchObject({ id: "analyst", defaultModel: "small", skills: [{ id: "charts", defaultOn: true }, { id: "names", defaultOn: false }] });
    expect(info.connectors[1]).toMatchObject({ id: "jira", status: ConnectorStatus.NEEDS_SIGN_IN, signInUrl: "https://example.com/sign-in" });

    await collect(agent.send({ sessionId: "s", input: { case: "text", value: "hi" }, model: "large", choicesSet: true, skillIds: ["names"], connectorIds: [] }));
    expect(seen[0]).toEqual({ system: "Base.\n\n## Skill: Naming\n\nName things for readers.", tools: ["render_surface", "now"], model: "large" });
    expect(seen[1]!.tools).not.toContain("list_tables");

    seen.length = 0;
    await collect(agent.send({ sessionId: "s", input: { case: "text", value: "again" } }));
    expect(seen[0]).toMatchObject({ system: "Base.\n\n## Skill: Chart standards\n\nBars start at zero.", tools: ["render_surface", "list_tables", "now"] });
    expect(seen[0]!.model).toBeUndefined();

    const refused = await collect(agent.send({ sessionId: "s", input: { case: "text", value: "x" }, model: "huge" }));
    expect(refused.map((e) => e.event.case)).toEqual(["error", "done"]);
  });

  it("routes a turn to the agent it names and lists every agent", async () => {
    const say = (text: string) => scriptedAgent(() => [{ event: { case: "text", value: { delta: text } } } as never]);
    const router = agentRouter([
      { info: { id: "a", name: "First" }, backend: say("from a") },
      { info: { id: "b", name: "Second" }, backend: say("from b") },
    ]);
    expect((await router.describeAgents()).agents.map((a) => [a.id, a.isDefault])).toEqual([["a", true], ["b", false]]);
    const text = async (agentId: string) => (await collect(router.send({ agentId }))).map((e) => (e.event.case === "text" ? e.event.value.delta : e.event.case));
    expect(await text("b")).toEqual(["from b"]);
    expect(await text("")).toEqual(["from a"]);
    expect(await text("z")).toEqual(["error", "done"]);
  });
});
