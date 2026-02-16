/**
 * TableWithFilters Molecule Types
 */
import type { Density } from '../../primitives/data-table/types';

/** TableWithFilters props - composition of DataTable + Filter + DensityToggle */
export interface TableWithFiltersProps {
  /** Data rows to display */
  data: Record<string, unknown>[];
  /** Column names to display */
  columns?: string[];
  /** Table height in pixels */
  height?: number;
  /** Initial row density */
  initialDensity?: Density;
  /** Show search filter */
  showFilter?: boolean;
  /** Show density toggle */
  showDensityToggle?: boolean;
  /** Enable virtual scrolling */
  virtualScrolling?: boolean;
  /** Callback when row is clicked */
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
  /** Additional CSS class */
  className?: string;
}

/** Internal state for TableWithFilters */
export interface TableWithFiltersState {
  searchTerm: string;
  density: Density;
  filteredData: Record<string, unknown>[];
}
