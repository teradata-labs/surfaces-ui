import { useState } from "react";
import { type LabelKey, dateFormat, label as text } from "../locale/locale.js";
import { CodeBlock } from "../text/Markdown.js";

export type ReceiptOutcome = "done" | "partial" | "failed";

export interface ReceiptDecision {
  /** Who decided. */
  by: string;
  /** ISO time. */
  at?: string;
  reason?: string;
}

export interface ReceiptChange {
  /** What changed, such as "Rows in orders_clean". */
  label: string;
  before?: string;
  after: string;
}

export interface ReceiptUndo {
  /** The button text, such as "Restore version 41". */
  label: string;
  /** What undoing does and what it cannot bring back. */
  description?: string;
  /** ISO time after which it can no longer be undone. */
  until?: string;
}

export interface ActionReceiptProps {
  /** What was done, such as "Rebuilt orders_clean". */
  title: string;
  outcome: ReceiptOutcome;
  summary?: string;
  /** When it ran, ISO time. */
  ranAt?: string;
  /** What ran it: an agent, a pipeline, a service. */
  ranBy?: string;
  /** Who approved it, with when and why. */
  approvedBy?: ReceiptDecision[];
  /** What ran, for the record. Never run from here. */
  sql?: string;
  changes?: ReceiptChange[];
  /** How to undo it, when it can be. Leave out when it cannot; the receipt then says so. */
  undo?: ReceiptUndo;
  /** The person asked to undo it. Undoing is the host's or agent's job; this only reports the request. */
  onUndo?(): void;
  /** The time to check `undo.until` against; for tests. */
  now?: () => number;
  className?: string;
}

const OUTCOME: Record<ReceiptOutcome, { mark: string; text: LabelKey }> = {
  done: { mark: "✓", text: "receipt.done" },
  partial: { mark: "◐", text: "receipt.partial" },
  failed: { mark: "✕", text: "receipt.failed" },
};

const when = (iso: string | undefined) => {
  if (!iso) return "";
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : dateFormat({ dateStyle: "medium", timeStyle: "short" }).format(new Date(time));
};

/**
 * What an agent or pipeline did after a person approved it: the outcome,
 * who approved it and why, what ran, what changed, and whether it can be
 * undone. The last step of every approval, so a decision is never left
 * without a record of what followed. Display only: pressing Undo reports a
 * request; whatever undoes it is the host or the agent, after asking again.
 */
export function ActionReceipt({ title, outcome, summary, ranAt, ranBy, approvedBy = [], sql, changes = [], undo, onUndo, now = Date.now, className }: ActionReceiptProps) {
  const [asked, setAsked] = useState(false);
  const closed = undo?.until ? Date.parse(undo.until) <= now() : false;
  const status = OUTCOME[outcome];
  return (
    <section className={["sf-receipt", className].filter(Boolean).join(" ")} aria-label={title} data-outcome={outcome}>
      <p className="sf-receipt-head">
        <span className="sf-receipt-mark" aria-hidden="true">
          {status.mark}
        </span>
        <span className="sf-receipt-title">{title}</span>
        <span className="sf-receipt-status">{text(status.text)}</span>
      </p>
      {summary && <p className="sf-receipt-summary">{summary}</p>}
      <dl className="sf-receipt-facts">
        {(ranAt || ranBy) && (
          <>
            <dt>{text("receipt.ran")}</dt>
            <dd>{[when(ranAt), ranBy ? text("receipt.by", { who: ranBy }) : ""].filter(Boolean).join(" ")}</dd>
          </>
        )}
        <dt>{text("receipt.approved")}</dt>
        <dd>
          {approvedBy.length === 0 ? (
            text("receipt.noApproval")
          ) : (
            <ul>
              {approvedBy.map((d, i) => (
                <li key={`${d.by}-${i}`}>
                  {d.by}
                  {d.at ? `, ${when(d.at)}` : ""}
                  {d.reason ? `: “${d.reason}”` : ""}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      {changes.length > 0 && (
        <table className="sf-receipt-changes">
          <caption className="sf-a2-visually-hidden">{text("receipt.whatChanged")}</caption>
          <thead>
            <tr>
              <th scope="col">{text("receipt.what")}</th>
              <th scope="col">{text("receipt.before")}</th>
              <th scope="col">{text("receipt.after")}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.label}>
                <th scope="row">{c.label}</th>
                <td>{c.before ?? "–"}</td>
                <td>{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sql && <CodeBlock code={sql} language="sql" label={text("receipt.whatRan")} />}
      {!undo ? (
        <p className="sf-receipt-undo-note">{text("receipt.cannotUndo")}</p>
      ) : closed ? (
        <p className="sf-receipt-undo-note">{text("receipt.undoClosed", { time: when(undo.until) })}</p>
      ) : (
        <div className="sf-receipt-undo">
          {undo.description && <p className="sf-receipt-undo-note">{undo.description}</p>}
          {undo.until && <p className="sf-receipt-undo-note">{text("receipt.undoUntil", { time: when(undo.until) })}</p>}
          {asked ? (
            <p className="sf-receipt-undo-note" role="status">
              {text("receipt.undoRequested")}
            </p>
          ) : (
            onUndo && (
              <button
                type="button"
                className="sf-button"
                onClick={() => {
                  setAsked(true);
                  onUndo();
                }}
              >
                {undo.label}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
