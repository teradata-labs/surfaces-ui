/**
 * DataTable Primitive
 *
 * Virtual scrolling data table using TanStack Virtual.
 * Handles 100K+ rows at 60FPS with memoized row components.
 *
 * Props limited to 8 for AI describability (json-render catalog constraint).
 */
import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { VirtualRow } from './VirtualRow';
import type { DataTableProps } from './types';
import { ROW_HEIGHTS } from './types';

// Dynamic overscan based on dataset size for optimal performance
const getOverscan = (count: number) => count < 1000 ? 5 : count < 50000 ? 10 : 15;

export function DataTable({
  data,
  columns: columnsProp,
  height = 400,
  density = 'comfortable',
  virtualScrolling = true,
  onRowClick,
  className,
  showRowNumbers = false,
}: DataTableProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Derive columns from data if not provided
  const columns = React.useMemo(() => {
    if (columnsProp?.length) return columnsProp;
    if (!data.length) return [];
    return Object.keys(data[0] || {});
  }, [columnsProp, data]);

  const rowHeight = ROW_HEIGHTS[density];

  // Virtual scrolling setup with dynamic overscan
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: getOverscan(data.length),
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Empty state
  if (!data.length) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-muted-foreground border border-border rounded-lg',
          className
        )}
        style={{ height: `${height}px` }}
      >
        No data to display
      </div>
    );
  }

  // Non-virtual rendering for small datasets
  if (!virtualScrolling || data.length <= 100) {
    return (
      <div
        className={cn('border border-border rounded-lg overflow-hidden', className)}
      >
        <div className="overflow-auto" style={{ maxHeight: `${height}px` }}>
          <table
            className="w-full text-xs"
            role="grid"
            aria-rowcount={data.length + 1}
            aria-colcount={columns.length + (showRowNumbers ? 1 : 0)}
          >
            <thead className="bg-muted sticky top-0 z-10">
              <tr aria-rowindex={1}>
                {showRowNumbers && (
                  <th
                    className="px-3 py-1.5 text-right font-medium text-muted-foreground border-b border-border bg-muted w-12"
                    aria-colindex={1}
                  >
                    #
                  </th>
                )}
                {columns.map((col, idx) => (
                  <th
                    key={col}
                    className="px-3 py-1.5 text-left font-medium text-muted-foreground border-b border-border bg-muted"
                    aria-colindex={idx + 1 + (showRowNumbers ? 1 : 0)}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <VirtualRow
                  key={idx}
                  row={row}
                  columns={columns}
                  index={idx}
                  style={{}}
                  density={density}
                  onClick={onRowClick}
                  showRowNumbers={showRowNumbers}
                  ariaRowIndex={idx + 2}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Virtual scrolling for large datasets
  return (
    <div
      className={cn('border border-border rounded-lg overflow-hidden', className)}
    >
      <div
        ref={parentRef}
        className="overflow-auto scrollbar-thin"
        style={{ height: `${height}px` }}
      >
        <table
          className="w-full text-xs"
          role="grid"
          aria-rowcount={data.length + 1}
          aria-colcount={columns.length + (showRowNumbers ? 1 : 0)}
        >
          <thead className="bg-muted sticky top-0 z-10">
            <tr aria-rowindex={1}>
              {showRowNumbers && (
                <th
                  className="px-3 py-1.5 text-right font-medium text-muted-foreground border-b border-border bg-muted w-12"
                  aria-colindex={1}
                >
                  #
                </th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left font-medium text-muted-foreground border-b border-border bg-muted"
                  aria-colindex={idx + 1 + (showRowNumbers ? 1 : 0)}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: `${totalSize}px`, position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const row = data[virtualRow.index];
              if (!row) return null;
              return (
                <VirtualRow
                  key={virtualRow.index}
                  row={row}
                  columns={columns}
                  index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  density={density}
                  onClick={onRowClick}
                  showRowNumbers={showRowNumbers}
                  ariaRowIndex={virtualRow.index + 2}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
