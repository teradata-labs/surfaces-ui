/**
 * ChartWithControls Molecule
 *
 * Composes Chart with axis selection and chart type controls.
 * Molecule-level component (50-150 lines) in atomic design hierarchy.
 */
import * as React from 'react';
import { Settings, ChevronLeft } from 'lucide-react';
import { Chart, detectBestAxes } from '../../primitives/chart';
import type { ChartType } from '../../primitives/chart/types';
import { Card, CardContent } from '../../primitives/card';
import { Button } from '../../primitives/button';
import { cn } from '../../lib/utils';
import type { ChartWithControlsProps, ChartControlsState } from './types';
import { CHART_TYPE_OPTIONS } from './types';

export function ChartWithControls({
  data,
  columns: columnsProp,
  height = 400,
  initialChartType = 'bar',
  initialXAxis,
  initialYAxis,
  showControls = true,
  controlsCollapsed: initialCollapsed = false,
  onConfigChange,
  className,
}: ChartWithControlsProps) {
  const [controlsCollapsed, setControlsCollapsed] = React.useState(initialCollapsed);

  // Derive columns from data if not provided
  const columns = React.useMemo(() => {
    if (columnsProp?.length) return columnsProp;
    if (!data.length) return [];
    return Object.keys(data[0] || {});
  }, [columnsProp, data]);

  // Auto-detect initial axes
  const detectedAxes = React.useMemo(() => {
    return detectBestAxes(data, columns);
  }, [data, columns]);

  const [chartType, setChartType] = React.useState<ChartType>(initialChartType);
  const [xAxis, setXAxis] = React.useState(initialXAxis || detectedAxes.xAxis);
  const [yAxis, setYAxis] = React.useState(initialYAxis || detectedAxes.yAxis);
  const [showDataLabels, setShowDataLabels] = React.useState(false);

  // Notify parent of config changes
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onConfigChange?.({ chartType, xAxis, yAxis, showDataLabels });
  }, [chartType, xAxis, yAxis, showDataLabels, onConfigChange]);

  if (!data.length) {
    return (
      <div
        className={cn('flex items-center justify-center text-muted-foreground', className)}
        style={{ height: `${height}px` }}
      >
        No data to visualize
      </div>
    );
  }

  return (
    <div className={cn('flex gap-4', className)}>
      {/* Controls Panel */}
      {showControls && (
        <div
          className={cn(
            'transition-all duration-300',
            controlsCollapsed ? 'w-10' : 'w-56 flex-shrink-0'
          )}
        >
          {controlsCollapsed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setControlsCollapsed(false)}
              title="Expand chart options"
            >
              <Settings className="h-5 w-5" />
            </Button>
          ) : (
            <Card className="h-full">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                  <h3 className="text-sm font-semibold">Chart Options</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setControlsCollapsed(true)}
                    title="Collapse"
                    className="h-6 w-6 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>

                {/* Chart Type */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Chart Type</label>
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as ChartType)}
                    className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                  >
                    {CHART_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* X Axis */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">X Axis</label>
                  <select
                    value={xAxis}
                    onChange={(e) => setXAxis(e.target.value)}
                    className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                  >
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Y Axis */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Y Axis</label>
                  <select
                    value={yAxis}
                    onChange={(e) => setYAxis(e.target.value)}
                    className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                  >
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Data Labels */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-labels"
                    checked={showDataLabels}
                    onChange={(e) => setShowDataLabels(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label htmlFor="show-labels" className="text-xs text-muted-foreground cursor-pointer">
                    Show data labels
                  </label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1">
        <Chart
          data={data}
          xAxis={xAxis}
          yAxis={yAxis}
          type={chartType}
          height={height}
          showDataLabels={showDataLabels}
        />
      </div>
    </div>
  );
}

export default ChartWithControls;
