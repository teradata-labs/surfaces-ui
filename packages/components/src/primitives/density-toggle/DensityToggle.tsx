/**
 * DensityToggle Primitive
 *
 * Toggle between compact, comfortable, and spacious row density.
 * Atom-level component in atomic design hierarchy.
 *
 * Props limited to 5 for AI describability.
 */
import * as React from 'react';
import { AlignJustify, Menu, List } from 'lucide-react';
import { Button } from '../button';
import { cn } from '../../lib/utils';
import type { DensityToggleProps, Density } from './types';
import { DENSITY_OPTIONS } from './types';

// Icons for each density
const DENSITY_ICONS: Record<Density, React.ComponentType<{ className?: string }>> = {
  compact: AlignJustify,
  comfortable: Menu,
  spacious: List,
};

export function DensityToggle({
  value,
  onChange,
  options = DENSITY_OPTIONS,
  showLabels = false,
  className,
}: DensityToggleProps) {
  return (
    <div
      className={cn(
        'flex items-center rounded-lg border border-border bg-muted/20',
        className
      )}
      role="radiogroup"
      aria-label="Row density"
    >
      {options.map((option, index) => {
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const isActive = value === option.value;
        const Icon = DENSITY_ICONS[option.value];

        return (
          <Button
            key={option.value}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 px-2 text-xs',
              isFirst && !isLast && 'rounded-r-none border-r border-border',
              isLast && !isFirst && 'rounded-l-none',
              !isFirst && !isLast && 'rounded-none border-r border-border'
            )}
            title={option.description || option.label}
            role="radio"
            aria-checked={isActive}
          >
            <Icon className={cn('h-4 w-4', showLabels && 'mr-1.5')} />
            {showLabels && <span>{option.label}</span>}
          </Button>
        );
      })}
    </div>
  );
}

export default DensityToggle;
