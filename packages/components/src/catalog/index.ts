/**
 * Catalog Module - json-render definitions for SurfacesUI
 */
export { catalog, ChartSchema, DataTableSchema, FilterSchema, DensityToggleSchema, ViewModeToggleSchema } from './schema';
export type { ChartProps, DataTableProps, FilterProps, DensityToggleProps, ViewModeToggleProps } from './schema';
export { registry } from './registry';
export { aiSystemPrompt, getCatalogPrompt } from './prompt';
export { generateCatalogPrompt, generateComponentPrompt, generateComponentExample } from './prompts';
