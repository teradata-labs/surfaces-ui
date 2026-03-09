import * as React from 'react';
import {
  Check,
  AlertTriangle,
  XCircle,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { Checkbox } from '../../primitives/checkbox';
import { cn } from '../../lib/utils';

export type ActionRibbonState =
  | 'inactive'
  | 'active'
  | 'positive'
  | 'caution'
  | 'negative'
  | 'loading'
  | 'pending'
  | 'checked';

export interface ActionRibbonProps {
  /** Visual state controlling background color, icon, and label color */
  state?: ActionRibbonState;
  /** Status label text */
  label?: string;
  /** Number of selected items (checked state) */
  selectionCount?: number;
  /** Callback when "Clear selection" is clicked */
  onClearSelection?: () => void;
  /** Icon button elements (up to 3) */
  icons?: React.ReactNode[];
  /** Action button elements (up to 3) */
  actions?: React.ReactNode[];
  /** Checkbox checked state (checked variant) */
  checked?: boolean;
  /** Checkbox change handler */
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

const stateConfig: Record<
  ActionRibbonState,
  { bg: string; textColor: string; icon: React.ReactNode | null }
> = {
  inactive: {
    bg: '',
    textColor: 'text-muted-foreground',
    icon: null,
  },
  active: {
    bg: 'bg-primary/8',
    textColor: 'text-primary',
    icon: null,
  },
  positive: {
    bg: 'bg-success/8',
    textColor: 'text-success',
    icon: <Check className="h-6 w-6 text-success" />,
  },
  caution: {
    bg: 'bg-warning/8',
    textColor: 'text-warning',
    icon: <AlertTriangle className="h-6 w-6 text-warning" />,
  },
  negative: {
    bg: 'bg-destructive/8',
    textColor: 'text-destructive',
    icon: <XCircle className="h-6 w-6 text-destructive" />,
  },
  loading: {
    bg: '',
    textColor: 'text-primary',
    icon: <Loader2 className="h-6 w-6 text-primary animate-spin" />,
  },
  pending: {
    bg: '',
    textColor: 'text-on-surface-variant',
    icon: <MoreHorizontal className="h-6 w-6 text-on-surface-variant" />,
  },
  checked: {
    bg: 'bg-primary/8',
    textColor: 'text-on-surface-variant',
    icon: null,
  },
};

const ActionRibbon = React.forwardRef<HTMLDivElement, ActionRibbonProps>(
  (
    {
      state = 'inactive',
      label = 'No changes',
      selectionCount,
      onClearSelection,
      icons,
      actions,
      checked = false,
      onCheckedChange,
      className,
    },
    ref
  ) => {
    const config = stateConfig[state];
    const isChecked = state === 'checked';

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={isChecked ? `${selectionCount ?? 0} items selected` : label}
        className={cn(
          'flex h-14 items-center border-b border-border pr-1 py-1 pl-4',
          config.bg,
          className
        )}
      >
        {/* Checkbox (checked state only) */}
        {isChecked && (
          <div className="flex items-center px-1 shrink-0">
            <Checkbox
              checked={checked}
              onCheckedChange={onCheckedChange}
              aria-label="Select all"
            />
          </div>
        )}

        {/* Status icon */}
        {config.icon && (
          <div className="shrink-0" aria-hidden="true">
            {config.icon}
          </div>
        )}

        {/* Label / selection message */}
        <div className="flex flex-1 items-center gap-1 min-w-0 pl-4">
          {isChecked ? (
            <>
              <span className="text-xs text-on-surface-variant whitespace-nowrap">
                {selectionCount ?? 0} {(selectionCount ?? 0) === 1 ? 'item' : 'items'} selected.
              </span>
              {onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Clear selection
                </button>
              )}
            </>
          ) : (
            <span className={cn('text-xs truncate', config.textColor)}>
              {label}
            </span>
          )}
        </div>

        {/* Icon slots */}
        {icons && icons.length > 0 && (
          <div className="flex items-center shrink-0">
            {icons.map((icon, i) => (
              <React.Fragment key={i}>{icon}</React.Fragment>
            ))}
          </div>
        )}

        {/* Action button slots */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 pl-2 pr-3">
            {actions.map((action, i) => (
              <React.Fragment key={i}>{action}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }
);
ActionRibbon.displayName = 'ActionRibbon';

export { ActionRibbon };
