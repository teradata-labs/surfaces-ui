// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import type { DataRef } from "@surfaces-ui/components";
import { AgentInfoSchema, ConnectorStatus } from "@surfaces-ui/proto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer, type ComposerProps } from "./ChatComposer.js";
import { type SpeechAdapter, type SpeechHandlers, speakableText } from "./speech.js";
import { settingsRequest, type ChatSettings } from "./useChat.js";
import type { VoiceReply } from "./voice.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const agents = [
  create(AgentInfoSchema, {
    id: "analyst",
    name: "Analyst",
    isDefault: true,
    defaultModel: "small",
    models: [
      { id: "small", label: "Small" },
      { id: "large", label: "Large" },
    ],
    skills: [
      { id: "charts", name: "Chart standards", defaultOn: true },
      { id: "clean", name: "Data cleaning" },
    ],
    connectors: [
      { id: "jira", name: "Jira", status: ConnectorStatus.CONNECTED },
      { id: "drive", name: "Drive", status: ConnectorStatus.NEEDS_SIGN_IN, signInUrl: "https://example.com/sign-in" },
    ],
  }),
  create(AgentInfoSchema, { id: "pipes", name: "Pipelines" }),
];

function Host(props: Partial<ComposerProps> & { initial?: ChatSettings }) {
  const [settings, setSettings] = useState<ChatSettings>(props.initial ?? {});
  return (
    <>
      <ChatComposer onSend={() => {}} {...props} settings={settings} onSettingsChange={setSettings} />
      <output data-testid="settings">{JSON.stringify(settings)}</output>
    </>
  );
}
const settingsNow = () => JSON.parse(screen.getByTestId("settings").textContent!) as ChatSettings;

