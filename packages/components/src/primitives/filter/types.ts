/**
 * Filter Primitive Types
 */

/** Filter props - 6 props for AI describability */
export interface FilterProps {
  /** Current search/filter value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in ms (0 for immediate) */
  debounceMs?: number;
  /** Additional CSS class */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/** Column filter for more advanced filtering */
export interface ColumnFilter {
  column: string;
  value: string;
}

/** Extended filter props for column-specific filtering */
export interface ColumnFilterProps extends FilterProps {
  /** Available columns for filtering */
  columns?: string[];
  /** Column-specific filters */
  columnFilters?: Record<string, string>;
  /** Callback when column filter changes */
  onColumnFilterChange?: (column: string, value: string) => void;
}
