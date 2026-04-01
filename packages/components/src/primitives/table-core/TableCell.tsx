/**
 * TableCell — Covalent-styled <td> shared across table components.
 *
 * Matches Figma specs:
 *   - border-top: var(--cv-theme-outline-variant)
 *   - padding: 16px horizontal
 *   - text: foreground, 14px, truncated
 */

import * as React from 'react';
import { cn } from '../../lib/utils';
import type { CellAlignment } from './types';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell content alignment */
  align?: CellAlignment;
  /** Cell height in px (from density) */
  height?: number;
  children?: React.ReactNode;
}

const ALIGN_CLASS: Record<CellAlignment, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function TableCell({
  align = 'left',
  height,
  className,
  children,
  style,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        'border-t border-su-outline-variant px-4 text-foreground text-sm leading-tight truncate',
        ALIGN_CLASS[align],
        className,
      )}
      style={{ height: height ? `${height}px` : undefined, ...style }}
      {...props}
    >
      {children}
    </td>
  );
}
