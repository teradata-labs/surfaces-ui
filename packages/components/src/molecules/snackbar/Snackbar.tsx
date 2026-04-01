import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SnackbarVariant = 'default' | 'positive' | 'caution' | 'negative';

export interface SnackbarProps {
  /** Message text */
  message: string;
  /** Visual variant */
  variant?: SnackbarVariant;
  /** Optional action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Show dismiss (X) button */
  dismissible?: boolean;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number;
  /** Whether the snackbar is visible */
  open?: boolean;
  className?: string;
}

const variantStyles: Record<SnackbarVariant, string> = {
  default: 'bg-inverse-surface text-inverse-on-surface',
  positive: 'bg-success text-on-success',
  caution: 'bg-warning text-on-warning',
  negative: 'bg-destructive text-destructive-foreground',
};

const Snackbar = React.forwardRef<HTMLDivElement, SnackbarProps>(
  (
    {
      message,
      variant = 'default',
      actionLabel,
      onAction,
      dismissible = false,
      onDismiss,
      duration = 4000,
      open = true,
      className,
    },
    ref
  ) => {
    React.useEffect(() => {
      if (!open || duration <= 0 || !onDismiss) return;
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }, [open, duration, onDismiss]);

    if (!open) return null;

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-2 rounded-sm px-4 py-3 text-sm shadow-lg min-w-[288px] max-w-[560px]',
          variantStyles[variant],
          className
        )}
      >
        <span className="flex-1 min-w-0">{message}</span>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-sm font-medium text-primary-inverse hover:underline"
          >
            {actionLabel}
          </button>
        )}

        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Snackbar.displayName = 'Snackbar';

export { Snackbar };
