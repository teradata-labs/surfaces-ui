// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION } from "../dynamic.js";
import { type SurfaceAction, type SurfaceComponent, type SurfaceMessage, applyMessages } from "../surface.js";
import { REPLY_DELAY_MS } from "./conversation.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const v = A2UI_VERSION;
const surfaceOf = (components: SurfaceComponent[], data?: unknown) => {
  const messages: SurfaceMessage[] = [
    { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
    { version: v, updateComponents: { surfaceId: "main", components } },
  ];
  if (data !== undefined) messages.push({ version: v, updateDataModel: { surfaceId: "main", path: "/", value: data } });
  return applyMessages({}, messages).main!;
};

const turns = (container: HTMLElement) =>
  [...container.querySelectorAll(".sf-a2-message")].map((el) => `${el.getAttribute("data-side")} ${el.querySelector("b")!.textContent}: ${el.querySelector(".sf-a2-message-body")!.textContent}`);

describe("Conversation", () => {
  it("is valid as its example, and draws the thread, the suggestions and the box", () => {
    const example = analyticsCatalog.components.Conversation!.example as SurfaceComponent;
    expect(analyticsCatalog.validateComponent(example)).toEqual([]);
    const { container } = render(<SurfaceView surface={surfaceOf([{ ...example, id: "root" }])} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.getByRole("region", { name: "Support chat" })).toBeTruthy();
    expect(turns(container)).toEqual(["start Assistant: Hi! What can I help you with today?", "end You: My last order hasn't arrived.", "start Assistant: Sorry about that. Which order is it?"]);
    expect(within(screen.getByRole("group", { name: "Suggested replies" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["The one from Monday", "Show my orders"]);
    expect(screen.getByRole("log")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds a sent turn at once, sends it, and answers with the next scripted reply", () => {
    vi.useFakeTimers();
    const onAction = vi.fn<(action: SurfaceAction) => void>();
    const surface = surfaceOf([
      {
        id: "root",
        component: "Conversation",
        label: "Help",
        messages: [{ speaker: "Bot", text: "Ask me anything." }],
        you: "Ana",
        suggestions: ["Where is my order?"],
        replies: [
          { speaker: "Bot", text: "It arrives **tomorrow**." },
          { speaker: "Bot", text: "Anything else?" },
        ],
        action: { event: { name: "send" } },
      } as SurfaceComponent,
    ]);
    const { container } = render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Where is my order?" }));
    expect(turns(container)).toEqual(["start Bot: Ask me anything.", "end Ana: Where is my order?"]);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "send", context: expect.objectContaining({ text: "Where is my order?" }) }));
    expect(screen.queryByRole("group", { name: "Suggested replies" })).toBeNull();
    expect(screen.getByText("Bot is writing…")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(REPLY_DELAY_MS));
    expect(turns(container).at(-1)).toBe("start Bot: It arrives tomorrow.");
    expect(container.querySelector(".sf-a2-message:last-child strong")!.textContent).toBe("tomorrow");

    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "Thanks" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect((box as HTMLTextAreaElement).value).toBe("");
    act(() => void vi.advanceTimersByTime(REPLY_DELAY_MS));
    expect(turns(container).slice(-2)).toEqual(["end Ana: Thanks", "start Bot: Anything else?"]);

    // The script has run out: a turn sent now waits for an agent.
    fireEvent.change(box, { target: { value: "Bye" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    act(() => void vi.advanceTimersByTime(REPLY_DELAY_MS));
    expect(turns(container).at(-1)).toBe("end Ana: Bye");
    expect(screen.queryByText(/is writing/)).toBeNull();
  });

  it("keeps Shift and Enter for a new line, and sends nothing blank", () => {
    const onAction = vi.fn();
    const surface = surfaceOf([{ id: "root", component: "Conversation", label: "Chat", messages: [], action: { event: { name: "send" } } } as SurfaceComponent]);
    const { container } = render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.change(box, { target: { value: "two\nlines" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(turns(container)).toEqual([]);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("with messages bound to a path, shows a sent turn until the agent adds it, then draws the agent's list", () => {
    const onDataChange = vi.fn();
    const onAction = vi.fn<(action: SurfaceAction) => void>();
    const component = { id: "root", component: "Conversation", label: "Chat", messages: { "@path": "/chat" }, action: { event: { name: "send" } } } as SurfaceComponent;
    const hello = { speaker: "Agent", text: "Hello." };
    const surface = surfaceOf([component], { chat: [hello] });
    const view = (s: typeof surface) => <SurfaceView surface={s} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onDataChange={onDataChange} />;
    const { container, rerender } = render(view(surface));
    const box = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(box, { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(turns(container)).toEqual(["start Agent: Hello.", "end You: Hi"]);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ name: "send", context: expect.objectContaining({ text: "Hi" }) }));
    // Nothing is written into the data model, so the agent's later updates to the path are never hidden.
    expect(onDataChange).not.toHaveBeenCalled();

    // The agent answers by adding the person's turn and its own to the list: each is drawn once.
    rerender(view(surfaceOf([component], { chat: [hello, { speaker: "You", text: "Hi", side: "end" }, { speaker: "Agent", text: "How can I help?" }] })));
    expect(turns(container)).toEqual(["start Agent: Hello.", "end You: Hi", "start Agent: How can I help?"]);
  });

  it("drops a sent turn only as many times as the thread holds it", async () => {
    const { unheld } = await import("./conversation.js");
    const yes = { speaker: "You", text: "Yes", side: "end" as const };
    expect(unheld([yes], [yes, yes])).toEqual([yes]);
    expect(unheld([{ speaker: "You", text: "Yes" }], [yes])).toEqual([yes]);
  });

  it("refuses turns that are not turns", () => {
    const problems = analyticsCatalog.validateComponent({ id: "c", component: "Conversation", label: "Chat", messages: [{ who: "x" }] } as SurfaceComponent);
    expect(problems.length).toBeGreaterThan(0);
  });
});
