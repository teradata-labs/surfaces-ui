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
import type { Catalog } from '@json-render/core';

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

function CatalogChart(ctx: ComponentContext<any, 'Chart'>) {
  const { type, xAxis, yAxis, theme, height, showDataLabels } = ctx.props as any;
  const data = useStateValue<Record<string, unknown>[]>('/data') || [];

  return (
    <Chart
      data={data}
      type={type as any}
      xAxis={xAxis}
      yAxis={yAxis}
      theme={theme || undefined}
      height={height}
      showDataLabels={showDataLabels}
    />
  );
}

function CatalogDataTable(ctx: ComponentContext<any, 'DataTable'>) {
  const { columns, height, density, virtualScrolling } = ctx.props as any;
  const data = useStateValue<Record<string, unknown>[]>('/data') || [];

  return (
    <DataTable
      data={data}
      columns={columns}
      height={height}
      density={density}
      virtualScrolling={virtualScrolling}
    />
  );
}

function CatalogFilter(ctx: ComponentContext<any, 'Filter'>) {
  const { placeholder, columns } = ctx.props as any;
  // Filter needs value and onChange which come from parent context
  // This is a simplified version for catalog rendering
  const [value, setValue] = React.useState('');

  return (
    <Filter
      value={value}
      onChange={setValue}
      placeholder={placeholder}
    />
  );
}

function CatalogDensityToggle(ctx: ComponentContext<any, 'DensityToggle'>) {
  const { value: initialValue } = ctx.props as any;
  const [density, setDensity] = React.useState(initialValue || 'comfortable');

  return (
    <DensityToggle
      value={density}
      onChange={setDensity}
    />
  );
}

function CatalogViewModeToggle(ctx: ComponentContext<any, 'ViewModeToggle'>) {
  const { modes = ['table', 'chart'], activeMode: initialMode = 'table' } = ctx.props as any;
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
function CatalogTableWithFilters(ctx: ComponentContext<any, 'TableWithFilters'>) {
  const {
    columns,
    height,
    initialDensity,
    showFilter,
    showDensityToggle,
    virtualScrolling,
  } = ctx.props as any;

  // Data comes from json-render state provider via useStateValue hook
  const data = useStateValue<Record<string, unknown>[]>('/data') || [];

  return (
    <TableWithFilters
      data={data}
      columns={columns}
      height={height}
      initialDensity={initialDensity}
      showFilter={showFilter}
      showDensityToggle={showDensityToggle}
      virtualScrolling={virtualScrolling}
    />
  );
}

function CatalogChartWithControls(ctx: ComponentContext<any, 'ChartWithControls'>) {
  const {
    columns,
    height,
    initialChartType,
    initialXAxis,
    initialYAxis,
    showControls,
    controlsCollapsed,
  } = ctx.props as any;

  // Data comes from json-render state provider via useStateValue hook
  const data = useStateValue<Record<string, unknown>[]>('/data') || [];

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
function CatalogSQLResultsDisplay(ctx: ComponentContext<any, 'SQLResultsDisplay'>) {
  const {
    sql,
    context: execContext,
    projectId,
    teradataBaseUrl,
    initialViewMode,
    tableHeight,
    chartHeight,
  } = ctx.props as any;

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
});
