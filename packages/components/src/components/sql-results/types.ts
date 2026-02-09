/**
 * SQLResultsDisplay Types
 */

import type { LucideIcon } from 'lucide-react';

/** Chart types supported by SQLResultsDisplay */
export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'heatmap'
  | 'area'
  | 'stacked-bar'
  | 'combo';

/** Aggregation types for grouped data */
export type AggregationType = 'sum' | 'avg' | 'count' | 'max' | 'min';

/** Chart configuration options */
export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string;
  yAxis2: string;
  groupBy: string;
  stackBy: string;
  aggregationType: AggregationType;
  horizontal: boolean;
  theme: string;
  colors: string[];
  showDataLabels: boolean;
  stacked: boolean;
}

/** Date range filter configuration */
export interface DateRangeFilter {
  start: string;
  end: string;
  column: string;
}

/** Full configuration for SQLResultsDisplay state */
export interface SQLResultsConfig {
  resultsViewMode: 'table' | 'chart';
  chartHeight: number;
  tableHeight: number;
  chartConfig: ChartConfig;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: Record<string, string>;
  dateRange: DateRangeFilter;
  limit: number;
  searchTerm: string;
  chartOptionsCollapsed: boolean;
}

/** SQL result data structure */
export interface SQLResultData {
  success?: boolean;
  columns?: string[];
  data?: Record<string, unknown>[];
  rows?: Record<string, unknown>[]; // Alternative name used by some kernels
  row_count?: number;
  error?: string;
  execution_time?: number;
}

/** Configurable action for the results toolbar */
export interface SQLResultsAction {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon?: LucideIcon;
  /** Click handler with access to current data */
  onClick: (data: {
    columns: string[];
    data: Record<string, unknown>[];
  }) => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Visual variant */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
}

/** Props for SQLResultsDisplay component */
export interface SQLResultsDisplayProps {
  /** SQL result data */
  data: SQLResultData;
  /** The SQL query that produced these results (for "Open in Teradata" action) */
  sql?: string;
  /** Optional saved configuration */
  savedConfig?: Partial<SQLResultsConfig>;
  /** Callback when configuration changes */
  onConfigChange?: (config: SQLResultsConfig) => void;
  /** Configurable actions (copy, export, custom) */
  actions?: SQLResultsAction[];
  /** Runtime context for portability */
  context?: 'web' | 'mcp-apps';
  /** Project ID for "Open in Teradata" deep link */
  projectId?: string;
  /** Base URL for Teradata app (default: http://localhost:8080) */
  teradataBaseUrl?: string;
  /** Additional CSS class */
  className?: string;
}

/** Default chart configuration */
export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar',
  xAxis: '',
  yAxis: '',
  yAxis2: '',
  groupBy: '',
  stackBy: '',
  aggregationType: 'sum',
  horizontal: false,
  theme: 'professionalLight',
  colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
  showDataLabels: false,
  stacked: false,
};

/** Default date range filter */
export const DEFAULT_DATE_RANGE: DateRangeFilter = {
  start: '',
  end: '',
  column: '',
};

/** Default SQLResultsConfig */
export const DEFAULT_RESULTS_CONFIG: SQLResultsConfig = {
  resultsViewMode: 'table',
  chartHeight: 400,
  tableHeight: 400,
  chartConfig: DEFAULT_CHART_CONFIG,
  sortBy: '',
  sortOrder: 'asc',
  filters: {},
  dateRange: DEFAULT_DATE_RANGE,
  limit: 100,
  searchTerm: '',
  chartOptionsCollapsed: false,
};
