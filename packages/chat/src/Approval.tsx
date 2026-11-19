import type { JsonObject } from "@bufbuild/protobuf";
import { CONFIRM_WORD, approvalDigest } from "@surfaces-ui/agent";
import { CodeBlock } from "@surfaces-ui/components";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { ChatApproval, ChatDecision } from "./thread.js";
import type { ApprovalReply } from "./useChat.js";

export interface ApprovalCardProps {
  approval: ChatApproval;
  onAnswer(id: string, reply: ApprovalReply): void;
  /** The time to check expiry against; for tests. Defaults to the clock. */
  now?: () => number;
}

const RISK_WORD: Record<ChatApproval["risk"], string> = { low: "Low risk", high: "High risk", irreversible: "Cannot be undone", "": "" };

const when = (iso: string) => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const decision = (d: ChatDecision) => `${d.allow ? "Allowed" : "Declined"} by ${d.by?.name || d.by?.id || "you"}${d.at ? `, ${when(d.at)}` : ""}${d.reason ? `: “${d.reason}”` : ""}`;

/** Checks that the request's digest matches the SQL and subject the card shows. */
function useDigestCheck(approval: ChatApproval): "checking" | "ok" | "mismatch" {
  const [state, setState] = useState<"checking" | "ok" | "mismatch">(approval.digest ? "checking" : "ok");
  useEffect(() => {
    if (!approval.digest) return setState("ok");
    let live = true;
    void approvalDigest({ sql: approval.sql, subject: approval.subject }).then((digest) => live && setState(digest === approval.digest ? "ok" : "mismatch"));
    return () => {
      live = false;
    };
  }, [approval.digest, approval.sql, approval.subject]);
  return state;
}

