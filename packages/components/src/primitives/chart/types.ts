/**
 * Chart Primitive Types
 *
 * Standalone types for the Chart component, extracted from SQLResultsDisplay.
 */

/** Chart types supported by Chart primitive */
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

/** Chart primitive props - 8 props maximum for AI describability */
export interface ChartProps {
  /** Data rows to visualize */
  data: Record<string, unknown>[];
  /** Column name for X axis */
  xAxis: string;
  /** Column name for Y axis */
  yAxis: string;
  /** Chart type to render */
  type?: ChartType;
  /** ECharts theme name (auto-detects system theme if not provided) */
  theme?: string;
  /** Chart height in pixels */
  height?: number;
  /** Show data labels on chart elements */
  showDataLabels?: boolean;
  /** Additional CSS class */
  className?: string;
}

/** Extended chart configuration for advanced use cases */
export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string;
  yAxis2?: string;
  groupBy?: string;
  stackBy?: string;
  aggregationType: AggregationType;
  horizontal?: boolean;
  theme: string;
  colors: string[];
  showDataLabels: boolean;
  stacked?: boolean;
}

/** Default chart colors (matches existing theme) */
export const DEFAULT_CHART_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];
