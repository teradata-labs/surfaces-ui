// @vitest-environment jsdom
import { analyticsCatalog } from "@surfaces-ui/spec";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ChatActions, type ChatPart, type ChatThread, MessageList, type MessageListProps, parseThread } from "./index.js";

afterEach(cleanup);

const thread = (parts: ChatPart[]): ChatThread => ({
  messages: [
    { id: 1, role: "user", parts: [{ kind: "text", text: "Add headline numbers" }], generatedBy: "", streaming: false },
    { id: 2, role: "assistant", parts, generatedBy: "demo rules", streaming: false },
  ],
  surfaces: {},
  status: "idle",
  sessionId: "",
  suggestions: [],
});

const list = (parts: ChatPart[], props: Partial<MessageListProps> = {}) =>
  render(<MessageList thread={thread(parts)} catalog={analyticsCatalog} renderers={{}} onAction={() => {}} onAnswer={() => {}} {...props} />);

const proposal: ChatActions = {
  id: "p1",
  title: "Proposed: 2 added",
  detail: "Drawn on the page.",
  buttons: [
    { id: "show", label: "Show on the page" },
    { id: "discard", label: "Discard" },
    { id: "apply", label: "Apply", variant: "primary", disabled: true, reason: "A viewer cannot change the prototype" },
  ],
};

const ways: ChatActions = {
  id: "w1",
  title: "3 ways to choose from",
  choices: ["Bold", "Quiet", "Dense"].map((way) => ({
    id: way.toLowerCase(),
    title: way,
    detail: "2 added",
    buttons: [
      { id: "look", label: "Look at it", ariaLabel: `Look at “${way}” alone` },
      { id: "apply", label: "Apply", variant: "primary" as const, ariaLabel: `Apply “${way}” from the chat` },
    ],
  })),
  buttons: [{ id: "discard", label: "Discard all" }],
};

describe("Actions in a reply", () => {
  it("draws a named group under the reply with its title, detail and buttons in order", () => {
    list([{ kind: "text", text: "Here is a change." }, { kind: "actions", actions: proposal }]);
    const group = screen.getByRole("group", { name: "Proposed: 2 added" });
    expect(within(group).getByText("Drawn on the page.")).toBeTruthy();
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Show on the page", "Discard", "Apply"]);
    expect(within(group).getByRole("button", { name: "Apply" }).getAttribute("data-variant")).toBe("primary");
    // It is part of the reply, before who answered.
    const reply = group.closest("article")!;
    expect(reply.getAttribute("data-role")).toBe("assistant");
    expect(reply.lastElementChild?.textContent).toBe("Answered by demo rules");
  });

  it("tells the host which part and which button was pressed", () => {
    const onPartAction = vi.fn();
    list([{ kind: "actions", actions: proposal }], { onPartAction });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onPartAction).toHaveBeenCalledWith("p1", "discard", undefined);
  });

  it("keeps a disabled button reachable by keyboard, says why, and never presses it", () => {
    const onPartAction = vi.fn();
    list([{ kind: "actions", actions: proposal }], { onPartAction });
    const apply = screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    expect(apply.getAttribute("aria-disabled")).toBe("true");
    expect(apply.title).toBe("A viewer cannot change the prototype");
    const described = document.getElementById(apply.getAttribute("aria-describedby")!);
    expect(described?.textContent).toBe("A viewer cannot change the prototype");
    apply.focus();
    expect(document.activeElement).toBe(apply);
    fireEvent.click(apply);
    expect(onPartAction).not.toHaveBeenCalled();
  });

  it("puts every button in the tab order, and a key press reaches the host as a click", () => {
    const onPartAction = vi.fn();
    list([{ kind: "actions", actions: proposal }], { onPartAction });
    for (const button of screen.getAllByRole("button")) expect(button.tabIndex).toBe(0);
    const show = screen.getByRole("button", { name: "Show on the page" });
    show.focus();
    expect(document.activeElement).toBe(show);
    // A native button: Enter and Space press it, which the browser turns into a click.
    expect(show.tagName).toBe("BUTTON");
    expect(show.getAttribute("type")).toBe("button");
    fireEvent.click(show);
    expect(onPartAction).toHaveBeenCalledWith("p1", "show", undefined);
  });

  it("draws alternatives as one row each, named by the choice, and says which choice a press came from", () => {
    const onPartAction = vi.fn();
    list([{ kind: "actions", actions: ways }], { onPartAction });
    const set = screen.getByRole("group", { name: "3 ways to choose from" });
    const choices = within(set).getByRole("list", { name: "Choices" });
    expect(within(choices).getAllByRole("listitem")).toHaveLength(3);
    const quiet = within(set).getByRole("group", { name: "Quiet" });
    expect(within(quiet).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Look at “Quiet” alone", "Apply “Quiet” from the chat"]);
    fireEvent.click(within(quiet).getByRole("button", { name: "Apply “Quiet” from the chat" }));
    expect(onPartAction).toHaveBeenLastCalledWith("w1", "apply", "quiet");
    fireEvent.click(within(set).getByRole("group", { name: "All choices" }).querySelector("button")!);
    expect(onPartAction).toHaveBeenLastCalledWith("w1", "discard", undefined);
  });

  it("replaces every button with the outcome once handled", () => {
    list([{ kind: "actions", actions: { ...ways, outcome: "Applied “Quiet”." } }]);
    const set = screen.getByRole("group", { name: "3 ways to choose from" });
    expect(within(set).queryAllByRole("button")).toHaveLength(0);
    expect(within(set).getByRole("status").textContent).toBe("Applied “Quiet”.");
    expect(set.hasAttribute("data-handled")).toBe(true);
  });

  it("is named Actions when it has no title, and works without a callback", () => {
    list([{ kind: "actions", actions: { id: "a", buttons: [{ id: "ok", label: "OK" }] } }]);
    const group = screen.getByRole("group", { name: "Actions" });
    fireEvent.click(within(group).getByRole("button", { name: "OK" }));
  });

  it("draws a reply without actions as before", () => {
    const { container } = list([{ kind: "text", text: "Just words." }]);
    expect(container.querySelector(".sf-chat-actions")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByText("Just words.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps an actions part when a stored thread is read back", () => {
    const stored = JSON.parse(JSON.stringify(thread([{ kind: "actions", actions: proposal }])));
    expect(parseThread(stored)?.messages[1]?.parts[0]).toEqual({ kind: "actions", actions: proposal });
  });
});
