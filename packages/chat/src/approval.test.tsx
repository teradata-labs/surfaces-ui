// @vitest-environment jsdom
import { type SendInit, agentEvent, approvalDigest, scriptedAgent, withDigest } from "@surfaces-ui/agent";
import { ApprovalKind, ApprovalRisk } from "@surfaces-ui/proto";
import { EditorView } from "@codemirror/view";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Chat } from "./index.js";

afterEach(cleanup);

const plan = { table: "orders", steps: ["drop rows with no order_id"] };

/** A chat whose agent asks once, then records what came back. */
function ask(request: Parameters<typeof agentEvent.approval>[0], user = { id: "u1", name: "Ada" }) {
  const seen: SendInit[] = [];
  const agent = scriptedAgent((r, turn) => {
    seen.push(r);
    return turn === 0 ? [agentEvent.approval(request)] : [agentEvent.text("Done."), agentEvent.done("s1", "scripted")];
  });
  render(<Chat agent={agent} user={user} />);
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Clean orders" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  return seen;
}

const approvalSent = (seen: SendInit[]) => (seen[1]?.input?.case === "approval" ? seen[1].input.value : undefined);

describe("ApprovalCard", () => {
  it("records who decided, when, why, and the digest of what they saw", async () => {
    const request = await withDigest({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Clean orders?", sql: "SELECT 1", subject: plan, reasonRequired: true });
    const seen = ask(request);
    const allow = await screen.findByRole("button", { name: "Allow" });
    await waitFor(() => expect((allow as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(allow);
    expect((await screen.findByRole("alert")).textContent).toMatch(/reason/i);
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Checked the counts" } });
    fireEvent.click(allow);
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(approvalSent(seen)).toMatchObject({ allow: true, reason: "Checked the counts", digest: request.digest, decidedBy: { id: "u1", name: "Ada" } });
    expect(approvalSent(seen)?.decidedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await screen.findByText(/Allowed by Ada.*Checked the counts/)).toBeTruthy();
  });

  it("sends the person's edited SQL with the digest of their version", async () => {
    const seen = ask(await withDigest({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Run this?", sql: "SELECT * FROM orders", editable: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit before allowing" }));
    // The SQL is edited in the SQL editor (CodeMirror), so the test types through its view.
    const editor = EditorView.findFromDOM(screen.getByLabelText("SQL"))!;
    act(() => editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: "SELECT * FROM orders LIMIT 10" } }));
    const allow = screen.getByRole("button", { name: "Allow my version" });
    await waitFor(() => expect((allow as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(allow);
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(approvalSent(seen)).toMatchObject({ allow: true, editedSql: "SELECT * FROM orders LIMIT 10", digest: await approvalDigest({ sql: "SELECT * FROM orders LIMIT 10" }) });
    expect(await screen.findByText(/edited before approving/)).toBeTruthy();
  });

  it("asks for a typed confirmation before allowing what cannot be undone, and shows earlier decisions", async () => {
    const seen = ask(
      await withDigest({
        id: "a1",
        kind: ApprovalKind.PERMISSION,
        title: "Rebuild orders_clean?",
        subject: plan,
        risk: ApprovalRisk.IRREVERSIBLE,
        approvalsRequired: 2,
        approvals: [{ decidedBy: { id: "u0", name: "Grace" }, decidedAt: "2026-11-13T09:00:00Z", allow: true, reason: "Looks right" }],
      }),
    );
    expect(await screen.findByText("Cannot be undone")).toBeTruthy();
    expect(screen.getByText("Needs 2 people")).toBeTruthy();
    expect(screen.getByText(/Allowed by Grace/)).toBeTruthy();
    const allow = screen.getByRole("button", { name: "Allow" });
    await waitFor(() => expect((allow as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(allow);
    expect((await screen.findByRole("alert")).textContent).toMatch(/confirm/);
    expect(seen).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/Type “confirm”/), { target: { value: "confirm" } });
    fireEvent.click(allow);
    await waitFor(() => expect(seen).toHaveLength(2));
  });

  it("will not offer approval for a request whose digest does not match, or one that has expired", async () => {
    ask({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Run this?", sql: "SELECT 1", digest: "sha256:0000" });
    expect((await screen.findByRole("alert")).textContent).toMatch(/does not match/);
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
    cleanup();
    ask(await withDigest({ id: "a2", kind: ApprovalKind.PERMISSION, title: "Run that?", sql: "SELECT 2", expiresAt: "2000-01-01T00:00:00Z" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/expired/);
    expect(screen.queryByRole("button", { name: "Allow" })).toBeNull();
  });
});
