// @vitest-environment jsdom
import { memorySurfaceLibrary } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type SessionListState, SessionList, arrangeSessions, dayBucket } from "./SessionList.js";
import { type ChatSessionSummary, librarySessions, memorySessions } from "./sessions.js";
import { type ChatThread, emptyThread } from "./thread.js";

afterEach(cleanup);

const now = new Date("2026-11-15T12:00:00Z");
const thread = (said: string, answer = "Here it is."): ChatThread => ({
  ...emptyThread,
  messages: [
    { id: 1, role: "user", parts: [{ kind: "text", text: said }, { kind: "references", references: [{ sourceId: "retail", kind: "table", table: "orders" }] }], generatedBy: "", streaming: false },
    { id: 2, role: "assistant", parts: [{ kind: "text", text: answer }], generatedBy: "Scripted demo", streaming: false },
  ],
});
const s = (id: string, title: string, updatedAt: string, extra: Partial<ChatSessionSummary> = {}): ChatSessionSummary => ({ id, title, createdAt: updatedAt, updatedAt, sources: [], tags: [], pinned: false, messageCount: 2, lastMessage: "", ...extra });
const sample = [
  s("a", "Refunds by store", "2026-11-15T09:00:00Z", { agentId: "analyst", sources: ["retail"], tags: ["refunds"] }),
  s("b", "Churn drivers", "2026-11-14T09:00:00Z", { agentId: "analyst", sources: ["telco"] }),
  s("c", "Pipeline checks", "2026-11-10T09:00:00Z", { agentId: "pipes", sources: ["retail"], pinned: true }),
  s("d", "Old question", "2026-09-01T09:00:00Z", { lastMessage: "about margins" }),
];

describe("session stores", () => {
  it("keeps conversations in memory, titled from the first thing said, with their sources", async () => {
    const sessions = memorySessions({ now: () => now });
    const saved = await sessions.save({ thread: thread("Which stores drive refunds?"), agentId: "analyst" });
    expect(saved).toMatchObject({ title: "Which stores drive refunds?", agentId: "analyst", sources: ["retail"], messageCount: 2, lastMessage: "Here it is." });
    await sessions.save({ id: saved.id, thread: thread("Which stores drive refunds?", "Store 12.") });
    await sessions.pin(saved.id, true);
    await sessions.rename(saved.id, "Refunds");
    expect(await sessions.list()).toEqual([expect.objectContaining({ id: saved.id, title: "Refunds", pinned: true, lastMessage: "Store 12." })]);
    expect((await sessions.load(saved.id)).thread.messages).toHaveLength(2);
    await sessions.remove(saved.id);
    expect(await sessions.list()).toEqual([]);
  });

  it("keeps conversations in a surface library, one version per save, with what a list needs in one call", async () => {
    const library = memorySurfaceLibrary();
    const sessions = librarySessions(library, { savedBy: "Ada" });
    const saved = await sessions.save({ thread: thread("Revenue by month"), agentId: "analyst", model: "large", tags: ["finance"] });
    await sessions.pin(saved.id, true);
    await sessions.rename(saved.id, "Monthly revenue");
    const [listed] = await sessions.list();
    expect(listed).toMatchObject({ id: saved.id, title: "Monthly revenue", agentId: "analyst", model: "large", sources: ["retail"], tags: ["finance"], pinned: true, messageCount: 2, lastMessage: "Here it is.", createdAt: saved.createdAt });
    expect((await library.listSurfaceVersions({ id: saved.id })).versions).toHaveLength(3);
    // The Library sees an ordinary conversation document.
    const { surface } = await library.getSurface({ id: saved.id });
    expect(surface?.document).toMatchObject({ type: "conversation", title: "Monthly revenue" });
    expect((await sessions.load(saved.id)).thread.messages[1]!.parts).toEqual([{ kind: "text", text: "Here it is." }]);
    // A later save keeps the title, the tags and the pin.
    await sessions.save({ id: saved.id, thread: thread("Revenue by month", "Up 4%.") });
    expect((await sessions.list())[0]).toMatchObject({ title: "Monthly revenue", tags: ["finance"], pinned: true, lastMessage: "Up 4%." });
    await sessions.remove(saved.id);
    expect(await sessions.list()).toEqual([]);
  });
});

