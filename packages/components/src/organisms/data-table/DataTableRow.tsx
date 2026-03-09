/**
 * DataTableRow — Memoized row component for virtual scrolling performance.
 *
 * Renders cells per column definition using shared TableCell styling.
 * Extracted from DataTable to enable React.memo optimization.
 */

import * as React from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TableCell } from '../../primitives/table-core';
import { Checkbox } from '../../primitives/checkbox/Checkbox';
import { Menu } from '../../molecules/menu/Menu';
import { IconButton } from '../../molecules/icon-button/IconButton';
import { DENSITY_HEIGHTS, type TableDensity } from '../../primitives/table-core';
import type { DataTableColumn, RowAction } from './types';

/* ── Props ────────────────────────────────────────────────────────────── */

export interface DataTableRowProps<T extends Record<string, unknown>> {
  row: T;
  columns: DataTableColumn<T>[];
  index: number;
  style: React.CSSProperties;
  density: TableDensity;
  selected: boolean;
  onSelectToggle?: (index: number) => void;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T, index: number) => void;
  getRowKey: (row: T, index: number) => string | number;
  ariaRowIndex: number;
}

/* ── Component ────────────────────────────────────────────────────────── */

function DataTableRowInner<T extends Record<string, unknown>>({
  row,
  columns,
  index,
  style,
  density,
  selected,
  onSelectToggle,
  rowActions,
  onRowClick,
  getRowKey,
  ariaRowIndex,
}: DataTableRowProps<T>) {
  const bodyHeight = DENSITY_HEIGHTS[density].body;

  const handleRowClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Don't fire row click when clicking checkbox or actions
      const target = e.target as HTMLElement;
      if (target.closest('[data-table-checkbox]') || target.closest('[data-table-actions]')) {
        return;
      }
      onRowClick?.(row, index);
    },
    [onRowClick, row, index],
  );

  const handleSelectToggle = React.useCallback(() => {
    onSelectToggle?.(index);
  }, [onSelectToggle, index]);

  // Build menu items from rowActions (bind row + index to onClick)
  const menuItems = React.useMemo(
    () =>
      rowActions?.map((action) => ({
        label: action.label,
        icon: action.icon,
        disabled: action.disabled,
        destructive: action.destructive,
        onClick: () => action.onClick(row, index),
      })) ?? [],
    [rowActions, row, index],
  );

  return (
    <tr
      className={cn(
        'hover:bg-(--on-surface-8-raw) transition-colors',
        selected && 'bg-primary/8',
        onRowClick && 'cursor-pointer',
      )}
      style={{ ...style, height: `${bodyHeight}px` }}
      role="row"
      aria-rowindex={ariaRowIndex}
      aria-selected={selected || undefined}
      onClick={onRowClick ? handleRowClick : undefined}
    >
      {columns.map((col) => {
        const key = getRowKey(row, index);

        if (col.type === 'checkbox') {
          return (
            <TableCell
              key={col.id}
              align="center"
              height={bodyHeight}
              className="w-[56px]"
              data-table-checkbox=""
            >
              <Checkbox
                checked={selected}
                onCheckedChange={handleSelectToggle}
                aria-label={`Select row ${key}`}
              />
            </TableCell>
          );
        }

        if (col.type === 'actions') {
          return (
            <TableCell
              key={col.id}
              align="center"
              height={bodyHeight}
              className="w-[48px]"
              data-table-actions=""
            >
              {menuItems.length > 0 && (
                <Menu
                  trigger={
                    <IconButton
                      variant="standard"
                      size="sm"
                      aria-label={`Actions for row ${key}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </IconButton>
                  }
                  items={menuItems}
                  align="end"
                />
              )}
            </TableCell>
          );
        }

        // Text or number column
        const value = row[col.id];
        const align = col.align ?? (col.type === 'number' ? 'right' : 'left');

        return (
          <TableCell
            key={col.id}
            align={align}
            height={bodyHeight}
            title={value != null ? String(value) : undefined}
            style={col.width ? { width: `${col.width}px` } : undefined}
          >
            {col.renderCell
              ? col.renderCell(value, row, index)
              : value != null
                ? String(value)
                : <span className="text-muted-foreground italic">—</span>}
          </TableCell>
        );
      })}
    </tr>
  );
}

export const DataTableRow = React.memo(DataTableRowInner) as typeof DataTableRowInner;
