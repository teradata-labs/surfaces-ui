/**
 * Type utilities for catalog-registry type safety
 *
 * Provides typed access to catalog schema props in registry wrappers,
 * eliminating the need for `as any` casts.
 */

/* ── Generic Data Types ───────────────────────────────────────────────── */

/**
 * Generic row type for data arrays - record with string keys and unknown values
 */
export type DataRow = Record<string, unknown>;

/* ── Chart Props ─────────────────────────────────────────────────────── */

export interface ChartProps {
  type: 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'heatmap' | 'stacked-bar' | 'combo';
  xAxis?: string;
  yAxis?: string;
  theme?: string | null;
  height?: number;
  showDataLabels?: boolean;
}

/* ── DataTable Props ─────────────────────────────────────────────────── */

export interface DataTableProps {
  columns?: string[];
  height?: number;
  density?: 'compact' | 'comfortable' | 'spacious';
  virtualScrolling?: boolean;
  showRowNumbers?: boolean;
}

/* ── Filter Props ────────────────────────────────────────────────────── */

export interface FilterProps {
  placeholder?: string;
  debounceMs?: number;
  ariaLabel?: string;
}

/* ── DensityToggle Props ─────────────────────────────────────────────── */

export interface DensityToggleProps {
  value?: 'compact' | 'comfortable' | 'spacious';
  showLabels?: boolean;
}

/* ── ViewModeToggle Props ────────────────────────────────────────────── */

export interface ViewModeToggleProps {
  modes?: ('table' | 'chart')[];
  activeMode?: 'table' | 'chart';
  showLabels?: boolean;
}

/* ── TableWithFilters Props ──────────────────────────────────────────── */

export interface TableWithFiltersProps {
  columns?: string[];
  height?: number;
  initialDensity?: 'compact' | 'comfortable' | 'spacious';
  showFilter?: boolean;
  showDensityToggle?: boolean;
  virtualScrolling?: boolean;
}

/* ── ChartWithControls Props ─────────────────────────────────────────── */

export interface ChartWithControlsProps {
  columns?: string[];
  height?: number;
  initialChartType?: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap';
  initialXAxis?: string;
  initialYAxis?: string;
  showControls?: boolean;
  controlsCollapsed?: boolean;
}

/* ── SQLResultsDisplay Props ─────────────────────────────────────────── */

export interface SQLResultsDisplayProps {
  sql?: string;
  context?: 'web' | 'mcp-apps';
  projectId?: string;
  teradataBaseUrl?: string;
  initialViewMode?: 'table' | 'chart';
  tableHeight?: number;
  chartHeight?: number;
}
