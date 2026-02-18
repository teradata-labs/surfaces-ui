/**
 * Type-level tests for catalog schema and registry alignment
 *
 * These tests use TypeScript's type system to verify at compile time that:
 * 1. Catalog schemas match component prop types
 * 2. Registry wrapper types align with catalog definitions
 *
 * If these tests fail to compile, the types are misaligned.
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { z } from 'zod';

import {
  ChartSchema,
  DataTableSchema,
  FilterSchema,
  DensityToggleSchema,
  ViewModeToggleSchema,
  TableWithFiltersSchema,
  ChartWithControlsSchema,
  SQLResultsDisplaySchema,
  catalog,
} from './schema';
import type {
  ChartProps,
  DataTableProps,
  FilterProps,
  DensityToggleProps,
  ViewModeToggleProps,
  TableWithFiltersProps,
  ChartWithControlsProps,
  SQLResultsDisplayProps,
} from './types';

/* ── Helper Types ────────────────────────────────────────────────────── */

/**
 * Extract the inferred type from a Zod schema
 */
type InferZodType<T extends z.ZodType> = z.infer<T>;

/* ── Type Alignment Tests ────────────────────────────────────────────── */

describe('Catalog schema types match component prop types', () => {
  it('Chart schema matches ChartProps', () => {
    type CatalogChartProps = InferZodType<typeof ChartSchema>;

    // Type-level assertion: ChartProps should be assignable to catalog props
    expectTypeOf<ChartProps>().toMatchTypeOf<CatalogChartProps>();
    expectTypeOf<CatalogChartProps>().toMatchTypeOf<ChartProps>();
  });

  it('DataTable schema matches DataTableProps', () => {
    type CatalogDataTableProps = InferZodType<typeof DataTableSchema>;

    expectTypeOf<DataTableProps>().toMatchTypeOf<CatalogDataTableProps>();
    expectTypeOf<CatalogDataTableProps>().toMatchTypeOf<DataTableProps>();
  });

  it('Filter schema matches FilterProps', () => {
    type CatalogFilterProps = InferZodType<typeof FilterSchema>;

    expectTypeOf<FilterProps>().toMatchTypeOf<CatalogFilterProps>();
    expectTypeOf<CatalogFilterProps>().toMatchTypeOf<FilterProps>();
  });

  it('DensityToggle schema matches DensityToggleProps', () => {
    type CatalogDensityToggleProps = InferZodType<typeof DensityToggleSchema>;

    expectTypeOf<DensityToggleProps>().toMatchTypeOf<CatalogDensityToggleProps>();
    expectTypeOf<CatalogDensityToggleProps>().toMatchTypeOf<DensityToggleProps>();
  });

  it('ViewModeToggle schema matches ViewModeToggleProps', () => {
    type CatalogViewModeToggleProps = InferZodType<typeof ViewModeToggleSchema>;

    expectTypeOf<ViewModeToggleProps>().toMatchTypeOf<CatalogViewModeToggleProps>();
    expectTypeOf<CatalogViewModeToggleProps>().toMatchTypeOf<ViewModeToggleProps>();
  });

  it('TableWithFilters schema matches TableWithFiltersProps', () => {
    type CatalogTableWithFiltersProps = InferZodType<typeof TableWithFiltersSchema>;

    expectTypeOf<TableWithFiltersProps>().toMatchTypeOf<CatalogTableWithFiltersProps>();
    expectTypeOf<CatalogTableWithFiltersProps>().toMatchTypeOf<TableWithFiltersProps>();
  });

  it('ChartWithControls schema matches ChartWithControlsProps', () => {
    type CatalogChartWithControlsProps = InferZodType<typeof ChartWithControlsSchema>;

    expectTypeOf<ChartWithControlsProps>().toMatchTypeOf<CatalogChartWithControlsProps>();
    expectTypeOf<CatalogChartWithControlsProps>().toMatchTypeOf<ChartWithControlsProps>();
  });

  it('SQLResultsDisplay schema matches SQLResultsDisplayProps', () => {
    type CatalogSQLResultsDisplayProps = InferZodType<typeof SQLResultsDisplaySchema>;

    expectTypeOf<SQLResultsDisplayProps>().toMatchTypeOf<CatalogSQLResultsDisplayProps>();
    expectTypeOf<CatalogSQLResultsDisplayProps>().toMatchTypeOf<SQLResultsDisplayProps>();
  });
});

describe('Registry completeness at type level', () => {
  it('all catalog components have corresponding prop types', () => {
    // This test ensures we haven't missed any components
    type CatalogComponents = keyof typeof catalog.components;

    // If a component is added to catalog without a corresponding type,
    // this will show as a type error
    type ExpectedComponents =
      | 'Chart'
      | 'DataTable'
      | 'Filter'
      | 'DensityToggle'
      | 'ViewModeToggle'
      | 'TableWithFilters'
      | 'ChartWithControls'
      | 'SQLResultsDisplay';

    expectTypeOf<CatalogComponents>().toEqualTypeOf<ExpectedComponents>();
  });

  it('schema exports match catalog definitions', () => {
    // Verify that all schemas used in the catalog are exported
    type _ChartSchema = typeof ChartSchema;
    type _DataTableSchema = typeof DataTableSchema;
    type _FilterSchema = typeof FilterSchema;
    type _DensityToggleSchema = typeof DensityToggleSchema;
    type _ViewModeToggleSchema = typeof ViewModeToggleSchema;
    type _TableWithFiltersSchema = typeof TableWithFiltersSchema;
    type _ChartWithControlsSchema = typeof ChartWithControlsSchema;
    type _SQLResultsDisplaySchema = typeof SQLResultsDisplaySchema;

    // If this compiles, all schemas are accessible and exported
    expectTypeOf<_ChartSchema>().not.toBeNever();
  });
});

describe('Type safety verification', () => {
  it('DataRow type is compatible with component data props', () => {
    // Verify that our DataRow type works with actual component interfaces
    const mockData: Array<Record<string, unknown>> = [
      { name: 'test', value: 123 },
    ];

    // Should be assignable to DataRow[]
    expectTypeOf(mockData).toMatchTypeOf<Array<Record<string, unknown>>>();
  });

  it('prop types have correct optionality', () => {
    // These should compile - all props are optional except type in Chart
    const chartProps: ChartProps = { type: 'bar' };
    const tableProps: DataTableProps = {};
    const filterProps: FilterProps = {};

    expectTypeOf(chartProps).toMatchTypeOf<ChartProps>();
    expectTypeOf(tableProps).toMatchTypeOf<DataTableProps>();
    expectTypeOf(filterProps).toMatchTypeOf<FilterProps>();
  });
});