describe("arrangeSessions", () => {
  it("searches, filters relative to today, sorts with pinned first, and groups", () => {
    const titles = (state: SessionListState) => arrangeSessions(sample, state, { now }).map((g) => [g.label, g.sessions.map((x) => x.id)]);
    expect(titles({})).toEqual([["", ["c", "a", "b", "d"]]]);
    expect(titles({ search: "margins" })).toEqual([["", ["d"]]]);
    expect(titles({ since: "7d" })).toEqual([["", ["c", "a", "b"]]]);
    expect(titles({ since: "older" })).toEqual([["", ["d"]]]);
    expect(titles({ sources: ["retail"], sort: "title" })).toEqual([["", ["c", "a"]]]);
    expect(titles({ agents: ["pipes"] })).toEqual([["", ["c"]]]);
    expect(titles({ groupBy: "day" })).toEqual([
      ["Pinned", ["c"]],
      ["Today", ["a"]],
      ["Yesterday", ["b"]],
      ["Older", ["d"]],
    ]);
    expect(titles({ groupBy: "source" })).toEqual([
      ["retail", ["c", "a"]],
      ["telco", ["b"]],
      ["No data attached", ["d"]],
    ]);
    expect(dayBucket("2026-11-12T00:00:00Z", now)).toBe("Previous 7 days");
  });
});

function Host({ sessions }: { sessions: ChatSessionSummary[] }) {
  const [list, setList] = useState(sessions);
  const [state, setState] = useState<SessionListState>({});
  const onOpen = vi.fn();
  return (
    <>
      <SessionList
        sessions={list}
        value={state}
        onChange={setState}
        now={now}
        onOpen={onOpen}
        onRename={(id, title) => setList((all) => all.map((x) => (x.id === id ? { ...x, title } : x)))}
        onPin={(id, pinned) => setList((all) => all.map((x) => (x.id === id ? { ...x, pinned } : x)))}
        onRemove={(id) => setList((all) => all.filter((x) => x.id !== id))}
        agentName={(id) => ({ analyst: "Analyst", pipes: "Pipelines" })[id] ?? id}
      />
      <output data-testid="state">{JSON.stringify(state)}</output>
    </>
  );
}
const rowTitles = () => screen.getAllByRole("button").filter((b) => b.classList.contains("sf-session-open")).map((b) => b.querySelector(".sf-session-title")!.textContent);

describe("SessionList", () => {
  it("searches, groups and sorts through plain state", () => {
    render(<Host sessions={sample} />);
    expect(rowTitles()).toEqual(["Pinned: Pipeline checks", "Refunds by store", "Churn drivers", "Old question"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search conversations" }), { target: { value: "churn" } });
    expect(rowTitles()).toEqual(["Churn drivers"]);
    expect(document.querySelector(".sf-sessions-status")!.textContent).toBe("1 of 4 conversations");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Group: No grouping" }));
    fireEvent.click(screen.getByRole("radio", { name: "Agent" }));
    expect(screen.getAllByRole("presentation").map((g) => g.textContent)).toEqual(["Analyst 2", "Pipelines 1", "No agent named 1"]);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pinned only" }));
    expect(rowTitles()).toEqual(["Pinned: Pipeline checks"]);
    expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual({ groupBy: "agent", pinned: true });
  });

  it("renames, pins and deletes from the keyboard, asking before a delete", () => {
    render(<Host sessions={sample} />);
    const row = () => screen.getByRole("button", { name: /^Churn drivers/ });
    fireEvent.keyDown(row(), { key: "F2" });
    const input = screen.getByLabelText("New title for Churn drivers");
    fireEvent.change(input, { target: { value: "Why subscribers leave" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("button", { name: /^Why subscribers leave/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("button", { name: /^Why subscribers leave/ }), { key: "p" });
    expect(rowTitles().slice(0, 2)).toEqual(["Pinned: Why subscribers leave", "Pinned: Pipeline checks"]);

    fireEvent.keyDown(screen.getByRole("button", { name: /^Old question/ }), { key: "Delete" });
    const ask = screen.getByRole("alert");
    expect(ask.textContent).toMatch(/cannot be brought back/);
    fireEvent.click(within(ask).getByRole("button", { name: "Keep" }));
    expect(rowTitles()).toContain("Old question");
    fireEvent.click(screen.getByRole("button", { name: "Remove Old question" }));
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Delete" }));
    expect(rowTitles()).not.toContain("Old question");
  });

  it("draws only the rows in view when it scrolls inside", () => {
    const many = Array.from({ length: 500 }, (_, i) => s(`s${i}`, `Question ${i}`, new Date(now.getTime() - i * 60_000).toISOString()));
    render(<SessionList sessions={many} onOpen={() => {}} height={280} rowHeight={56} now={now} />);
    expect(rowTitles().length).toBeLessThan(20);
  });
});
