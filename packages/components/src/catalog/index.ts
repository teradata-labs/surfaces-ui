/**
 * Catalog Module - json-render definitions for SurfacesUI
 */
export { catalog, ChartSchema, DataTableSchema, FilterSchema, DensityToggleSchema, ViewModeToggleSchema, TableWithFiltersSchema, ChartWithControlsSchema, SQLResultsDisplaySchema } from './schema';
export type { ChartProps, DataTableProps, FilterProps, DensityToggleProps, ViewModeToggleProps, TableWithFiltersSchemaProps, ChartWithControlsSchemaProps, SQLResultsDisplaySchemaProps } from './schema';
export { createMcpActionHandlers, type McpActionState } from './actions';
export { registry } from './registry';
export { SurfacesRenderer, type SurfacesRendererProps } from './renderer';
export { aiSystemPrompt, getCatalogPrompt } from './prompt';
export { generateCatalogPrompt, generateComponentPrompt, generateComponentExample, generateSpecExample } from './prompts';

// Demo components for testing catalog-to-component flow
export { CatalogDemo } from './demo';
export { chartSpec, dataTableSpec, tableWithFiltersSpec, sqlResultsSpec, sampleData } from './demo-specs';
