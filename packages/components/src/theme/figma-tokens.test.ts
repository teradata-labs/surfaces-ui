import { describe, it, expect } from 'vitest';
import {
  rgbToHsl,
  parseColorToHsl,
  parseFigmaColorToHsl,
  mapFigmaTokensToSurfaces,
  mapFigmaVariablesToSurfaces,
  generateSurfacesCSS,
  mergeSurfacesTokens,
  type FigmaTokens,
  type FigmaVariable,
  type SurfacesTokens,
} from './figma-tokens';

describe('rgbToHsl', () => {
  it('converts white to HSL', () => {
    expect(rgbToHsl(255, 255, 255)).toBe('0 0% 100%');
  });

  it('converts black to HSL', () => {
    expect(rgbToHsl(0, 0, 0)).toBe('0 0% 0%');
  });

  it('converts blue to HSL', () => {
    const result = rgbToHsl(0, 0, 255);
    expect(result).toMatch(/^240 100% 50%$/);
  });

  it('handles 0-1 range', () => {
    expect(rgbToHsl(1, 1, 1)).toBe('0 0% 100%');
  });
});

describe('parseColorToHsl', () => {
  it('parses hex colors', () => {
    expect(parseColorToHsl('#ffffff')).toBe('0 0% 100%');
    expect(parseColorToHsl('#000000')).toBe('0 0% 0%');
  });

  it('parses rgb colors', () => {
    expect(parseColorToHsl('rgb(255, 255, 255)')).toBe('0 0% 100%');
    expect(parseColorToHsl('rgb(0, 0, 0)')).toBe('0 0% 0%');
  });

  it('parses rgba colors', () => {
    expect(parseColorToHsl('rgba(255, 255, 255, 1)')).toBe('0 0% 100%');
  });

  it('parses hsl colors', () => {
    expect(parseColorToHsl('hsl(0, 0%, 100%)')).toBe('0 0% 100%');
    expect(parseColorToHsl('hsl(240, 100%, 50%)')).toBe('240 100% 50%');
  });

  it('returns already formatted HSL', () => {
    expect(parseColorToHsl('0 0% 100%')).toBe('0 0% 100%');
  });

  it('throws on unsupported format', () => {
    expect(() => parseColorToHsl('invalid')).toThrow();
  });
});

describe('parseFigmaColorToHsl', () => {
  it('converts Figma color object', () => {
    expect(parseFigmaColorToHsl({ r: 1, g: 1, b: 1 })).toBe('0 0% 100%');
    expect(parseFigmaColorToHsl({ r: 0, g: 0, b: 0 })).toBe('0 0% 0%');
  });

  it('handles 0-255 range', () => {
    expect(parseFigmaColorToHsl({ r: 255, g: 255, b: 255 })).toBe('0 0% 100%');
  });
});

