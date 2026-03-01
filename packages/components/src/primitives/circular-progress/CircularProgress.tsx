import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CircularProgressProps {
  /** Progress value 0–100 */
  value: number;
  /** Diameter in pixels. Default: 48 */
  size?: number;
  /** Stroke width in pixels. Default: 4 */
  strokeWidth?: number;
  /** Show percentage label below. Default: true */
  showLabel?: boolean;
  className?: string;
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ value, size = 48, strokeWidth = 4, showLabel = true, className }, ref) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - clampedValue / 100);

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center gap-1', className)}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clampedValue}% complete`}
      >
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--outline))"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        {showLabel && (
          <span className="text-[10px] text-on-surface-variant">
            {clampedValue}%
          </span>
        )}
      </div>
    );
  }
);
CircularProgress.displayName = 'CircularProgress';

export { CircularProgress };
