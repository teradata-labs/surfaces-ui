/**
 * SQLResultsDisplay - Rich SQL results display with table/chart views
 *
 * Features:
 * - Table view with sorting, filtering, search
 * - 8 chart types (bar, line, pie, scatter, heatmap, area, stacked-bar, combo)
 * - 10 accessible color themes (light/dark variants)
 * - Collapsible chart options panel
 * - Resizable table/chart heights
 * - Configurable actions via props
 * - "Open in Teradata" deep link support
 */

import * as React from 'react';
import * as echarts from 'echarts';
import {
  Table as TableIcon,
  BarChart3,
  AlertCircle,
  Download,
  Copy,
  Filter,
  Calendar,
  X,
  ChevronLeft,
  Settings,
  GripHorizontal,
  ExternalLink,
} from 'lucide-react';

import { Button } from '../../primitives/button';
import { Badge } from '../../primitives/badge';
import { Card, CardContent } from '../../primitives/card';
import { Input } from '../../primitives/input';
import { ViewModeToggle } from '../../primitives/view-mode-toggle';
import { ECharts } from '../charts/ECharts';
import { registerEChartsThemes } from '../charts/echart-themes';
import { cn } from '../../lib/utils';

import type {
  SQLResultsDisplayProps,
  SQLResultsConfig,
  SQLResultsAction,
  ChartConfig,
  DateRangeFilter,
} from './types';
import { DEFAULT_RESULTS_CONFIG, DEFAULT_CHART_CONFIG } from './types';
import { useMcpBridge } from '../../bridge/McpBridgeProvider';

// Register themes on module load
registerEChartsThemes(echarts);

/**
 * Create default actions for the results toolbar
 */
export function createDefaultActions(options: {
  projectId?: string;
  teradataBaseUrl?: string;
}): SQLResultsAction[] {
  const actions: SQLResultsAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      icon: Copy,
      tooltip: 'Copy as JSON',
      onClick: async ({ data }) => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        } catch {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = JSON.stringify(data, null, 2);
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      },
    },
    {
      id: 'export-csv',
      label: 'Export',
      icon: Download,
      tooltip: 'Export to CSV',
      onClick: ({ columns, data }) => {
        const headers = columns.join(',');
        const rows = data
          .map((row) =>
            columns
              .map((col) => {
                const value = row[col];
                const str = String(value ?? '');
                if (str.includes(',') || str.includes('"')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              })
              .join(',')
          )
          .join('\n');
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query_results.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    },
  ];

  // Always add "Open in Teradata" action
  const baseUrl = options.teradataBaseUrl || 'http://localhost:8080';
  actions.push({
    id: 'open-in-teradata',
    label: options.projectId ? 'Open in Teradata' : 'New Project',
    icon: ExternalLink,
    tooltip: options.projectId
      ? 'Open this project in Teradata Studio'
      : 'Open in Teradata Studio as a new project',
    // onClick is overridden in the component to include SQL context
    onClick: () => {
      const url = options.projectId
        ? `${baseUrl}/project/${options.projectId}`
        : `${baseUrl}/project/new`;
      window.open(url, '_blank');
    },
  });

  return actions;
}

/**
 * Detect the system theme (dark/light)
 */
