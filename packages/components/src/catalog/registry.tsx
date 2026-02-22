/**
 * json-render Component Registry
 *
 * Maps catalog definitions to React component implementations.
 * Updated with real component implementations from primitives.
 */
import * as React from 'react';
import { defineRegistry, type ComponentContext, useStateValue } from '@json-render/react';
import { Table as TableIcon, BarChart3 as BarChartIcon } from 'lucide-react';

import { catalog } from './schema';
import type {
  DataRow,
  ChartProps,
  DataTableProps,
  FilterProps,
  DensityToggleProps,
  ViewModeToggleProps,
  TableWithFiltersProps,
  ChartWithControlsProps,
  SQLResultsDisplayProps,
} from './types';

// Import real component implementations
import { Chart } from '../primitives/chart';
import { DataTable } from '../primitives/data-table';
import { Filter } from '../primitives/filter';
import { DensityToggle } from '../primitives/density-toggle';
import { ViewModeToggle } from '../primitives/view-mode-toggle';
import { TableWithFilters } from '../molecules/table-with-filters';
import { ChartWithControls } from '../molecules/chart-with-controls';
import { SQLResultsDisplay } from '../components/sql-results';

// Wrapper components that adapt ComponentContext to component props
// These receive a ComponentContext and extract props.value for the actual components

function CatalogChart(ctx: ComponentContext<typeof catalog, 'Chart'>) {
  const props = ctx.props as ChartProps;
  const data = useStateValue<DataRow[]>('/data') || [];
  const { type, xAxis, yAxis, theme, height, showDataLabels } = props;

  // Chart requires xAxis and yAxis - use first two columns as defaults
  const columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
  const finalXAxis = xAxis || columns[0] || '';
  const finalYAxis = yAxis || columns[1] || '';

  return (
    <Chart
      data={data}
      type={type as ChartProps['type']}
      xAxis={finalXAxis}
      yAxis={finalYAxis}
      theme={theme || undefined}
      height={height}
      showDataLabels={showDataLabels}
    />
  );
}

function CatalogDataTable(ctx: ComponentContext<typeof catalog, 'DataTable'>) {
  const props = ctx.props as DataTableProps;
  const data = useStateValue<DataRow[]>('/data') || [];
  const { columns, height, density, virtualScrolling } = props;

  // Memoize columns to prevent breaking DataTable's internal memoization
  const memoizedColumns = React.useMemo(
    () => columns || undefined,
    [columns]
  );

  return (
    <DataTable
      data={data}
      columns={memoizedColumns}
      height={height}
      density={density}
      virtualScrolling={virtualScrolling}
    />
  );
}

function CatalogFilter(ctx: ComponentContext<typeof catalog, 'Filter'>) {
  const props = ctx.props as FilterProps;
  const { placeholder, ariaLabel } = props;
  // Filter needs value and onChange which come from parent context
  // This is a simplified version for catalog rendering
  const [value, setValue] = React.useState('');

  return (
    <Filter
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
    />
  );
}

function CatalogDensityToggle(ctx: ComponentContext<typeof catalog, 'DensityToggle'>) {
  const props = ctx.props as DensityToggleProps;
  const { value: initialValue } = props;
  const [density, setDensity] = React.useState(initialValue || 'comfortable');

  return (
    <DensityToggle
      value={density}
      onChange={setDensity}
    />
  );
}

function CatalogViewModeToggle(ctx: ComponentContext<typeof catalog, 'ViewModeToggle'>) {
  const props = ctx.props as ViewModeToggleProps;
  const { modes = ['table', 'chart'], activeMode: initialMode = 'table' } = props;
  const [activeMode, setActiveMode] = React.useState(initialMode);

  const options = modes.map((mode: 'table' | 'chart') => ({
    id: mode,
    label: mode.charAt(0).toUpperCase() + mode.slice(1),
    icon: mode === 'table' ? TableIcon : BarChartIcon,
  }));

  return (
    <ViewModeToggle
      options={options}
      activeMode={activeMode}
      onModeChange={(mode) => setActiveMode(mode as 'table' | 'chart')}
    />
  );
}

