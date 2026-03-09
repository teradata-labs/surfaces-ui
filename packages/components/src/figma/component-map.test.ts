import { describe, it, expect } from 'vitest';
import {
  COMPONENT_MAP,
  getComponentsByStatus,
  getComponentsByCategory,
  getComponentsByLevel,
  figmaToReact,
  reactToFigma,
  getComponentCatalog,
  type ComponentMapEntry,
} from './component-map';

describe('COMPONENT_MAP', () => {
  it('contains all 43 Figma cv-* components', () => {
    const keys = Object.keys(COMPONENT_MAP);
    expect(keys.length).toBe(43);
    keys.forEach(key => {
      expect(key).toMatch(/^cv-/);
    });
  });

  it('every entry has required fields', () => {
    for (const [key, entry] of Object.entries(COMPONENT_MAP)) {
      expect(entry.figmaName).toBe(key);
      expect(entry.react).toBeTruthy();
      expect(entry.path).toBeTruthy();
      expect(['atom', 'molecule', 'organism']).toContain(entry.level);
      expect(['implemented', 'planned', 'extend-existing']).toContain(entry.status);
      expect(['actions', 'feedback', 'layout', 'data-display', 'inputs', 'navigation', 'content']).toContain(entry.category);
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });

  it('uses PascalCase React names with no cv- prefix', () => {
    for (const entry of Object.values(COMPONENT_MAP)) {
      expect(entry.react).not.toMatch(/^cv/i);
      expect(entry.react[0]).toBe(entry.react[0].toUpperCase());
    }
  });

  it('has 43 implemented components', () => {
    const implemented = getComponentsByStatus('implemented');
    expect(implemented.length).toBe(43);
  });

  it('all implemented components have valid paths', () => {
    const implemented = getComponentsByStatus('implemented');
    for (const entry of implemented) {
      expect(entry.path).toMatch(/^(primitives|molecules|components|organisms)\//);
    }
  });
});

describe('getComponentsByStatus', () => {
  it('returns implemented components', () => {
    const result = getComponentsByStatus('implemented');
    expect(result.length).toBeGreaterThan(0);
    result.forEach(entry => {
      expect(entry.status).toBe('implemented');
    });
  });

  it('returns planned components (none remaining — all implemented)', () => {
    const result = getComponentsByStatus('planned');
    expect(result.length).toBe(0);
  });

  it('returns extend-existing components (none remaining — all implemented)', () => {
    const result = getComponentsByStatus('extend-existing');
    expect(result.length).toBe(0);
  });
});

describe('getComponentsByCategory', () => {
  it('returns action components', () => {
    const result = getComponentsByCategory('actions');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(c => c.react === 'Button')).toBe(true);
    expect(result.some(c => c.react === 'IconButton')).toBe(true);
  });

  it('returns input components', () => {
    const result = getComponentsByCategory('inputs');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(c => c.react === 'Input')).toBe(true);
    expect(result.some(c => c.react === 'Checkbox')).toBe(true);
  });

  it('covers all categories', () => {
    const categories = ['actions', 'feedback', 'layout', 'data-display', 'inputs', 'navigation', 'content'] as const;
    for (const cat of categories) {
      const result = getComponentsByCategory(cat);
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe('getComponentsByLevel', () => {
  it('returns atoms', () => {
    const atoms = getComponentsByLevel('atom');
    expect(atoms.length).toBeGreaterThan(0);
    atoms.forEach(a => expect(a.level).toBe('atom'));
  });

  it('returns molecules', () => {
    const molecules = getComponentsByLevel('molecule');
    expect(molecules.length).toBeGreaterThan(0);
    molecules.forEach(m => expect(m.level).toBe('molecule'));
  });

  it('returns organisms', () => {
    const organisms = getComponentsByLevel('organism');
    expect(organisms.length).toBeGreaterThan(0);
    organisms.forEach(o => expect(o.level).toBe('organism'));
  });
});

describe('figmaToReact', () => {
  it('maps cv-button to Button', () => {
    expect(figmaToReact('cv-button')).toBe('Button');
  });

  it('maps cv-text-field to Input', () => {
    expect(figmaToReact('cv-text-field')).toBe('Input');
  });

  it('maps cv-divider to Separator', () => {
    expect(figmaToReact('cv-divider')).toBe('Separator');
  });

  it('maps cv-linear-progress to Progress', () => {
    expect(figmaToReact('cv-linear-progress')).toBe('Progress');
  });

  it('returns undefined for unknown components', () => {
    expect(figmaToReact('cv-nonexistent')).toBeUndefined();
  });
});

describe('reactToFigma', () => {
  it('maps Button to cv-button', () => {
    expect(reactToFigma('Button')).toBe('cv-button');
  });

  it('maps Input to cv-text-field', () => {
    expect(reactToFigma('Input')).toBe('cv-text-field');
  });

  it('maps Separator to cv-divider', () => {
    expect(reactToFigma('Separator')).toBe('cv-divider');
  });

  it('returns undefined for unknown React names', () => {
    expect(reactToFigma('NonExistent')).toBeUndefined();
  });
});

describe('getComponentCatalog', () => {
  it('returns deduplicated list sorted by name', () => {
    const catalog = getComponentCatalog();
    // Should be sorted
    for (let i = 1; i < catalog.length; i++) {
      expect(catalog[i]!.name.localeCompare(catalog[i - 1]!.name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('deduplicates components mapped to same React name', () => {
    const catalog = getComponentCatalog();
    const names = catalog.map(c => c.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('marks implemented components as available', () => {
    const catalog = getComponentCatalog();
    const button = catalog.find(c => c.name === 'Button');
    expect(button?.available).toBe(true);
  });

  it('marks all components as available (all implemented)', () => {
    const catalog = getComponentCatalog();
    const unavailable = catalog.filter(c => !c.available);
    expect(unavailable.length).toBe(0);
  });

  it('includes all required fields for AI consumption', () => {
    const catalog = getComponentCatalog();
    for (const entry of catalog) {
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.level).toBeTruthy();
      expect(typeof entry.available).toBe('boolean');
    }
  });
});
