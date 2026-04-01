/**
 * Dashboard-specific UI Registry
 *
 * Extends the base ui-registry with chart theme integration for the dashboard viewer.
 * Uses ChartWithTheme to automatically apply theme from ChartThemeProvider.
 */

import * as React from 'react';
import { defineRegistry, type ComponentContext, useStateValue } from '@json-render/react';
import { uiCatalog } from '../catalog/ui-registry';
import { ChartWithTheme } from './ChartWithTheme';
import type { ChartProps, DataRow } from '../catalog/types';

// Import all other components from base registry
import { DataTable } from '../primitives/data-table';
import { Filter } from '../primitives/filter';
import { DensityToggle } from '../primitives/density-toggle';
import { ViewModeToggle } from '../primitives/view-mode-toggle';
import { TableWithFilters } from '../molecules/table-with-filters';
import { ChartWithControls } from '../molecules/chart-with-controls';
import { SQLResultsDisplay } from '../components/sql-results';
import { Input } from '../primitives/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../primitives/select';
import { Separator } from '../primitives/separator';
import { cn } from '@/lib/utils';
import { Table as TableIcon, BarChart3 as BarChartIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import type {
  DataTableProps,
  FilterProps,
  DensityToggleProps,
  ViewModeToggleProps,
  TableWithFiltersProps,
  ChartWithControlsProps,
  SQLResultsDisplayProps,
} from '../catalog/types';

import {
  type BoxProps, type DividerProps, type HeadingProps, type TextProps,
  type CardProps, type StatCardProps, type FormInputProps, type FormSelectProps,
} from '../catalog/ui-schema';

// Dashboard-specific Chart wrapper with theme
function DashboardChart(ctx: ComponentContext<typeof uiCatalog, 'Chart'>) {
  const props = ctx.props as ChartProps & { xKey?: string; yKey?: string; title?: string };
  const data = useStateValue<DataRow[]>('/data') || [];
  const columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];

  // Support both xAxis/yAxis (correct) and xKey/yKey (for backwards compatibility)
  const finalXAxis = props.xAxis || props.xKey || columns[0] || '';
  const finalYAxis = props.yAxis || props.yKey || columns[1] || '';

  console.log('[DashboardChart] Props:', props);
  console.log('[DashboardChart] Using axes:', { finalXAxis, finalYAxis });
  console.log('[DashboardChart] Available columns:', columns);

  if (!data || data.length === 0) {
    return (
      <div className="p-4 border border-dashed border-muted rounded-lg text-center text-muted-foreground text-sm">
        <p>No data available for chart</p>
        {props.title && <p className="text-xs mt-1">{props.title}</p>}
      </div>
    );
  }

  return (
    <ChartWithTheme
      data={data}
      type={props.type as ChartProps['type']}
      xAxis={finalXAxis}
      yAxis={finalYAxis}
      theme={props.theme || undefined}
      height={props.height}
      showDataLabels={props.showDataLabels}
    />
  );
}

// Copy all other component wrappers from base registry
function UIDataTable(ctx: ComponentContext<typeof uiCatalog, 'DataTable'>) {
  const props = ctx.props as DataTableProps;
  const data = useStateValue<DataRow[]>('/data') || [];
  const memoizedColumns = React.useMemo(() => props.columns || undefined, [props.columns]);
  return (
    <DataTable
      data={data}
      columns={memoizedColumns}
      height={props.height}
      density={props.density}
      virtualScrolling={props.virtualScrolling}
    />
  );
}

function UIFilter(ctx: ComponentContext<typeof uiCatalog, 'Filter'>) {
  const props = ctx.props as FilterProps;
  const [value, setValue] = React.useState('');
  return (
    <Filter
      value={value}
      onChange={setValue}
      placeholder={props.placeholder}
      ariaLabel={props.ariaLabel}
    />
  );
}

function UIDensityToggle(ctx: ComponentContext<typeof uiCatalog, 'DensityToggle'>) {
  const props = ctx.props as DensityToggleProps;
  const [density, setDensity] = React.useState(props.value || 'comfortable');
  return <DensityToggle value={density} onChange={setDensity} />;
}

