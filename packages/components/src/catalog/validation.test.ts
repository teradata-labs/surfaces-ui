/**
 * Validation Layer Tests
 *
 * Tests the validation layer that catches malformed specs before render.
 * Validates error messages are actionable and provide clear guidance for fixing specs.
 */
import { describe, it, expect } from 'vitest';
import {
  validateGeneratedSpec,
  attemptAutoFix,
  getKnownComponentTypes,
} from './validation';

describe('Spec Validation', () => {
  describe('Valid Specs', () => {
    it('validates DataTable spec with all required props', () => {
      const spec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: ['id', 'name'], height: 400 },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates Chart spec with minimal props', () => {
      const spec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            props: { type: 'bar' },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
      expect(result.spec).toBeDefined();
    });

    it('validates Filter spec', () => {
      const spec = {
        root: 'filter',
        elements: {
          filter: {
            type: 'Filter',
            props: { placeholder: 'Search...', debounceMs: 150 },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates DensityToggle spec', () => {
      const spec = {
        root: 'density',
        elements: {
          density: {
            type: 'DensityToggle',
            props: { value: 'compact', showLabels: true },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates ViewModeToggle spec', () => {
      const spec = {
        root: 'viewMode',
        elements: {
          viewMode: {
            type: 'ViewModeToggle',
            props: { modes: ['table', 'chart'], activeMode: 'table' },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates nested molecule spec (TableWithFilters)', () => {
      const spec = {
        root: 'filteredTable',
        elements: {
          filteredTable: {
            type: 'TableWithFilters',
            props: {
              columns: ['id', 'name'],
              height: 500,
              showFilter: true,
              showDensityToggle: true,
            },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates ChartWithControls molecule', () => {
      const spec = {
        root: 'chartControl',
        elements: {
          chartControl: {
            type: 'ChartWithControls',
            props: {
              columns: ['date', 'value'],
              initialChartType: 'line',
              showControls: true,
            },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates organism spec (SQLResultsDisplay)', () => {
      const spec = {
        root: 'sqlResults',
        elements: {
          sqlResults: {
            type: 'SQLResultsDisplay',
            props: {
              sql: 'SELECT * FROM users',
              initialViewMode: 'table',
              context: 'web',
            },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates spec with data array', () => {
      const spec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: ['id'] },
          },
        },
        data: [{ id: 1 }, { id: 2 }],
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });

    it('validates spec with empty props object', () => {
      const spec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Specs', () => {
    it('rejects spec with unknown component type', () => {
      const spec = {
        root: 'unknown',
        elements: {
          unknown: {
            type: 'UnknownComponent',
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('unknown_component');
      expect(result.errors[0].message).toContain('UnknownComponent');
    });

    it('rejects spec with invalid prop types', () => {
      const spec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: 'not-an-array' }, // Should be string[]
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects spec with missing root element', () => {
      const spec = {
        root: 'nonexistent',
        elements: {
          table: {
            type: 'DataTable',
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('missing_root');
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('rejects malformed JSON structure (missing elements)', () => {
      const spec = {
        root: 'table',
        // Missing elements
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('rejects spec with invalid element structure', () => {
      const spec = {
        root: 'table',
        elements: {
          table: 'not-an-object', // Should be object with type and props
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('rejects Chart with invalid type value', () => {
      const spec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            props: { type: 'invalid-chart-type' },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('rejects DataTable with invalid density', () => {
      const spec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { density: 'ultra-dense' },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('rejects Filter with invalid debounceMs type', () => {
      const spec = {
        root: 'filter',
        elements: {
          filter: {
            type: 'Filter',
            props: { debounceMs: 'slow' }, // Should be number
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('rejects spec with null type', () => {
      const spec = {
        root: 'element',
        elements: {
          element: {
            type: null,
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('provides actionable error for unknown component type', () => {
      const spec = {
        root: 'test',
        elements: {
          test: {
            type: 'InvalidType',
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.errors[0].message).toContain('Unknown component type');
      expect(result.errors[0].expected).toBeDefined();
      expect(result.errors[0].received).toBe('InvalidType');
    });

    it('provides actionable error for wrong prop type', () => {
      const spec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: 123 }, // Should be array
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('columns');
    });

    it('includes path in error messages', () => {
      const spec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            props: { height: 'invalid' }, // Should be number
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.errors[0].path).toContain('elements.chart.props');
      expect(result.errors[0].path).toContain('height');
    });

    it('provides clear error for missing root element', () => {
      const spec = {
        root: 'missing',
        elements: {
          existing: {
            type: 'Chart',
            props: {},
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.errors[0].message).toContain('Root element "missing" not found');
    });
  });

  describe('Auto-fix', () => {
    it('fixes missing props object', () => {
      const invalidSpec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            // Missing props
          },
        },
      };

      const errors = [
        {
          path: 'elements.chart.props',
          message: 'Expected object, received undefined',
          code: 'invalid_type',
          expected: 'object',
        },
      ];

      const fixed = attemptAutoFix(invalidSpec, errors);
      expect(fixed).not.toBeNull();
      if (fixed) {
        expect(fixed.elements.chart.props).toBeDefined();
      }
    });

    it('returns null for unfixable errors (unknown component)', () => {
      const invalidSpec = {
        root: 'test',
        elements: {
          test: {
            type: 'UnknownComponent',
            props: {},
          },
        },
      };

      const errors = [
        {
          path: 'elements.test.type',
          message: 'Unknown component type',
          code: 'unknown_component',
        },
      ];

      const fixed = attemptAutoFix(invalidSpec, errors);
      expect(fixed).toBeNull();
    });

    it('returns null for non-object specs', () => {
      const invalidSpec = null;
      const errors = [];
      const fixed = attemptAutoFix(invalidSpec, errors);
      expect(fixed).toBeNull();
    });

    it('revalidates fixed spec before returning', () => {
      const invalidSpec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
          },
        },
      };

      const errors = [
        {
          path: 'elements.chart.props',
          message: 'Expected object',
          code: 'invalid_type',
          expected: 'object',
        },
      ];

      const fixed = attemptAutoFix(invalidSpec, errors);
      if (fixed) {
        // Should pass validation after fix
        const revalidated = validateGeneratedSpec(fixed);
        expect(revalidated.valid).toBe(true);
      }
    });
  });

  describe('Known Component Types', () => {
    it('returns list of all catalog component types', () => {
      const types = getKnownComponentTypes();
      expect(types).toContain('Chart');
      expect(types).toContain('DataTable');
      expect(types).toContain('Filter');
      expect(types).toContain('DensityToggle');
      expect(types).toContain('ViewModeToggle');
      expect(types).toContain('TableWithFilters');
      expect(types).toContain('ChartWithControls');
      expect(types).toContain('SQLResultsDisplay');
      expect(types.length).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('handles null spec', () => {
      const result = validateGeneratedSpec(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles undefined spec', () => {
      const result = validateGeneratedSpec(undefined);
      expect(result.valid).toBe(false);
    });

    it('handles spec with extra properties', () => {
      const spec = {
        root: 'chart',
        elements: {
          chart: {
            type: 'Chart',
            props: { type: 'bar', extraProp: 'should-be-ignored' },
          },
        },
        extraField: 'ignored',
      };
      const result = validateGeneratedSpec(spec);
      // Should still validate - Zod strips extra props by default
      expect(result.valid).toBe(true);
    });

    it('handles spec with nested invalid props', () => {
      const spec = {
        root: 'sql',
        elements: {
          sql: {
            type: 'SQLResultsDisplay',
            props: {
              sql: 'SELECT 1',
              context: 'invalid-context', // Should be 'web' or 'mcp-apps'
            },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
    });

    it('handles spec with multiple validation errors', () => {
      const spec = {
        root: 'test',
        elements: {
          test: {
            type: 'DataTable',
            props: {
              columns: 'invalid', // Should be array
              height: 'invalid', // Should be number
              density: 'invalid', // Should be enum
            },
          },
        },
      };
      const result = validateGeneratedSpec(spec);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
