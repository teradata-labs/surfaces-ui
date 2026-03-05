/**
 * VirtualRow - Memoized row component for DataTable
 *
 * Extracted as separate component to enable React.memo optimization.
 * Critical for 60FPS scrolling with large datasets.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';
import type { VirtualRowProps } from './types';
import { ROW_HEIGHTS } from './types';

function VirtualRowComponent({
  row,
  columns,
  index,
  style,
  density,
  onClick,
  showRowNumbers,
  ariaRowIndex,
}: VirtualRowProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(row, index);
  }, [onClick, row, index]);

  const rowHeight = ROW_HEIGHTS[density];
  const paddingClass = density === 'compact' ? 'px-2 py-1' : density === 'spacious' ? 'px-4 py-3' : 'px-3 py-2';

  return (
    <tr
      className={cn(
        'border-b border-border last:border-b-0 hover:bg-muted/30',
        onClick && 'cursor-pointer'
      )}
      style={{ ...style, height: `${rowHeight}px` }}
      onClick={onClick ? handleClick : undefined}
      role="row"
      aria-rowindex={ariaRowIndex}
    >
      {showRowNumbers && (
        <td
          className={cn(paddingClass, 'text-muted-foreground text-right w-12')}
          aria-colindex={1}
        >
          {index + 1}
        </td>
      )}
      {columns.map((col, idx) => (
        <td
          key={col}
          className={cn(paddingClass, 'text-foreground leading-tight truncate')}
          title={String(row[col] ?? '')}
          aria-colindex={idx + 1 + (showRowNumbers ? 1 : 0)}
        >
          {row[col] != null ? (
            String(row[col])
          ) : (
            <span className="text-muted-foreground italic">null</span>
          )}
        </td>
      ))}
    </tr>
  );
}

// Memoize to prevent unnecessary re-renders during virtual scrolling
export const VirtualRow = React.memo(VirtualRowComponent);
