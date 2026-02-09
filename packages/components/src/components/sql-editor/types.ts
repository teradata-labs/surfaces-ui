/**
 * SQLEditor Types
 */

/** SQL execution result from the MCP tool */
export interface SQLResult {
  success: boolean;
  columns?: string[];
  data?: Record<string, unknown>[];
  row_count?: number;
  error?: string;
  message?: string;
}

/** Configuration for chart visualization */
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
  showDataLabels?: boolean;
  horizontal?: boolean;
}

/** Persisted configuration for results display */
export interface ResultsConfig {
  viewMode: 'table' | 'chart';
  chartConfig: ChartConfig;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit: number;
  searchTerm?: string;
}

/** Props for the main SQLEditor component */
export interface SQLEditorProps {
  initialCode?: string;
  title?: string;
  onCodeChange?: (code: string) => void;
  onExecutionComplete?: (result: SQLResult) => void;
  autoExecute?: boolean;
  connectionId?: string;
  className?: string;
  readOnly?: boolean;
}

/** Props for SQLInput component */
export interface SQLInputProps {
  value: string;
  onChange: (code: string) => void;
  onExecute: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

/** Props for SQLToolbar component */
export interface SQLToolbarProps {
  isExecuting: boolean;
  hasResult: boolean;
  hasError: boolean;
  onExecute: () => void;
  onClear: () => void;
  title?: string;
}

/** Props for SQLResultsTable component */
export interface SQLResultsTableProps {
  columns: string[];
  data: Record<string, unknown>[];
  totalRows?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (column: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

/** Props for SQLVisualization component */
export interface SQLVisualizationProps {
  columns: string[];
  data: Record<string, unknown>[];
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  height?: number;
}
