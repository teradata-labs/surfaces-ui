import { useId, useState } from "react";
import { PII_ACTION_LABELS, PII_DEFAULT_ACTION, PII_LABELS, type PiiAction, type PiiCategory } from "./pii.js";

export interface PiiColumn {
  name: string;
  type?: string;
  /** The kind of personal data suspected. Leave out for a column with no flag. */
  category?: PiiCategory;
  /** How the flag was arrived at: guessed from the name, found by a scan of values, or set by a person. */
  basis?: "name" | "values" | "person";
  /** The treatment proposed. Defaults to the cautious one for its category, or "keep" when unflagged. */
  action?: PiiAction;
}

export interface PiiDecision {
  table: string;
  columns: { name: string; category?: PiiCategory; action: PiiAction }[];
  /** True when the person confirmed they may make this decision. */
  confirmed: boolean;
}

export interface PiiReviewProps {
  table: string;
  columns: PiiColumn[];
  /** Why the review is happening, such as "Before sharing with the marketing workspace". */
  purpose?: string;
  onDecide(decision: PiiDecision): void;
  decided?: PiiDecision;
  className?: string;
}

const BASIS_TEXT = { name: "Guessed from the column name", values: "Found by scanning values", person: "Marked by a person" } as const;
const ACTIONS = Object.keys(PII_ACTION_LABELS) as PiiAction[];

/**
 * A review of a table's columns for personal data before it is shared,
 * charted or sent to a model. Each flagged column shows why it was flagged
 * and a proposed treatment that a person can change. Flags are suggestions:
 * the person decides and confirms, and the decision is what is reported.
 */
export function PiiReview(props: PiiReviewProps) {
  const { table, columns, purpose, onDecide } = props;
  const id = useId();
  const proposed = (column: PiiColumn): PiiAction => column.action ?? (column.category ? PII_DEFAULT_ACTION[column.category] : "keep");
  const [actions, setActions] = useState<Record<string, PiiAction>>(() => Object.fromEntries(columns.map((c) => [c.name, proposed(c)])));
  const [confirmed, setConfirmed] = useState(false);
  const [made, setMade] = useState<PiiDecision | undefined>(props.decided);
  const decision = props.decided ?? made;
  const actionOf = (column: PiiColumn) => decision?.columns.find((c) => c.name === column.name)?.action ?? actions[column.name] ?? "keep";
  const flagged = columns.filter((c) => c.category);
  const keptAsIs = flagged.filter((c) => actionOf(c) === "keep");

  return (
    <section className={["sf-pii", props.className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <header>
        <p className="sf-plan-review-title" id={`${id}-title`}>
          Personal data in {table}
        </p>
        <p className="sf-plan-review-summary">
          {flagged.length === 0 ? "No column was flagged." : `${flagged.length} of ${columns.length} columns may hold personal data.`} {purpose ?? ""}
        </p>
        <p className="sf-plan-review-by">Flags are suggestions and can miss a column. Check the ones left unflagged too.</p>
      </header>
      <div className="sf-pii-scroll">
        <table className="sf-pii-table">
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">May hold</th>
              <th scope="col">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.name} data-flagged={column.category ? "" : undefined}>
                <th scope="row">
                  <span className="sf-pii-name">{column.name}</span>
                  {column.type && <span className="sf-pii-type"> {column.type}</span>}
                </th>
                <td>
                  {column.category ? (
                    <>
                      <span className="sf-pii-flag">◆ {PII_LABELS[column.category]}</span>
                      <span className="sf-pii-basis">{BASIS_TEXT[column.basis ?? "name"]}</span>
                    </>
                  ) : (
                    <span className="sf-pii-basis">Not flagged</span>
                  )}
                </td>
                <td>
                  <select
                    className="sf-input"
                    aria-label={`Treatment for ${column.name}`}
                    value={actionOf(column)}
                    disabled={decision !== undefined}
                    onChange={(event) => setActions((previous) => ({ ...previous, [column.name]: event.target.value as PiiAction }))}
                  >
                    {ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {PII_ACTION_LABELS[action]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {keptAsIs.length > 0 && (
        <p className="sf-pii-warning" role="note">
          ▲ {keptAsIs.length === 1 ? `${keptAsIs[0]!.name} is flagged and will be kept as is.` : `${keptAsIs.length} flagged columns will be kept as is: ${keptAsIs.map((c) => c.name).join(", ")}.`}
        </p>
      )}
      {decision ? (
        <p className="sf-plan-review-outcome" role="status">
          Decision recorded for {decision.columns.length} columns.
        </p>
      ) : (
        <footer className="sf-plan-review-actions">
          <label className="sf-pii-confirm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I have checked every column and may decide how this data is handled.</span>
          </label>
          <button
            type="button"
            className="sf-button"
            data-variant="primary"
            disabled={!confirmed}
            onClick={() => {
              const result: PiiDecision = { table, confirmed: true, columns: columns.map((c) => ({ name: c.name, ...(c.category ? { category: c.category } : {}), action: actionOf(c) })) };
              setMade(result);
              onDecide(result);
            }}
          >
            Record decision
          </button>
        </footer>
      )}
    </section>
  );
}