describe('mapFigmaTokensToSurfaces', () => {
  it('maps basic color tokens', () => {
    const figmaTokens: FigmaTokens = {
      colors: {
        background: { $value: '#ffffff', $type: 'color' },
        foreground: { $value: '#0f172a', $type: 'color' },
        primary: { $value: '#1e293b', $type: 'color' },
      },
    };

    const result = mapFigmaTokensToSurfaces(figmaTokens);

    expect(result.root.background).toBe('0 0% 100%');
    expect(result.root.foreground).toMatch(/^\d+ \d+% \d+%$/);
    expect(result.root.primary).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('maps dark mode tokens', () => {
    const figmaTokens: FigmaTokens = {
      colors: {
        background: { $value: '#ffffff', $type: 'color' },
        dark: {
          background: { $value: '#0f172a', $type: 'color' },
        },
      },
    };

    const result = mapFigmaTokensToSurfaces(figmaTokens);

    expect(result.root.background).toBe('0 0% 100%');
    expect(result.dark.background).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('handles custom color paths', () => {
    const figmaTokens: FigmaTokens = {
      theme: {
        semantic: {
          background: { $value: '#ffffff', $type: 'color' },
        },
      },
    };

    const result = mapFigmaTokensToSurfaces(figmaTokens, {
      colorPath: ['theme', 'semantic'],
    });

    expect(result.root.background).toBe('0 0% 100%');
  });

  it('applies semantic mapping', () => {
    const figmaTokens: FigmaTokens = {
      colors: {
        'bg-primary': { $value: '#ffffff', $type: 'color' },
      },
    };

    const result = mapFigmaTokensToSurfaces(figmaTokens, {
      semanticMapping: { 'bg-primary': 'background' },
    });

    expect(result.root.background).toBe('0 0% 100%');
  });

  it('normalizes token names', () => {
    const figmaTokens: FigmaTokens = {
      colors: {
        'Primary Color': { $value: '#1e293b', $type: 'color' },
        secondary_color: { $value: '#64748b', $type: 'color' },
      },
    };

    const result = mapFigmaTokensToSurfaces(figmaTokens);

    expect(result.root['primary-color']).toMatch(/^\d+ \d+% \d+%$/);
    expect(result.root['secondary-color']).toMatch(/^\d+ \d+% \d+%$/);
  });
});

describe('mapFigmaVariablesToSurfaces', () => {
  it('maps Figma variables', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'colors/background',
        resolvedType: 'COLOR',
        valuesByMode: {
          light: '#ffffff',
          dark: '#0f172a',
        },
      },
      {
        id: '2',
        name: 'colors/primary',
        resolvedType: 'COLOR',
        valuesByMode: {
          light: '#1e293b',
        },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables);

    expect(result.root.background).toBe('0 0% 100%');
    expect(result.dark.background).toMatch(/^\d+ \d+% \d+%$/);
    expect(result.root.primary).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('handles custom mode IDs', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'colors/background',
        resolvedType: 'COLOR',
        valuesByMode: {
          '123': '#ffffff',
          '456': '#0f172a',
        },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables, {
      lightModeId: '123',
      darkModeId: '456',
    });

    expect(result.root.background).toBe('0 0% 100%');
    expect(result.dark.background).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('skips non-color variables by default', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'spacing/md',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 16 },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables);

    expect(Object.keys(result.root)).toHaveLength(0);
    expect(result.components).toBeUndefined();
  });

  it('includes FLOAT variables when includeFloats is true', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'components/button-height',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 36 },
      },
      {
        id: '2',
        name: 'components/chip-height',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 32 },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables, { includeFloats: true });

    expect(result.components).toBeDefined();
    expect(result.components!['button-height']).toBe('36px');
    expect(result.components!['chip-height']).toBe('32px');
  });

  it('applies custom float unit', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'spacing/md',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 1 },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables, {
      includeFloats: true,
      floatUnit: 'rem',
    });

    expect(result.components!['md']).toBe('1rem');
  });

  it('applies custom float mapping', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'components/button-height',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 36 },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables, {
      includeFloats: true,
      floatMapping: { 'button-height': 'su-button-height' },
    });

    expect(result.components!['su-button-height']).toBe('36px');
  });

  it('handles mixed COLOR and FLOAT variables', () => {
    const variables: FigmaVariable[] = [
      {
        id: '1',
        name: 'colors/primary',
        resolvedType: 'COLOR',
        valuesByMode: { light: '#3053f4' },
      },
      {
        id: '2',
        name: 'components/button-height',
        resolvedType: 'FLOAT',
        valuesByMode: { light: 36 },
      },
    ];

    const result = mapFigmaVariablesToSurfaces(variables, { includeFloats: true });

    expect(result.root.primary).toMatch(/^\d+ \d+% \d+%$/);
    expect(result.components!['button-height']).toBe('36px');
  });
});

describe('generateSurfacesCSS', () => {
  it('generates CSS for root tokens', () => {
    const tokens: SurfacesTokens = {
      root: {
        background: '0 0% 100%',
        foreground: '222 84% 5%',
      },
      dark: {},
    };

    const css = generateSurfacesCSS(tokens);

    expect(css).toContain(':root {');
    expect(css).toContain('--background: 0 0% 100%;');
    expect(css).toContain('--foreground: 222 84% 5%;');
  });

  it('generates CSS for component tokens', () => {
    const tokens: SurfacesTokens = {
      root: {},
      dark: {},
      components: {
        'su-button-height': '36px',
        'su-chip-height': '32px',
      },
    };

    const css = generateSurfacesCSS(tokens);

    expect(css).toContain('/* Component tokens */');
    expect(css).toContain('--su-button-height: 36px;');
    expect(css).toContain('--su-chip-height: 32px;');
  });

  it('generates CSS for elevation tokens', () => {
    const tokens: SurfacesTokens = {
      root: {},
      dark: {},
      elevation: {
        'elevation-1': '0 1px 3px rgba(0,0,0,0.15)',
      },
    };

    const css = generateSurfacesCSS(tokens);

    expect(css).toContain('/* Elevation tokens */');
    expect(css).toContain('--elevation-1: 0 1px 3px rgba(0,0,0,0.15);');
  });

  it('generates CSS for dark tokens', () => {
    const tokens: SurfacesTokens = {
      root: {
        background: '0 0% 100%',
      },
      dark: {
        background: '222 84% 5%',
      },
    };

    const css = generateSurfacesCSS(tokens);

    expect(css).toContain('.dark {');
    expect(css).toContain('--background: 222 84% 5%;');
  });
});

describe('mergeSurfacesTokens', () => {
  it('merges tokens with existing taking precedence', () => {
    const existing: SurfacesTokens = {
      root: { background: '0 0% 100%' },
      dark: {},
    };

    const figma: SurfacesTokens = {
      root: { background: '222 84% 5%', foreground: '0 0% 0%' },
      dark: {},
    };

    const result = mergeSurfacesTokens(existing, figma);

    expect(result.root.background).toBe('0 0% 100%'); // Existing wins
    expect(result.root.foreground).toBe('0 0% 0%'); // New added
  });

  it('merges with override', () => {
    const existing: SurfacesTokens = {
      root: { background: '0 0% 100%' },
      dark: {},
    };

    const figma: SurfacesTokens = {
      root: { background: '222 84% 5%' },
      dark: {},
    };

    const result = mergeSurfacesTokens(existing, figma, true);

    expect(result.root.background).toBe('222 84% 5%'); // Figma wins
  });
});
