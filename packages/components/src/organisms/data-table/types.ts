/**
 * DataTable Organism — Types
 *
 * Extends the shared table-core types with DataTable-specific features:
 * column types, row selection, sorting, and row actions.
 */

import type * as React from 'react';
import type { BaseColumnDef, TableDensity, SortState } from '../../primitives/table-core';

/* ── Column types ─────────────────────────────────────────────────────── */

/** Semantic column types controlling alignment, rendering, and width. */
export type ColumnType = 'text' | 'number' | 'checkbox' | 'actions';

/**
 * Column definition for the DataTable organism.
 *
 * Extends BaseColumnDef with type information and optional custom rendering.
 * Default widths: checkbox=56, actions=48, text/number fills remaining space.
 */
export interface DataTableColumn<T = Record<string, unknown>> extends BaseColumnDef {
  /** Column type — controls default alignment and rendering */
  type: ColumnType;
  /** Whether this column is sortable (only text/number columns) */
  sortable?: boolean;
  /** Custom cell renderer (overrides default text/number rendering) */
  renderCell?: (value: unknown, row: T, index: number) => React.ReactNode;
}

/* ── Row actions ──────────────────────────────────────────────────────── */

/** Action item rendered in the per-row 3-dot overflow menu. */
export interface RowAction<T = Record<string, unknown>> {
  /** Menu item label */
  label: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Destructive style (red text) */
  destructive?: boolean;
  /** Click handler — receives the row data and index */
  onClick: (row: T, index: number) => void;
}

/* ── DataTable props ──────────────────────────────────────────────────── */

export interface DataTableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Row data array */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Container height in px (for virtual scroll). Default: 400 */
  height?: number;
  /** Density level (4 Figma levels). Default: 'default' */
  density?: TableDensity;
  /** Enable virtual scrolling. Default: true; auto-disabled for ≤100 rows */
  virtualScrolling?: boolean;

  /* ── Selection (controlled) ─── */
  /** Set of selected row keys */
  selectedKeys?: Set<string | number>;
  /** Callback when selection changes */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Derives a unique key from a row. Defaults to array index. */
  getRowKey?: (row: T, index: number) => string | number;

  /* ── Sorting (controlled) ─── */
  /** Current sort state (null = unsorted) */
  sort?: SortState | null;
  /** Callback when sort changes */
  onSortChange?: (sort: SortState | null) => void;

  /* ── Row actions ─── */
  /** Actions rendered in the per-row overflow menu */
  rowActions?: RowAction<T>[];

  /* ── Interaction ─── */
  /** Callback when a row body is clicked (not checkbox/action) */
  onRowClick?: (row: T, index: number) => void;

  /** Additional CSS class */
  className?: string;
  /** ARIA label for the table */
  'aria-label'?: string;
}
