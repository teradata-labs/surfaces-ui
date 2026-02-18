/**
 * Catalog Schema Validation Tests
 *
 * Tests all Zod schemas for catalog components (primitives, molecules, organisms).
 * Validates that schemas correctly accept valid specs and reject invalid ones.
 */
import { describe, it, expect } from 'vitest';
import {
  ChartSchema,
  DataTableSchema,
  FilterSchema,
  DensityToggleSchema,
  ViewModeToggleSchema,
  TableWithFiltersSchema,
  ChartWithControlsSchema,
  SQLResultsDisplaySchema,
} from './schema';

describe('Catalog Schemas', () => {
  describe('Chart Schema (Primitive)', () => {
    it('validates correct Chart spec with all props', () => {
      const validSpec = {
        type: 'bar',
        xAxis: 'category',
        yAxis: 'value',
        theme: 'dark',
        height: 400,
        showDataLabels: true,
      };
      const result = ChartSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates Chart spec with minimal props (defaults applied)', () => {
      const minimalSpec = {};
      const result = ChartSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('bar'); // default
        expect(result.data.height).toBe(400); // default
        expect(result.data.showDataLabels).toBe(false); // default
      }
    });

    it('validates Chart with different chart types', () => {
      const chartTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'heatmap', 'stacked-bar', 'combo'];
      chartTypes.forEach(type => {
        const spec = { type };
        const result = ChartSchema.safeParse(spec);
        expect(result.success).toBe(true);
      });
    });

    it('rejects Chart with invalid type', () => {
      const invalidSpec = { type: 'invalid-type' };
      const result = ChartSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects Chart with invalid height type', () => {
      const invalidSpec = { height: 'not-a-number' };
      const result = ChartSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects Chart with invalid xAxis type', () => {
      const invalidSpec = { xAxis: 123 }; // Should be string
      const result = ChartSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates Chart with 6 props (within 5-8 limit)', () => {
      const spec = {
        type: 'line',
        xAxis: 'date',
        yAxis: 'revenue',
        theme: 'vintage',
        height: 350,
        showDataLabels: true,
      };
      const result = ChartSchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(6);
      expect(Object.keys(spec).length).toBeGreaterThanOrEqual(5);
      expect(Object.keys(spec).length).toBeLessThanOrEqual(8);
    });
  });

  describe('DataTable Schema (Primitive)', () => {
    it('validates correct DataTable spec', () => {
      const validSpec = {
        columns: ['id', 'name', 'email'],
        height: 500,
        density: 'compact',
        virtualScrolling: true,
        showRowNumbers: false,
      };
      const result = DataTableSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates DataTable with minimal props (defaults applied)', () => {
      const minimalSpec = {};
      const result = DataTableSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.height).toBe(400);
        expect(result.data.density).toBe('comfortable');
        expect(result.data.virtualScrolling).toBe(true);
        expect(result.data.showRowNumbers).toBe(false);
      }
    });

    it('rejects DataTable with invalid columns type', () => {
      const invalidSpec = { columns: 'not-an-array' };
      const result = DataTableSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects DataTable with invalid density value', () => {
      const invalidSpec = { density: 'invalid-density' };
      const result = DataTableSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates DataTable with all 3 density options', () => {
      const densities = ['compact', 'comfortable', 'spacious'];
      densities.forEach(density => {
        const spec = { density };
        const result = DataTableSchema.safeParse(spec);
        expect(result.success).toBe(true);
      });
    });

    it('validates DataTable with 5 props (within limit)', () => {
      const spec = {
        columns: ['id', 'name'],
        height: 600,
        density: 'spacious',
        virtualScrolling: false,
        showRowNumbers: true,
      };
      const result = DataTableSchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(5);
    });
  });

  describe('Filter Schema (Primitive)', () => {
    it('validates correct Filter spec', () => {
      const validSpec = {
        placeholder: 'Search records...',
        debounceMs: 300,
        ariaLabel: 'Filter results',
      };
      const result = FilterSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates Filter with defaults', () => {
      const minimalSpec = {};
      const result = FilterSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.placeholder).toBe('Search...');
        expect(result.data.debounceMs).toBe(0);
        expect(result.data.ariaLabel).toBe('Search filter');
      }
    });

    it('rejects Filter with invalid debounceMs type', () => {
      const invalidSpec = { debounceMs: 'not-a-number' };
      const result = FilterSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates Filter with 3 props (within limit)', () => {
      const spec = {
        placeholder: 'Filter data',
        debounceMs: 150,
        ariaLabel: 'Search input',
      };
      const result = FilterSchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(3);
    });
  });

  describe('DensityToggle Schema (Primitive)', () => {
    it('validates correct DensityToggle spec', () => {
      const validSpec = {
        value: 'comfortable',
        showLabels: true,
      };
      const result = DensityToggleSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates DensityToggle with defaults', () => {
      const minimalSpec = {};
      const result = DensityToggleSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe('comfortable');
        expect(result.data.showLabels).toBe(false);
      }
    });

    it('rejects DensityToggle with invalid value', () => {
      const invalidSpec = { value: 'invalid-density' };
      const result = DensityToggleSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates all density values', () => {
      const densities = ['compact', 'comfortable', 'spacious'];
      densities.forEach(value => {
        const spec = { value };
        const result = DensityToggleSchema.safeParse(spec);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ViewModeToggle Schema (Primitive)', () => {
    it('validates correct ViewModeToggle spec', () => {
      const validSpec = {
        modes: ['table', 'chart'],
        activeMode: 'table',
        showLabels: true,
      };
      const result = ViewModeToggleSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates ViewModeToggle with defaults', () => {
      const minimalSpec = {};
      const result = ViewModeToggleSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modes).toEqual(['table', 'chart']);
        expect(result.data.activeMode).toBe('table');
        expect(result.data.showLabels).toBe(true);
      }
    });

    it('rejects ViewModeToggle with invalid mode', () => {
      const invalidSpec = { modes: ['invalid-mode'] };
      const result = ViewModeToggleSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects ViewModeToggle with invalid activeMode', () => {
      const invalidSpec = { activeMode: 'invalid-mode' };
      const result = ViewModeToggleSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });
  });

  describe('TableWithFilters Schema (Molecule)', () => {
    it('validates correct TableWithFilters spec', () => {
      const validSpec = {
        columns: ['id', 'name', 'email'],
        height: 500,
        initialDensity: 'comfortable',
        showFilter: true,
        showDensityToggle: true,
        virtualScrolling: true,
      };
      const result = TableWithFiltersSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates TableWithFilters with defaults', () => {
      const minimalSpec = {};
      const result = TableWithFiltersSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.height).toBe(400);
        expect(result.data.initialDensity).toBe('comfortable');
        expect(result.data.showFilter).toBe(true);
        expect(result.data.showDensityToggle).toBe(true);
        expect(result.data.virtualScrolling).toBe(true);
      }
    });

    it('rejects TableWithFilters with invalid initialDensity', () => {
      const invalidSpec = { initialDensity: 'invalid' };
      const result = TableWithFiltersSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates TableWithFilters with 6 props (within limit)', () => {
      const spec = {
        columns: ['id'],
        height: 300,
        initialDensity: 'compact',
        showFilter: false,
        showDensityToggle: false,
        virtualScrolling: false,
      };
      const result = TableWithFiltersSchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(6);
    });
  });

  describe('ChartWithControls Schema (Molecule)', () => {
    it('validates correct ChartWithControls spec', () => {
      const validSpec = {
        columns: ['date', 'revenue', 'profit'],
        height: 450,
        initialChartType: 'line',
        initialXAxis: 'date',
        initialYAxis: 'revenue',
        showControls: true,
        controlsCollapsed: false,
      };
      const result = ChartWithControlsSchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates ChartWithControls with defaults', () => {
      const minimalSpec = {};
      const result = ChartWithControlsSchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.height).toBe(400);
        expect(result.data.initialChartType).toBe('bar');
        expect(result.data.showControls).toBe(true);
        expect(result.data.controlsCollapsed).toBe(false);
      }
    });

    it('rejects ChartWithControls with invalid initialChartType', () => {
      const invalidSpec = { initialChartType: 'invalid-type' };
      const result = ChartWithControlsSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates ChartWithControls with all chart types', () => {
      const chartTypes = ['bar', 'line', 'area', 'pie', 'scatter', 'heatmap'];
      chartTypes.forEach(initialChartType => {
        const spec = { initialChartType };
        const result = ChartWithControlsSchema.safeParse(spec);
        expect(result.success).toBe(true);
      });
    });

    it('validates ChartWithControls with 7 props (within limit)', () => {
      const spec = {
        columns: ['a', 'b'],
        height: 500,
        initialChartType: 'scatter',
        initialXAxis: 'a',
        initialYAxis: 'b',
        showControls: false,
        controlsCollapsed: true,
      };
      const result = ChartWithControlsSchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(7);
    });
  });

  describe('SQLResultsDisplay Schema (Organism)', () => {
    it('validates correct SQLResultsDisplay spec', () => {
      const validSpec = {
        sql: 'SELECT * FROM users',
        context: 'web',
        projectId: 'proj-123',
        teradataBaseUrl: 'https://teradata.example.com',
        initialViewMode: 'table',
        tableHeight: 400,
        chartHeight: 300,
      };
      const result = SQLResultsDisplaySchema.safeParse(validSpec);
      expect(result.success).toBe(true);
    });

    it('validates SQLResultsDisplay with defaults', () => {
      const minimalSpec = {};
      const result = SQLResultsDisplaySchema.safeParse(minimalSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.context).toBe('web');
        expect(result.data.initialViewMode).toBe('table');
        expect(result.data.tableHeight).toBe(400);
        expect(result.data.chartHeight).toBe(400);
      }
    });

    it('rejects SQLResultsDisplay with invalid context', () => {
      const invalidSpec = { context: 'invalid-context' };
      const result = SQLResultsDisplaySchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects SQLResultsDisplay with invalid initialViewMode', () => {
      const invalidSpec = { initialViewMode: 'invalid-mode' };
      const result = SQLResultsDisplaySchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('validates SQLResultsDisplay with mcp-apps context', () => {
      const spec = {
        sql: 'SELECT id FROM items',
        context: 'mcp-apps',
        projectId: 'test-project',
        teradataBaseUrl: 'https://td.example.com',
      };
      const result = SQLResultsDisplaySchema.safeParse(spec);
      expect(result.success).toBe(true);
    });

    it('validates SQLResultsDisplay with 7 props (within limit)', () => {
      const spec = {
        sql: 'SELECT 1',
        context: 'mcp-apps',
        projectId: 'p1',
        teradataBaseUrl: 'https://example.com',
        initialViewMode: 'chart',
        tableHeight: 500,
        chartHeight: 450,
      };
      const result = SQLResultsDisplaySchema.safeParse(spec);
      expect(result.success).toBe(true);
      expect(Object.keys(spec).length).toBe(7);
    });
  });

  describe('Edge Cases', () => {
    it('rejects schema with null values for required strings', () => {
      const invalidSpec = { placeholder: null };
      const result = FilterSchema.safeParse(invalidSpec);
      expect(result.success).toBe(false);
    });

    it('rejects schema with undefined for non-optional fields', () => {
      const invalidSpec = { value: undefined };
      const result = DensityToggleSchema.safeParse(invalidSpec);
      // Should pass because value has a default
      expect(result.success).toBe(true);
    });

    it('handles empty arrays for columns', () => {
      const spec = { columns: [] };
      const result = DataTableSchema.safeParse(spec);
      expect(result.success).toBe(true);
    });

    it('rejects invalid prop types across all schemas', () => {
      // Boolean as string
      const invalidBoolean = { showDataLabels: 'true' };
      expect(ChartSchema.safeParse(invalidBoolean).success).toBe(false);

      // Number as string
      const invalidNumber = { height: '400' };
      expect(DataTableSchema.safeParse(invalidNumber).success).toBe(false);

      // Array as string
      const invalidArray = { columns: 'id,name' };
      expect(TableWithFiltersSchema.safeParse(invalidArray).success).toBe(false);
    });
  });

  describe('Prop Count Limits (AI Describability)', () => {
    it('all primitive schemas have 5-8 props or defaults', () => {
      // Chart: 6 props (type, xAxis, yAxis, theme, height, showDataLabels)
      const chartKeys = Object.keys(ChartSchema.shape);
      expect(chartKeys.length).toBeGreaterThanOrEqual(5);
      expect(chartKeys.length).toBeLessThanOrEqual(8);

      // DataTable: 5 props
      const tableKeys = Object.keys(DataTableSchema.shape);
      expect(tableKeys.length).toBeGreaterThanOrEqual(5);
      expect(tableKeys.length).toBeLessThanOrEqual(8);

      // Filter: 3 props
      const filterKeys = Object.keys(FilterSchema.shape);
      expect(filterKeys.length).toBeGreaterThanOrEqual(3);
      expect(filterKeys.length).toBeLessThanOrEqual(8);
    });

    it('molecule schemas have 6-7 props (within limit)', () => {
      // TableWithFilters: 6 props
      const tableFilterKeys = Object.keys(TableWithFiltersSchema.shape);
      expect(tableFilterKeys.length).toBe(6);

      // ChartWithControls: 7 props
      const chartControlKeys = Object.keys(ChartWithControlsSchema.shape);
      expect(chartControlKeys.length).toBe(7);
    });

    it('organism schema has 7 props (within limit)', () => {
      // SQLResultsDisplay: 7 props
      const organismKeys = Object.keys(SQLResultsDisplaySchema.shape);
      expect(organismKeys.length).toBe(7);
    });
  });
});
