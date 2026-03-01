/**
 * SurfacesUI Design Token Mapper
 *
 * Maps design system CSS custom properties to the surfaces-ui format.
 *
 * Source: https://cdn.jsdelivr.net/npm/@covalent/tokens@11.7.0/index.css
 * Figma: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles
 */

import { parseColorToHsl, type SurfacesTokens } from './figma-tokens';

/**
 * Design system color tokens
 */
export const DESIGN_TOKENS = {
  light: {
    // Primary colors
    primary: '#3053f4',        // Brand blue
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
 * Convert design tokens to surfaces-ui HSL format
 */
export function convertToSurfaces(): SurfacesTokens {
  return {
    root: {
      // Core semantic tokens
      background: parseColorToHsl(DESIGN_TOKENS.light.background),
      foreground: parseColorToHsl(DESIGN_TOKENS.light.onBackground),

      card: parseColorToHsl(DESIGN_TOKENS.light.canvas),
      'card-foreground': parseColorToHsl(DESIGN_TOKENS.light.onBackground),

      popover: parseColorToHsl(DESIGN_TOKENS.light.canvas),
      'popover-foreground': parseColorToHsl(DESIGN_TOKENS.light.onBackground),

      primary: parseColorToHsl(DESIGN_TOKENS.light.primary),
      'primary-foreground': parseColorToHsl(DESIGN_TOKENS.light.onPrimary),

      secondary: parseColorToHsl(DESIGN_TOKENS.light.secondary),
      'secondary-foreground': parseColorToHsl(DESIGN_TOKENS.light.onPrimary),

      muted: parseColorToHsl(DESIGN_TOKENS.light.background),
      'muted-foreground': parseColorToHsl(DESIGN_TOKENS.light.secondary),

      accent: parseColorToHsl(DESIGN_TOKENS.light.emphasis),
      'accent-foreground': parseColorToHsl(DESIGN_TOKENS.light.onPrimary),

      destructive: parseColorToHsl(DESIGN_TOKENS.light.error),
      'destructive-foreground': parseColorToHsl(DESIGN_TOKENS.light.onPrimary),

      border: parseColorToHsl(DESIGN_TOKENS.light.border),
      input: parseColorToHsl(DESIGN_TOKENS.light.input),
      ring: parseColorToHsl(DESIGN_TOKENS.light.primary),

      // Additional semantic colors
      success: parseColorToHsl(DESIGN_TOKENS.light.success),
      'success-foreground': parseColorToHsl(DESIGN_TOKENS.light.onPrimary),

      warning: parseColorToHsl(DESIGN_TOKENS.light.warning),
      'warning-foreground': parseColorToHsl(DESIGN_TOKENS.light.onBackground),
    },

    dark: {
      // Core semantic tokens
      background: parseColorToHsl(DESIGN_TOKENS.dark.background),
      foreground: parseColorToHsl(DESIGN_TOKENS.dark.onBackground),

      card: parseColorToHsl(DESIGN_TOKENS.dark.canvas),
      'card-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onBackground),

      popover: parseColorToHsl(DESIGN_TOKENS.dark.canvas),
      'popover-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onBackground),

      primary: parseColorToHsl(DESIGN_TOKENS.dark.primary),
      'primary-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),

      secondary: parseColorToHsl(DESIGN_TOKENS.dark.secondary),
      'secondary-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),

      muted: parseColorToHsl(DESIGN_TOKENS.dark.canvas),
      'muted-foreground': parseColorToHsl(DESIGN_TOKENS.dark.secondary),

      accent: parseColorToHsl(DESIGN_TOKENS.dark.emphasis),
      'accent-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),

      destructive: parseColorToHsl(DESIGN_TOKENS.dark.error),
      'destructive-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),

      border: parseColorToHsl(DESIGN_TOKENS.dark.border),
      input: parseColorToHsl(DESIGN_TOKENS.dark.input),
      ring: parseColorToHsl(DESIGN_TOKENS.dark.primary),

      // Additional semantic colors
      success: parseColorToHsl(DESIGN_TOKENS.dark.success),
      'success-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),

      warning: parseColorToHsl(DESIGN_TOKENS.dark.warning),
      'warning-foreground': parseColorToHsl(DESIGN_TOKENS.dark.onPrimary),
    },
  };
}

/**
 * Fetch and parse design tokens from CDN
 * @param version - Token package version (default: 11.7.0)
 */
export async function fetchDesignTokens(version = '11.7.0'): Promise<Record<string, string>> {
  const url = `https://cdn.jsdelivr.net/npm/@covalent/tokens@${version}/index.css`;

  const response = await fetch(url);
  const css = await response.text();

  // Parse CSS custom properties
  const tokens: Record<string, string> = {};
  const regex = /--(cv-[^:]+):\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    if (match[1] && match[2]) {
      tokens[match[1]] = match[2].trim();
    }
  }

  return tokens;
}
