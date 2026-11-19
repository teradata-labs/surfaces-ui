import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { memoryDataSource } from "@surfaces-ui/data";
import { A2UI_VERSION, type SurfaceMessage } from "@surfaces-ui/spec";
import { describe, expect, it } from "vitest";
import { composerPrompt, datasetOutline, findAgents, loomGuide, mergeAgentMessages, runTurn, withGuide } from "./composerAgent.js";

const update = (surfaceId: string) => ({ updateComponents: { surfaceId, components: [{ id: "root", component: "Text", text: "Hi" }] } });

describe("composerPrompt", () => {
  it("puts the instruction, the surface id and the components where the scripted agent reads them", () => {
    const components = [{ id: "root", component: "Column", children: [] }];
    const text = composerPrompt({ instruction: "Add a chart\nof revenue", surfaceId: "main", components, outline: "Source \"shop\"" });
    expect(text).toMatch(/^Instruction: Add a chart of revenue$/m);
    expect(text).toContain('Change the page "main"');
    expect(text.split("\n").at(-1)).toBe(JSON.stringify(components));
    expect(text.indexOf("Source")).toBeLessThan(text.indexOf("Instruction:"));
  });

  it("asks for createSurface when the surface does not exist yet", () => {
    expect(composerPrompt({ instruction: "Start", surfaceId: "main", components: [] })).toMatch(/start with createSurface/);
  });
});

describe("mergeAgentMessages", () => {
  it("adds the version and leaves out a createSurface for a surface that exists", () => {
    const { messages, notes } = mergeAgentMessages(new Set(["main"]), [{ createSurface: { surfaceId: "main", catalogId: "x" } }, update("main"), "not a message"]);
    expect(messages).toEqual([{ version: A2UI_VERSION, ...update("main") }]);
    expect(notes[0]).toMatch(/already exists/);
  });

  it("keeps a createSurface for a new surface", () => {
    expect(mergeAgentMessages(new Set(), [{ createSurface: { surfaceId: "new", catalogId: "x" } }]).messages).toHaveLength(1);
  });
});

describe("runTurn", () => {
  it("streams text, collects the drawn messages and records who answered", async () => {
    const agent = scriptedAgent(() => [agentEvent.text("Added "), agentEvent.text("a title."), agentEvent.surface(update("main")), agentEvent.done("s1", "test agent")]);
    const seen: string[] = [];
    const result = await runTurn(agent, { sessionId: "", input: { case: "text", value: "Add a title" }, surfaces: [], existing: new Set(["main"]) }, { onText: (t) => seen.push(t) });
    expect(result).toMatchObject({ text: "Added a title.", generatedBy: "test agent", sessionId: "s1" });
    expect(seen.at(-1)).toBe("Added a title.");
    expect((result.messages[0] as SurfaceMessage & { updateComponents: unknown }).updateComponents).toBeDefined();
  });

  it("sends a surface event as an action with its context as JSON", async () => {
    let sent: unknown;
    const agent = scriptedAgent((request) => {
      sent = request.input;
      return [agentEvent.done("s", "test")];
    });
    await runTurn(agent, {
      sessionId: "s",
      input: { case: "action", value: { name: "send_note", surfaceId: "main", sourceComponentId: "send", timestamp: "2026-11-13T00:00:00Z", context: { note: "hello", count: 2n } } },
      surfaces: [{ surfaceId: "main", dataModel: { note: "hello" }, controls: {} }],
      existing: new Set(["main"]),
    });
    expect(sent).toMatchObject({ case: "action", value: { name: "send_note", context: { note: "hello", count: "2" } } });
  });

  it("reports an error the agent sends", async () => {
    const agent = scriptedAgent(() => [agentEvent.error("UNAVAILABLE", "No agent is set up."), agentEvent.done("", "no agent")]);
    const result = await runTurn(agent, { sessionId: "", input: { case: "text", value: "x" }, surfaces: [], existing: new Set() });
    expect(result.error).toBe("No agent is set up.");
    expect(result.messages).toEqual([]);
  });
});

describe("datasetOutline", () => {
  it("lists tables with column names and types, never values", async () => {
    const data = memoryDataSource({ sourceId: "shop", tables: { customers: [{ customer_id: 1, full_name: "Ada" }] } });
    const outline = await datasetOutline(data, "shop");
    expect(outline).toContain("customers(customer_id");
    expect(outline).not.toContain("Ada");
  });
});

describe("findAgents", () => {
  const fakeFetch = (async (url: string) => {
    if (String(url).endsWith("/v1/agents")) return new Response(JSON.stringify({ agents: [{ name: "analyst" }] }));
    return new Response("", { status: 404 });
  }) as typeof fetch;
  const backend = (id: string, label: string, model: string, active: boolean) => ({ id, label, model, models: [{ id: model, label: model === "claude-opus-5-5" ? "Claude Opus 5.5" : model }], active, available: true });

  it("names the dev server's agent and the Loom agent by the model each runs", async () => {
    const agents = await findAgents({
      serverUp: true,
      fetch: fakeFetch,
      backends: async () => [backend("claude", "Claude", "claude-opus-5-5", true), backend("loom-test", "Test Loom", "gemma4:26b", false)],
    });
    expect(agents.map((a) => a.label)).toEqual(["Scripted demo", "Dev server: Claude Opus 5.5", "Loom: analyst (gemma4:26b)"]);
    expect(agents[1]!.detail).toMatch(/^Claude on the dev server, model claude-opus-5-5/);
  });

  it("falls back to a plain name when the server says nothing about models", async () => {
    const agents = await findAgents({ serverUp: true, fetch: fakeFetch, backends: async () => { throw new Error("unimplemented"); } });
    expect(agents.map((a) => a.label)).toEqual(["Scripted demo", "Dev server agent", "Loom: analyst"]);
  });
});

describe("withGuide", () => {
  const recorder = () => {
    const sent: { sessionId: string; agentId?: string; text?: string }[] = [];
    const agent = {
      async *send(request: { sessionId: string; agentId?: string; input?: { case: string; value: unknown } }) {
        sent.push({ sessionId: request.sessionId, agentId: request.agentId, text: request.input?.case === "text" ? String(request.input.value) : undefined });
        yield agentEvent.done("s1", "test");
      },
    };
    return { agent, sent };
  };
  const drain = async (it: AsyncIterable<unknown>) => {
    for await (const _ of it);
  };

  it("starts a conversation with the whole catalog, so a text-only agent can add any component", async () => {
    const { agent, sent } = recorder();
    const guided = withGuide(agent as never, "analyst");
    await drain(guided.send({ sessionId: "", input: { case: "text", value: "Add a report builder" } } as never));
    await drain(guided.send({ sessionId: "s1", input: { case: "text", value: "Now a pivot" } } as never));
    expect(sent[0]!.agentId).toBe("analyst");
    expect(sent[0]!.text).toContain("ReportBuilder");
    expect(sent[0]!.text!.endsWith("Add a report builder")).toBe(true);
    expect(sent[1]!.text).toBe("Now a pivot");
    expect(loomGuide()).toContain("Explorer");
  });
});