describe("ChatComposer", () => {
  it("sends with an arrow named Send, and shows only the box and Send when given nothing else", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    const send = screen.getByRole("button", { name: "Send" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Revenue by month" } });
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledWith("Revenue by month", []);
    // Nothing optional is drawn.
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Send"]);
  });

  it("shows Stop while a reply streams", () => {
    const onStop = vi.fn();
    render(<ChatComposer onSend={() => {}} streaming onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("uploads any file through the host, attaching what became data and naming what did not", async () => {
    const onSend = vi.fn();
    const ref: DataRef = { sourceId: "local", kind: "table", table: "orders" };
    const attachFiles = vi.fn(async (files: File[]) => files.map((file) => (file.name.endsWith(".csv") ? { file, ref } : { file, error: "Not a format that can be read as a table." })));
    render(<ChatComposer onSend={onSend} attachFiles={attachFiles} />);
    fireEvent.click(screen.getByRole("button", { name: "Add files or data" }));
    expect(screen.getByRole("button", { name: /Upload files/ })).toBeTruthy();
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    expect(input.accept).toBe("");
    fireEvent.change(input, { target: { files: [new File(["a,b"], "orders.csv"), new File(["x"], "notes.pdf")] } });
    const attached = await screen.findByRole("list", { name: "Attached to this message" });
    await waitFor(() => expect(within(attached).getByText("Not a format that can be read as a table.")).toBeTruthy());
    expect(within(attached).getByText("orders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove notes.pdf" }));
    expect(within(attached).queryByText("notes.pdf")).toBeNull();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "What is in it?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("What is in it?", [ref]);
  });

  it("takes files dropped on it", async () => {
    const attachFiles = vi.fn(async (files: File[]) => files.map((file) => ({ file, ref: { sourceId: "local", kind: "file" as const, table: "", path: file.name } })));
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} />);
    const form = screen.getByLabelText("Message").closest("form")!;
    const file = new File(["{}"], "events.json");
    fireEvent.drop(form, { dataTransfer: { files: [file], types: ["Files"], getData: () => "" } });
    await waitFor(() => expect(attachFiles).toHaveBeenCalledWith([file]));
  });

  it("opens the data panel from + and Add data when the host has one", () => {
    const onManage = vi.fn();
    render(<ChatComposer onSend={() => {}} onManage={onManage} />);
    fireEvent.click(screen.getByRole("button", { name: "Add data" }));
    fireEvent.click(screen.getByRole("button", { name: "Add files or data" }));
    fireEvent.click(screen.getByRole("button", { name: /Add tables and files/ }));
    expect(onManage.mock.calls).toEqual([["data"], ["data"]]);
  });

  it("chooses the model on its own, and the agent, skills and connectors in one menu, all going with the turn", () => {
    const onManage = vi.fn();
    render(<Host agents={agents} onManage={onManage} menuLimit={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Model: Small" }));
    fireEvent.click(screen.getByRole("radio", { name: /Large/ }));
    expect(settingsNow()).toEqual({ model: "large" });

    // One button for the agent's setup, saying where it stands.
    const setup = screen.getByRole("button", { name: "Agent setup: Analyst · 1 skill · 0 tools" });
    fireEvent.click(setup);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Agent: Analyst", "Skills: 1 of 2 on", "Connectors: 0 of 2 tools on"]);

    // Skills opens in place, with a way back.
    fireEvent.click(within(dialog).getByRole("button", { name: /^Skills/ }));
    expect(document.activeElement?.textContent).toBe("Agent setup");
    fireEvent.click(screen.getByRole("checkbox", { name: /Chart standards/ }));
    expect(settingsNow()).toMatchObject({ skillIds: [], connectorIds: [] });
    // One shown of two: the rest are in the panel.
    expect(screen.queryByRole("checkbox", { name: /Data cleaning/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View all 2 skills…" }));
    expect(onManage).toHaveBeenCalledWith("setup");

    // ← comes back to the sections, on the row just left; → goes in.
    fireEvent.click(screen.getByRole("button", { name: /^Agent setup/ }));
    fireEvent.keyDown(screen.getByRole("button", { name: /^Skills/ }), { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Skills/);
    fireEvent.keyDown(screen.getByRole("button", { name: /^Connectors/ }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Jira/ }));
    expect(settingsNow().connectorIds).toEqual(["jira"]);
    expect(settingsRequest(settingsNow(), "analyst")).toMatchObject({ agentId: "analyst", model: "large", choicesSet: true, skillIds: [], connectorIds: ["jira"] });

    // Escape inside a section comes back, leaving the menu open.
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(setup.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /^Agent:/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Agent:/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Pipelines/ }));
    // Another agent starts from its own defaults; this one offers no models, skills or tools.
    expect(settingsNow()).toEqual({ agentId: "pipes" });
    expect(screen.queryByRole("button", { name: /^Model/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Agent setup: Pipelines$/ })).toBeTruthy();
  });

  it("opens straight on the only section, offers sign-in, and closes on Escape", () => {
    const onConnect = vi.fn();
    const one = [create(AgentInfoSchema, { ...agents[0]!, skills: [] })];
    render(<Host agents={one} onConnect={onConnect} />);
    const button = screen.getByRole("button", { name: /^Agent setup/ });
    fireEvent.click(button);
    expect(screen.queryByRole("button", { name: /^Agent setup/, hidden: false })).toBe(button);
    fireEvent.click(screen.getByRole("button", { name: /Sign in to Drive/ }));
    expect(onConnect).toHaveBeenCalledWith(expect.objectContaining({ id: "drive" }));
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });
});

/** A speech adapter driven by the test. */
function fakeSpeech() {
  const said: string[] = [];
  let handlers: SpeechHandlers | undefined;
  const speaking: (() => void)[] = [];
  const adapter: SpeechAdapter = {
    supported: () => true,
    label: "A test voice.",
    listen(h) {
      handlers = h;
      return () => {
        handlers = undefined;
      };
    },
    speak(text) {
      said.push(text);
      return new Promise<void>((resolve) => speaking.push(resolve));
    },
    cancelSpeech: vi.fn(),
  };
  return {
    adapter,
    said,
    hear: (text: string) => act(() => handlers?.onFinal(text)),
    partial: (text: string) => act(() => handlers?.onPartial(text)),
    end: () => act(() => handlers?.onEnd()),
    listening: () => !!handlers,
    finishSpeaking: () => act(async () => speaking.shift()?.()),
  };
}

function VoiceHost({ speech, reply, onSend }: { speech: SpeechAdapter; reply?: VoiceReply; onSend(text: string): void }) {
  return <ChatComposer onSend={onSend} speech={speech} voiceReply={reply} />;
}

describe("providers", () => {
  it("groups models by where they run and sets provider and model together", () => {
    const providers = [
      { id: "server", label: "Dev server (Claude)", models: [{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }, { id: "claude-opus-5-5", label: "Claude Opus 5.5" }] },
      { id: "ollama", label: "Ollama on this machine", models: [{ id: "qwen3:8b" }] },
    ];
    const onSettingsChange = vi.fn();
    const onManageProviders = vi.fn();
    render(<ChatComposer onSend={() => {}} agents={[]} providers={providers} settings={{}} onSettingsChange={onSettingsChange} onManageProviders={onManageProviders} />);
    fireEvent.click(screen.getByRole("button", { name: "Model: Claude Sonnet 5.5, Dev server (Claude)" }));
    const local = screen.getByRole("group", { name: "Ollama on this machine" });
    fireEvent.click(within(local).getByRole("radio", { name: /qwen3:8b/ }));
    expect(onSettingsChange).toHaveBeenCalledWith({ provider: "ollama", model: "qwen3:8b" });
    // The provider's backend gets the model from the host; the turn does not carry it.
    expect(settingsRequest({ provider: "ollama", model: "qwen3:8b" }).model).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /^Model:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Manage providers…" }));
    expect(onManageProviders).toHaveBeenCalledOnce();
  });
});

describe("voice", () => {
  it("hides the microphone where speech is not supported", () => {
    render(<ChatComposer onSend={() => {}} speech={{ supported: () => false, label: "", listen: () => () => {} }} />);
    expect(screen.queryByRole("button", { name: "Dictate" })).toBeNull();
  });

  it("asks once before listening, saying where audio goes", () => {
    const fake = fakeSpeech();
    const onGive = vi.fn();
    const { rerender } = render(<ChatComposer onSend={() => {}} speech={fake.adapter} speechConsent={{ given: false, onGive }} />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    const ask = screen.getByRole("group", { name: "Use voice?" });
    expect(ask.textContent).toContain(fake.adapter.label);
    expect(fake.listening()).toBe(false);
    fireEvent.click(within(ask).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("group", { name: "Use voice?" })).toBeNull();
    expect(onGive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    fireEvent.click(screen.getByRole("button", { name: "Use voice" }));
    expect(onGive).toHaveBeenCalledOnce();
    expect(fake.listening()).toBe(true);
    rerender(<ChatComposer onSend={() => {}} speech={fake.adapter} speechConsent={{ given: true, onGive }} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop dictating" }));
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    expect(screen.queryByRole("group", { name: "Use voice?" })).toBeNull();
  });

  it("dictates into the box without sending", () => {
    const fake = fakeSpeech();
    const onSend = vi.fn();
    render(<VoiceHost speech={fake.adapter} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    expect(screen.getByRole("button", { name: "Stop dictating" }).getAttribute("aria-pressed")).toBe("true");
    fake.partial("revenue by");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("revenue by");
    fake.hear("revenue by month");
    fake.end();
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("revenue by month");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Dictate" })).toBeTruthy();
  });

  it("converses: sends after a pause, reads the reply, listens again, and pauses for a decision", async () => {
    vi.useFakeTimers();
    const fake = fakeSpeech();
    const onSend = vi.fn();
    const { rerender } = render(<VoiceHost speech={fake.adapter} onSend={onSend} reply={{ id: "1", text: "Hello", status: "idle" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Talk" }));
    expect(screen.getByText("Listening. Pause when you are done.")).toBeTruthy();
    fake.hear("show revenue by month");
    act(() => vi.advanceTimersByTime(1300));
    expect(onSend).toHaveBeenCalledWith("show revenue by month", []);
    expect(fake.listening()).toBe(false);
    expect(screen.getByText("Sent. Waiting for the reply…")).toBeTruthy();

    // The old reply does not count; the new one is read once it is done.
    rerender(<VoiceHost speech={fake.adapter} onSend={onSend} reply={{ id: "2", text: "", status: "streaming" }} />);
    expect(fake.said).toEqual([]);
    rerender(<VoiceHost speech={fake.adapter} onSend={onSend} reply={{ id: "2", text: "Revenue **rose**.\n\n```sql\nSELECT 1\n```", status: "idle" }} />);
    expect(fake.said).toEqual(["Revenue rose. (code shown on screen)"]);
    expect(screen.getByText("Reading the reply aloud.")).toBeTruthy();
    await fake.finishSpeaking();
    expect(fake.listening()).toBe(true);

    // A reply that asks for a decision stops the loop: it needs the person's hands.
    fake.hear("drop the old rows");
    act(() => vi.advanceTimersByTime(1300));
    rerender(<VoiceHost speech={fake.adapter} onSend={onSend} reply={{ id: "3", text: "Approve?", status: "waiting" }} />);
    expect(screen.getByText("Paused: the reply needs your decision.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Talk" })).toBeTruthy();
  });

  it("keeps listening when the browser ends recognition, and stops on Escape or after a long silence", () => {
    vi.useFakeTimers();
    const fake = fakeSpeech();
    render(<VoiceHost speech={fake.adapter} onSend={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Talk" }));
    fake.end();
    expect(fake.listening()).toBe(true);
    fireEvent.keyDown(screen.getByLabelText("Message"), { key: "Escape" });
    expect(fake.listening()).toBe(false);
    expect(screen.getByText("Stopped.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Talk" }));
    act(() => vi.advanceTimersByTime(30_001));
    expect(fake.listening()).toBe(false);
    expect(screen.getByText("Stopped listening after a long silence.")).toBeTruthy();
  });

  it("reads words, not markup", () => {
    expect(speakableText("# Result\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nSee [the docs](https://x).")).toBe("Result. (table shown on screen) See the docs.");
  });
});
