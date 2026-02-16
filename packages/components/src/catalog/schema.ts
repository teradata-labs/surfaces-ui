/**
 * json-render Catalog Schema Definitions
 *
 * Defines Zod schemas for all SQL results primitives.
 * Each component has 5-8 props maximum for AI describability.
 */
import { defineSchema, defineCatalog } from '@json-render/core';
import { z } from 'zod';

/**
 * Catalog Schemas - AI-Specifiable Props Only
 *
 * These schemas define props that AI can configure from natural language.
 * They intentionally exclude:
 * - Context-provided props (data arrays) - come from json-render context
 * - Runtime props (callbacks, className) - managed by parent components
 *
 * The registry wrappers (registry.tsx) handle mapping between catalog schemas
 * and full component interfaces.
 */

// Zod schemas for component props
export const ChartSchema = z.object({
  // AI-specifiable configuration
  type: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'stacked-bar', 'combo']).default('bar').describe('Chart visualization type'),
  xAxis: z.string().optional().describe('Column name for X axis'),
  yAxis: z.string().optional().describe('Column name for Y axis'),
  theme: z.string().nullable().optional().describe('ECharts theme name'),
  height: z.number().default(400).describe('Chart height in pixels'),
  showDataLabels: z.boolean().default(false).describe('Show values on chart elements'),
  // Note: data comes from json-render context, className is runtime styling
});

export const DataTableSchema = z.object({
  // AI-specifiable configuration
  columns: z.array(z.string()).optional().describe('Column names to display'),
  height: z.number().default(400).describe('Table height in pixels'),
  density: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable').describe('Row density'),
  virtualScrolling: z.boolean().default(true).describe('Enable virtual scrolling'),
  showRowNumbers: z.boolean().default(false).describe('Show row number column'),
  // Note: data comes from context, onRowClick/className are runtime
});

export const FilterSchema = z.object({
  // AI-specifiable configuration
  placeholder: z.string().default('Search...').describe('Placeholder text'),
  debounceMs: z.number().default(0).describe('Debounce delay in ms'),
  ariaLabel: z.string().default('Search filter').describe('Accessibility label'),
  // Note: value/onChange are controlled by parent, className is runtime
});

export const DensityToggleSchema = z.object({
  // AI-specifiable configuration
  value: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable').describe('Current density'),
  showLabels: z.boolean().default(false).describe('Show text labels'),
  // Note: onChange/options/className are runtime
});

export const ViewModeToggleSchema = z.object({
  // AI-specifiable configuration
  modes: z.array(z.enum(['table', 'chart'])).default(['table', 'chart']).describe('Available view modes'),
  activeMode: z.enum(['table', 'chart']).default('table').describe('Currently active mode'),
  showLabels: z.boolean().default(true).describe('Show text labels'),
  // Note: options array and onModeChange are runtime
});

// Molecule schemas - compose primitives into higher-level components
export const TableWithFiltersSchema = z.object({
  // AI-specifiable configuration
  columns: z.array(z.string()).optional().describe('Column names to display'),
  height: z.number().default(400).describe('Table height in pixels'),
  initialDensity: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable').describe('Initial row density'),
  showFilter: z.boolean().default(true).describe('Show search filter'),
  showDensityToggle: z.boolean().default(true).describe('Show density toggle'),
  virtualScrolling: z.boolean().default(true).describe('Enable virtual scrolling'),
  // Note: data comes from context, onRowClick/className are runtime
});

export const ChartWithControlsSchema = z.object({
  // AI-specifiable configuration
  columns: z.array(z.string()).optional().describe('Columns for axis selection'),
  height: z.number().default(400).describe('Chart height in pixels'),
  initialChartType: z.enum(['bar', 'line', 'area', 'pie', 'scatter', 'heatmap']).default('bar').describe('Initial chart type'),
  initialXAxis: z.string().optional().describe('Initial X axis column'),
  initialYAxis: z.string().optional().describe('Initial Y axis column'),
  showControls: z.boolean().default(true).describe('Show chart options panel'),
  controlsCollapsed: z.boolean().default(false).describe('Controls collapsed by default'),
  // Note: data comes from context, onConfigChange/className are runtime
});

// Organisms - complete feature-rich components
export const SQLResultsDisplaySchema = z.object({
  // AI-specifiable configuration
  sql: z.string().optional().describe('SQL query that produced results'),
  context: z.enum(['web', 'mcp-apps']).default('web').describe('Execution context'),
  projectId: z.string().optional().describe('Project ID for Teradata link'),
  teradataBaseUrl: z.string().optional().describe('Base URL for Teradata app'),
  initialViewMode: z.enum(['table', 'chart']).default('table').describe('Initial view mode'),
  tableHeight: z.number().default(400).describe('Table height in pixels'),
  chartHeight: z.number().default(400).describe('Chart height in pixels'),
  // Note: data comes from context
  // Note: savedConfig is constructed from initialViewMode/tableHeight/chartHeight
  // Note: onConfigChange, actions, className are runtime
});

// Define the schema for json-render
const schema = defineSchema((s) => ({
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

// Catalog definition - components will be registered as they're built
export const catalog = defineCatalog(schema, {
  components: {
    // Primitives - basic building blocks
    Chart: {
      props: ChartSchema,
      description: 'Render data as a chart using ECharts with theme integration. Use for visualizing trends, comparisons, and distributions.',
      hasChildren: false,
    },
    DataTable: {
      props: DataTableSchema,
      description: 'Display tabular data with virtual scrolling for large datasets. Use for detailed row-by-row data inspection.',
      hasChildren: false,
    },
    Filter: {
      props: FilterSchema,
      description: 'Filter table data by search term or column-specific filters. Combine with DataTable for searchable data.',
      hasChildren: false,
    },
    DensityToggle: {
      props: DensityToggleSchema,
      description: 'Toggle between compact, comfortable, and spacious row density. Use with DataTable.',
      hasChildren: false,
    },
    ViewModeToggle: {
      props: ViewModeToggleSchema,
      description: 'Toggle between table and chart view modes. Use to switch visualization types.',
      hasChildren: false,
    },
    // Molecules - compose primitives
    TableWithFilters: {
      props: TableWithFiltersSchema,
      description: 'Data table with search filter and density toggle',
      hasChildren: false,
    },
    ChartWithControls: {
      props: ChartWithControlsSchema,
      description: 'Chart with type/axis configuration panel',
      hasChildren: false,
    },
    // Organisms - complete features
    SQLResultsDisplay: {
      props: SQLResultsDisplaySchema,
      description: 'Full SQL results with table/chart views and export',
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
  },
});

export type ChartProps = z.infer<typeof ChartSchema>;
export type DataTableProps = z.infer<typeof DataTableSchema>;
export type FilterProps = z.infer<typeof FilterSchema>;
export type DensityToggleProps = z.infer<typeof DensityToggleSchema>;
export type ViewModeToggleProps = z.infer<typeof ViewModeToggleSchema>;
export type TableWithFiltersSchemaProps = z.infer<typeof TableWithFiltersSchema>;
export type ChartWithControlsSchemaProps = z.infer<typeof ChartWithControlsSchema>;
export type SQLResultsDisplaySchemaProps = z.infer<typeof SQLResultsDisplaySchema>;
