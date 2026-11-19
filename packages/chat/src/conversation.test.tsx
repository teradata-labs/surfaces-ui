// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { type ConversationScript, analyticsCatalog, validateConversationScript } from "@surfaces-ui/spec";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chat, type ChatThread, conversationDocument, conversationThread, parseConversation, scriptAgent, scriptThread } from "./index.js";

afterEach(cleanup);

const script: ConversationScript = {
  id: "sample",
  title: "How many orders?",
  description: "A short written conversation.",
  answeredBy: "a written sample (not a model)",
  turns: [
    {
      say: "How many orders are there?",
      reply: [
        { steps: [{ title: "Count the orders", tool: "query", detail: "SELECT COUNT(*) FROM orders" }] },
        { text: "There are **12** orders." },
        { surface: { id: "main", components: [{ id: "root", component: "Stat", label: "Orders", value: 12 }] } },
      ],
    },
    {
      say: "Show the steps",
      reply: [
        { text: "Choose a step." },
        {
          surface: {
            id: "main",
            components: [
              {
                id: "root",
                component: "PipelineGraph",
                nodes: [{ id: "orders", name: "orders", kind: "source" }],
                edges: [],
                action: { event: { name: "open_node" } },
              },
            ],
          },
        },
      ],
      suggestions: [],
    },
  ],
  events: [{ name: "open_node", where: { id: "orders" }, reply: [{ text: "You chose {{name}}." }] }],
};

const all = async (stream: AsyncIterable<{ event: { case?: string; value?: unknown } }>) => {
  const out: { case?: string; value?: unknown }[] = [];
  for await (const item of stream) out.push(item.event);
  return out;
};

describe("a written conversation", () => {
  it("is valid against the catalog", () => {
    expect(validateConversationScript(script, analyticsCatalog)).toEqual([]);
    expect(validateConversationScript({ ...script, answeredBy: " " }, analyticsCatalog)).toHaveLength(1);
  });

  it("plays into a thread as live replies would, each reply keeping its own surface", () => {
    const thread = scriptThread(script, analyticsCatalog);
    expect(thread.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(thread.messages[1]!.parts.map((p) => p.kind)).toEqual(["steps", "text", "surface"]);
    expect(thread.messages[1]!.generatedBy).toBe("a written sample (not a model)");
    expect(Object.keys(thread.surfaces)).toEqual(["m2:main", "m4:main"]);
    expect(thread.status).toBe("idle");
    // After a turn the next thing to say is offered, unless the turn says otherwise.
    expect(scriptThread(script, analyticsCatalog, 1).suggestions).toEqual(["Show the steps"]);
    expect(thread.suggestions).toEqual([]);
  });

  it("keeps two written paragraphs in a row apart", () => {
    const two: ConversationScript = { ...script, turns: [{ say: "Hello", reply: [{ text: "First." }, { text: "Second." }] }] };
    const text = scriptThread(two, analyticsCatalog).messages[1]!.parts.find((p) => p.kind === "text");
    expect(text && "text" in text ? text.text : "").toBe("First.\n\nSecond.");
  });

  it("answers a message it was written for, an event from a control, and says so when it has no answer", async () => {
    const agent = scriptAgent(script, { catalog: analyticsCatalog });
    const known = await all(agent.send({ input: { case: "text", value: "  how many ORDERS are there? " } }));
    expect(known.filter((e) => e.case === "surface")).toHaveLength(2);
    expect(known.at(-1)).toMatchObject({ case: "done", value: { generatedBy: "a written sample (not a model)" } });

    const chosen = await all(agent.send({ input: { case: "action", value: { name: "open_node", surfaceId: "main", context: { id: "orders", name: "orders" } } } }));
    expect(chosen[0]).toMatchObject({ case: "text", value: { delta: "You chose orders." } });
    // An answer to an event offers the way on again, from the furthest turn played.
    expect(chosen.find((e) => e.case === "suggestions")).toMatchObject({ value: { items: ["Show the steps"] } });

    const unknown = await all(agent.send({ input: { case: "text", value: "What is the weather?" } }));
    expect(unknown[0]).toMatchObject({ case: "text" });
    expect(unknown.find((e) => e.case === "suggestions")).toMatchObject({ value: { items: ["How many orders are there?", "Show the steps"] } });
  });

  it("is kept as a document and refused when it is not one", () => {
    const thread = scriptThread(script, analyticsCatalog);
    const document = conversationDocument({ ...thread, sessionId: "secret-session" }, { id: "sample", title: "How many orders?" });
    expect(JSON.stringify(document)).not.toContain("secret-session");
    const back = parseConversation(JSON.parse(JSON.stringify(document)));
    expect(back?.thread.messages).toHaveLength(4);
    expect(conversationThread(back!).status).toBe("idle");
    expect(parseConversation({ type: "page", title: "x", thread: document.thread })).toBeUndefined();
    expect(parseConversation({ type: "conversation", title: "x", thread: { messages: [{ id: "1" }], surfaces: {} } })).toBeUndefined();
  });
});

describe("Chat opened on a conversation", () => {
  it("shows the thread, reports changes and carries on from it", async () => {
    const seen: ChatThread[] = [];
    const onThreadChange = vi.fn((thread: ChatThread) => void seen.push(thread));
    render(
      <DataSourceProvider dataSource={memoryDataSource({ tables: {} })}>
        <Chat agent={scriptAgent(script, { catalog: analyticsCatalog })} initialThread={scriptThread(script, analyticsCatalog, 1)} onThreadChange={onThreadChange} />
      </DataSourceProvider>,
    );
    expect(screen.getByText("How many orders are there?")).toBeTruthy();
    expect(screen.getByText(/Answered by a written sample/)).toBeTruthy();
    expect(seen[0]?.messages).toHaveLength(2);
    // The next thing to say is offered, and saying it adds the next reply.
    fireEvent.click(screen.getByRole("button", { name: "Show the steps" }));
    await waitFor(() => expect(screen.getByText("Choose a step.")).toBeTruthy());
    await waitFor(() => expect(seen.at(-1)?.messages).toHaveLength(4));
  });
});
