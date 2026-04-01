import * as React from 'react';
import { cn } from '../../lib/utils';
import { CellCodeMirror } from './CellCodeMirror';

/* ── Types ────────────────────────────────────────────────────────────── */

export type NotebookCellType = 'code' | 'markdown';
export type NotebookCellStatus = 'idle' | 'running' | 'success' | 'error';

export interface NotebookCellError {
  /** Error alert title */
  title: string;
  /** Error alert description */
  description?: string;
  /** Action items rendered in the alert (e.g. retry button) */
  actions?: React.ReactNode;
}

export interface NotebookCellProps {
  /** Cell type: code (monospace) or markdown (proportional) */
  type: NotebookCellType;
  /** Cell content value */
  value: string;
  /** Callback when value changes (makes cell editable) */
  onValueChange?: (value: string) => void;
  /** Execution status */
  status?: NotebookCellStatus;
  /** Execution count number */
  executionCount?: number;
  /** Whether cell is selected */
  selected?: boolean;
  /** Callback when cell is clicked */
  onSelect?: () => void;
  /** Error displayed between editor and rendered output */
  error?: NotebookCellError;
  /** Rendered output below editor (e.g. markdown HTML, table, chart) */
  renderedOutput?: React.ReactNode;
  /** Custom editor element (replaces built-in textarea). Use for Monaco, CodeMirror, etc. */
  editor?: React.ReactNode;
  /** Run callback (triggered by Shift+Enter) */
  onRun?: () => void;
  className?: string;
}

/* ── Icons ────────────────────────────────────────────────────────────── */

const DragIndicatorIcon = () => (
  <svg
    className="w-6 h-6 text-on-surface-variant"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </svg>
);

const ErrorCircleIcon = () => (
  <svg
    className="w-6 h-6 shrink-0"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    className="w-4 h-4 animate-spin text-primary"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="31.4 31.4"
    />
  </svg>
);

/* ── Sub-component: CellErrorAlert ───────────────────────────────────── */

interface CellErrorAlertProps {
  error: NotebookCellError;
}

function CellErrorAlert({ error }: CellErrorAlertProps) {
  return (
    <div
      className="flex items-start min-h-[64px] bg-negative-container text-on-negative-container overflow-hidden pl-6 pr-4"
      role="alert"
    >
      {/* Icon */}
      <div className="flex items-start pt-5 pr-6 shrink-0">
        <ErrorCircleIcon />
      </div>

      {/* Text */}
      <div className="flex-1 flex flex-col justify-center min-h-[64px] py-2.5 min-w-0">
        <p className="text-base leading-6">{error.title}</p>
        {error.description && (
          <p className="text-sm leading-5">{error.description}</p>
        )}
      </div>

      {/* Action items */}
      {error.actions && (
        <div className="flex items-center h-16 shrink-0">{error.actions}</div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */

const NotebookCell = React.forwardRef<HTMLDivElement, NotebookCellProps>(
  (
    {
      type,
      value,
      onValueChange,
      status = 'idle',
      executionCount,
      selected = false,
      onSelect,
      error,
      renderedOutput,
      editor,
      onRun,
      className,
    },
    ref,
  ) => {
    const isEditable = !!onValueChange;

    return (
      <div
        ref={ref}
        className={cn(
          'group/cell flex items-stretch w-full',
          !selected && 'hover:bg-(--on-surface-8-raw) hover:cursor-pointer',
          className,
        )}
        onClick={onSelect}
        role="article"
        aria-label={`${type} cell${executionCount != null ? ` [${executionCount}]` : ''}`}
      >
        {/* ── Selection indicator (8px left strip) ─────────────── */}
        <div
          className={cn(
            'w-2 shrink-0 rounded-sm transition-colors',
            selected && 'bg-on-surface-variant/[.38]',
          )}
          data-testid="selection-indicator"
        />

        {/* ── Gutter: drag handle + execution count ────────────── */}
        <div className="flex items-start pl-2 pr-4 shrink-0">
          {/* Drag handle */}
          <div
            className={cn(
              'w-12 flex items-center justify-center self-stretch transition-opacity',
              'opacity-0 group-hover/cell:opacity-100',
              selected && 'opacity-100',
            )}
            aria-hidden="true"
          >
            <DragIndicatorIcon />
          </div>

          {/* Execution count */}
          <div className="w-[52px] h-14 flex items-center justify-end text-xs text-on-surface-variant select-none pr-1">
            {status === 'running' ? (
              <SpinnerIcon />
            ) : executionCount != null ? (
              <span>[{executionCount}]</span>
            ) : null}
          </div>
        </div>

        {/* ── Cell output wrapper ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 pb-2">
          {/* Editor container */}
          <div className="bg-surface-container-lowest border border-su-outline-variant rounded-[4px] p-4">
            {editor ?? (
              <CellCodeMirror
                type={type}
                value={value}
                onChange={isEditable ? onValueChange : undefined}
                editable={isEditable}
                onRun={onRun}
              />
            )}
          </div>

          {/* Error alert */}
          {error && <CellErrorAlert error={error} />}

          {/* Rendered output */}
          {renderedOutput && (
            <div className="p-4" data-testid="rendered-output">
              {renderedOutput}
            </div>
          )}
        </div>
      </div>
    );
  },
);
NotebookCell.displayName = 'NotebookCell';

export { NotebookCell, CellErrorAlert };
