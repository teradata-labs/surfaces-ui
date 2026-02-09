/**
 * SQLVisualization - Chart visualization for SQL results.
 */

import * as React from 'react';
import { BarChart3, LineChart, PieChart, ScatterChart } from 'lucide-react';
import { Card, CardContent } from '../../primitives/card';
import { Label } from '../../primitives/label';
import { cn } from '../../lib/utils';
import type { SQLVisualizationProps, ChartConfig } from './types';

const CHART_TYPES: { id: ChartConfig['type']; label: string; icon: React.ElementType }[] = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'pie', label: 'Pie', icon: PieChart },
  { id: 'scatter', label: 'Scatter', icon: ScatterChart },
];

const AGGREGATION_TYPES = [
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'max', label: 'Max' },
  { id: 'min', label: 'Min' },
] as const;

export function SQLVisualization({
  columns,
  data,
  config,
  onConfigChange,
  height = 300,
}: SQLVisualizationProps) {
  const numericColumns = React.useMemo(
    () => columns.filter((col) => {
      const sample = data[0]?.[col];
      return typeof sample === 'number' || !isNaN(parseFloat(String(sample)));
    }),
    [columns, data]
  );

  const chartData = React.useMemo(() => {
    if (!config.xAxis || !config.yAxis || !data.length) return [];
    const groups: Record<string, number[]> = {};
    data.forEach((row) => {
      const key = String(row[config.xAxis] ?? 'Unknown');
      const val = parseFloat(String(row[config.yAxis]));
      if (!isNaN(val)) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(val);
      }
    });
    return Object.entries(groups).map(([label, values]) => {
      let value: number;
      switch (config.aggregation) {
        case 'sum': value = values.reduce((a, b) => a + b, 0); break;
        case 'avg': value = values.reduce((a, b) => a + b, 0) / values.length; break;
        case 'count': value = values.length; break;
        case 'max': value = Math.max(...values); break;
        case 'min': value = Math.min(...values); break;
        default: value = values.reduce((a, b) => a + b, 0);
      }
      return { label, value };
    });
  }, [data, config]);

  if (columns.length === 0 || data.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data available for visualization</div>;
  }

  return (
    <div className="flex gap-4">
      <Card className="w-56 flex-shrink-0">
        <CardContent className="p-3 space-y-4">
          <div>
            <Label className="text-xs font-medium">Chart Type</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {CHART_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => onConfigChange({ ...config, type: id })}
                  className={cn(
                    'p-2 rounded border transition-colors',
                    config.type === id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                  )}
                  aria-label={`${label} chart`}
                  aria-pressed={config.type === id}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="x-axis-select" className="text-xs font-medium">X Axis</Label>
            <select
              id="x-axis-select"
              value={config.xAxis}
              onChange={(e) => onConfigChange({ ...config, xAxis: e.target.value })}
              className="w-full mt-1 h-8 px-2 text-xs border border-border rounded bg-background"
            >
              <option value="">Select column...</option>
              {columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="y-axis-select" className="text-xs font-medium">Y Axis</Label>
            <select
              id="y-axis-select"
              value={config.yAxis}
              onChange={(e) => onConfigChange({ ...config, yAxis: e.target.value })}
              className="w-full mt-1 h-8 px-2 text-xs border border-border rounded bg-background"
            >
              <option value="">Select column...</option>
              {numericColumns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="aggregation-select" className="text-xs font-medium">Aggregation</Label>
            <select
              id="aggregation-select"
              value={config.aggregation ?? 'sum'}
              onChange={(e) => onConfigChange({ ...config, aggregation: e.target.value as ChartConfig['aggregation'] })}
              className="w-full mt-1 h-8 px-2 text-xs border border-border rounded bg-background"
            >
              {AGGREGATION_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardContent className="p-4">
          <div
            style={{ height }}
            className="flex items-center justify-center bg-muted/20 rounded-lg"
            role="img"
            aria-label={`${config.type} chart showing ${config.yAxis} by ${config.xAxis}`}
          >
            {chartData.length > 0 ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Chart Preview ({config.type})</p>
                <div className="flex gap-2 justify-center flex-wrap max-w-md">
                  {chartData.slice(0, 10).map((d, i) => (
                    <div key={i} className="text-xs bg-primary/20 px-2 py-1 rounded">
                      {d.label}: {d.value.toFixed(2)}
                    </div>
                  ))}
                  {chartData.length > 10 && <div className="text-xs text-muted-foreground">+{chartData.length - 10} more</div>}
                </div>
                <p className="text-xs text-muted-foreground mt-4">Install echarts for full visualization support</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select X and Y axes to visualize data</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
