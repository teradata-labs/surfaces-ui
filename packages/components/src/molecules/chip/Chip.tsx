import * as React from 'react';
import { cn } from '../../lib/utils';

// ── FilterChip ─────────────────────────────────────────────────────────────

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  className?: string;
}

const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, selected = false, onSelectedChange, className, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onSelectedChange?.(!selected);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={handleClick}
        className={cn(
          'h-8 px-3 rounded-full text-sm font-medium transition-colors',
          'flex items-center gap-1.5 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          selected
            ? 'bg-secondary-container text-secondary-container-foreground'
            : 'border border-su-outline text-on-surface-variant hover:bg-secondary-container/10',
          className
        )}
        {...props}
      >
        {selected && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {label}
      </button>
    );
  }
);
FilterChip.displayName = 'FilterChip';

// ── InputChip ─────────────────────────────────────────────────────────────

export interface InputChipProps {
  label: string;
  onDismiss?: () => void;
  className?: string;
}

const InputChip = React.forwardRef<HTMLDivElement, InputChipProps>(
  ({ label, onDismiss, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full',
        'border border-su-outline text-sm text-foreground bg-surface-container',
        className
      )}
    >
      <span>{label}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Remove ${label}`}
          className={cn(
            'ml-0.5 w-4 h-4 flex items-center justify-center rounded-full',
            'hover:bg-(--on-surface-12-raw) text-on-surface-variant transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
);
InputChip.displayName = 'InputChip';

export { FilterChip, InputChip };