// Molecule wrapper components - inject data from context
function CatalogTableWithFilters(ctx: ComponentContext<typeof catalog, 'TableWithFilters'>) {
  const props = ctx.props as TableWithFiltersProps;
  const {
    columns,
    height,
    initialDensity,
    showFilter,
    showDensityToggle,
    virtualScrolling,
  } = props;

  // Data comes from json-render state provider via useStateValue hook
  const data = useStateValue<DataRow[]>('/data') || [];

  // Memoize columns to prevent breaking DataTable's internal memoization
  const memoizedColumns = React.useMemo(
    () => columns || undefined,
    [columns]
  );

  return (
    <TableWithFilters
      data={data}
      columns={memoizedColumns}
      height={height}
      initialDensity={initialDensity}
      showFilter={showFilter}
      showDensityToggle={showDensityToggle}
      virtualScrolling={virtualScrolling}
    />
  );
}

function CatalogChartWithControls(ctx: ComponentContext<typeof catalog, 'ChartWithControls'>) {
  const props = ctx.props as ChartWithControlsProps;
  const {
    columns,
    height,
    initialChartType,
    initialXAxis,
    initialYAxis,
    showControls,
    controlsCollapsed,
  } = props;

  // Data comes from json-render state provider via useStateValue hook
  const data = useStateValue<DataRow[]>('/data') || [];

  return (
    <ChartWithControls
      data={data}
      columns={columns}
      height={height}
      initialChartType={initialChartType}
      initialXAxis={initialXAxis}
      initialYAxis={initialYAxis}
      showControls={showControls}
      controlsCollapsed={controlsCollapsed}
    />
  );
}

// Organism wrapper component - complete feature-rich component
function CatalogSQLResultsDisplay(ctx: ComponentContext<typeof catalog, 'SQLResultsDisplay'>) {
  const props = ctx.props as SQLResultsDisplayProps;
  const {
    sql,
    context: execContext,
    projectId,
    teradataBaseUrl,
    initialViewMode,
    tableHeight,
    chartHeight,
  } = props;

  // Data comes from json-render state provider via useStateValue hook
  const rawData = useStateValue<unknown>('/data');

  // SQLResultsDisplay expects data in specific format
  // Support both {rows, columns} and {data, columns} formats
  const data = React.useMemo(() => {
    if (!rawData) return { rows: [], columns: [] };
    if (Array.isArray(rawData)) {
      // If just an array, derive columns from first row
      const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];
      return { rows: rawData, columns };
    }
    // Already in correct format
    return rawData;
  }, [rawData]);

  // Build savedConfig from AI-specifiable schema props
  const savedConfig = React.useMemo(() => ({
    resultsViewMode: initialViewMode || 'table',
    tableHeight: tableHeight || 400,
    chartHeight: chartHeight || 400,
  }), [initialViewMode, tableHeight, chartHeight]);

  return (
    <SQLResultsDisplay
      data={data}
      sql={sql}
      savedConfig={savedConfig}
      context={execContext}
      projectId={projectId}
      teradataBaseUrl={teradataBaseUrl}
    />
  );
}

export const { registry } = defineRegistry(catalog, {
  components: {
    // Primitives
    Chart: CatalogChart,
    DataTable: CatalogDataTable,
    Filter: CatalogFilter,
    DensityToggle: CatalogDensityToggle,
    ViewModeToggle: CatalogViewModeToggle,
    // Molecules
    TableWithFilters: CatalogTableWithFilters,
    ChartWithControls: CatalogChartWithControls,
    // Organisms
    SQLResultsDisplay: CatalogSQLResultsDisplay,
  },
  // No-op action stubs — real implementations are provided at runtime
  // via ActionProvider + createMcpActionHandlers(bridge)
  actions: {
    execute_sql: async () => {},
    export_csv: async () => {},
    copy_json: async () => {},
  },
});
