/**
 * DataTable — Covalent data table organism.
 *
 * Full-featured table matching Figma (node 7626:22287) with:
 *   - Checkbox row selection (controlled, indeterminate header)
 *   - Column sorting with visual indicators
 *   - Per-row overflow actions menu
 *   - 4 density levels
 *   - Virtual scrolling for large datasets via shared table-core
 *
 * Uses Covalent design tokens throughout (surface-container, outline-variant, etc.).
 */

import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  TableHeader,
  useVirtualTable,
  DENSITY_HEIGHTS,
  type SortDirection,
} from '../../primitives/table-core';
import { Checkbox } from '../../primitives/checkbox/Checkbox';
import { DataTableRow } from './DataTableRow';
import type { DataTableProps, DataTableColumn } from './types';

/* ── Defaults ─────────────────────────────────────────────────────────── */

const DEFAULT_WIDTHS: Record<string, number> = {
  checkbox: 56,
  actions: 48,
};

const defaultGetRowKey = (_row: Record<string, unknown>, index: number) => index;

/* ── Component ────────────────────────────────────────────────────────── */

export function DataTable<T extends Record<string, unknown> = Record<string, unknown>>({
  data,
  columns,
  height = 400,
  density = 'default',
  virtualScrolling = true,
  selectedKeys,
  onSelectionChange,
  getRowKey = defaultGetRowKey as (row: T, index: number) => string | number,
  sort = null,
  onSortChange,
  rowActions,
  onRowClick,
  className,
  'aria-label': ariaLabel = 'Data table',
}: DataTableProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { header: headerHeight, body: bodyHeight } = DENSITY_HEIGHTS[density];

  /* ── Virtual scrolling ─────────────────────────────────────────────── */

  const { virtualItems, totalSize, isVirtual } = useVirtualTable({
    count: data.length,
    rowHeight: bodyHeight,
    containerRef: scrollRef,
    enabled: virtualScrolling,
  });

  /* ── Selection logic ───────────────────────────────────────────────── */

  const hasSelection = !!onSelectionChange;
  const selectAllState: boolean | 'indeterminate' = React.useMemo(() => {
    if (!selectedKeys || selectedKeys.size === 0) return false;
    if (selectedKeys.size >= data.length) return true;
    return 'indeterminate';
  }, [selectedKeys, data.length]);

  const handleSelectAll = React.useCallback(() => {
    if (!onSelectionChange) return;
    if (selectAllState === true) {
      // Deselect all
      onSelectionChange(new Set());
    } else {
      // Select all
      const allKeys = new Set(data.map((row, i) => getRowKey(row, i)));
      onSelectionChange(allKeys);
    }
  }, [onSelectionChange, selectAllState, data, getRowKey]);

  const handleToggleRow = React.useCallback(
    (index: number) => {
      if (!onSelectionChange || !selectedKeys || !data[index]) return;
      const key = getRowKey(data[index], index);
      const next = new Set(selectedKeys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onSelectionChange(next);
    },
    [onSelectionChange, selectedKeys, data, getRowKey],
  );

  /* ── Sort logic ────────────────────────────────────────────────────── */

  const handleSort = React.useCallback(
    (columnId: string) => {
      if (!onSortChange) return;
      if (sort?.columnId === columnId) {
        if (sort.direction === 'asc') {
          onSortChange({ columnId, direction: 'desc' });
        } else {
          onSortChange(null); // clear sort
        }
      } else {
        onSortChange({ columnId, direction: 'asc' });
      }
    },
    [onSortChange, sort],
  );

  /* ── Column metadata ───────────────────────────────────────────────── */

  const colCount = columns.length;

  /* ── Empty state ───────────────────────────────────────────────────── */

  if (!data.length) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-on-surface-variant border border-su-outline-variant rounded-lg',
          className,
        )}
        style={{ height: `${height}px` }}
        role="status"
      >
        No data to display
      </div>
    );
  }

  /* ── Render header cell ────────────────────────────────────────────── */

  function renderHeaderCell(col: DataTableColumn<T>) {
    if (col.type === 'checkbox') {
      return (
        <TableHeader
          key={col.id}
          align="center"
          height={headerHeight}
          className="w-[56px]"
        >
          {hasSelection ? (
            <Checkbox
              checked={selectAllState}
              onCheckedChange={handleSelectAll}
              aria-label="Select all rows"
            />
          ) : (
            <span className="sr-only">Select</span>
          )}
        </TableHeader>
      );
    }

    if (col.type === 'actions') {
      return (
        <TableHeader
          key={col.id}
          height={headerHeight}
          className="w-[48px]"
        >
          <span className="sr-only">Actions</span>
        </TableHeader>
      );
    }

    const isSortable = col.sortable && !!onSortChange;
    const sortDir: SortDirection | null =
      sort?.columnId === col.id ? sort.direction : null;

    return (
      <TableHeader
        key={col.id}
        align={col.align ?? (col.type === 'number' ? 'right' : 'left')}
        height={headerHeight}
        sortable={isSortable}
        sortDirection={sortDir}
        onSort={isSortable ? () => handleSort(col.id) : undefined}
        style={col.width ? { width: `${col.width}px` } : undefined}
      >
        {col.header}
      </TableHeader>
    );
  }

  /* ── Render rows ───────────────────────────────────────────────────── */

  function renderRow(row: T, index: number, rowStyle: React.CSSProperties = {}) {
    const key = getRowKey(row, index);
    const isSelected = selectedKeys?.has(key) ?? false;

    return (
      <DataTableRow<T>
        key={key}
        row={row}
        columns={columns}
        index={index}
        style={rowStyle}
        density={density}
        selected={isSelected}
        onSelectToggle={hasSelection ? handleToggleRow : undefined}
        rowActions={rowActions}
        onRowClick={onRowClick}
        getRowKey={getRowKey}
        ariaRowIndex={index + 2}
      />
    );
  }

  /* ── Main render ───────────────────────────────────────────────────── */

  return (
    <div className={cn('border border-su-outline-variant rounded-lg overflow-hidden', className)}>
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: `${height}px` }}
      >
        <table
          className="w-full table-fixed"
          role="grid"
          aria-label={ariaLabel}
          aria-rowcount={data.length + 1}
          aria-colcount={colCount}
        >
          {/* Column widths */}
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.id}
                style={{
                  width: col.width
                    ? `${col.width}px`
                    : DEFAULT_WIDTHS[col.type]
                      ? `${DEFAULT_WIDTHS[col.type]}px`
                      : undefined,
                }}
              />
            ))}
          </colgroup>

          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr aria-rowindex={1}>
              {columns.map(renderHeaderCell)}
            </tr>
          </thead>

          {/* Body */}
          {isVirtual ? (
            <tbody style={{ height: `${totalSize}px`, position: 'relative' }}>
              {virtualItems.map((vItem) => {
                const row = data[vItem.index];
                if (!row) return null;
                return renderRow(row, vItem.index, {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vItem.start}px)`,
                });
              })}
            </tbody>
          ) : (
            <tbody>
              {data.map((row, i) => renderRow(row, i))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

DataTable.displayName = 'DataTable';