function UIViewModeToggle(ctx: ComponentContext<typeof uiCatalog, 'ViewModeToggle'>) {
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

function UITableWithFilters(ctx: ComponentContext<typeof uiCatalog, 'TableWithFilters'>) {
  const props = ctx.props as TableWithFiltersProps;
  const rawData = useStateValue<DataRow[]>('/data');
  const data = React.useMemo(() => rawData || [], [rawData]);
  const memoizedColumns = React.useMemo(() => {
    if (!props.columns) return undefined;
    if (!data.length) return props.columns;
    const actualColumns = Object.keys(data[0] || {});
    if (props.columns.some(col => !actualColumns.includes(col))) {
      return actualColumns;
    }
    return props.columns;
  }, [data, props.columns]);
  return (
    <TableWithFilters
      data={data}
      columns={memoizedColumns}
      height={props.height}
      initialDensity={props.initialDensity}
      showFilter={props.showFilter}
      showDensityToggle={props.showDensityToggle}
      virtualScrolling={props.virtualScrolling}
    />
  );
}

function UIChartWithControls(ctx: ComponentContext<typeof uiCatalog, 'ChartWithControls'>) {
  const props = ctx.props as ChartWithControlsProps;
  const rawData = useStateValue<DataRow[]>('/data');
  const data = React.useMemo(() => rawData || [], [rawData]);
  const columns = React.useMemo(() => {
    if (!data.length) return props.columns;
    const actualColumns = Object.keys(data[0] || {});
    if (props.columns && props.columns.some(col => !actualColumns.includes(col))) {
      return actualColumns;
    }
    return props.columns;
  }, [data, props.columns]);
  return (
    <ChartWithControls
      data={data}
      columns={columns}
      height={props.height}
      initialChartType={props.initialChartType}
      initialXAxis={props.initialXAxis}
      initialYAxis={props.initialYAxis}
      showControls={props.showControls}
      controlsCollapsed={props.controlsCollapsed}
    />
  );
}

function UISQLResultsDisplay(ctx: ComponentContext<typeof uiCatalog, 'SQLResultsDisplay'>) {
  const props = ctx.props as SQLResultsDisplayProps;
  const rawData = useStateValue<unknown>('/data');
  const data = React.useMemo(() => {
    if (!rawData) return { rows: [], columns: [] };
    if (Array.isArray(rawData)) {
      const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];
      return { rows: rawData, columns };
    }
    return rawData;
  }, [rawData]);
  const savedConfig = React.useMemo(() => ({
    resultsViewMode: props.initialViewMode || 'table',
    tableHeight: props.tableHeight || 400,
    chartHeight: props.chartHeight || 400,
  }), [props.initialViewMode, props.tableHeight, props.chartHeight]);
  return (
    <SQLResultsDisplay
      data={data}
      sql={props.sql}
      savedConfig={savedConfig}
      context={props.context}
      projectId={props.projectId}
      teradataBaseUrl={props.teradataBaseUrl}
    />
  );
}

function UIBox(ctx: ComponentContext<typeof uiCatalog, 'Box'>) {
  const props = ctx.props as BoxProps;
  const { direction = 'column', gap = 24, columns, padding = 0, align = 'stretch', justify = 'start', wrap = false } = props;

  const justifyMap: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };

  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const isGrid = columns && columns > 1;

  const style: React.CSSProperties = {
    gap: `${gap}px`,
    padding: padding > 0 ? `${padding}px` : undefined,
  };

  // Use responsive grid classes for better StatCard layout
  const gridClass = isGrid
    ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
    : 'flex';

  return (
    <div
      className={cn(
        gridClass,
        !isGrid && `${direction === 'row' ? 'flex-row' : 'flex-col'}`,
        alignMap[align],
        justifyMap[justify],
        wrap && !isGrid ? 'flex-wrap' : '',
      )}
      style={style}
    >
      {ctx.children}
    </div>
  );
}

