/**
 * DataTable Primitive Types
 *
 * Types for virtual scrolling data table component.
 */

/** Row density options */
export type Density = 'compact' | 'comfortable' | 'spacious';

/** Row height in pixels for each density */
export const ROW_HEIGHTS: Record<Density, number> = {
  compact: 28,
  comfortable: 35,
  spacious: 44,
};

/** DataTable props - 8 props maximum for AI describability */
export interface DataTableProps {
  /** Data rows to display */
  data: Record<string, unknown>[];
  /** Column names to display (defaults to all columns from first row) */
  columns?: string[];
  /** Table height in pixels */
  height?: number;
  /** Row density */
  density?: Density;
  /** Enable virtual scrolling (recommended for >100 rows) */
  virtualScrolling?: boolean;
  /** Callback when a row is clicked */
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  /** Additional CSS class */
  className?: string;
  /** Show row numbers */
  showRowNumbers?: boolean;
}

/** Props for VirtualRow component */
export interface VirtualRowProps {
  row: Record<string, unknown>;
  columns: string[];
  index: number;
  style: React.CSSProperties;
  density: Density;
  onClick?: (row: Record<string, unknown>, index: number) => void;
  showRowNumbers?: boolean;
  ariaRowIndex?: number;
}
