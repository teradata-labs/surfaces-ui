import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Progress value 0–100.
   * Omit (or pass undefined) for indeterminate state.
   */
  value?: number;
  className?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, className, ...props }, ref) => {
    const isIndeterminate = value === undefined || value === null;
    const clampedValue = isIndeterminate
      ? undefined
      : Math.max(0, Math.min(100, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={isIndeterminate ? 'Loading…' : `${clampedValue}% complete`}
        className={cn(
          'h-2 w-full rounded-full bg-surface-container-highest overflow-hidden relative',
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <div
            className="h-full w-1/3 rounded-full bg-primary absolute"
            style={{ animation: 'su-progress-indeterminate 1.5s ease-in-out infinite' }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${clampedValue}%` }}
          />
        )}
        <style>{`
          @keyframes su-progress-indeterminate {
            0%   { left: -33%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
