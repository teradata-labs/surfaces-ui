import type { ReactNode } from "react";
import { numberFormat, label as text } from "../locale/locale.js";

/** One thing a `SelectionBar` can do to the rows chosen. */
export interface SelectionAction {
  /** Tells actions apart; put on the button as `data-action`. */
  id: string;
  /** The button's words: "Turn off", "Make admins". */
  label: string;
  onSelect(): void;
  /** For an action that takes something away. Marked by more than colour: it comes last, after a gap. */
  danger?: boolean;
  disabled?: boolean;
  /** For an action that opens more below the bar (a form): whether it is open now. */
  expanded?: boolean;
}

export interface SelectionBarProps {
  /** How many rows are chosen: those ticked, or every row that matches when `allMatching`. Nothing is drawn at 0. */
  count: number;
  actions: readonly SelectionAction[];
  /** Untick everything. */
  onClear(): void;
  /** Names the bar for assistive technology. Defaults to "With the selected rows". */
  label?: string;
  /** Every row on this page is ticked: the bar offers to choose every row that matches, past this page. */
  pageSelected?: boolean;
  /** How many rows match the search and filters in all, across every page. */
  total?: number;
  /** Every row that matches is chosen, not only those ticked. */
  allMatching?: boolean;
  /** Asked for when a person chooses every row that matches, or goes back to this page only. Without it, nothing is offered past the page. */
  onAllMatchingChange?(all: boolean): void;
  /** An action is running: every button waits. */
  busy?: boolean;
  /** Drawn under the actions: a form an action opened, such as who to hand the rows to. */
  children?: ReactNode;
  className?: string;
}

/**
 * What to do with the rows a person chose in a `DataTable`: how many, the actions, and Clear. When the whole page is
 * ticked and more rows match, it offers to take every one that matches, so an action can reach rows on pages never
 * opened; the host then acts on the search and filters, not on a list of keys. It runs nothing itself: each action
 * calls back, and the host asks first for anything hard to undo (`useConfirm`).
 */
export function SelectionBar(props: SelectionBarProps) {
  const { count, actions, onClear, pageSelected, total, allMatching, onAllMatchingChange, busy, children, className } = props;
  if (count <= 0) return null;
  const number = (n: number) => numberFormat().format(n);
  const more = onAllMatchingChange !== undefined && total !== undefined && total > count;
  const ordered = [...actions.filter((a) => !a.danger), ...actions.filter((a) => a.danger)];
  return (
    <div className={["sf-selection-bar", className].filter(Boolean).join(" ")} role="group" aria-label={props.label ?? text("selection.label")}>
      <div className="sf-selection-bar-row">
        <strong className="sf-selection-bar-count" aria-live="polite">
          {text("selection.count", { count: number(count) })}
        </strong>
        <div className="sf-selection-bar-actions">
          {ordered.map((action) => (
            <button
              key={action.id}
              type="button"
              className="sf-button"
              data-action={action.id}
              data-variant={action.danger ? "danger" : undefined}
              aria-expanded={action.expanded}
              disabled={busy || action.disabled}
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className="sf-selection-bar-link" disabled={busy} onClick={onClear}>
          {text("selection.clear")}
        </button>
      </div>
      {allMatching && onAllMatchingChange && total !== undefined ? (
        <p className="sf-selection-bar-all">
          {text("selection.allMatching", { total: number(total) })}{" "}
          <button type="button" className="sf-selection-bar-link" disabled={busy} onClick={() => onAllMatchingChange(false)}>
            {text("selection.onlyPage")}
          </button>
        </p>
      ) : pageSelected && more ? (
        <p className="sf-selection-bar-all">
          {text("selection.pageSelected", { count: number(count) })}{" "}
          <button type="button" className="sf-selection-bar-link" disabled={busy} onClick={() => onAllMatchingChange(true)}>
            {text("selection.selectAllMatching", { total: number(total) })}
          </button>
        </p>
      ) : null}
      {children && <div className="sf-selection-bar-more">{children}</div>}
    </div>
  );
}
