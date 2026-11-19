import { create } from "@bufbuild/protobuf";
import { ApprovalAnswerSchema, ApprovalKind, ApprovalRecordSchema, ApprovalRequestSchema, ApprovalRisk } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { approvalDigest, canonicalJson, checkApproval, withDigest } from "./approvals.js";

const plan = { steps: [{ id: "drop", title: "Drop rows with no order_id" }], table: "orders" };

async function request(extra: Record<string, unknown> = {}) {
  return create(ApprovalRequestSchema, await withDigest({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Clean orders?", sql: "SELECT 1", subject: plan, ...extra }));
}

describe("approvals", () => {
  it("gives the same digest whatever the key order", async () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(await approvalDigest({ sql: "SELECT 1", subject: { a: 1, b: 2 } })).toBe(await approvalDigest({ sql: "SELECT 1", subject: { b: 2, a: 1 } }));
    expect(await approvalDigest({ sql: "SELECT 1" })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("accepts an answer that approved exactly what will run, and records who and when", async () => {
    const r = await request();
    const answer = create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest, decidedBy: { id: "u1", name: "Ada" }, decidedAt: "2026-11-13T10:00:00Z" });
    const check = await checkApproval(r, answer);
    expect(check).toMatchObject({ ok: true, allow: true, complete: true, sql: "SELECT 1", record: { decidedBy: { name: "Ada" }, decidedAt: "2026-11-13T10:00:00Z" } });
  });

  it("refuses a stale digest, an expired request, a missing reason and an edit that was not allowed", async () => {
    const r = await request({ reasonRequired: true });
    const ok = { id: "a1", allow: true, digest: r.digest, reason: "checked" };
    expect(await checkApproval(r, create(ApprovalAnswerSchema, { ...ok, digest: "sha256:00" }))).toMatchObject({ ok: false, code: "DIGEST_MISMATCH" });
    expect(await checkApproval(r, create(ApprovalAnswerSchema, { ...ok, reason: " " }))).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    expect(await checkApproval(r, create(ApprovalAnswerSchema, { ...ok, editedSql: "SELECT 2" }))).toMatchObject({ ok: false, code: "NOT_EDITABLE" });
    const expiring = await request({ expiresAt: "2026-11-13T10:00:00Z" });
    expect(await checkApproval(expiring, create(ApprovalAnswerSchema, { ...ok, digest: expiring.digest }), { now: new Date("2026-11-13T10:00:01Z") })).toMatchObject({ ok: false, code: "EXPIRED" });
  });

  it("runs the person's edited version when the request was editable", async () => {
    const r = await request({ editable: true });
    const digest = await approvalDigest({ sql: "SELECT 2", subject: plan });
    const check = await checkApproval(r, create(ApprovalAnswerSchema, { id: "a1", allow: true, editedSql: "SELECT 2", digest }));
    expect(check).toMatchObject({ ok: true, edited: true, sql: "SELECT 2" });
  });

  it("needs distinct people when more than one must allow it", async () => {
    const r = await request({ risk: ApprovalRisk.IRREVERSIBLE, approvalsRequired: 2 });
    const first = await checkApproval(r, create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest, decidedBy: { id: "u1", name: "Ada" } }));
    expect(first).toMatchObject({ ok: true, complete: false, allowedBy: 1 });
    if (!first.ok) return;
    const again = create(ApprovalRequestSchema, { ...r, approvals: [create(ApprovalRecordSchema, first.record)] });
    expect(await checkApproval(again, create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest, decidedBy: { id: "u1", name: "Ada" } }))).toMatchObject({ ok: false, code: "ALREADY_DECIDED" });
    expect(await checkApproval(again, create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest }))).toMatchObject({ ok: false, code: "NO_DECIDER" });
    expect(await checkApproval(again, create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest, decidedBy: { id: "u2", name: "Grace" } }))).toMatchObject({ ok: true, complete: true, allowedBy: 2 });
    expect(await checkApproval(again, create(ApprovalAnswerSchema, { id: "a1", allow: false, decidedBy: { id: "u2", name: "Grace" } }))).toMatchObject({ ok: true, allow: false, complete: false });
  });

  it("applies the backend's own rule for who may decide", async () => {
    const r = await request();
    const answer = create(ApprovalAnswerSchema, { id: "a1", allow: true, digest: r.digest, decidedBy: { id: "u9", name: "Mallory" } });
    expect(await checkApproval(r, answer, { mayDecide: (actor) => actor?.id === "u1" })).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });
});
