// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { DataSourceProvider, normalizeLayout } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { AgentInfoSchema } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnalyticsChat, placeChatPanel, voiceReplyOf } from "./AnalyticsChat.js";
import { memorySessions } from "./sessions.js";
import { emptyThread } from "./thread.js";

afterEach(cleanup);

const agent = () => scriptedAgent((request) => [agentEvent.text(`You said ${request.input?.case === "text" ? request.input.value : ""}.`), agentEvent.done("s", "Scripted test agent")]);
const send = (text: string) => {
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("AnalyticsChat", () => {
  it("is a plain conversation when given nothing else: no workspace, no menus", async () => {
    render(<AnalyticsChat agent={agent()} />);
    expect(screen.queryByRole("region", { name: "Chat panels" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add/ })).toBeNull();
    send("hello");
    expect(await screen.findByText("You said hello.")).toBeTruthy();
  });

  it("saves each conversation, lists it, and opens a saved one from the Conversations panel", async () => {
    const sessions = memorySessions();
    const agents = [create(AgentInfoSchema, { id: "a", name: "Analyst", isDefault: true, skills: [{ id: "charts", name: "Chart standards", defaultOn: true }, ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `Skill ${i}` }))] })];
    render(
      <DataSourceProvider dataSource={memoryDataSource({ tables: {} })}>
        <AnalyticsChat agent={agent()} sessions={sessions} agents={agents} onSettingsChange={() => {}} />
      </DataSourceProvider>,
    );
    send("first question");
    await screen.findByText("You said first question.");
    await waitFor(async () => expect((await sessions.list()).map((s) => s.title)).toEqual(["first question"]));

    // A menu's "View all" opens the panel with the whole list.
    fireEvent.click(screen.getByRole("button", { name: /^Agent setup:/ }));
    fireEvent.click(screen.getByRole("button", { name: "View all 7 skills…" }));
    expect(await screen.findByRole("checkbox", { name: "Skill 5" })).toBeTruthy();

    // The rail shows Conversations; a new conversation, then the old one again.
    fireEvent.click(screen.getByRole("button", { name: /Conversations/ }));
    const list = await screen.findByRole("region", { name: "Conversation list" });
    fireEvent.click(within(list).getByRole("button", { name: /New/ }));
    expect(screen.queryByText("You said first question.")).toBeNull();
    fireEvent.click(await within(list).findByRole("button", { name: /^first question/ }));
    expect(await screen.findByText("You said first question.")).toBeTruthy();
  });

  it("lists every model under where it runs in the Agent setup panel, opened from the Model menu", async () => {
    const providers = [
      { id: "server", label: "Claude on the dev server", detail: "The key stays on the server.", models: [{ id: "sonnet", label: "Claude Sonnet" }] },
      { id: "ollama", label: "Ollama on this machine", models: Array.from({ length: 7 }, (_, i) => ({ id: `m${i}` })) },
    ];
    const changes: unknown[] = [];
    render(<AnalyticsChat agent={agent()} agents={[]} providers={providers} settings={{}} onSettingsChange={(s) => changes.push(s)} />);
    fireEvent.click(screen.getByRole("button", { name: /^Model:/ }));
    expect(screen.queryByRole("radio", { name: "m6" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View all 8 models…" }));
    const local = await screen.findByRole("radiogroup", { name: "Ollama on this machine" });
    fireEvent.click(within(local).getByRole("radio", { name: "m6" }));
    expect(changes.at(-1)).toEqual({ provider: "ollama", model: "m6" });
    expect(screen.getByText("The key stays on the server.")).toBeTruthy();
  });

  it("puts a panel beside the conversation, not under it", () => {
    const ids = ["chat", "sessions", "data"];
    const one = placeChatPanel({ columns: [["chat"]], hidden: ["sessions", "data"] }, "sessions", ids);
    expect(one.columns).toEqual([["chat"], ["sessions"]]);
    const two = placeChatPanel(one, "data", ids);
    expect(two.columns).toEqual([["chat"], ["sessions", "data"]]);
    expect(normalizeLayout(two).columnWidths[0]).toBeGreaterThan(0.5);
  });

  it("gives the voice loop the latest reply and whether it waits on a person", () => {
    expect(voiceReplyOf(emptyThread)).toBeUndefined();
    const thread = { ...emptyThread, status: "waiting" as const, messages: [{ id: 3, role: "assistant" as const, parts: [{ kind: "text" as const, text: "Approve?" }], generatedBy: "x", streaming: false }] };
    expect(voiceReplyOf(thread)).toEqual({ id: "3", text: "Approve?", status: "waiting" });
  });
});
