import type { JsonObject, MessageInitShape } from "@bufbuild/protobuf";
import { contentDigest } from "@surfaces-ui/data";
import { type ApprovalAnswer, type ApprovalRecord, type ApprovalRequest, type ApprovalRequestSchema, ApprovalRisk } from "@surfaces-ui/proto";

/** What an approval is about: the SQL and the structured subject a person is shown. */
export interface ApprovalContent {
  sql?: string;
  subject?: JsonObject;
}

export { canonicalJson } from "@surfaces-ui/data";

/**
 * "sha256:<hex>" of the canonical JSON of `{ sql, subject }`. The agent puts
 * it in `ApprovalRequest.digest`; the client recomputes it from what it shows
 * and sends it back in the answer; the backend compares it with what it is
 * about to run. Uses Web Crypto, present in browsers and Node 20+.
 */
export async function approvalDigest(content: ApprovalContent): Promise<string> {
  return contentDigest({ sql: content.sql ?? "", subject: content.subject ?? {} });
}

type RequestInit = MessageInitShape<typeof ApprovalRequestSchema>;

/** An approval request with its digest filled in from its SQL and subject. */
export async function withDigest<T extends RequestInit>(request: T): Promise<T & { digest: string }> {
  return { ...request, digest: await approvalDigest({ sql: request.sql, subject: request.subject as JsonObject | undefined }) };
}

export type ApprovalCheck =
  | {
      ok: true;
      allow: boolean;
      /** What to run: the person's edited version when they edited it. */
      sql: string;
      subject: JsonObject;
      edited: boolean;
      /** This decision, to keep and to send in `ApprovalRequest.approvals` when more people must decide. */
      record: { decidedBy?: { id: string; name: string }; decidedAt: string; allow: boolean; reason: string };
      /** Different people who have allowed it, this decision included. */
      allowedBy: number;
      /** Enough people have allowed it and nobody has refused. */
      complete: boolean;
    }
  | { ok: false; code: ApprovalProblem; message: string };

export type ApprovalProblem = "WRONG_REQUEST" | "EXPIRED" | "NOT_EDITABLE" | "DIGEST_MISMATCH" | "REASON_REQUIRED" | "NO_DECIDER" | "NOT_ALLOWED" | "ALREADY_DECIDED";

export interface CheckApprovalOptions {
  /** The time to check expiry against. Default now. */
  now?: Date;
  /**
   * Who may decide. The backend's own rule, checked against its own session:
   * `decided_by` comes from the client, so never trust it alone.
   */
  mayDecide?(actor: { id: string; name: string } | undefined, request: ApprovalRequest): boolean;
}

/**
 * Checks an answer against the request it answers, on the backend, before
 * acting on it: the right request, not expired, a reason when one is
 * required, edits only when allowed, and a digest that matches what will
 * run. For a request that needs several people, it also counts distinct
 * people who allowed it (`request.approvals` plus this one).
 */
export async function checkApproval(request: ApprovalRequest, answer: ApprovalAnswer, options: CheckApprovalOptions = {}): Promise<ApprovalCheck> {
  const fail = (code: ApprovalProblem, message: string): ApprovalCheck => ({ ok: false, code, message });
  if (answer.id !== request.id) return fail("WRONG_REQUEST", `The answer is for ${answer.id}, not ${request.id}.`);
  const now = options.now ?? new Date();
  const decidedAt = answer.decidedAt || now.toISOString();
  if (request.expiresAt && Date.parse(request.expiresAt) <= now.getTime()) {
    return fail("EXPIRED", `The request expired at ${request.expiresAt}. Ask again against the data as it is now.`);
  }
  const edited = answer.editedSql !== undefined || answer.editedSubject !== undefined;
  if (edited && !request.editable) return fail("NOT_EDITABLE", "The person changed a request that was not editable.");
  if (request.reasonRequired && !answer.reason.trim()) return fail("REASON_REQUIRED", "A reason is required.");
  if (options.mayDecide && !options.mayDecide(answer.decidedBy, request)) return fail("NOT_ALLOWED", "This person may not decide this request.");
  const decidedBy = answer.decidedBy ? { id: answer.decidedBy.id, name: answer.decidedBy.name } : undefined;
  const needed = Math.max(1, request.approvalsRequired);
  if (needed > 1 && !decidedBy?.id) return fail("NO_DECIDER", "A request that needs several people must say who decided.");
  if (decidedBy?.id && request.approvals.some((r: ApprovalRecord) => r.decidedBy?.id === decidedBy.id)) {
    return fail("ALREADY_DECIDED", `${decidedBy.name || decidedBy.id} has already decided this request.`);
  }

  const sql = answer.editedSql ?? request.sql;
  const subject = (answer.editedSubject ?? request.subject ?? {}) as JsonObject;
  const expected = await approvalDigest({ sql, subject });
  if (request.digest && !edited && request.digest !== expected) {
    return fail("DIGEST_MISMATCH", "The request's digest does not match its own SQL and subject.");
  }
  if (answer.allow && answer.digest !== expected) {
    return fail("DIGEST_MISMATCH", "What the person approved is not what would run.");
  }

  const record = { ...(decidedBy ? { decidedBy } : {}), decidedAt, allow: answer.allow, reason: answer.reason };
  const refused = !answer.allow || request.approvals.some((r) => !r.allow);
  const allowedBy = new Set([...request.approvals.filter((r) => r.allow).map((r) => r.decidedBy?.id ?? ""), ...(answer.allow ? [decidedBy?.id ?? "you"] : [])]).size;
  return { ok: true, allow: answer.allow, sql, subject, edited, record, allowedBy, complete: !refused && allowedBy >= needed };
}

/** The word a person types before an irreversible request can be allowed. */
export const CONFIRM_WORD = "confirm";

/** Whether a request needs the person to type `CONFIRM_WORD` first. */
export const needsTypedConfirmation = (risk: ApprovalRisk) => risk === ApprovalRisk.IRREVERSIBLE;
