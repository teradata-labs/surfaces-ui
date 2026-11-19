// @vitest-environment jsdom
import { type SendInit, agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { ApprovalKind } from "@surfaces-ui/proto";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { memoryStorage } from "@surfaces-ui/state";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chat, parseThread } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;

describe("keeping a conversation", () => {
  it("brings back the thread, its surfaces and a waiting approval after a reload, and the answer continues the same session", async () => {
    const storage = memoryStorage();
    const first = scriptedAgent(() => [
      agentEvent.text("Here is the count."),
      agentEvent.surface({ version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } }),
      agentEvent.surface({ version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: "Kept view" }] } }),
      agentEvent.approval({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Save it as a table?" }),
      agentEvent.done("s-42", "scripted"),
    ]);
    render(<Chat agent={first} storage={storage} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Count orders" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Kept view");
    await waitFor(() => expect(storage.data["surfaces.chat"]).toContain("Save it as a table?"));
    cleanup();

    // The page reloads: a new chat over the same storage.
    const seen: SendInit[] = [];
    const second = scriptedAgent((request) => {
      seen.push(request);
      return [agentEvent.text("Saved."), agentEvent.done("s-42", "scripted")];
    });
    render(<Chat agent={second} storage={storage} user={{ id: "u2", name: "Grace" }} />);
    expect(await screen.findByText("Count orders")).toBeTruthy();
    expect(screen.getByText("Kept view")).toBeTruthy();
    const allow = await screen.findByRole("button", { name: "Allow" });
    await waitFor(() => expect((allow as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(allow);
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(seen[0]).toMatchObject({ sessionId: "s-42", input: { case: "approval", value: { id: "a1", allow: true, decidedBy: { name: "Grace" } } } });
    expect(seen[0]!.surfaces?.map((s) => s.surfaceId)).toEqual(["main"]);
  });

  it("refuses kept data that is not a thread, and marks a reply cut off by a reload", () => {
    expect(parseThread("nope")).toBeUndefined();
    expect(parseThread({ messages: [{ id: 1, role: "system", parts: [] }], surfaces: {} })).toBeUndefined();
    expect(parseThread({ messages: [{ id: 1, role: "user", parts: [{ kind: "script" }] }], surfaces: {} })).toBeUndefined();
    const cut = parseThread({ messages: [{ id: 1, role: "assistant", parts: [{ kind: "text", text: "Half" }], streaming: true }], surfaces: {}, status: "streaming" });
    expect(cut?.status).toBe("idle");
    expect(cut?.messages[0]?.parts.at(-1)).toMatchObject({ kind: "error", code: "INTERRUPTED" });
  });

  it("keeps a plain conversation as it streams in", async () => {
    const storage = memoryStorage();
    const agent = scriptedAgent(() => [agentEvent.text("Hi."), agentEvent.done("s1", "scripted")]);
    const { unmount } = render(<Chat agent={agent} storage={storage} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Hi.");
    await waitFor(() => expect(storage.data["surfaces.chat"]).toContain("Hello"));
    unmount();
  });
});
