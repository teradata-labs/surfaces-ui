import { type LabelKey, label as words } from "../locale/locale.js";

export type FlowStatus = "done" | "current" | "waiting" | "pending" | "failed" | "skipped";

export interface FlowStep {
  id: string;
  title: string;
  detail?: string;
  /**
   * "waiting" means the work has stopped for a person: an approval, a
   * credential to add, a choice. Use it rather than "current" so the pause
   * is plain.
   */
  status: FlowStatus;
}

export interface StepFlowProps {
  /** What the workflow is, such as "Connect the sales lake". */
  label: string;
  steps: FlowStep[];
  className?: string;
}

const STATUS: Record<FlowStatus, { mark: string; text: LabelKey }> = {
  done: { mark: "✓", text: "flow.done" },
  current: { mark: "●", text: "flow.current" },
  waiting: { mark: "‖", text: "flow.waiting" },
  pending: { mark: "○", text: "flow.pending" },
  failed: { mark: "✕", text: "flow.failed" },
  skipped: { mark: "–", text: "flow.skipped" },
};

/**
 * Where a multi-step piece of work stands: onboarding, connecting a source,
 * a cleaning or transformation run. It shows every step, which one is
 * active, and where the work is paused for a person. Display only: the
 * status comes from whatever is doing the work.
 */
export function StepFlow({ label, steps, className }: StepFlowProps) {
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return (
    <section className={["sf-flow", className].filter(Boolean).join(" ")} aria-label={label}>
      <p className="sf-flow-head">
        <span className="sf-flow-label">{label}</span>
        <span className="sf-flow-count">
          {words("flow.count", { done, total: steps.length })}
        </span>
      </p>
      <ol className="sf-flow-steps">
        {steps.map((step) => (
          <li key={step.id} className="sf-flow-step" data-status={step.status} aria-current={step.status === "current" || step.status === "waiting" ? "step" : undefined}>
            <span className="sf-flow-mark" aria-hidden="true">
              {STATUS[step.status].mark}
            </span>
            <span className="sf-flow-body">
              <span className="sf-flow-title">{step.title}</span>
              <span className="sf-flow-status">{words(STATUS[step.status].text)}</span>
              {step.detail && <span className="sf-flow-detail">{step.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
