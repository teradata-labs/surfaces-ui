/**
 * Figma Design Tokens Mapper
 *
 * Maps Figma design tokens (exported from Figma Variables or Tokens Studio)
 * to surfaces-ui CSS custom properties.
 *
 * Supports:
 * - Design Tokens Community Group (DTCG) format
 * - Figma Variables export format
 * - Tokens Studio format
 *
 * @see https://tr.designtokens.org/format/
 * @see https://www.figma.com/plugin-docs/api/properties/variables-variable/
 */

// ── Type Definitions ────────────────────────────────────────────────────────

/** DTCG token types */
export type FigmaTokenType =
  | 'color'
  | 'dimension'
  | 'fontFamily'
  | 'fontWeight'
  | 'duration'
  | 'cubicBezier'
  | 'number'
  | 'shadow'
  | 'gradient';

/** Single DTCG token */
export interface FigmaToken {
  $value: string | number | Record<string, unknown>;
  $type?: FigmaTokenType;
  $description?: string;
}

/** DTCG token collection */
export interface FigmaTokens {
  [key: string]: FigmaToken | FigmaTokens;
}

/** Figma Variables export format */
export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, string | number | boolean>;
  scopes?: string[];
}

/** Figma color in RGBA */
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** surfaces-ui token mapping output */
export interface SurfacesTokens {
  root: Record<string, string>;
  dark: Record<string, string>;
}

// ── Color Conversion Utilities ──────────────────────────────────────────────

/**
 * Convert RGB(A) to HSL format used by surfaces-ui
 * @param r Red (0-255 or 0-1)
 * @param g Green (0-255 or 0-1)
 * @param b Blue (0-255 or 0-1)
 * @returns HSL string like "222.2 84% 4.9%"
 */
export function rgbToHsl(r: number, g: number, b: number): string {
  // Normalize to 0-1 if needed
  r = r > 1 ? r / 255 : r;
  g = g > 1 ? g / 255 : g;
  b = b > 1 ? b / 255 : b;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Parse Figma color string to HSL
 * Supports: #hex, rgb(), rgba(), hsl(), hsla()
 */
export function parseColorToHsl(color: string): string {
  // Remove whitespace
  color = color.trim();

  // Hex color
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return rgbToHsl(r, g, b);
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return rgbToHsl(
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3])
    );
  }

  // HSL/HSLA - extract h s l values
  const hslMatch = color.match(/hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?/);
  if (hslMatch) {
    return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  }

  // If already in our format, return as-is
  if (/^\d+\s+\d+%\s+\d+%$/.test(color)) {
    return color;
  }

  throw new Error(`Unsupported color format: ${color}`);
}

/**
 * Parse Figma color object {r, g, b, a} to HSL
 */
export function parseFigmaColorToHsl(color: FigmaColor): string {
  return rgbToHsl(color.r, color.g, color.b);
}

// ── Token Mapping ───────────────────────────────────────────────────────────

/**
 * Map Figma semantic color tokens to surfaces-ui tokens
 *
 * @example
 * ```ts
 * const figmaTokens = {
 *   colors: {
 *     background: { $value: '#ffffff', $type: 'color' },
 *     foreground: { $value: '#0f172a', $type: 'color' },
 *     primary: { $value: '#1e293b', $type: 'color' },
 *   }
 * };
 *
 * const surfacesTokens = mapFigmaTokensToSurfaces(figmaTokens);
 * ```
 */
