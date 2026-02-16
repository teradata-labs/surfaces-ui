/**
 * json-render Component Registry
 *
 * Maps catalog definitions to React component implementations.
 * Updated with real component implementations from primitives.
 */
import * as React from 'react';
import { defineRegistry, type ComponentContext } from '@json-render/react';
import { Table as TableIcon, BarChart3 as BarChartIcon } from 'lucide-react';

import { catalog } from './schema';
import type { Catalog } from '@json-render/core';

// Import real component implementations
import { Chart } from '../primitives/chart';
import { DataTable } from '../primitives/data-table';
import { Filter } from '../primitives/filter';
import { DensityToggle } from '../primitives/density-toggle';
import { ViewModeToggle } from '../primitives/view-mode-toggle';

// Wrapper components that adapt ComponentContext to component props
// These receive a ComponentContext and extract props.value for the actual components

function CatalogChart(ctx: ComponentContext<any, 'Chart'>) {
  const { type, xAxis, yAxis, theme, height, showDataLabels } = (ctx.props as any).value;
  const data = (ctx as any).data?.value || [];

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
  const { columns, height, density, virtualScrolling } = (ctx.props as any).value;
  const data = (ctx as any).data?.value || [];

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
  const { placeholder, columns } = (ctx.props as any).value;
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
  const { value: initialValue } = (ctx.props as any).value;
  const [density, setDensity] = React.useState(initialValue || 'comfortable');

  return (
    <DensityToggle
      value={density}
      onChange={setDensity}
    />
  );
}

function CatalogViewModeToggle(ctx: ComponentContext<any, 'ViewModeToggle'>) {
  const { modes = ['table', 'chart'], activeMode: initialMode = 'table' } = (ctx.props as any).value;
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

export const { registry } = defineRegistry(catalog, {
  components: {
    Chart: CatalogChart,
    DataTable: CatalogDataTable,
    Filter: CatalogFilter,
    DensityToggle: CatalogDensityToggle,
    ViewModeToggle: CatalogViewModeToggle,
  },
});
