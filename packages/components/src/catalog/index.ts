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
export {
  validateGeneratedSpec,
  attemptAutoFix,
  getKnownComponentTypes,
  type ValidationResult,
  type ValidationError,
} from './validation';
export {
  SpecValidationError,
  createFallbackSpec,
  ValidatedSpecRenderer,
  type SpecValidationErrorProps,
  type ValidatedSpecRendererProps,
} from './fallback';
export {
  useSpecStream,
  generateSpec,
  type SpecStreamState,
  type SpecStreamChunk,
  type UseSpecStreamOptions,
} from './stream';

// Re-export bridge type for consumers
export type { BridgeLike } from '../bridge';

// Demo components for testing catalog-to-component flow
export { CatalogDemo } from './demo';
export { chartSpec, dataTableSpec, tableWithFiltersSpec, sqlResultsSpec, sampleData } from './demo-specs';
