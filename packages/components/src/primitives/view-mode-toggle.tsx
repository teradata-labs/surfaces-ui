/**
 * ViewModeToggle Component
 *
 * Reusable toggle component for switching between different view modes.
 * Commonly used for Table/Chart toggle in SQL results.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '../lib/utils';

export interface ViewModeOption {
  /** Unique identifier for the mode */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tooltip text */
  title?: string;
}

export interface ViewModeToggleProps {
  /** Available mode options */
  options: ViewModeOption[];
  /** Currently active mode ID */
  activeMode: string;
  /** Callback when mode changes */
  onModeChange: (modeId: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Show labels next to icons */
  showLabels?: boolean;
}

export function ViewModeToggle({
  options,
  activeMode,
  onModeChange,
  className,
  showLabels = true,
}: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        'flex items-center rounded-lg border border-border bg-muted/20',
        className
      )}
      role="tablist"
      aria-label="View mode"
    >
      {options.map((option, index) => {
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const isActive = activeMode === option.id;
        const Icon = option.icon;

        return (
          <Button
            key={option.id}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange(option.id)}
            className={cn(
              'h-7 px-2 text-xs',
              isFirst && !isLast && 'rounded-r-none border-r border-border',
              isLast && !isFirst && 'rounded-l-none',
              !isFirst && !isLast && 'rounded-none border-r border-border'
            )}
            title={option.title}
            role="tab"
            aria-selected={isActive}
          >
            <Icon className={cn('h-4 w-4', showLabels && 'mr-1.5')} />
            {showLabels && <span>{option.label}</span>}
          </Button>
        );
      })}
    </div>
  );
}
