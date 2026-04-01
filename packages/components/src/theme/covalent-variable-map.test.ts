import { describe, it, expect } from 'vitest';
import {
  COLOR_VARIABLE_MAP,
  COMPONENT_VARIABLE_MAP,
  TYPOGRAPHY_VARIABLE_MAP,
  ELEVATION_MAP,
  resolveColorVariable,
  resolveComponentVariable,
  getAllMappings,
} from './covalent-variable-map';

describe('COLOR_VARIABLE_MAP', () => {
  it('maps core semantic colors', () => {
    expect(COLOR_VARIABLE_MAP['cv-theme-primary']).toBe('primary');
    expect(COLOR_VARIABLE_MAP['cv-theme-on-primary']).toBe('primary-foreground');
    expect(COLOR_VARIABLE_MAP['cv-theme-background']).toBe('background');
    expect(COLOR_VARIABLE_MAP['cv-theme-on-surface']).toBe('foreground');
  });

  it('maps status colors', () => {
    expect(COLOR_VARIABLE_MAP['cv-theme-negative']).toBe('destructive');
    expect(COLOR_VARIABLE_MAP['cv-theme-positive']).toBe('success');
    expect(COLOR_VARIABLE_MAP['cv-theme-caution']).toBe('warning');
  });

  it('maps container colors', () => {
    expect(COLOR_VARIABLE_MAP['cv-theme-primary-container']).toBe('primary-container');
    expect(COLOR_VARIABLE_MAP['cv-theme-negative-container']).toBe('negative-container');
    expect(COLOR_VARIABLE_MAP['cv-theme-positive-container']).toBe('positive-container');
  });

  it('maps surface variants', () => {
    expect(COLOR_VARIABLE_MAP['cv-theme-surface-container']).toBe('surface-container');
    expect(COLOR_VARIABLE_MAP['cv-theme-surface-dim']).toBe('surface-dim');
  });

  it('maps state layer opacity tokens', () => {
    expect(COLOR_VARIABLE_MAP['cv-theme-primary-8']).toBe('primary-8');
    expect(COLOR_VARIABLE_MAP['cv-theme-on-surface-12']).toBe('on-surface-12');
  });

  it('uses SurfacesUI naming (no cv- prefix)', () => {
    for (const surfaces of Object.values(COLOR_VARIABLE_MAP)) {
      expect(surfaces).not.toMatch(/^cv-/);
    }
  });
});

describe('COMPONENT_VARIABLE_MAP', () => {
  it('maps button dimensions', () => {
    expect(COMPONENT_VARIABLE_MAP['cv/button-height']).toEqual({
      surfaces: 'su-button-height',
      unit: 'px',
    });
  });

  it('maps chip dimensions', () => {
    expect(COMPONENT_VARIABLE_MAP['cv/chip-height']).toEqual({
      surfaces: 'su-chip-height',
      unit: 'px',
    });
  });

  it('maps shape/radius tokens', () => {
    expect(COMPONENT_VARIABLE_MAP['cv/shape-small']).toEqual({
      surfaces: 'su-radius-sm',
      unit: 'px',
    });
  });

  it('all entries have su- prefix', () => {
    for (const { surfaces } of Object.values(COMPONENT_VARIABLE_MAP)) {
      expect(surfaces).toMatch(/^su-/);
    }
  });

  it('all entries have a unit', () => {
    for (const { unit } of Object.values(COMPONENT_VARIABLE_MAP)) {
      expect(unit).toBeTruthy();
    }
  });
});

describe('TYPOGRAPHY_VARIABLE_MAP', () => {
  it('maps all 13 typography scales', () => {
    expect(Object.keys(TYPOGRAPHY_VARIABLE_MAP)).toHaveLength(13);
  });

  it('includes headline scales 1-6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(TYPOGRAPHY_VARIABLE_MAP[`headline-${i}`]).toBeDefined();
    }
  });

  it('includes body, caption, overline, button', () => {
    expect(TYPOGRAPHY_VARIABLE_MAP['body-1']).toBeDefined();
    expect(TYPOGRAPHY_VARIABLE_MAP['body-2']).toBeDefined();
    expect(TYPOGRAPHY_VARIABLE_MAP['caption']).toBeDefined();
    expect(TYPOGRAPHY_VARIABLE_MAP['overline']).toBeDefined();
    expect(TYPOGRAPHY_VARIABLE_MAP['button']).toBeDefined();
  });

  it('each scale has all typography properties', () => {
    for (const scale of Object.values(TYPOGRAPHY_VARIABLE_MAP)) {
      expect(scale.surfaces).toBeTruthy();
      expect(scale.fontSize).toBeTruthy();
      expect(scale.lineHeight).toBeTruthy();
      expect(scale.fontWeight).toBeTruthy();
      expect(scale.letterSpacing).toBeTruthy();
      expect(scale.fontFamily).toBeTruthy();
    }
  });
});

describe('ELEVATION_MAP', () => {
  it('defines 4 elevation levels', () => {
    expect(Object.keys(ELEVATION_MAP)).toHaveLength(4);
  });

  it('values are valid box-shadow CSS', () => {
    for (const value of Object.values(ELEVATION_MAP)) {
      expect(value).toMatch(/rgba\(/);
      expect(value).toContain(',');
    }
  });
});

describe('resolveColorVariable', () => {
  it('resolves plain variable name', () => {
    expect(resolveColorVariable('cv-theme-primary')).toBe('primary');
  });

  it('resolves var() wrapped variable', () => {
    expect(resolveColorVariable('var(--cv-theme-primary)')).toBe('primary');
  });

  it('resolves --prefixed variable', () => {
    expect(resolveColorVariable('--cv-theme-primary')).toBe('primary');
  });

  it('returns undefined for unknown variables', () => {
    expect(resolveColorVariable('cv-theme-unknown')).toBeUndefined();
  });
});

describe('resolveComponentVariable', () => {
  it('resolves component variable', () => {
    const result = resolveComponentVariable('cv/button-height');
    expect(result).toEqual({ surfaces: 'su-button-height', unit: 'px' });
  });

  it('returns undefined for unknown variables', () => {
    expect(resolveComponentVariable('cv/unknown')).toBeUndefined();
  });
});

describe('getAllMappings', () => {
  it('returns flat list of all mappings', () => {
    const mappings = getAllMappings();
    expect(mappings.length).toBeGreaterThan(0);
  });

  it('includes color, component, typography, and elevation categories', () => {
    const mappings = getAllMappings();
    const categories = new Set(mappings.map(m => m.category));
    expect(categories.has('color')).toBe(true);
    expect(categories.has('component')).toBe(true);
    expect(categories.has('typography')).toBe(true);
    expect(categories.has('elevation')).toBe(true);
  });

  it('every mapping has figma and surfaces fields', () => {
    const mappings = getAllMappings();
    for (const m of mappings) {
      expect(m.figma).toBeTruthy();
      expect(m.surfaces).toBeTruthy();
      expect(m.category).toBeTruthy();
    }
  });
});
