// @vitest-environment jsdom
import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { createRecorder } from "@surfaces-ui/trace";
import { TraceProvider } from "@surfaces-ui/trace/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chat } from "./index.js";

afterEach(cleanup);
const v = A2UI_VERSION;

describe("tracing a chat", () => {
  it("records a turn as one trace: the turn, its surface messages, and what they drew", async () => {
    const recorder = createRecorder();
    const agent = scriptedAgent((_, turn) =>
      turn === 0
        ? [
            agentEvent.text("Here is revenue."),
            agentEvent.surface({ version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } }),
            agentEvent.surface({ version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Stat", label: "Revenue", value: 10 }] } as never }),
            // Refused: nothing is drawn for it, and it is recorded as a problem.
            agentEvent.surface({ version: v, updateComponents: { surfaceId: "elsewhere", components: [{ id: "root", component: "Text", text: "Lost" }] } as never }),
            agentEvent.done("s1", "scripted demo"),
          ]
        : [agentEvent.text("Again."), agentEvent.done("s1", "scripted demo")],
    );
    render(
      <TraceProvider recorder={recorder}>
        <Chat agent={agent} />
      </TraceProvider>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Show revenue" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Revenue")).toBeTruthy());
    await waitFor(() => expect(recorder.get().events.find((e) => e.kind === "agent")?.status).toBe("ok"));

    const { events } = recorder.get();
    const turn = events.find((e) => e.kind === "agent")!;
    expect(turn.detail).toMatchObject({ request: { input: { case: "text", text: "Show revenue" } }, text: "Here is revenue.", surfaceMessages: 3, generatedBy: "scripted demo" });
    const messages = events.filter((e) => e.kind === "message");
    expect(messages.map((e) => [e.name, e.status, e.parentId === turn.spanId])).toEqual([["createSurface", "ok", true], ["updateComponents", "ok", true], ["updateComponents", "error", true]]);
    expect(messages[0]!.surfaceId).toMatch(/^c\d+:m2:main$/);
    expect(events.find((e) => e.kind === "problem")).toMatchObject({ parentId: messages[2]!.spanId });
    // The component the turn drew belongs to the turn's trace, under the message that drew it.
    expect(events.find((e) => e.kind === "component")).toMatchObject({ name: 'Stat "root"', traceId: turn.traceId, parentId: messages[1]!.spanId, surfaceId: messages[0]!.surfaceId });
    // One turn, one trace.
    expect(new Set(events.map((e) => e.traceId)).size).toBe(1);
  });
});
