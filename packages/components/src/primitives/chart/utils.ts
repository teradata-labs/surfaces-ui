/**
 * Chart Utility Functions
 *
 * Extracted from SQLResultsDisplay for reuse in Chart primitive.
 */
import type * as echarts from 'echarts';
import type { ChartType } from './types';
import { DEFAULT_CHART_COLORS } from './types';

/**
 * Detect the system theme (dark/light) for ECharts
 */
export function getSystemTheme(): string {
  if (typeof window !== 'undefined') {
    if (
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark')
    ) {
      return 'professionalDark';
    }
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'professionalDark';
    }
  }
  return 'professionalLight';
}

/**
 * Auto-detect best axes from data structure
 */
export function detectBestAxes(
  rows: Record<string, unknown>[],
  columns: string[]
): { xAxis: string; yAxis: string } {
  if (!rows.length || !columns.length) return { xAxis: '', yAxis: '' };

  const firstRow = rows[0];
  if (!firstRow) return { xAxis: columns[0] || '', yAxis: columns[1] || columns[0] || '' };

  const categoricalCandidates = columns.filter((col) => {
    const sampleValue = firstRow[col];
    return typeof sampleValue === 'string';
  });

  const numericalCandidates = columns.filter((col) => {
    const sampleValue = firstRow[col];
    const numValue = parseFloat(String(sampleValue));
    return !isNaN(numValue) && isFinite(numValue);
  });

  const xAxis = categoricalCandidates[0] || columns[0] || '';
  const yAxis =
    numericalCandidates.find((col) => col !== xAxis) ||
    numericalCandidates[0] ||
    columns[1] ||
    columns[0] ||
    '';

  return { xAxis, yAxis };
}

/**
 * Generate ECharts option for a simple chart (no grouping/stacking)
 * For advanced configs, use generateAdvancedChartOption
 *
 * NOTE: Does NOT set explicit colors - allows ECharts theme to control colors
 */
export function generateChartOption(
  data: Record<string, unknown>[],
  xAxis: string,
  yAxis: string,
  type: ChartType = 'bar',
  showDataLabels = false,
  colors?: string[]
): echarts.EChartsOption {
  if (!data.length) return {};

  const xData = data.map((row) => String(row[xAxis] || ''));
  const yData = data.map((row) => {
    const val = parseFloat(String(row[yAxis]));
    return isNaN(val) ? 0 : val;
  });

  const categoryAxisStyle = {
    type: 'category' as const,
    data: xData,
    axisLabel: {
      interval: 0,
      fontSize: 12,
      color: '#6b7280',
      rotate: xData.some((label) => label.length > 8) ? 45 : 0,
    },
    axisLine: { lineStyle: { color: '#6b7280', type: 'dotted' as const } },
    axisTick: { lineStyle: { color: '#6b7280' } },
  };

  const valueAxisStyle = {
    type: 'value' as const,
    axisLabel: { fontSize: 12, color: '#6b7280' },
    axisLine: { lineStyle: { color: '#6b7280', type: 'dotted' as const } },
    axisTick: { lineStyle: { color: '#6b7280' } },
    splitLine: { lineStyle: { color: '#6b7280', type: 'dotted' as const, opacity: 0.3 } },
  };

  const baseOption: echarts.EChartsOption = {
    tooltip: {
      trigger: type === 'pie' ? 'item' : 'axis',
      axisPointer: type !== 'pie' ? { type: 'shadow' } : undefined,
    },
    grid: type !== 'pie' ? {
      left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true,
    } : undefined,
  };

  // Type-specific series configuration
  switch (type) {
    case 'pie':
      return {
        ...baseOption,
        series: [{
          name: yAxis,
          type: 'pie',
          radius: '60%',
          data: xData.map((name, idx) => ({ name, value: yData[idx] })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
          label: showDataLabels ? { show: true } : { show: false },
        }],
      };

    case 'scatter':
      return {
        ...baseOption,
        xAxis: { ...valueAxisStyle, name: xAxis },
        yAxis: { ...valueAxisStyle, name: yAxis },
        series: [{
          type: 'scatter',
          data: data.map((row) => [
            parseFloat(String(row[xAxis])) || 0,
            parseFloat(String(row[yAxis])) || 0,
          ]),
          symbolSize: 8,
          // Let theme control colors
        }],
      };

    case 'heatmap':
      return {
        ...baseOption,
        xAxis: { ...categoryAxisStyle },
        yAxis: { type: 'category', data: ['Value'] },
        visualMap: {
          min: Math.min(...yData),
          max: Math.max(...yData),
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '0%',
        },
        series: [{
          type: 'heatmap',
          data: yData.map((val, idx) => [idx, 0, val]),
          label: showDataLabels ? { show: true } : { show: false },
        }],
      };

    case 'area':
      return {
        ...baseOption,
        xAxis: { ...categoryAxisStyle },
        yAxis: { ...valueAxisStyle },
        series: [{
          name: yAxis,
          type: 'line',
          data: yData,
          areaStyle: {},
          smooth: true,
          // Let theme control colors
        }],
      };

    case 'line':
      return {
        ...baseOption,
        xAxis: { ...categoryAxisStyle },
        yAxis: { ...valueAxisStyle },
        series: [{
          name: yAxis,
          type: 'line',
          data: yData,
          smooth: true,
          // Let theme control colors
        }],
      };

    case 'bar':
    default:
      return {
        ...baseOption,
        xAxis: { ...categoryAxisStyle },
        yAxis: { ...valueAxisStyle },
        series: [{
          name: yAxis,
          type: 'bar',
          data: yData,
          barWidth: '60%',
          label: showDataLabels ? { show: true, position: 'top' as const } : undefined,
          // Let theme control colors
        }],
      };
  }
}
