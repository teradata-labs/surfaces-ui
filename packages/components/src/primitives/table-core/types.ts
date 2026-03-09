/**
 * Table Core — Shared types for all Covalent table components.
 *
 * Provides density constants, alignment, column definitions, and sort state
 * used by both the DataTable organism (admin/management) and future
 * migrations of the SQL results table.
 */

/* ── Density ──────────────────────────────────────────────────────────── */

/** 4 density levels matching Figma (node 7626:22287). */
export type TableDensity = 'default' | 'comfortable' | 'compact' | 'dense';

/** Header & body row heights (px) per density level. */
export const DENSITY_HEIGHTS: Record<TableDensity, { header: number; body: number }> = {
  default: { header: 56, body: 48 },
  comfortable: { header: 48, body: 40 },
  compact: { header: 40, body: 32 },
  dense: { header: 32, body: 24 },
};

/* ── Cell alignment ───────────────────────────────────────────────────── */

export type CellAlignment = 'left' | 'right' | 'center';

/* ── Base column definition ───────────────────────────────────────────── */

export interface BaseColumnDef {
  /** Unique column identifier (also used as data accessor key) */
  id: string;
  /** Display header text */
  header?: string;
  /** Fixed width in px */
  width?: number;
  /** Cell content alignment */
  align?: CellAlignment;
}

/* ── Sort ──────────────────────────────────────────────────────────────── */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** Column being sorted */
  columnId: string;
  /** Sort direction */
  direction: SortDirection;
}
