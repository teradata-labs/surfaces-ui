/**
 * TableHeader — Covalent-styled <th> shared across table components.
 *
 * Matches Figma specs:
 *   - bg: surface-container
 *   - text: on-surface-variant, 12px (caption), font-medium
 *   - padding: 16px horizontal
 *   - Optional sort indicator with aria-sort
 */

import * as React from 'react';
import { cn } from '../../lib/utils';
import type { CellAlignment, SortDirection } from './types';

export interface TableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Content alignment */
  align?: CellAlignment;
  /** Header height in px (from density) */
  height?: number;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Current sort direction (null = unsorted) */
  sortDirection?: SortDirection | null;
  /** Click handler for sort toggle */
  onSort?: () => void;
  children?: React.ReactNode;
}

const ALIGN_CLASS: Record<CellAlignment, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/* Sort arrow SVGs — small inline icons matching Figma */
const SortArrow = ({ direction }: { direction: SortDirection }) => (
  <svg
    className="w-3 h-3 shrink-0"
    viewBox="0 0 12 12"
    fill="currentColor"
    aria-hidden="true"
  >
    {direction === 'asc' ? (
      <path d="M6 2.5L10 8.5H2L6 2.5Z" />
    ) : (
      <path d="M6 9.5L2 3.5H10L6 9.5Z" />
    )}
  </svg>
);

export function TableHeader({
  align = 'left',
  height,
  sortable = false,
  sortDirection = null,
  onSort,
  className,
  children,
  style,
  ...props
}: TableHeaderProps) {
  const ariaSortValue = sortDirection === 'asc'
    ? 'ascending' as const
    : sortDirection === 'desc'
      ? 'descending' as const
      : undefined;

  return (
    <th
      className={cn(
        'bg-surface-container px-4 text-on-surface-variant text-xs font-medium select-none',
        ALIGN_CLASS[align],
        sortable && 'cursor-pointer hover:text-foreground transition-colors',
        className,
      )}
      style={{ height: height ? `${height}px` : undefined, ...style }}
      onClick={sortable ? onSort : undefined}
      aria-sort={ariaSortValue}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {children}
        {sortable && sortDirection && <SortArrow direction={sortDirection} />}
      </span>
    </th>
  );
}
