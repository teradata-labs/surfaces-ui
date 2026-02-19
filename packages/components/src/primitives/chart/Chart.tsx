/**
 * Chart Primitive
 *
 * Standalone ECharts wrapper with theme integration.
 * Supports 8 chart types with automatic theme detection.
 *
 * Props limited to 8 for AI describability (json-render catalog constraint).
 */
import * as React from 'react';
import * as echarts from 'echarts';
import { registerEChartsThemes } from '../../components/charts/echart-themes';
import { cn } from '../../lib/utils';
import { generateChartOption, getSystemTheme, detectBestAxes } from './utils';
import type { ChartProps } from './types';

// Register themes on module load (idempotent)
registerEChartsThemes(echarts);

export function Chart({
  data,
  xAxis: xAxisProp,
  yAxis: yAxisProp,
  type = 'bar',
  theme: themeProp,
  height = 400,
  showDataLabels = false,
  className,
}: ChartProps) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartInstance = React.useRef<echarts.ECharts | null>(null);

  // Determine axes - use provided or auto-detect
  const columns = React.useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0] || {});
  }, [data]);

  const { xAxis, yAxis } = React.useMemo(() => {
    if (xAxisProp && yAxisProp) {
      return { xAxis: xAxisProp, yAxis: yAxisProp };
    }
    const detected = detectBestAxes(data, columns);
    return {
      xAxis: xAxisProp || detected.xAxis,
      yAxis: yAxisProp || detected.yAxis,
    };
  }, [xAxisProp, yAxisProp, data, columns]);

  // Determine theme - use provided or detect system theme
  const theme = React.useMemo(() => {
    if (themeProp) return themeProp;
    return getSystemTheme();
  }, [themeProp]);

  // Initialize chart with theme
  React.useEffect(() => {
    if (!chartRef.current) return;

    // Dispose existing instance (theme change requires re-init)
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current, theme);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [theme]);

  // Update chart options when data or config changes
  React.useEffect(() => {
    if (!chartInstance.current || !data.length) return;

    const option = generateChartOption(data, xAxis, yAxis, type, showDataLabels);
    chartInstance.current.setOption(option, { notMerge: true });
  }, [data, xAxis, yAxis, type, showDataLabels]);

  // Handle resize
  React.useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container changes
    let observer: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        setTimeout(() => chartInstance.current?.resize(), 100);
      });
      observer.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, []);

  if (!data.length) {
    return (
      <div
        className={cn('flex items-center justify-center text-muted-foreground', className)}
        style={{ height: `${height}px` }}
      >
        No data to display
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className={cn('w-full', className)}
      style={{ height: `${height}px` }}
      role="img"
      aria-label={`${type} chart showing ${yAxis} by ${xAxis}`}
      data-testid="chart"
    />
  );
}

export default Chart;
