import { useId, useState } from "react";
import { type LabelKey, label as text } from "../locale/locale.js";
import { CodeBlock } from "../text/Markdown.js";

export type PlanRisk = "low" | "medium" | "high";

export interface PlanStep {
  id: string;
  title: string;
  /** Why this step is proposed and what it changes, in a sentence. */
  detail?: string;
  /** What the step would run, shown for review. It is never run from here. */
  sql?: string;
  /** What kind of work this is, such as "Clean", "Transform" or "Connect". */
  kind?: string;
  /** What it touches, such as "1,204 of 58,000 rows" or "s3://acme-lake/sales". */
  affects?: string;
  /** "high" for anything that removes or overwrites data or widens access. Defaults to "low". */
  risk?: PlanRisk;
  /** A step the plan cannot do without; it cannot be unticked. */
  required?: boolean;
}

export interface PlanDecision {
  approved: boolean;
  /** The steps the person left ticked, in order. Empty when rejected. */
  stepIds: string[];
  note?: string;
}

export interface PlanReviewProps {
  title: string;
  /** What the plan is for, in a sentence or two. */
  summary?: string;
  steps: PlanStep[];
  /** Who or what wrote the plan, shown so a person knows what they are approving. */
  proposedBy?: string;
  onDecide(decision: PlanDecision): void;
  /** A decision already made, to show the card settled (for a thread reloaded later). */
  decided?: PlanDecision;
  className?: string;
}

const RISK_TEXT: Record<PlanRisk, LabelKey> = { low: "plan.riskLow", medium: "plan.riskMedium", high: "plan.riskHigh" };

/**
 * A proposed plan (cleaning steps, transformations, a connection to set up)
 * that a person reviews step by step before anything happens. Steps marked
 * high risk start unticked, so approving them is a deliberate act. The
 * component only reports the decision; whatever acts on it lives elsewhere.
 */
export function PlanReview(props: PlanReviewProps) {
  const { title, summary, steps, proposedBy, onDecide } = props;
  const id = useId();
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(steps.filter((s) => s.required || s.risk !== "high").map((s) => s.id)));
  const [note, setNote] = useState("");
  const [made, setMade] = useState<PlanDecision | undefined>(props.decided);
  const decision = props.decided ?? made;
  const chosen = steps.filter((s) => (decision ? decision.stepIds.includes(s.id) : ticked.has(s.id)));
  const decide = (approved: boolean) => {
    const result: PlanDecision = { approved, stepIds: approved ? chosen.map((s) => s.id) : [], ...(note.trim() ? { note: note.trim() } : {}) };
    setMade(result);
    onDecide(result);
  };

  return (
    <section className={["sf-plan-review", props.className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <header>
        <p className="sf-plan-review-title" id={`${id}-title`}>
          {title}
        </p>
        {summary && <p className="sf-plan-review-summary">{summary}</p>}
        {proposedBy && <p className="sf-plan-review-by">{text("plan.proposedBy", { who: proposedBy })}</p>}
      </header>
      <ol className="sf-plan-review-steps">
        {steps.map((step, i) => {
          const risk = step.risk ?? "low";
          return (
            <li key={step.id} className="sf-plan-review-step" data-risk={risk}>
              <label className="sf-plan-review-pick">
                <input
                  type="checkbox"
                  checked={decision ? decision.stepIds.includes(step.id) : ticked.has(step.id)}
                  disabled={decision !== undefined || step.required}
                  onChange={(event) =>
                    setTicked((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(step.id);
                      else next.delete(step.id);
                      return next;
                    })
                  }
                />
                <span className="sf-plan-review-name">
                  {i + 1}. {step.title}
                </span>
              </label>
              <span className="sf-plan-review-tags">
                {step.kind && <span className="sf-schema-tag">{step.kind}</span>}
                {step.required && <span className="sf-schema-tag">{text("plan.required")}</span>}
                {risk !== "low" && (
                  <span className="sf-plan-review-risk" data-risk={risk}>
                    {risk === "high" ? "▲ " : "● "}
                    {text(RISK_TEXT[risk])}
                  </span>
                )}
              </span>
              {step.detail && <p className="sf-plan-review-detail">{step.detail}</p>}
              {step.affects && <p className="sf-plan-review-detail">{text("plan.affects", { what: step.affects })}</p>}
              {step.sql && (
                <details className="sf-plan-review-sql">
                  <summary>{text("plan.whatItWouldRun")}</summary>
                  <CodeBlock code={step.sql} language="sql" />
                </details>
              )}
            </li>
          );
        })}
      </ol>
      {decision ? (
        <p className="sf-plan-review-outcome" role="status">
          {decision.approved ? text("plan.approved", { count: decision.stepIds.length, total: steps.length }) : text("plan.rejected")}
          {decision.note ? text("plan.decisionNote", { note: decision.note }) : ""}
        </p>
      ) : (
        <footer className="sf-plan-review-actions">
          <label className="sf-plan-review-note">
            <span>{text("plan.noteLabel")}</span>
            <input className="sf-input" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button type="button" className="sf-button" data-variant="primary" disabled={chosen.length === 0} onClick={() => decide(true)}>
            {text(chosen.length === 1 ? "plan.approveOne" : "plan.approve", { count: chosen.length })}
          </button>
          <button type="button" className="sf-button" onClick={() => decide(false)}>
            {text("plan.reject")}
          </button>
        </footer>
      )}
    </section>
  );
}
