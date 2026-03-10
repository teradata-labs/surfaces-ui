/**
 * Extended UI Component Registry for json-render
 *
 * Extends the data-viz catalog with layout, content, and form components.
 * Used by the AI Playground to render AI-generated specs for dashboards,
 * landing pages, forms, surveys, and control plane UIs.
 *
 * Includes all 8 original data-viz components + 8 new UI components = 16 total.
 */
import * as React from 'react';
import { defineRegistry, type ComponentContext, useStateValue } from '@json-render/react';
import { defineCatalog } from '@json-render/core';
import { z } from 'zod';
import { Table as TableIcon, BarChart3 as BarChartIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Import existing catalog schema (reuse schema definition)
import { catalog as dataCatalog } from './schema';
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

// Import new UI schemas
import {
  BoxSchema, DividerSchema, HeadingSchema, TextSchema,
  CardSchema, StatCardSchema, FormInputSchema, FormSelectSchema,
  type BoxProps, type DividerProps, type HeadingProps, type TextProps,
  type CardProps, type StatCardProps, type FormInputProps, type FormSelectProps,
} from './ui-schema';

// Import existing Zod schemas for data-viz components
import {
  ChartSchema, DataTableSchema, FilterSchema, DensityToggleSchema,
  ViewModeToggleSchema, TableWithFiltersSchema, ChartWithControlsSchema,
  SQLResultsDisplaySchema,
} from './schema';

// Import real component implementations
import { Chart } from '../primitives/chart';
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

// ── Extended Catalog ──────────────────────────────────────────────────────────

// We create a new catalog schema inline that mirrors the existing pattern
// but includes all 16 component types.
import { defineSchema } from '@json-render/core';

const uiSchemaDefinition = defineSchema((s) => ({
  spec: s.object({
    root: s.string(),
    elements: s.record(s.object({
      type: s.ref('catalog.components'),
      props: s.propsOf('catalog.components'),
    })),
  }),
  catalog: s.object({
    components: s.map({
      props: s.zod(),
      description: s.string(),
      hasChildren: s.boolean(),
    }),
    actions: s.map({
      params: s.zod(),
      description: s.string(),
    }),
  }),
}));

export const uiCatalog = defineCatalog(uiSchemaDefinition, {
  components: {
    // ── Existing Data-Viz Components ──
    Chart: {
      props: ChartSchema,
      description: 'Render data as a chart (bar, line, pie, etc.) for visualizing trends and distributions.',
      hasChildren: false,
    },
    DataTable: {
      props: DataTableSchema,
      description: 'Display tabular data with virtual scrolling for large datasets.',
      hasChildren: false,
    },
    Filter: {
      props: FilterSchema,
      description: 'Search filter input. Combine with DataTable for searchable data.',
      hasChildren: false,
    },
    DensityToggle: {
      props: DensityToggleSchema,
      description: 'Toggle between compact, comfortable, and spacious row density.',
      hasChildren: false,
    },
    ViewModeToggle: {
      props: ViewModeToggleSchema,
      description: 'Toggle between table and chart view modes.',
      hasChildren: false,
    },
    TableWithFilters: {
      props: TableWithFiltersSchema,
      description: 'Data table with search filter and density toggle.',
      hasChildren: false,
    },
    ChartWithControls: {
      props: ChartWithControlsSchema,
      description: 'Chart with type/axis configuration panel.',
      hasChildren: false,
    },
    SQLResultsDisplay: {
      props: SQLResultsDisplaySchema,
      description: 'Full SQL results with table/chart views and export.',
      hasChildren: false,
    },

    // ── New Layout Components ──
    Box: {
      props: BoxSchema,
      description: 'Flexbox/grid layout container. Use to arrange children in rows, columns, or grids.',
      hasChildren: true,
    },
    Divider: {
      props: DividerSchema,
      description: 'Horizontal or vertical separator line between content sections.',
      hasChildren: false,
    },

    // ── New Content Components ──
    Heading: {
      props: HeadingSchema,
      description: 'Text heading (h1-h4). Use for section titles and page headers.',
      hasChildren: false,
    },
    Text: {
      props: TextSchema,
      description: 'Body text paragraph. Supports basic markdown formatting.',
      hasChildren: false,
    },
    Card: {
      props: CardSchema,
      description: 'Content card with optional title and description. Use to group related content.',
      hasChildren: true,
    },
    StatCard: {
      props: StatCardSchema,
      description: 'KPI metric card showing a value, label, and optional trend indicator.',
      hasChildren: false,
    },

    // ── New Form Components ──
    FormInput: {
      props: FormInputSchema,
      description: 'Labeled text input field for forms.',
      hasChildren: false,
    },
    FormSelect: {
      props: FormSelectSchema,
      description: 'Labeled dropdown select for forms.',
      hasChildren: false,
    },
  },
  actions: {
    export_csv: {
      params: z.object({ filename: z.string().default('export.csv') }),
      description: 'Export current data to CSV file',
    },
    copy_json: {
      params: z.object({}),
      description: 'Copy data as JSON to clipboard',
    },
    execute_sql: {
      params: z.object({ query: z.string(), connection_id: z.string().optional() }),
      description: 'Execute SQL query via MCP Bridge and update state with results',
    },
  },
});

// ── Registry Wrapper Components ───────────────────────────────────────────────

// Re-use existing data-viz wrappers
function UIChart(ctx: ComponentContext<typeof uiCatalog, 'Chart'>) {
  const props = ctx.props as ChartProps;
  const data = useStateValue<DataRow[]>('/data') || [];
  const columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
  const finalXAxis = props.xAxis || columns[0] || '';
  const finalYAxis = props.yAxis || columns[1] || '';

  // Don't render if no data
  if (!data || data.length === 0) {
    return (
      <div className="p-4 border border-dashed border-muted rounded-lg text-center text-muted-foreground text-sm">
        <p>No data available for chart</p>
        {props.title && <p className="text-xs mt-1">{props.title}</p>}
      </div>
    );
  }

  return (
    <Chart
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

// ── New UI Component Wrappers ─────────────────────────────────────────────────

function UIBox(ctx: ComponentContext<typeof uiCatalog, 'Box'>) {
  const props = ctx.props as BoxProps;
  const { direction = 'column', gap = 16, columns, padding = 0, align = 'stretch', justify = 'start', wrap = false } = props;

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
    ...(isGrid ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : {}),
  };

  return (
    <div
      className={cn(
        isGrid ? 'grid' : `flex ${direction === 'row' ? 'flex-row' : 'flex-col'}`,
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

  // Simple markdown: **bold** and *italic*
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
    <div className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-sm">
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

// ── Define Registry ───────────────────────────────────────────────────────────

export const { registry: uiRegistry } = defineRegistry(uiCatalog, {
  components: {
    // Data-viz components
    Chart: UIChart,
    DataTable: UIDataTable,
    Filter: UIFilter,
    DensityToggle: UIDensityToggle,
    ViewModeToggle: UIViewModeToggle,
    TableWithFilters: UITableWithFilters,
    ChartWithControls: UIChartWithControls,
    SQLResultsDisplay: UISQLResultsDisplay,
    // Layout components
    Box: UIBox,
    Divider: UIDivider,
    // Content components
    Heading: UIHeading,
    Text: UIText,
    Card: UICard,
    StatCard: UIStatCard,
    // Form components
    FormInput: UIFormInput,
    FormSelect: UIFormSelect,
  },
  actions: {
    execute_sql: async () => {},
    export_csv: async () => {},
    copy_json: async () => {},
  },
});