/** Whether `expiresAt` has passed, updating when it does. */
function useExpired(expiresAt: string, now: () => number): boolean {
  const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const [expired, setExpired] = useState(() => !Number.isNaN(deadline) && deadline <= now());
  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    const left = deadline - now();
    if (left <= 0) return setExpired(true);
    setExpired(false);
    // Timers longer than this overflow; a page open that long checks again on the next render.
    const timer = setTimeout(() => setExpired(true), Math.min(left, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [deadline, now]);
  return expired;
}

/**
 * A question the agent is waiting on: allow or deny, pick an option, or type
 * an answer. For a permission it shows what exactly is asked (SQL and a
 * structured subject), what it was based on, how risky it is and when it
 * expires; it can take a reason, let the person edit before approving,
 * require typing "confirm" for what cannot be undone, and show who has
 * already decided when several people must. It refuses to offer approval
 * when the request does not match its own digest, and once it has expired.
 */
export function ApprovalCard({ approval, onAnswer, now = Date.now }: ApprovalCardProps) {
  const id = useId();
  const digest = useDigestCheck(approval);
  const expired = useExpired(approval.expiresAt, now);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [editing, setEditing] = useState(false);
  const [sql, setSql] = useState(approval.sql);
  const [subject, setSubject] = useState(approval.subject ? JSON.stringify(approval.subject, null, 2) : "");
  const [error, setError] = useState("");
  const answered = approval.answer;
  const irreversible = approval.risk === "irreversible";
  const needed = approval.approvalsRequired;

  const reply = (allow: boolean, answer = ""): ApprovalReply | undefined => {
    if (approval.reasonRequired && !reason.trim()) {
      setError("Give a reason first.");
      return undefined;
    }
    const base: ApprovalReply = { allow, text: answer, reason };
    if (!allow || !editing) return base;
    let editedSubject: JsonObject | undefined;
    if (approval.subject) {
      try {
        const parsed = JSON.parse(subject) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        editedSubject = parsed as JsonObject;
      } catch {
        setError("The edited details are not a JSON object.");
        return undefined;
      }
    }
    return {
      ...base,
      ...(sql !== approval.sql ? { editedSql: sql } : {}),
      ...(editedSubject && JSON.stringify(editedSubject) !== JSON.stringify(approval.subject) ? { editedSubject } : {}),
    };
  };
  const submit = (allow: boolean, answer = "") => {
    setError("");
    if (allow && irreversible && confirm.trim().toLowerCase() !== CONFIRM_WORD) {
      setError(`Type “${CONFIRM_WORD}” to allow something that cannot be undone.`);
      return;
    }
    const r = reply(allow, answer);
    if (r) onAnswer(approval.id, r);
  };
  const onSubmitInput = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim()) submit(true, text.trim());
  };

  const blocked = digest === "mismatch" || expired;
  return (
    <section className="sf-chat-approval" aria-label={approval.title} data-answered={answered ? "" : undefined} data-risk={approval.risk || undefined}>
      <p className="sf-chat-approval-title">{approval.title}</p>
      {(approval.risk || needed > 1) && (
        <p className="sf-chat-approval-tags">
          {approval.risk && (
            <span className="sf-a2-badge" data-tone={approval.risk === "low" ? "neutral" : approval.risk === "high" ? "warning" : "danger"}>
              {RISK_WORD[approval.risk]}
            </span>
          )}
          {needed > 1 && <span className="sf-a2-badge" data-tone="neutral">{`Needs ${needed} people`}</span>}
        </p>
      )}
      {approval.detail && <p className="sf-chat-approval-detail">{approval.detail}</p>}
      {approval.basis && <p className="sf-chat-approval-detail">Based on: {approval.basis}</p>}

      {editing && !answered ? (
        <>
          {approval.sql && (
            <label className="sf-chat-approval-field">
              <span>SQL</span>
              <textarea className="sf-input" value={sql} spellCheck={false} rows={Math.min(12, sql.split("\n").length + 1)} onChange={(e) => setSql(e.target.value)} />
            </label>
          )}
          {approval.subject && (
            <label className="sf-chat-approval-field">
              <span>Details (JSON)</span>
              <textarea className="sf-input" value={subject} spellCheck={false} rows={Math.min(14, subject.split("\n").length + 1)} onChange={(e) => setSubject(e.target.value)} />
            </label>
          )}
        </>
      ) : (
        <>
          {(answered?.editedSql ?? approval.sql) && <CodeBlock code={answered?.editedSql ?? approval.sql} language="sql" label={answered?.editedSql !== undefined ? "SQL, as edited" : "SQL"} />}
          {(answered?.editedSubject ?? approval.subject) && (
            <CodeBlock code={JSON.stringify(answered?.editedSubject ?? approval.subject, null, 2)} language="json" label={answered?.editedSubject ? "Details, as edited" : "Details"} />
          )}
        </>
      )}

      {approval.approvals.length > 0 && (
        <ul className="sf-chat-approval-record" aria-label="Decisions so far">
          {approval.approvals.map((d, i) => (
            <li key={`${d.by?.id ?? ""}-${i}`}>{decision(d)}</li>
          ))}
        </ul>
      )}

      {answered ? (
        <p className="sf-chat-approval-detail" role="status">
          {approval.kind === "permission" ? decision(answered) : `${answered.by?.name ? `${answered.by.name} answered` : "You answered"}: ${answered.text}`}
          {answered.editedSql !== undefined || answered.editedSubject ? " (edited before approving)" : ""}
        </p>
      ) : digest === "mismatch" ? (
        <p className="sf-chat-error" role="alert">
          This request does not match its own contents, so it cannot be approved. Ask the agent to send it again.
        </p>
      ) : expired ? (
        <p className="sf-chat-error" role="alert">
          This request expired {when(approval.expiresAt)}. Ask the agent again so it is checked against the data as it is now.
        </p>
      ) : (
        <>
          {approval.expiresAt && <p className="sf-chat-approval-detail">Expires {when(approval.expiresAt)}.</p>}
          {(approval.kind === "permission" || approval.reasonRequired) && (
            <label className="sf-chat-approval-field">
              <span>{approval.reasonRequired ? "Reason (required)" : "Reason (optional)"}</span>
              <input className="sf-input" value={reason} onChange={(e) => setReason(e.target.value)} aria-required={approval.reasonRequired || undefined} />
            </label>
          )}
          {approval.kind === "permission" && irreversible && (
            <label className="sf-chat-approval-field">
              <span>{`Type “${CONFIRM_WORD}” to allow`}</span>
              <input className="sf-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </label>
          )}
          {error && (
            <p className="sf-chat-error" role="alert">
              {error}
            </p>
          )}
          {approval.kind === "permission" ? (
            <div className="sf-chat-approval-actions">
              <button type="button" className="sf-button" data-variant="primary" disabled={blocked || digest === "checking"} onClick={() => submit(true)}>
                {editing ? "Allow my version" : "Allow"}
              </button>
              <button type="button" className="sf-button" onClick={() => submit(false)}>
                Deny
              </button>
              {approval.editable && (
                <button type="button" className="sf-button" aria-pressed={editing} onClick={() => {
                    if (editing) {
                      setSql(approval.sql);
                      setSubject(approval.subject ? JSON.stringify(approval.subject, null, 2) : "");
                    }
                    setEditing(!editing);
                  }}
                >
                  {editing ? "Undo my edits" : "Edit before allowing"}
                </button>
              )}
            </div>
          ) : approval.kind === "choice" ? (
            <div className="sf-chat-approval-actions">
              {approval.options.map((option) => (
                <button key={option} type="button" className="sf-button" onClick={() => submit(true, option)}>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <form className="sf-chat-approval-actions" onSubmit={onSubmitInput}>
              <label className="sf-a2-visually-hidden" htmlFor={id}>
                Your answer
              </label>
              <input id={id} className="sf-input" value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit" className="sf-button" data-variant="primary">
                Send
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
