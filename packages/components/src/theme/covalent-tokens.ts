/**
 * Covalent Design System Token Mapper
 *
 * Maps Covalent (@covalent/tokens) CSS custom properties to surfaces-ui format.
 *
 * Source: https://cdn.jsdelivr.net/npm/@covalent/tokens@11.7.0/index.css
 * Figma: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles
 */

import { parseColorToHsl, type SurfacesTokens } from './figma-tokens';

/**
 * Covalent design system color tokens
 * From @covalent/tokens@11.7.0
 */
export const COVALENT_TOKENS = {
  light: {
    // Primary colors
    primary: '#3053f4',        // Covalent blue
    secondary: '#00233c',      // Navy

    // Semantic colors
    error: '#ae1209',          // Error red
    success: '#036600',        // Success green
    warning: '#f38800',        // Warning orange
    emphasis: '#b10142',       // Deep pink

    // Surfaces
    background: '#f8f9fb',     // Light gray background
    canvas: '#ffffff',         // White canvas

    // Text
    onBackground: '#00233c',   // Navy text
    onPrimary: '#ffffff',      // White on primary

    // Borders & inputs
    border: '#d1d5db',         // Light gray border
    input: '#e5e7eb',          // Input background
  },

  dark: {
    // Primary colors
    primary: '#688bf1',        // Lighter blue
    secondary: '#c3c5dd',      // Light gray-blue

    // Semantic colors
    error: '#fd7d69',          // Coral red
    success: '#81f976',        // Bright green
    warning: '#ffcd9e',        // Light orange
    emphasis: '#cc809c',       // Muted rose

    // Surfaces
    background: '#030406',     // Near black
    canvas: '#111827',         // Dark gray canvas

    // Text
    onBackground: '#ebe8ec',   // Off-white text
    onPrimary: '#030406',      // Dark on primary

    // Borders & inputs
    border: '#374151',         // Dark gray border
    input: '#1f2937',          // Dark input background
  },
} as const;

/**
 * Convert Covalent tokens to surfaces-ui HSL format
 */
export function convertCovalentToSurfaces(): SurfacesTokens {
  return {
    root: {
      // Core semantic tokens
      background: parseColorToHsl(COVALENT_TOKENS.light.background),
      foreground: parseColorToHsl(COVALENT_TOKENS.light.onBackground),

      card: parseColorToHsl(COVALENT_TOKENS.light.canvas),
      'card-foreground': parseColorToHsl(COVALENT_TOKENS.light.onBackground),

      popover: parseColorToHsl(COVALENT_TOKENS.light.canvas),
      'popover-foreground': parseColorToHsl(COVALENT_TOKENS.light.onBackground),

      primary: parseColorToHsl(COVALENT_TOKENS.light.primary),
      'primary-foreground': parseColorToHsl(COVALENT_TOKENS.light.onPrimary),

      secondary: parseColorToHsl(COVALENT_TOKENS.light.secondary),
      'secondary-foreground': parseColorToHsl(COVALENT_TOKENS.light.onPrimary),

      muted: parseColorToHsl(COVALENT_TOKENS.light.background),
      'muted-foreground': parseColorToHsl(COVALENT_TOKENS.light.secondary),

      accent: parseColorToHsl(COVALENT_TOKENS.light.emphasis),
      'accent-foreground': parseColorToHsl(COVALENT_TOKENS.light.onPrimary),

      destructive: parseColorToHsl(COVALENT_TOKENS.light.error),
      'destructive-foreground': parseColorToHsl(COVALENT_TOKENS.light.onPrimary),

      border: parseColorToHsl(COVALENT_TOKENS.light.border),
      input: parseColorToHsl(COVALENT_TOKENS.light.input),
      ring: parseColorToHsl(COVALENT_TOKENS.light.primary),

      // Additional Covalent semantic colors
      success: parseColorToHsl(COVALENT_TOKENS.light.success),
      'success-foreground': parseColorToHsl(COVALENT_TOKENS.light.onPrimary),

      warning: parseColorToHsl(COVALENT_TOKENS.light.warning),
      'warning-foreground': parseColorToHsl(COVALENT_TOKENS.light.onBackground),
    },

    dark: {
      // Core semantic tokens
      background: parseColorToHsl(COVALENT_TOKENS.dark.background),
      foreground: parseColorToHsl(COVALENT_TOKENS.dark.onBackground),

      card: parseColorToHsl(COVALENT_TOKENS.dark.canvas),
      'card-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onBackground),

      popover: parseColorToHsl(COVALENT_TOKENS.dark.canvas),
      'popover-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onBackground),

      primary: parseColorToHsl(COVALENT_TOKENS.dark.primary),
      'primary-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),

      secondary: parseColorToHsl(COVALENT_TOKENS.dark.secondary),
      'secondary-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),

      muted: parseColorToHsl(COVALENT_TOKENS.dark.canvas),
      'muted-foreground': parseColorToHsl(COVALENT_TOKENS.dark.secondary),

      accent: parseColorToHsl(COVALENT_TOKENS.dark.emphasis),
      'accent-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),

      destructive: parseColorToHsl(COVALENT_TOKENS.dark.error),
      'destructive-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),

      border: parseColorToHsl(COVALENT_TOKENS.dark.border),
      input: parseColorToHsl(COVALENT_TOKENS.dark.input),
      ring: parseColorToHsl(COVALENT_TOKENS.dark.primary),

      // Additional Covalent semantic colors
      success: parseColorToHsl(COVALENT_TOKENS.dark.success),
      'success-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),

      warning: parseColorToHsl(COVALENT_TOKENS.dark.warning),
      'warning-foreground': parseColorToHsl(COVALENT_TOKENS.dark.onPrimary),
    },
  };
}

/**
 * Fetch and parse Covalent tokens from CDN
 * @param version - Covalent tokens version (default: 11.7.0)
 */
export async function fetchCovalentTokens(version = '11.7.0'): Promise<Record<string, string>> {
  const url = `https://cdn.jsdelivr.net/npm/@covalent/tokens@${version}/index.css`;

  const response = await fetch(url);
  const css = await response.text();

  // Parse CSS custom properties
  const tokens: Record<string, string> = {};
  const regex = /--(cv-[^:]+):\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    tokens[match[1]] = match[2].trim();
  }

  return tokens;
}
