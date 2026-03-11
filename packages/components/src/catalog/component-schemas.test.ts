import { describe, it, expect } from 'vitest';
import {
  COMPONENT_SCHEMAS,
  getSchemaByName,
  getSchemasByCategory,
  getAvailableSchemas,
  generateComponentCatalogPrompt,
} from './component-schemas';

describe('COMPONENT_SCHEMAS', () => {
  it('has schemas for implemented components', () => {
    const expectedComponents = [
      // Actions
      'Button', 'IconButton', 'ActionRibbon',
      // Feedback
      'Alert', 'Dialog', 'CircularProgress', 'Progress', 'EmptyState',
      'Snackbar', 'StatusDialog', 'FullScreenDialog',
      // Layout
      'Separator', 'SideSheet', 'FocusedPage', 'OnboardingCards',
      // Data Display
      'Badge', 'FilterChip', 'ListItem', 'TreeList', 'DataTable', 'NotebookCell',
      // Inputs
      'Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup',
      'FormField', 'Switch', 'Slider',
      // Navigation
      'Tabs', 'Menu', 'Toolbar',
      // Content
      'Tooltip', 'Typography', 'Icon', 'IconLockup', 'TextLockup', 'CodeSnippet',
    ];

    for (const name of expectedComponents) {
      const schema = COMPONENT_SCHEMAS.find(s => s.name === name);
      expect(schema, `Missing schema for ${name}`).toBeDefined();
    }
  });

  it('every schema has required fields', () => {
    for (const schema of COMPONENT_SCHEMAS) {
      expect(schema.name).toBeTruthy();
      expect(schema.figmaName).toMatch(/^cv-/);
      expect(schema.description.length).toBeGreaterThan(10);
      expect(schema.category).toBeTruthy();
      expect(['atom', 'molecule', 'organism']).toContain(schema.level);
      expect(schema.props.length).toBeGreaterThan(0);
    }
  });

  it('every schema has usage guidance', () => {
    for (const schema of COMPONENT_SCHEMAS) {
      expect(schema.usage.when.length).toBeGreaterThan(0);
      expect(schema.usage.whenNot.length).toBeGreaterThan(0);
      expect(schema.usage.dos.length).toBeGreaterThan(0);
      expect(schema.usage.donts.length).toBeGreaterThan(0);
    }
  });

  it('every prop has name, type, and description', () => {
    for (const schema of COMPONENT_SCHEMAS) {
      for (const prop of schema.props) {
        expect(prop.name, `Missing name in ${schema.name} prop`).toBeTruthy();
        expect(prop.type, `Missing type for ${schema.name}.${prop.name}`).toBeTruthy();
        expect(prop.description, `Missing description for ${schema.name}.${prop.name}`).toBeTruthy();
      }
    }
  });

  it('enum props have values array', () => {
    for (const schema of COMPONENT_SCHEMAS) {
      for (const prop of schema.props) {
        if (prop.type === 'enum') {
          expect(prop.values, `${schema.name}.${prop.name} is enum but has no values`).toBeDefined();
          expect(prop.values!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('design tokens reference CSS custom properties', () => {
    for (const schema of COMPONENT_SCHEMAS) {
      if (schema.designTokens.length > 0) {
        for (const token of schema.designTokens) {
          expect(token).toMatch(/^--/);
        }
      }
    }
  });
});

describe('getSchemaByName', () => {
  it('returns schema for Button', () => {
    const schema = getSchemaByName('Button');
    expect(schema).toBeDefined();
    expect(schema!.name).toBe('Button');
    expect(schema!.figmaName).toBe('cv-button');
  });

  it('returns schema for Alert', () => {
    const schema = getSchemaByName('Alert');
    expect(schema).toBeDefined();
    expect(schema!.category).toBe('feedback');
  });

  it('returns schema for new feedback components', () => {
    expect(getSchemaByName('Snackbar')).toBeDefined();
    expect(getSchemaByName('StatusDialog')).toBeDefined();
    expect(getSchemaByName('FullScreenDialog')).toBeDefined();
  });

  it('returns schema for layout components', () => {
    expect(getSchemaByName('SideSheet')).toBeDefined();
    expect(getSchemaByName('FocusedPage')).toBeDefined();
    expect(getSchemaByName('OnboardingCards')).toBeDefined();
  });

  it('returns schema for content components', () => {
    expect(getSchemaByName('Typography')).toBeDefined();
    expect(getSchemaByName('Icon')).toBeDefined();
    expect(getSchemaByName('IconLockup')).toBeDefined();
    expect(getSchemaByName('TextLockup')).toBeDefined();
    expect(getSchemaByName('CodeSnippet')).toBeDefined();
  });

  it('returns schema for data-display components', () => {
    expect(getSchemaByName('ListItem')).toBeDefined();
    expect(getSchemaByName('TreeList')).toBeDefined();
    expect(getSchemaByName('DataTable')).toBeDefined();
    expect(getSchemaByName('NotebookCell')).toBeDefined();
  });

  it('returns schema for navigation components', () => {
    expect(getSchemaByName('Menu')).toBeDefined();
    expect(getSchemaByName('Toolbar')).toBeDefined();
  });

  it('returns schema for new input components', () => {
    expect(getSchemaByName('Slider')).toBeDefined();
  });

  it('returns undefined for unknown component', () => {
    expect(getSchemaByName('NonExistent')).toBeUndefined();
  });
});

describe('getSchemasByCategory', () => {
  it('returns action components', () => {
    const schemas = getSchemasByCategory('actions');
    expect(schemas.length).toBeGreaterThan(0);
    schemas.forEach(s => expect(s.category).toBe('actions'));
  });

  it('returns feedback components', () => {
    const schemas = getSchemasByCategory('feedback');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns input components', () => {
    const schemas = getSchemasByCategory('inputs');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns layout components', () => {
    const schemas = getSchemasByCategory('layout');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns content components', () => {
    const schemas = getSchemasByCategory('content');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns navigation components', () => {
    const schemas = getSchemasByCategory('navigation');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns data-display components', () => {
    const schemas = getSchemasByCategory('data-display');
    expect(schemas.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown category', () => {
    expect(getSchemasByCategory('nonexistent')).toEqual([]);
  });
});

describe('getAvailableSchemas', () => {
  it('returns all schemas', () => {
    const schemas = getAvailableSchemas();
    expect(schemas.length).toBe(COMPONENT_SCHEMAS.length);
  });
});

describe('generateComponentCatalogPrompt', () => {
  it('generates non-empty prompt string', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('includes component names', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('### Button');
    expect(prompt).toContain('### Alert');
    expect(prompt).toContain('### Input');
  });

  it('includes prop definitions', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('variant');
    expect(prompt).toContain('disabled');
  });

  it('includes usage guidance', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('When to use:');
    expect(prompt).toContain('When NOT to use:');
  });

  it('includes domain context', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('Domain context:');
    expect(prompt).toContain('analytics');
  });

  it('includes category headers', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('## Actions');
    expect(prompt).toContain('## Feedback');
    expect(prompt).toContain('## Inputs');
  });

  it('includes composition guidance', () => {
    const prompt = generateComponentCatalogPrompt();
    expect(prompt).toContain('Commonly composed with:');
  });
});
