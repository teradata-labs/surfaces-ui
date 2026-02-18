/**
 * ChartWithControls Molecule Types
 */
import type { ChartType } from '../../primitives/chart/types';

/** ChartWithControls props - Chart with configuration UI */
export interface ChartWithControlsProps {
  /** Data rows to visualize */
  data: Record<string, unknown>[];
  /** Available columns for axis selection */
  columns?: string[];
  /** Chart height in pixels */
  height?: number;
  /** Initial chart type */
  initialChartType?: ChartType;
  /** Initial X axis column */
  initialXAxis?: string;
  /** Initial Y axis column */
  initialYAxis?: string;
  /** Show chart options panel */
  showControls?: boolean;
  /** Controls panel collapsed by default */
  controlsCollapsed?: boolean;
  /** Callback when chart config changes */
  onConfigChange?: (config: ChartControlsState) => void;
  /** Additional CSS class */
  className?: string;
}

/** Chart controls state */
export interface ChartControlsState {
  chartType: ChartType;
  xAxis: string;
  yAxis: string;
  showDataLabels: boolean;
}

/** Supported chart types with labels */
export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'heatmap', label: 'Heatmap' },
];
