/**
 * SQLResultsDisplay - Rich SQL results display with table/chart views
 *
 * REFACTORED: Composes TableWithFilters and ChartWithControls molecules.
 * Reduced from 1772 lines to ~350 lines following atomic design principles.
 *
 * Features:
 * - Table view with sorting, filtering, search via TableWithFilters molecule
 * - Chart view with controls via ChartWithControls molecule
 * - View mode toggle between table and chart
 * - Configurable actions via props
 * - MCP Bridge integration for "Open in Teradata"
 */

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Table as TableIcon, BarChart3 } from 'lucide-react';

import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { ViewModeToggle } from '../../primitives/view-mode-toggle';
import { TableWithFilters } from '../../molecules/table-with-filters';
import { ChartWithControls } from '../../molecules/chart-with-controls';
import { cn } from '../../lib/utils';
import { useMcpBridge } from '../../bridge/McpBridgeProvider';

import type {
  SQLResultsDisplayProps,
  SQLResultsConfig,
} from './types';
import { DEFAULT_RESULTS_CONFIG } from './types';
import { createDefaultActions, buildTeradataUrl } from './utils';

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
      ...DEFAULT_RESULTS_CONFIG.chartConfig,
      ...savedConfig?.chartConfig,
    },
  };

  // State
  const [resultsViewMode, setResultsViewMode] = React.useState<'table' | 'chart'>(
    initialConfig.resultsViewMode
  );
  const [chartHeight, _setChartHeight] = React.useState(initialConfig.chartHeight);
  const [tableHeight, _setTableHeight] = React.useState(initialConfig.tableHeight);

  const isFirstRender = React.useRef(true);

  // Normalize data - SQL kernel uses 'rows', other formats use 'data'
  const resultData = React.useMemo(
    () => (data.rows || data.data || []) as Record<string, unknown>[],
    [data.rows, data.data]
  );
  const resultColumns = data.columns || [];
  const isSuccess = data.success !== false;

  // Save configuration on changes
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (onConfigChange) {
      const config: SQLResultsConfig = {
        ...DEFAULT_RESULTS_CONFIG,
        resultsViewMode,
        chartHeight,
        tableHeight,
      };
      onConfigChange(config);
    }
  }, [resultsViewMode, chartHeight, tableHeight, onConfigChange]);

  // Get bridge for MCP Apps context
  let bridge: ReturnType<typeof useMcpBridge>['bridge'] | null = null;
  try {
    const bridgeContext = useMcpBridge();
    bridge = bridgeContext.bridge;
  } catch {
    // Not inside McpBridgeProvider - that's fine for web context
  }

  // Build "Open in Teradata" URL
  const teradataUrl = React.useMemo(
    () => buildTeradataUrl(sql, projectId, teradataBaseUrl),
    [sql, projectId, teradataBaseUrl]
  );

  // Actions with MCP Bridge support
  const actions = React.useMemo(() => {
    if (customActions) return customActions;

    const baseActions = createDefaultActions({ projectId, teradataBaseUrl });

    // Override open-in-teradata to include SQL and use bridge
    return baseActions.map((action) => {
      if (action.id === 'open-in-teradata') {
        return {
          ...action,
          onClick: async () => {
            if (context === 'mcp-apps' && bridge?.openLink) {
              const result = await bridge.openLink(teradataUrl);
              if (!result.success) {
                try {
                  await navigator.clipboard.writeText(teradataUrl);
                  alert(`Link copied to clipboard: ${teradataUrl}`);
                } catch {
                  alert(`Open this URL: ${teradataUrl}`);
                }
              }
            } else {
              window.open(teradataUrl, '_blank');
            }
          },
        };
      }
      return action;
    });
  }, [customActions, projectId, teradataBaseUrl, context, bridge, teradataUrl]);

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
      {/* Controls Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.row_count || resultData.length || 0} rows
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Buttons */}
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

          {/* View Mode Toggle */}
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

      {/* Table View - Using TableWithFilters molecule */}
      {resultsViewMode === 'table' && resultColumns.length > 0 && resultData.length > 0 && (
        <TableWithFilters
          data={resultData}
          columns={resultColumns}
          height={tableHeight}
          showFilter={true}
          showDensityToggle={true}
          virtualScrolling={resultData.length > 100}
        />
      )}

      {/* Chart View - Using ChartWithControls molecule */}
      {resultsViewMode === 'chart' && resultColumns.length > 0 && resultData.length > 0 && (
        <ChartWithControls
          data={resultData}
          columns={resultColumns}
          height={chartHeight}
          showControls={true}
        />
      )}
    </div>
  );
}

// Re-export utility for backward compatibility
export { createDefaultActions } from './utils';
