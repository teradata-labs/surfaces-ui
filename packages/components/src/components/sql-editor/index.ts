/**
 * SQL Editor Component Exports
 */

export { SQLEditor } from './SQLEditor';
export type { SQLEditorExtendedProps } from './SQLEditor';
export { SQLInput } from './SQLInput';
export { MonacoSQLInput } from './MonacoSQLInput';
export { SQLToolbar } from './SQLToolbar';

// Re-export SQLResultsDisplay and related types from sql-results
export {
  SQLResultsDisplay,
  createDefaultActions,
  DEFAULT_RESULTS_CONFIG,
  DEFAULT_CHART_CONFIG,
  DEFAULT_DATE_RANGE,
} from '../sql-results';

// Legacy exports (still available for backward compatibility)
export { SQLResultsTable } from './SQLResultsTable';
export { SQLVisualization } from './SQLVisualization';

export type {
  SQLEditorProps,
  SQLInputProps,
  SQLToolbarProps,
  SQLResultsTableProps,
  SQLVisualizationProps,
  SQLResult,
  ChartConfig as LegacyChartConfig,
  ResultsConfig as LegacyResultsConfig,
} from './types';

// New types from sql-results
export type {
  SQLResultsDisplayProps,
  SQLResultsConfig,
  SQLResultsAction,
  SQLResultData,
  ChartConfig,
  ChartType,
  AggregationType,
  DateRangeFilter,
} from '../sql-results/types';
