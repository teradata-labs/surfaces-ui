/**
 * json-render Catalog Schema Definitions
 *
 * Defines Zod schemas for all SQL results primitives.
 * Each component has 5-8 props maximum for AI describability.
 */
import { defineSchema, defineCatalog } from '@json-render/core';
import { z } from 'zod';

// Zod schemas for component props
export const ChartSchema = z.object({
  type: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'stacked-bar', 'combo']),
  xAxis: z.string().describe('Column name for X axis'),
  yAxis: z.string().describe('Column name for Y axis'),
  theme: z.string().nullable().default(null).describe('ECharts theme name'),
  height: z.number().default(400).describe('Chart height in pixels'),
  showDataLabels: z.boolean().default(false).describe('Show values on chart elements'),
});

export const DataTableSchema = z.object({
  columns: z.array(z.string()).describe('Column names to display'),
  height: z.number().default(400).describe('Table height in pixels'),
  density: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
  virtualScrolling: z.boolean().default(true).describe('Enable virtual scrolling for large datasets'),
});

export const FilterSchema = z.object({
  placeholder: z.string().default('Search...').describe('Placeholder text for search input'),
  columns: z.array(z.string()).describe('Columns available for filtering'),
});

export const DensityToggleSchema = z.object({
  value: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
});

export const ViewModeToggleSchema = z.object({
  modes: z.array(z.enum(['table', 'chart'])).default(['table', 'chart']),
  activeMode: z.enum(['table', 'chart']).default('table'),
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