function UIDivider(ctx: ComponentContext<typeof uiCatalog, 'Divider'>) {
  const props = ctx.props as DividerProps;

  if (props.label) {
    return (
      <div className={cn(
        'flex items-center gap-3',
        props.orientation === 'vertical' ? 'flex-col h-full' : 'w-full'
      )}>
        <Separator className="flex-1" orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{props.label}</span>
        <Separator className="flex-1" orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} />
      </div>
    );
  }

  return <Separator orientation={props.orientation === 'vertical' ? 'vertical' : 'horizontal'} />;
}

function UIHeading(ctx: ComponentContext<typeof uiCatalog, 'Heading'>) {
  const props = ctx.props as HeadingProps;
  const { text, level = '2', align = 'left' } = props;

  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  const sizeClasses: Record<string, string> = {
    '1': 'text-3xl font-bold tracking-tight',
    '2': 'text-2xl font-semibold tracking-tight',
    '3': 'text-xl font-semibold',
    '4': 'text-lg font-medium',
  };

  const headingClass = cn('text-foreground', sizeClasses[level], alignClass);

  if (level === '1') return <h1 className={headingClass}>{text}</h1>;
  if (level === '3') return <h3 className={headingClass}>{text}</h3>;
  if (level === '4') return <h4 className={headingClass}>{text}</h4>;
  return <h2 className={headingClass}>{text}</h2>;
}

function UIText(ctx: ComponentContext<typeof uiCatalog, 'Text'>) {
  const props = ctx.props as TextProps;
  const { content, size = 'base', muted = false, align = 'left' } = props;

  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base';
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const rendered = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  return (
    <p
      className={cn(sizeClass, alignClass, muted ? 'text-muted-foreground' : 'text-foreground', 'leading-relaxed')}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function UICard(ctx: ComponentContext<typeof uiCatalog, 'Card'>) {
  const props = ctx.props as CardProps;
  const { title, description, variant = 'default', padding = 'md' } = props;

  const paddingMap: Record<string, string> = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-8',
  };

  const variantClasses: Record<string, string> = {
    default: 'bg-card text-card-foreground border border-border rounded-lg shadow-sm',
    outline: 'border border-border rounded-lg',
    filled: 'bg-muted rounded-lg',
  };

  return (
    <div className={cn(variantClasses[variant], paddingMap[padding])}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}
      {ctx.children}
    </div>
  );
}

function UIStatCard(ctx: ComponentContext<typeof uiCatalog, 'StatCard'>) {
  const props = ctx.props as StatCardProps;
  const { label, value, change, trend } = props;

  const trendColor = trend === 'up' ? 'text-green-600 dark:text-green-400'
    : trend === 'down' ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm col-span-full">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {change && (
          <span className={cn('text-sm font-medium flex items-center gap-1', trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function UIFormInput(ctx: ComponentContext<typeof uiCatalog, 'FormInput'>) {
  const props = ctx.props as FormInputProps;
  const { label, name, placeholder, type = 'text', required = false, helperText } = props;
  const [value, setValue] = React.useState('');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`form-${name}`} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Input
        id={`form-${name}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
      />
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

function UIFormSelect(ctx: ComponentContext<typeof uiCatalog, 'FormSelect'>) {
  const props = ctx.props as FormSelectProps;
  const { label, name, placeholder, options, required = false } = props;
  const [value, setValue] = React.useState('');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`form-${name}`} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Export dashboard-specific registry with ChartWithTheme
export const { registry: dashboardRegistry } = defineRegistry(uiCatalog, {
  components: {
    Chart: DashboardChart, // Use theme-aware Chart
    DataTable: UIDataTable,
    Filter: UIFilter,
    DensityToggle: UIDensityToggle,
    ViewModeToggle: UIViewModeToggle,
    TableWithFilters: UITableWithFilters,
    ChartWithControls: UIChartWithControls,
    SQLResultsDisplay: UISQLResultsDisplay,
    Box: UIBox,
    Divider: UIDivider,
    Heading: UIHeading,
    Text: UIText,
    Card: UICard,
    StatCard: UIStatCard,
    FormInput: UIFormInput,
    FormSelect: UIFormSelect,
  },
  actions: {
    execute_sql: async () => {},
    export_csv: async () => {},
    copy_json: async () => {},
  },
});
