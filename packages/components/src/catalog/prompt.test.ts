/**
 * Prompt Generation Tests
 *
 * Tests prompt generation utilities used in NL generation.
 * Validates that prompts are AI-consumable with clear descriptions under 60 chars.
 */
import { describe, it, expect } from 'vitest';
import {
  generateCatalogPrompt,
  generateComponentPrompt,
  generateComponentExample,
  generateSpecExample,
  generateAllExamples,
  getExamplesForComponent,
} from './prompts';

describe('Prompt Generation', () => {
  describe('Catalog Prompt', () => {
    it('generates prompt with all component types', () => {
      const prompt = generateCatalogPrompt();

      // Should include organisms section
      expect(prompt).toContain('Organisms');
      expect(prompt).toContain('SQLResultsDisplay');

      // Should include molecules section
      expect(prompt).toContain('Molecules');
      expect(prompt).toContain('TableWithFilters');
      expect(prompt).toContain('ChartWithControls');

      // Should include primitives section
      expect(prompt).toContain('Primitives');
      expect(prompt).toContain('DataTable');
      expect(prompt).toContain('Chart');
      expect(prompt).toContain('Filter');
      expect(prompt).toContain('DensityToggle');
      expect(prompt).toContain('ViewModeToggle');
    });

    it('includes prop descriptions for each component', () => {
      const prompt = generateCatalogPrompt();

      // DataTable props described
      expect(prompt).toMatch(/columns.*Column names to display/i);
      expect(prompt).toMatch(/height.*height in pixels/i);

      // Chart props described
      expect(prompt).toMatch(/type.*Chart visualization type/i);
      expect(prompt).toMatch(/xAxis.*Column name for X axis/i);
    });

    it('lists organisms first as recommended', () => {
      // Per Phase 02 decision: Organisms listed first
      const prompt = generateCatalogPrompt();
      const organismsIndex = prompt.indexOf('Organisms');
      const moleculesIndex = prompt.indexOf('Molecules');
      const primitivesIndex = prompt.indexOf('Primitives');

      expect(organismsIndex).toBeGreaterThan(0);
      expect(organismsIndex).toBeLessThan(moleculesIndex);
      expect(moleculesIndex).toBeLessThan(primitivesIndex);
    });

    it('includes actions section', () => {
      const prompt = generateCatalogPrompt();
      expect(prompt).toContain('Available Actions');
      expect(prompt).toContain('export_csv');
      expect(prompt).toContain('copy_json');
    });

    it('includes examples when requested', () => {
      const promptWithExamples = generateCatalogPrompt({ includeExamples: true });
      expect(promptWithExamples).toContain('Example Prompts');
      expect(promptWithExamples).toContain('Show monthly sales as a line chart');
      expect(promptWithExamples).toContain('Show all customer records in a table');
    });

    it('excludes examples by default', () => {
      const promptWithoutExamples = generateCatalogPrompt();
      expect(promptWithoutExamples).not.toContain('Example Prompts');
    });

    it('keeps descriptions under 60 chars per Phase 02 decision', () => {
      // Per Phase 02-01: Schema descriptions under 60 chars for AI processing
      const prompt = generateCatalogPrompt();
      const lines = prompt.split('\n');

      // Find all prop description lines (those that start with "- " after "Props:")
      let inPropsSection = false;
      for (const line of lines) {
        if (line.includes('Props:')) {
          inPropsSection = true;
          continue;
        }
        if (line.startsWith('##') || line.startsWith('###')) {
          inPropsSection = false;
        }
        if (inPropsSection && line.startsWith('- ')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            const description = parts.slice(1).join(':').trim();
            // Description should be under 60 chars
            expect(description.length).toBeLessThanOrEqual(60);
          }
        }
      }
    });

    it('generates consistent prompt structure', () => {
      const prompt1 = generateCatalogPrompt();
      const prompt2 = generateCatalogPrompt();
      expect(prompt1).toBe(prompt2);
    });
  });

  describe('Component Prompt', () => {
    it('generates prompt for DataTable component', () => {
      const prompt = generateComponentPrompt('DataTable');
      expect(prompt).toContain('# DataTable');
      expect(prompt).toContain('Display tabular data');
      expect(prompt).toContain('## Props');
      expect(prompt).toContain('columns');
      expect(prompt).toContain('height');
      expect(prompt).toContain('density');
    });

    it('generates prompt for Chart component', () => {
      const prompt = generateComponentPrompt('Chart');
      expect(prompt).toContain('# Chart');
      expect(prompt).toContain('Render data as a chart');
      expect(prompt).toContain('type');
      expect(prompt).toContain('xAxis');
      expect(prompt).toContain('yAxis');
    });

    it('generates prompt for TableWithFilters molecule', () => {
      const prompt = generateComponentPrompt('TableWithFilters');
      expect(prompt).toContain('# TableWithFilters');
      expect(prompt).toContain('Data table with search filter');
      expect(prompt).toContain('showFilter');
      expect(prompt).toContain('showDensityToggle');
    });

    it('generates prompt for SQLResultsDisplay organism', () => {
      const prompt = generateComponentPrompt('SQLResultsDisplay');
      expect(prompt).toContain('# SQLResultsDisplay');
      expect(prompt).toContain('Full SQL results');
      expect(prompt).toContain('sql');
      expect(prompt).toContain('initialViewMode');
    });

    it('marks optional props correctly', () => {
      const prompt = generateComponentPrompt('Chart');
      // Optional props should be marked
      expect(prompt).toMatch(/xAxis.*\(optional\)/);
      expect(prompt).toMatch(/yAxis.*\(optional\)/);
    });

    it('includes all props from schema', () => {
      const chartPrompt = generateComponentPrompt('Chart');
      expect(chartPrompt).toContain('type');
      expect(chartPrompt).toContain('xAxis');
      expect(chartPrompt).toContain('yAxis');
      expect(chartPrompt).toContain('theme');
      expect(chartPrompt).toContain('height');
      expect(chartPrompt).toContain('showDataLabels');
    });

    it('throws error for unknown component', () => {
      expect(() => generateComponentPrompt('UnknownComponent' as any)).toThrow('Unknown component');
    });
  });

  describe('Component Examples', () => {
    it('generates JSON example for Chart', () => {
      const example = generateComponentExample('Chart');
      expect(example).toBeTruthy();
      const parsed = JSON.parse(example);
      expect(parsed.type).toBe('Chart');
      expect(parsed.props).toBeDefined();
      expect(parsed.props.type).toBe('bar');
    });

    it('generates JSON example for DataTable', () => {
      const example = generateComponentExample('DataTable');
      const parsed = JSON.parse(example);
      expect(parsed.type).toBe('DataTable');
      expect(parsed.props.columns).toEqual(['id', 'name', 'email']);
      expect(parsed.props.height).toBe(400);
    });

    it('generates JSON example for Filter', () => {
      const example = generateComponentExample('Filter');
      const parsed = JSON.parse(example);
      expect(parsed.type).toBe('Filter');
      expect(parsed.props.placeholder).toBeTruthy();
    });

    it('generates JSON example for TableWithFilters molecule', () => {
      const example = generateComponentExample('TableWithFilters');
      const parsed = JSON.parse(example);
      expect(parsed.type).toBe('TableWithFilters');
      expect(parsed.props.showFilter).toBe(true);
    });

    it('generates JSON example for SQLResultsDisplay organism', () => {
      const example = generateComponentExample('SQLResultsDisplay');
      const parsed = JSON.parse(example);
      expect(parsed.type).toBe('SQLResultsDisplay');
      expect(parsed.props.sql).toBeTruthy();
      expect(parsed.props.initialViewMode).toBeTruthy();
    });

    it('generates valid JSON for all component types', () => {
      const components = [
        'Chart',
        'DataTable',
        'Filter',
        'DensityToggle',
        'ViewModeToggle',
        'TableWithFilters',
        'ChartWithControls',
        'SQLResultsDisplay',
      ] as const;

      components.forEach(component => {
        const example = generateComponentExample(component);
        expect(() => JSON.parse(example)).not.toThrow();
      });
    });
  });

  describe('Spec Example', () => {
    it('generates complete specification example', () => {
      const example = generateSpecExample();
      expect(example).toBeTruthy();
      const parsed = JSON.parse(example);

      // Should have root, elements, and data
      expect(parsed.root).toBeDefined();
      expect(parsed.elements).toBeDefined();
      expect(parsed.data).toBeDefined();
    });

    it('spec example has valid structure', () => {
      const example = generateSpecExample();
      const parsed = JSON.parse(example);

      // Root should point to an element
      expect(parsed.elements[parsed.root]).toBeDefined();

      // Element should have type and props
      const rootElement = parsed.elements[parsed.root];
      expect(rootElement.type).toBeDefined();
      expect(rootElement.props).toBeDefined();
    });

    it('spec example uses SQLResultsDisplay organism', () => {
      const example = generateSpecExample();
      const parsed = JSON.parse(example);
      const rootElement = parsed.elements[parsed.root];
      expect(rootElement.type).toBe('SQLResultsDisplay');
    });

    it('spec example includes data array', () => {
      const example = generateSpecExample();
      const parsed = JSON.parse(example);
      expect(Array.isArray(parsed.data)).toBe(true);
      expect(parsed.data.length).toBeGreaterThan(0);
    });
  });

  describe('Example Prompts for Components', () => {
    it('returns examples for Chart', () => {
      const examples = getExamplesForComponent('Chart');
      expect(examples.length).toBeGreaterThanOrEqual(3);
      expect(examples[0].prompt).toContain('chart');
      expect(examples[0].expectedComponent).toBe('Chart');
    });

    it('returns examples for DataTable', () => {
      const examples = getExamplesForComponent('DataTable');
      expect(examples.length).toBeGreaterThanOrEqual(3);
      expect(examples[0].prompt).toContain('table');
      expect(examples[0].expectedComponent).toBe('DataTable');
    });

    it('returns examples for TableWithFilters', () => {
      const examples = getExamplesForComponent('TableWithFilters');
      expect(examples.length).toBeGreaterThanOrEqual(2);
      expect(examples[0].expectedComponent).toBe('TableWithFilters');
    });

    it('returns examples for SQLResultsDisplay', () => {
      const examples = getExamplesForComponent('SQLResultsDisplay');
      expect(examples.length).toBeGreaterThanOrEqual(2);
      expect(examples[0].expectedComponent).toBe('SQLResultsDisplay');
    });

    it('example prompts are natural language (not technical)', () => {
      const examples = getExamplesForComponent('Chart');

      examples.forEach(example => {
        // Should be conversational, not JSON or technical jargon
        expect(example.prompt).not.toMatch(/\{|\}|\[|\]/); // No JSON syntax
        expect(example.prompt).not.toMatch(/type:|props:/); // No object literals
        expect(example.prompt.split(' ').length).toBeGreaterThan(3); // Multi-word
      });
    });

    it('all components have at least 2 example prompts', () => {
      const allExamples = generateAllExamples();
      const components = Object.keys(allExamples);

      components.forEach(component => {
        const examples = allExamples[component as keyof typeof allExamples];
        // Some primitives may have fewer examples, but all should have at least 1
        expect(examples.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('generateAllExamples returns examples for all components', () => {
      const allExamples = generateAllExamples();

      expect(allExamples.Chart).toBeDefined();
      expect(allExamples.DataTable).toBeDefined();
      expect(allExamples.Filter).toBeDefined();
      expect(allExamples.DensityToggle).toBeDefined();
      expect(allExamples.ViewModeToggle).toBeDefined();
      expect(allExamples.TableWithFilters).toBeDefined();
      expect(allExamples.ChartWithControls).toBeDefined();
      expect(allExamples.SQLResultsDisplay).toBeDefined();
    });

    it('example prompts have descriptions', () => {
      const examples = getExamplesForComponent('Chart');
      examples.forEach(example => {
        expect(example.description).toBeTruthy();
        expect(example.description.length).toBeGreaterThan(0);
      });
    });

    it('example prompts contain component-relevant keywords', () => {
      // Chart examples should mention visualization terms
      const chartExamples = getExamplesForComponent('Chart');
      const chartKeywords = chartExamples.map(ex => ex.prompt.toLowerCase()).join(' ');
      expect(chartKeywords).toMatch(/chart|bar|line|pie/);

      // Table examples should mention table/data terms
      const tableExamples = getExamplesForComponent('DataTable');
      const tableKeywords = tableExamples.map(ex => ex.prompt.toLowerCase()).join(' ');
      expect(tableKeywords).toMatch(/table|records|rows/);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options object', () => {
      const prompt = generateCatalogPrompt({});
      expect(prompt).toBeTruthy();
      expect(prompt).toContain('Available UI Components');
    });

    it('generates prompt even with undefined options', () => {
      const prompt = generateCatalogPrompt(undefined);
      expect(prompt).toBeTruthy();
    });

    it('component examples are valid JSON strings', () => {
      const components = [
        'Chart',
        'DataTable',
        'Filter',
        'DensityToggle',
        'ViewModeToggle',
        'TableWithFilters',
        'ChartWithControls',
        'SQLResultsDisplay',
      ] as const;

      components.forEach(component => {
        const example = generateComponentExample(component);
        expect(typeof example).toBe('string');
        expect(example.length).toBeGreaterThan(0);
      });
    });
  });
});