function getSystemTheme(): string {
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
 * Auto-detect best axes from data
 */
function detectBestAxes(
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

export function SQLResultsDisplay({
  data,
  sql,
  savedConfig,
  onConfigChange,
  actions: customActions,
  context = 'web',
  projectId,
  teradataBaseUrl,
  className,
}: SQLResultsDisplayProps) {
  // Merge saved config with defaults
  const initialConfig: SQLResultsConfig = {
    ...DEFAULT_RESULTS_CONFIG,
    ...savedConfig,
    chartConfig: {
      ...DEFAULT_CHART_CONFIG,
      ...savedConfig?.chartConfig,
    },
  };

  // State
  const [resultsViewMode, setResultsViewMode] = React.useState<'table' | 'chart'>(
    initialConfig.resultsViewMode
  );
  const [chartHeight, setChartHeight] = React.useState(initialConfig.chartHeight);
  const [tableHeight, setTableHeight] = React.useState(initialConfig.tableHeight);
  const [chartConfig, setChartConfig] = React.useState<ChartConfig>(
    initialConfig.chartConfig
  );
  const [filters, setFilters] = React.useState<Record<string, string>>(
    initialConfig.filters
  );
  const [dateRange, setDateRange] = React.useState<DateRangeFilter>(
    initialConfig.dateRange
  );
  const [limit, setLimit] = React.useState(initialConfig.limit);
  const [searchTerm, setSearchTerm] = React.useState(initialConfig.searchTerm);
  const [sortBy, setSortBy] = React.useState(initialConfig.sortBy);
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialConfig.sortOrder
  );
  const [chartOptionsCollapsed, setChartOptionsCollapsed] = React.useState(
    initialConfig.chartOptionsCollapsed
  );
  const [isDragging, setIsDragging] = React.useState(false);

  const tableRef = React.useRef<HTMLDivElement>(null);
  const isFirstRender = React.useRef(true);

  // Normalize data - SQL kernel uses 'rows', other formats use 'data'
  const resultData = React.useMemo(
    () => (data.rows || data.data || []) as Record<string, unknown>[],
    [data.rows, data.data]
  );
  const resultColumns = data.columns || [];
  const isSuccess = data.success !== false;

  // Detect date columns
  const dateColumns = React.useMemo(() => {
    if (!resultData.length) return [];
    const firstRow = resultData[0];
    if (!firstRow) return [];
    return resultColumns.filter((col) => {
      const sample = firstRow[col];
      if (!sample) return false;
      const dateStr = String(sample);
      return (
        /^\d{4}-\d{2}-\d{2}/.test(dateStr) ||
        /^\d{2}\/\d{2}\/\d{4}/.test(dateStr)
      );
    });
  }, [resultData, resultColumns]);

  // Filter and process data
  const filteredData = React.useMemo(() => {
    let filtered = [...resultData];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([col, value]) => {
      if (value) {
        filtered = filtered.filter((row) =>
          String(row[col]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Apply date range filter
    if (dateRange.column && (dateRange.start || dateRange.end)) {
      filtered = filtered.filter((row) => {
        const dateVal = new Date(row[dateRange.column] as string);
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;

        if (start && dateVal < start) return false;
        if (end && dateVal > end) return false;
        return true;
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
        if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

        const aNum = parseFloat(String(aVal));
        const bNum = parseFloat(String(bVal));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortOrder === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        }
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      });
    }

    return filtered.slice(0, limit);
  }, [resultData, searchTerm, filters, dateRange, sortBy, sortOrder, limit]);

  // Grouped data for charts
  const groupedData = React.useMemo(() => {
    if (!chartConfig.groupBy || !filteredData.length) return filteredData;

    const groups: Record<string, Record<string, unknown>[]> = {};
    filteredData.forEach((row) => {
      const groupKey = String(row[chartConfig.groupBy]);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
    });

    const grouped = Object.entries(groups).map(([key, rows]) => ({
      [chartConfig.groupBy]: key,
      count: rows.length,
      ...resultColumns.reduce(
        (acc, col) => {
          if (col !== chartConfig.groupBy) {
            const numValues = rows
              .map((r) => parseFloat(String(r[col])))
              .filter((v) => !isNaN(v));
            if (numValues.length > 0) {
              const sum = numValues.reduce((a, b) => a + b, 0);
              acc[`${col}_sum`] = sum;
              acc[`${col}_avg`] = sum / numValues.length;
              acc[`${col}_max`] = Math.max(...numValues);
              acc[`${col}_min`] = Math.min(...numValues);
            }
          }
          return acc;
        },
        {} as Record<string, number>
      ),
    }));

    // Apply sorting to grouped data
    if (sortBy && grouped.length > 0) {
      grouped.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
        if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

        const aNum =
          typeof aVal === 'number' ? aVal : parseFloat(String(aVal));
        const bNum =
          typeof bVal === 'number' ? bVal : parseFloat(String(bVal));

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortOrder === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        }
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      });
    }

    return grouped;
  }, [filteredData, chartConfig.groupBy, resultColumns, sortBy, sortOrder]);

  // Two-dimensional grouping for stacked bars
  const stackedGroupedData = React.useMemo(() => {
    if (!chartConfig.groupBy || !chartConfig.stackBy || !filteredData.length) {
      return null;
    }

    const groups: Record<string, Record<string, Record<string, unknown>[]>> = {};

    filteredData.forEach((row) => {
      const groupKey = String(row[chartConfig.groupBy]);
      const stackKey = String(row[chartConfig.stackBy]);

      if (!groups[groupKey]) groups[groupKey] = {};
      if (!groups[groupKey][stackKey]) groups[groupKey][stackKey] = [];
      groups[groupKey][stackKey].push(row);
    });

    return groups;
  }, [filteredData, chartConfig.groupBy, chartConfig.stackBy]);

  // Initialize chart config based on data
  React.useEffect(() => {
    const systemTheme = getSystemTheme();
    if (resultData.length > 0 && resultColumns.length > 0) {
      const { xAxis, yAxis } = detectBestAxes(resultData, resultColumns);
      setChartConfig((prev) => ({
        ...prev,
        theme: systemTheme,
        xAxis: prev.xAxis || xAxis,
        yAxis: prev.yAxis || yAxis,
      }));
    } else {
      setChartConfig((prev) => ({ ...prev, theme: systemTheme }));
    }
  }, [data]);

  // Save configuration on changes
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (onConfigChange) {
      const config: SQLResultsConfig = {
        resultsViewMode,
        chartHeight,
        tableHeight,
        chartConfig,
        filters,
        dateRange,
        limit,
        searchTerm,
        sortBy,
        sortOrder,
        chartOptionsCollapsed,
      };
      onConfigChange(config);
    }
  }, [
    resultsViewMode,
    chartHeight,
    tableHeight,
    chartConfig,
    filters,
    dateRange,
    limit,
    searchTerm,
    sortBy,
    sortOrder,
    chartOptionsCollapsed,
  ]);

  // Generate chart options
  const generateChartOption = React.useCallback((): echarts.EChartsOption => {
    const dataToUse = chartConfig.groupBy ? groupedData : filteredData;
    if (!dataToUse.length || !resultColumns.length) return {};

    const firstGroupedRow = groupedData[0];
    const availableColumns = chartConfig.groupBy && groupedData.length && firstGroupedRow
      ? Object.keys(firstGroupedRow)
      : resultColumns;

    let xAxis: string, yAxis: string;
    if (chartConfig.groupBy) {
      xAxis = chartConfig.groupBy;
      yAxis = chartConfig.yAxis || detectBestAxes(dataToUse, availableColumns).yAxis;
    } else {
      const detected =
        chartConfig.xAxis && chartConfig.yAxis
          ? { xAxis: chartConfig.xAxis, yAxis: chartConfig.yAxis }
          : detectBestAxes(dataToUse, availableColumns);
      xAxis = detected.xAxis;
      yAxis = detected.yAxis;
    }

    const actualYAxis =
      chartConfig.groupBy && yAxis !== chartConfig.groupBy
        ? yAxis === 'count'
          ? 'count'
          : `${yAxis}_${chartConfig.aggregationType}`
        : yAxis;

    const xData = dataToUse.map((row) => String(row[xAxis] || ''));
    const yData = dataToUse.map((row) => {
      const val = parseFloat(String(row[actualYAxis]));
      return isNaN(val) ? 0 : val;
    });

    // Axis styles
    const categoryAxisStyle = {
      type: 'category' as const,
      data: xData,
      axisLabel: {
        interval: 0,
        fontSize: 12,
        color: '#6b7280',
        rotate: xData.some((label) => label.length > 8) ? 45 : 0,
      },
      axisLine: {
        lineStyle: { color: '#6b7280', type: 'dotted' as const },
      },
      axisTick: {
        lineStyle: { color: '#6b7280' },
      },
    };

    const valueAxisStyle = {
      type: 'value' as const,
      axisLabel: { fontSize: 12, color: '#6b7280' },
      axisLine: {
        lineStyle: { color: '#6b7280', type: 'dotted' as const },
      },
      axisTick: {
        lineStyle: { color: '#6b7280' },
      },
      splitLine: {
        lineStyle: { color: '#6b7280', type: 'dotted' as const, opacity: 0.3 },
      },
    };

    const baseOption: echarts.EChartsOption = {
      tooltip: {
        trigger: chartConfig.type === 'pie' ? 'item' : 'axis',
        axisPointer:
          chartConfig.type !== 'pie' ? { type: 'shadow' } : undefined,
      },
      grid:
        chartConfig.type !== 'pie'
          ? {
              left: '3%',
              right: '4%',
              bottom: '3%',
              top: '10%',
              containLabel: true,
            }
          : undefined,
    };

    // Chart type specific options
    switch (chartConfig.type) {
      case 'pie':
        return {
          ...baseOption,
          series: [
            {
              name: yAxis,
              type: 'pie',
              radius: '60%',
              data: xData.map((name, idx) => ({ name, value: yData[idx] })),
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)',
                },
              },
              label: chartConfig.showDataLabels
                ? { show: true }
                : { show: false },
            },
          ],
        };

      case 'scatter':
        return {
          ...baseOption,
          xAxis: { ...valueAxisStyle, name: xAxis },
          yAxis: { ...valueAxisStyle, name: yAxis },
          series: [
            {
              type: 'scatter',
              data: dataToUse.map((row) => [
                parseFloat(String(row[xAxis])) || 0,
                parseFloat(String(row[actualYAxis])) || 0,
              ]),
              symbolSize: 8,
              itemStyle: { color: chartConfig.colors[0] },
            },
          ],
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
          series: [
            {
              type: 'heatmap',
              data: yData.map((val, idx) => [idx, 0, val]),
              label: chartConfig.showDataLabels
                ? { show: true }
                : { show: false },
            },
          ],
        };

      case 'area':
        return {
          ...baseOption,
          xAxis: { ...categoryAxisStyle },
          yAxis: { ...valueAxisStyle },
          series: [
            {
              name: yAxis,
              type: 'line',
              data: yData,
              areaStyle: {},
              smooth: true,
              itemStyle: { color: chartConfig.colors[0] },
            },
          ],
        };

      case 'stacked-bar':
        if (
          chartConfig.groupBy &&
          chartConfig.stackBy &&
          stackedGroupedData
        ) {
          const stackCategories = Array.from(
            new Set(filteredData.map((row) => String(row[chartConfig.stackBy])))
          ).sort();
          const groupCategories = Object.keys(stackedGroupedData).sort();

          const series = stackCategories.map((stackCat, idx) => {
            const seriesData = groupCategories.map((groupCat) => {
              const rows = stackedGroupedData[groupCat]?.[stackCat] || [];
              if (rows.length === 0) return 0;

              if (chartConfig.yAxis === 'count') {
                return rows.length;
              }

              const numValues = rows
                .map((r) => parseFloat(String(r[chartConfig.yAxis])))
                .filter((v) => !isNaN(v));
              if (numValues.length === 0) return 0;

              switch (chartConfig.aggregationType) {
                case 'sum':
                  return numValues.reduce((a, b) => a + b, 0);
                case 'avg':
                  return numValues.reduce((a, b) => a + b, 0) / numValues.length;
                case 'max':
                  return Math.max(...numValues);
                case 'min':
                  return Math.min(...numValues);
                case 'count':
                  return numValues.length;
                default:
                  return 0;
              }
            });

            return {
              name: stackCat,
              type: 'bar' as const,
              stack: 'total',
              data: seriesData,
              itemStyle: {
                color: chartConfig.colors[idx % chartConfig.colors.length],
              },
              label: chartConfig.showDataLabels
                ? { show: true, position: 'inside' as const }
                : undefined,
            };
          });

          if (chartConfig.horizontal) {
            return {
              ...baseOption,
              xAxis: { ...valueAxisStyle },
              yAxis: {
                type: 'category',
                data: groupCategories,
                axisLabel: { fontSize: 12, color: '#6b7280' },
                axisLine: {
                  lineStyle: { color: '#6b7280', type: 'dotted' as const },
                },
                axisTick: { lineStyle: { color: '#6b7280' } },
              },
              legend: { data: stackCategories, top: 0, type: 'scroll' },
              series,
            };
          }

          return {
            ...baseOption,
            xAxis: {
              type: 'category',
              data: groupCategories,
              axisLabel: {
                interval: 0,
                fontSize: 12,
                color: '#6b7280',
                rotate: groupCategories.some((l) => l.length > 8) ? 45 : 0,
              },
              axisLine: {
                lineStyle: { color: '#6b7280', type: 'dotted' as const },
              },
              axisTick: { lineStyle: { color: '#6b7280' } },
            },
            yAxis: { ...valueAxisStyle },
            legend: { data: stackCategories, top: 0, type: 'scroll' },
            series,
          };
        }
        // Fall through to regular bar if no stackBy
        break;

      case 'combo': {
        const actualYAxis2 =
          chartConfig.groupBy &&
          chartConfig.yAxis2 &&
          chartConfig.yAxis2 !== chartConfig.groupBy
            ? chartConfig.yAxis2 === 'count'
              ? 'count'
              : `${chartConfig.yAxis2}_${chartConfig.aggregationType}`
            : chartConfig.yAxis2 || actualYAxis;

        const yData2 = dataToUse.map((row) => {
          const val = parseFloat(String(row[actualYAxis2]));
          return isNaN(val) ? 0 : val;
        });

        return {
          ...baseOption,
          xAxis: { ...categoryAxisStyle },
          yAxis: [
            { ...valueAxisStyle, name: yAxis, position: 'left' },
            {
              ...valueAxisStyle,
              name: chartConfig.yAxis2 || yAxis,
              position: 'right',
            },
          ],
          series: [
            {
              name: yAxis,
              type: 'bar',
              data: yData,
              itemStyle: { color: chartConfig.colors[0] },
              label: chartConfig.showDataLabels ? { show: true } : undefined,
            },
            {
              name: chartConfig.yAxis2 || yAxis,
              type: 'line',
              yAxisIndex: 1,
              data: yData2,
              itemStyle: { color: chartConfig.colors[1] || chartConfig.colors[0] },
              label: chartConfig.showDataLabels ? { show: true } : undefined,
            },
          ],
          legend: {
            data: [yAxis, chartConfig.yAxis2 || yAxis],
            top: 0,
          },
        };
      }

      case 'line':
        return {
          ...baseOption,
          xAxis: { ...categoryAxisStyle },
          yAxis: { ...valueAxisStyle },
          series: [
            {
              name: yAxis,
              type: 'line',
              data: yData,
              smooth: true,
              itemStyle: { color: chartConfig.colors[0] },
            },
          ],
        };

      case 'bar':
      default:
        // Handle stacked bars with stacked option enabled
        if (
          chartConfig.stacked &&
          chartConfig.groupBy &&
          chartConfig.stackBy &&
          stackedGroupedData
        ) {
          const stackCategories = Array.from(
            new Set(filteredData.map((row) => String(row[chartConfig.stackBy])))
          ).sort();
          const groupCategories = Object.keys(stackedGroupedData).sort();

          const series = stackCategories.map((stackCat, idx) => {
            const seriesData = groupCategories.map((groupCat) => {
              const rows = stackedGroupedData[groupCat]?.[stackCat] || [];
              if (rows.length === 0) return 0;

              if (chartConfig.yAxis === 'count') {
                return rows.length;
              }

              const numValues = rows
                .map((r) => parseFloat(String(r[chartConfig.yAxis])))
                .filter((v) => !isNaN(v));
              if (numValues.length === 0) return 0;

              switch (chartConfig.aggregationType) {
                case 'sum':
                  return numValues.reduce((a, b) => a + b, 0);
                case 'avg':
                  return numValues.reduce((a, b) => a + b, 0) / numValues.length;
                case 'max':
                  return Math.max(...numValues);
                case 'min':
                  return Math.min(...numValues);
                case 'count':
                  return numValues.length;
                default:
                  return 0;
              }
            });

            return {
              name: stackCat,
              type: 'bar' as const,
              stack: 'total',
              data: seriesData,
              itemStyle: {
                color: chartConfig.colors[idx % chartConfig.colors.length],
              },
              label: chartConfig.showDataLabels
                ? { show: true, position: 'inside' as const }
                : undefined,
            };
          });

          return {
            ...baseOption,
            xAxis: {
              type: 'category',
              data: groupCategories,
              axisLabel: {
                interval: 0,
                fontSize: 12,
                color: '#6b7280',
                rotate: groupCategories.some((l) => l.length > 8) ? 45 : 0,
              },
              axisLine: {
                lineStyle: { color: '#6b7280', type: 'dotted' as const },
              },
              axisTick: { lineStyle: { color: '#6b7280' } },
            },
            yAxis: { ...valueAxisStyle },
            legend: { data: stackCategories, top: 0, type: 'scroll' },
            series,
          };
        }

        // Horizontal bar chart
        if (chartConfig.horizontal) {
          return {
            ...baseOption,
            xAxis: { ...valueAxisStyle },
            yAxis: {
              type: 'category',
              data: xData,
              axisLabel: { fontSize: 12, color: '#6b7280' },
              axisLine: {
                lineStyle: { color: '#6b7280', type: 'dotted' as const },
              },
              axisTick: { lineStyle: { color: '#6b7280' } },
            },
            series: [
              {
                name: yAxis,
                type: 'bar',
                data: yData,
                itemStyle: { color: chartConfig.colors[0] },
                label: chartConfig.showDataLabels
                  ? { show: true, position: 'right' as const }
                  : undefined,
              },
            ],
          };
        }

        // Default vertical bar chart
        return {
          ...baseOption,
          xAxis: { ...categoryAxisStyle },
          yAxis: { ...valueAxisStyle },
          series: [
            {
              name: yAxis,
              type: 'bar',
              data: yData,
              itemStyle: { color: chartConfig.colors[0] },
              barWidth: '60%',
              label: chartConfig.showDataLabels
                ? { show: true, position: 'top' as const }
                : undefined,
            },
          ],
        };
    }

    // Fallback for stacked-bar without proper config
    return {
      ...baseOption,
      xAxis: { ...categoryAxisStyle },
      yAxis: { ...valueAxisStyle },
      series: [
        {
          name: yAxis,
          type: 'bar',
          data: yData,
          itemStyle: { color: chartConfig.colors[0] },
          barWidth: '60%',
        },
      ],
    };
  }, [
    chartConfig,
    groupedData,
    filteredData,
    resultColumns,
    stackedGroupedData,
  ]);

  // Resize handlers
  const handleChartResize = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = chartHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(200, Math.min(1000, startHeight + deltaY));
        setChartHeight(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [chartHeight]
  );

  const handleTableResize = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startY = e.clientY;
      const startHeight = tableHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(200, Math.min(800, startHeight + deltaY));
        setTableHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [tableHeight]
  );

  // Get bridge for MCP Apps context (safe - returns null if not in provider)
  let bridge: ReturnType<typeof useMcpBridge>['bridge'] | null = null;
  try {
    const bridgeContext = useMcpBridge();
    bridge = bridgeContext.bridge;
  } catch {
    // Not inside McpBridgeProvider - that's fine for web context
  }

  // Build URL for "Open in Teradata" with SQL context
  const buildTeradataUrl = React.useCallback(() => {
    const baseUrl = teradataBaseUrl || 'http://localhost:8080';
    const basePath = projectId
      ? `${baseUrl}/project/${projectId}`
      : `${baseUrl}/project/new`;

    // Add SQL as query param if available (limit to ~1500 chars for URL safety)
    if (sql) {
      const encodedSql = encodeURIComponent(sql.slice(0, 1500));
      return `${basePath}?sql=${encodedSql}`;
    }
    return basePath;
  }, [teradataBaseUrl, projectId, sql]);

  // Actions - use bridge.openLink when available (MCP Apps context)
  const actions = React.useMemo(() => {
    if (customActions) return customActions;

    const baseActions = createDefaultActions({ projectId, teradataBaseUrl });

    // Override the open-in-teradata action to include SQL
    return baseActions.map((action) => {
      if (action.id === 'open-in-teradata') {
        return {
          ...action,
          onClick: async () => {
            const url = buildTeradataUrl();

            // Use bridge.openLink in MCP Apps context
            if (context === 'mcp-apps' && bridge?.openLink) {
              const result = await bridge.openLink(url);
              if (!result.success) {
                // Fallback: copy URL to clipboard
                try {
                  await navigator.clipboard.writeText(url);
                  alert(`Link copied to clipboard: ${url}`);
                } catch {
                  alert(`Open this URL: ${url}`);
                }
              }
            } else {
              // Web context: use window.open
              window.open(url, '_blank');
            }
          },
        };
      }
      return action;
    });
  }, [customActions, projectId, teradataBaseUrl, context, bridge, buildTeradataUrl]);

  // Error display
  if (!isSuccess && data.error) {
    return (
      <div
        className={cn(
          'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3',
          className
        )}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-400">
            <strong>SQL Error:</strong> {data.error}
          </div>
        </div>
      </div>
    );
  }

  // No results
  if (isSuccess && resultData.length === 0) {
    return (
      <div
        className={cn(
          'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3',
          className
        )}
      >
        <div className="text-sm text-green-700 dark:text-green-400">
          Query executed successfully but returned no results.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.row_count || resultData.length || 0} rows
          </Badge>
          {filteredData.length !== resultData.length && (
            <Badge variant="secondary" className="text-xs">
              Filtered: {filteredData.length} rows
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 w-32 text-xs"
            aria-label="Search results"
          />

          {/* Limit */}
          <div className="flex items-center gap-1">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-7 px-2 text-xs border border-border rounded bg-background"
              title="Display limit (client-side filtering)"
              aria-label="Rows limit"
            >
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
              <option value={500}>Show 500</option>
              <option value={1000}>Show 1000</option>
              <option value={resultData.length}>
                Show All ({resultData.length})
              </option>
            </select>
            {resultData.length > limit && (
              <span
                className="text-xs text-amber-600 dark:text-amber-400"
                title={`Displaying ${limit} of ${resultData.length} rows`}
              >
                *
              </span>
            )}
          </div>

          {/* Actions */}
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                size="sm"
                variant={action.variant || 'outline'}
                onClick={() =>
                  action.onClick({ columns: resultColumns, data: resultData })
                }
                disabled={action.disabled}
                className="h-7 px-2 text-xs"
                title={action.tooltip}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {action.id === 'open-in-teradata' && (
                  <span className="ml-1">{action.label}</span>
                )}
              </Button>
            );
          })}

          <ViewModeToggle
            options={[
              { id: 'table', label: 'Table', icon: TableIcon, title: 'Table view' },
              { id: 'chart', label: 'Chart', icon: BarChart3, title: 'Chart view' },
            ]}
            activeMode={resultsViewMode}
            onModeChange={(newMode) =>
              setResultsViewMode(newMode as 'table' | 'chart')
            }
          />
        </div>
      </div>

      {/* Date Range Filter */}
      {dateColumns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/30 rounded">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select
            value={dateRange.column}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, column: e.target.value }))
            }
            className="h-7 px-2 text-xs border border-border rounded bg-background"
            aria-label="Date column"
          >
            <option value="">Select date column...</option>
            {dateColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          {dateRange.column && (
            <>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="h-7 w-32 text-xs"
                aria-label="Start date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="h-7 w-32 text-xs"
                aria-label="End date"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDateRange({ start: '', end: '', column: '' })
                }
                className="h-7 px-2"
                aria-label="Clear date filter"
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Table View */}
      {resultsViewMode === 'table' &&
        resultColumns.length > 0 &&
        filteredData.length > 0 && (
          <div className="relative" ref={tableRef}>
            <div className="border border-border rounded-lg overflow-hidden">
              <div
                className="overflow-auto scrollbar-thin"
                style={{ maxHeight: `${tableHeight}px` }}
              >
                <table className="w-full text-xs" role="grid">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      {resultColumns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-1.5 text-left font-medium text-muted-foreground border-b border-border bg-muted"
                        >
                          <div className="flex items-center gap-1">
                            <span>{col}</span>
                            <Filter
                              className="w-3 h-3 cursor-pointer opacity-50 hover:opacity-100"
                              onClick={() => {
                                const value = prompt(`Filter ${col}:`);
                                if (value !== null) {
                                  setFilters((prev) => ({
                                    ...prev,
                                    [col]: value,
                                  }));
                                }
                              }}
                              aria-label={`Filter ${col}`}
                            />
                            {filters[col] && (
                              <X
                                className="w-3 h-3 cursor-pointer text-red-500"
                                onClick={() =>
                                  setFilters((prev) => {
                                    const newFilters = { ...prev };
                                    delete newFilters[col];
                                    return newFilters;
                                  })
                                }
                                aria-label={`Clear ${col} filter`}
                              />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30"
                      >
                        {resultColumns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 text-foreground leading-tight max-w-xs truncate"
                            title={String(row[col] || '')}
                          >
                            {row[col] != null ? (
                              String(row[col])
                            ) : (
                              <span className="text-muted-foreground italic">
                                null
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredData.length >= limit && (
                <div className="p-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                  Showing {limit} of {resultData.length} rows (limited)
                </div>
              )}
            </div>

            {/* Resize Handle */}
            <div
              className={cn(
                'flex items-center justify-center h-4 cursor-row-resize hover:bg-muted border-t border-border',
                isDragging ? 'bg-muted' : 'bg-background'
              )}
              onMouseDown={handleTableResize}
              role="separator"
              aria-label="Resize table"
            >
              <GripHorizontal className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}

      {/* Chart View */}
      {resultsViewMode === 'chart' &&
        resultColumns.length > 0 &&
        filteredData.length > 0 && (
          <div className="relative flex gap-4">
            {/* Chart Options Panel */}
            <div
              className={cn(
                'transition-all duration-300 z-10',
                chartOptionsCollapsed
                  ? 'absolute left-0 top-0 bottom-0'
                  : 'w-64 flex-shrink-0'
              )}
            >
              {chartOptionsCollapsed ? (
                <button
                  onClick={() => setChartOptionsCollapsed(false)}
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title="Expand chart options"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </button>
              ) : (
                <Card className="h-full">
                  <CardContent className="p-3 space-y-3 h-full overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Chart Options
                      </h3>
                      <button
                        onClick={() => setChartOptionsCollapsed(true)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Collapse options"
                      >
                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Chart Type */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Chart Type
                      </label>
                      <select
                        value={chartConfig.type}
                        onChange={(e) => {
                          const newType = e.target.value as ChartConfig['type'];
                          setChartConfig((prev) => ({
                            ...prev,
                            type: newType,
                            yAxis2: newType === 'combo' ? prev.yAxis2 : '',
                          }));
                        }}
                        className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="area">Area Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="scatter">Scatter Plot</option>
                        <option value="stacked-bar">Stacked Bar</option>
                        <option value="combo">Combo (Bar + Line)</option>
                        <option value="heatmap">Heatmap</option>
                      </select>
                    </div>

                    {chartConfig.type !== 'pie' && (
                      <>
                        {/* Group By Section */}
                        <div className="space-y-2 p-2 bg-muted/30 rounded border border-border">
                          <div>
                            <label className="text-xs font-medium text-foreground mb-1 block">
                              Group By (Optional)
                            </label>
                            <select
                              value={chartConfig.groupBy}
                              onChange={(e) =>
                                setChartConfig((prev) => ({
                                  ...prev,
                                  groupBy: e.target.value,
                                }))
                              }
                              className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                            >
                              <option value="">No grouping - Show raw data</option>
                              {resultColumns.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          {chartConfig.groupBy && (
                            <>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                  Aggregation
                                </label>
                                <select
                                  value={chartConfig.aggregationType}
                                  onChange={(e) =>
                                    setChartConfig((prev) => ({
                                      ...prev,
                                      aggregationType: e.target
                                        .value as ChartConfig['aggregationType'],
                                    }))
                                  }
                                  className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                                >
                                  <option value="sum">Sum - Total values</option>
                                  <option value="avg">Average - Mean values</option>
                                  <option value="count">Count - Number of items</option>
                                  <option value="max">Max - Highest value</option>
                                  <option value="min">Min - Lowest value</option>
                                </select>
                              </div>

                              {(chartConfig.type === 'stacked-bar' ||
                                (chartConfig.type === 'bar' &&
                                  chartConfig.stacked)) && (
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">
                                    Stack By (Optional)
                                  </label>
                                  <select
                                    value={chartConfig.stackBy}
                                    onChange={(e) =>
                                      setChartConfig((prev) => ({
                                        ...prev,
                                        stackBy: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                                  >
                                    <option value="">No stacking</option>
                                    {resultColumns
                                      .filter((col) => col !== chartConfig.groupBy)
                                      .map((col) => (
                                        <option key={col} value={col}>
                                          {col}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Sort By Section */}
                        <div className="space-y-2 p-2 bg-muted/30 rounded border border-border">
                          <div>
                            <label className="text-xs font-medium text-foreground mb-1 block">
                              Sort By (Optional)
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                              className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                            >
                              <option value="">No sorting</option>
                              {(chartConfig.groupBy
                                ? Object.keys(groupedData[0] || {})
                                : resultColumns
                              ).map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          {sortBy && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground">
                                Order:
                              </label>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setSortOrder('asc')}
                                  className={cn(
                                    'px-2 py-1 text-xs rounded border transition-colors',
                                    sortOrder === 'asc'
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background border-border hover:bg-muted'
                                  )}
                                >
                                  Asc
                                </button>
                                <button
                                  onClick={() => setSortOrder('desc')}
                                  className={cn(
                                    'px-2 py-1 text-xs rounded border transition-colors',
                                    sortOrder === 'desc'
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-background border-border hover:bg-muted'
                                  )}
                                >
                                  Desc
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* X Axis (only when not grouping) */}
                        {!chartConfig.groupBy && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              X Axis
                            </label>
                            <select
                              value={chartConfig.xAxis}
                              onChange={(e) =>
                                setChartConfig((prev) => ({
                                  ...prev,
                                  xAxis: e.target.value,
                                }))
                              }
                              className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                            >
                              {resultColumns.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Y Axis */}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Y Axis
                          </label>
                          <select
                            value={chartConfig.yAxis}
                            onChange={(e) =>
                              setChartConfig((prev) => ({
                                ...prev,
                                yAxis: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                          >
                            {chartConfig.groupBy && (
                              <option value="count">Record Count</option>
                            )}
                            {resultColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Y Axis 2 for Combo */}
                        {chartConfig.type === 'combo' && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Y Axis 2 (Line)
                            </label>
                            <select
                              value={chartConfig.yAxis2}
                              onChange={(e) =>
                                setChartConfig((prev) => ({
                                  ...prev,
                                  yAxis2: e.target.value,
                                }))
                              }
                              className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                            >
                              <option value="">Same as Y Axis</option>
                              {chartConfig.groupBy && (
                                <option value="count">Record Count</option>
                              )}
                              {resultColumns.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* Pie chart specific */}
                    {chartConfig.type === 'pie' && (
                      <>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Label Column
                          </label>
                          <select
                            value={chartConfig.xAxis}
                            onChange={(e) =>
                              setChartConfig((prev) => ({
                                ...prev,
                                xAxis: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                          >
                            {resultColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            Value Column
                          </label>
                          <select
                            value={chartConfig.yAxis}
                            onChange={(e) =>
                              setChartConfig((prev) => ({
                                ...prev,
                                yAxis: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                          >
                            {resultColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Show Data Labels */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={chartConfig.showDataLabels}
                        onChange={(e) =>
                          setChartConfig((prev) => ({
                            ...prev,
                            showDataLabels: e.target.checked,
                          }))
                        }
                        className="w-3 h-3"
                        id="show-labels"
                      />
                      <label
                        htmlFor="show-labels"
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        Show data labels
                      </label>
                    </div>

                    {/* Horizontal bars */}
                    {(chartConfig.type === 'bar' ||
                      chartConfig.type === 'stacked-bar') && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={chartConfig.horizontal}
                          onChange={(e) =>
                            setChartConfig((prev) => ({
                              ...prev,
                              horizontal: e.target.checked,
                            }))
                          }
                          className="w-3 h-3"
                          id="horizontal-bars"
                        />
                        <label
                          htmlFor="horizontal-bars"
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Horizontal bars
                        </label>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Chart */}
            <div className="flex-1 flex flex-col">
              <Card className="flex-1 flex flex-col">
                <CardContent className="p-3 flex-1 flex flex-col">
                  <div
                    style={{ height: `${chartHeight}px` }}
                    className="w-full"
                  >
                    <ECharts
                      option={generateChartOption()}
                      style={{ height: '100%', width: '100%' }}
                      theme={chartConfig.theme}
                    />
                  </div>
                  {/* Resize Handle */}
                  <div
                    className="w-full h-2 cursor-ns-resize hover:bg-primary/20 border-t border-border mt-2 flex items-center justify-center group"
                    onMouseDown={handleChartResize}
                    role="separator"
                    aria-label="Resize chart"
                  >
                    <div className="w-12 h-1 bg-muted-foreground/30 rounded group-hover:bg-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  );
}