export function mapFigmaTokensToSurfaces(
  tokens: FigmaTokens,
  options: {
    colorPath?: string[];      // Path to colors in token tree (e.g., ['colors'])
    darkModePath?: string[];   // Path to dark mode variants (e.g., ['colors', 'dark'])
    semanticMapping?: Record<string, string>; // Custom semantic name mapping
  } = {}
): SurfacesTokens {
  const {
    colorPath = ['colors'],
    darkModePath = ['colors', 'dark'],
    semanticMapping = {},
  } = options;

  const result: SurfacesTokens = {
    root: {},
    dark: {},
  };

  // Default semantic token mapping
  const defaultMapping = {
    background: 'background',
    foreground: 'foreground',
    card: 'card',
    'card-foreground': 'card-foreground',
    primary: 'primary',
    'primary-foreground': 'primary-foreground',
    secondary: 'secondary',
    'secondary-foreground': 'secondary-foreground',
    muted: 'muted',
    'muted-foreground': 'muted-foreground',
    accent: 'accent',
    'accent-foreground': 'accent-foreground',
    destructive: 'destructive',
    'destructive-foreground': 'destructive-foreground',
    border: 'border',
    input: 'input',
    ring: 'ring',
  };

  const mapping = { ...defaultMapping, ...semanticMapping };

  // Helper to extract colors from nested token structure
  function extractColors(
    obj: FigmaTokens,
    path: string[],
    target: Record<string, string>
  ): void {
    let current: FigmaTokens | FigmaToken = obj;

    // Navigate to the specified path
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key] as FigmaTokens;
      } else {
        return; // Path not found
      }
    }

    // Extract color tokens
    for (const [key, value] of Object.entries(current)) {
      if (value && typeof value === 'object' && '$value' in value) {
        const token = value as FigmaToken;
        if (token.$type === 'color' || typeof token.$value === 'string') {
          const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '-');
          const surfacesKey = mapping[normalizedKey] || normalizedKey;

          try {
            target[surfacesKey] = parseColorToHsl(token.$value as string);
          } catch (err) {
            console.warn(`Failed to parse color for ${key}:`, err);
          }
        }
      }
    }
  }

  // Extract light mode colors
  extractColors(tokens, colorPath, result.root);

  // Extract dark mode colors
  if (darkModePath.length > 0) {
    extractColors(tokens, darkModePath, result.dark);
  }

  return result;
}

/**
 * Map Figma Variables export to surfaces-ui tokens
 *
 * @example
 * ```ts
 * const variables = [
 *   {
 *     id: '1',
 *     name: 'colors/background',
 *     resolvedType: 'COLOR',
 *     valuesByMode: {
 *       'light': '#ffffff',
 *       'dark': '#0f172a'
 *     }
 *   }
 * ];
 *
 * const surfacesTokens = mapFigmaVariablesToSurfaces(variables);
 * ```
 */
export function mapFigmaVariablesToSurfaces(
  variables: FigmaVariable[],
  options: {
    lightModeId?: string;      // Mode ID for light theme (default: 'light')
    darkModeId?: string;       // Mode ID for dark theme (default: 'dark')
    semanticMapping?: Record<string, string>;
  } = {}
): SurfacesTokens {
  const {
    lightModeId = 'light',
    darkModeId = 'dark',
    semanticMapping = {},
  } = options;

  const result: SurfacesTokens = {
    root: {},
    dark: {},
  };

  for (const variable of variables) {
    if (variable.resolvedType !== 'COLOR') continue;

    // Extract semantic name (e.g., 'colors/background' -> 'background')
    const name = variable.name.split('/').pop()?.toLowerCase().replace(/[_\s]/g, '-');
    if (!name) continue;

    const surfacesKey = semanticMapping[name] || name;

    // Map light mode
    const lightValue = variable.valuesByMode[lightModeId];
    if (lightValue && typeof lightValue === 'string') {
      try {
        result.root[surfacesKey] = parseColorToHsl(lightValue);
      } catch (err) {
        console.warn(`Failed to parse light color for ${name}:`, err);
      }
    }

    // Map dark mode
    const darkValue = variable.valuesByMode[darkModeId];
    if (darkValue && typeof darkValue === 'string') {
      try {
        result.dark[surfacesKey] = parseColorToHsl(darkValue);
      } catch (err) {
        console.warn(`Failed to parse dark color for ${name}:`, err);
      }
    }
  }

  return result;
}

// ── CSS Generation ──────────────────────────────────────────────────────────

/**
 * Generate CSS custom properties from surfaces tokens
 *
 * @example
 * ```ts
 * const tokens = mapFigmaTokensToSurfaces(figmaTokens);
 * const css = generateSurfacesCSS(tokens);
 * // Write to file or inject into stylesheet
 * ```
 */
export function generateSurfacesCSS(tokens: SurfacesTokens): string {
  let css = ':root {\n';

  for (const [key, value] of Object.entries(tokens.root)) {
    css += `  --${key}: ${value};\n`;
  }

  css += '}\n\n';

  if (Object.keys(tokens.dark).length > 0) {
    css += '.dark {\n';

    for (const [key, value] of Object.entries(tokens.dark)) {
      css += `  --${key}: ${value};\n`;
    }

    css += '}\n';
  }

  return css;
}

/**
 * Merge Figma tokens with existing surfaces-ui tokens
 * Existing tokens take precedence unless override is true
 */
export function mergeSurfacesTokens(
  existing: SurfacesTokens,
  figma: SurfacesTokens,
  override = false
): SurfacesTokens {
  return {
    root: override
      ? { ...existing.root, ...figma.root }
      : { ...figma.root, ...existing.root },
    dark: override
      ? { ...existing.dark, ...figma.dark }
      : { ...figma.dark, ...existing.dark },
  };
}
