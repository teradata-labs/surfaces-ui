/**
 * Covalent Design System Variable Map
 *
 * Maps Figma Covalent variables (--cv-theme-*, cv/*) to SurfacesUI
 * CSS custom properties. This is the translation layer between the
 * Figma design system and the React component library.
 *
 * Source: Figma kitchen-sink file variables export
 * @see https://www.figma.com/design/Yl9Vh9sloq2VxueDt3Majm/kitchen-sink
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type TokenCategory = 'color' | 'typography' | 'spacing' | 'elevation' | 'component';

export interface VariableMapping {
  /** Figma variable name (e.g., '--cv-theme-primary') */
  figma: string;

  /** SurfacesUI CSS custom property name without -- prefix (e.g., 'primary') */
  surfaces: string;

  /** Token category */
  category: TokenCategory;

  /** CSS unit to append for numeric values (e.g., 'px', 'rem'). Omit for colors. */
  unit?: string;

  /** Description for documentation */
  description?: string;
}

// ── Color Token Mapping ──────────────────────────────────────────────────────

export const COLOR_VARIABLE_MAP: Record<string, string> = {
  // Core semantic colors
  'cv-theme-primary': 'primary',
  'cv-theme-on-primary': 'primary-foreground',
  'cv-theme-secondary': 'secondary',
  'cv-theme-on-secondary': 'secondary-foreground',
  'cv-theme-background': 'background',
  'cv-theme-on-surface': 'foreground',
  'cv-theme-surface': 'surface',

  // Surface variants
  'cv-theme-surface-container': 'surface-container',
  'cv-theme-surface-container-highest': 'surface-container-highest',
  'cv-theme-surface-container-lowest': 'surface-container-lowest',
  'cv-theme-surface-dim': 'surface-dim',
  'cv-theme-surface-variant': 'surface-variant',

  // Card / Popover
  'cv-theme-brand': 'card',

  // Outline / Border
  'cv-theme-outline': 'outline',
  'cv-theme-outline-variant': 'outline-variant',
  'cv-theme-on-surface-variant': 'muted-foreground',

  // Status / Semantic colors
  'cv-theme-negative': 'destructive',
  'cv-theme-on-negative': 'destructive-foreground',
  'cv-theme-positive': 'success',
  'cv-theme-on-positive': 'success-foreground',
  'cv-theme-caution': 'warning',
  'cv-theme-on-caution': 'warning-foreground',
  'cv-theme-tertiary': 'accent',

  // Container colors (Material Design 3)
  'cv-theme-primary-container': 'primary-container',
  'cv-theme-on-primary-container': 'on-primary-container',
  'cv-theme-secondary-container': 'secondary-container',
  'cv-theme-on-secondary-container': 'on-secondary-container',
  'cv-theme-negative-container': 'negative-container',
  'cv-theme-on-negative-container': 'on-negative-container',
  'cv-theme-positive-container': 'positive-container',
  'cv-theme-on-positive-container': 'on-positive-container',
  'cv-theme-caution-container': 'caution-container',
  'cv-theme-on-caution-container': 'on-caution-container',
  'cv-theme-emphasis-container': 'emphasis-container',
  'cv-theme-on-emphasis-container': 'on-emphasis-container',

  // Inverse colors
  'cv-theme-inverse-surface': 'inverse-surface',
  'cv-theme-inverse-on-surface': 'inverse-on-surface',
  'cv-theme-inverse-primary': 'inverse-primary',
  'cv-theme-inverse-secondary': 'inverse-secondary',

  // State layer opacity tokens (alpha channel colors)
  'cv-theme-primary-8': 'primary-8',
  'cv-theme-primary-12': 'primary-12',
  'cv-theme-primary-20': 'primary-20',
  'cv-theme-on-surface-4': 'on-surface-4',
  'cv-theme-on-surface-8': 'on-surface-8',
  'cv-theme-on-surface-12': 'on-surface-12',
  'cv-theme-on-surface-16': 'on-surface-16',
  'cv-theme-on-surface-20': 'on-surface-20',
  'cv-theme-on-surface-38': 'on-surface-38',
  'cv-theme-on-surface-variant-8': 'on-surface-variant-8',
  'cv-theme-on-surface-variant-12': 'on-surface-variant-12',
  'cv-theme-on-surface-variant-38': 'on-surface-variant-38',
  'cv-theme-on-primary-8': 'on-primary-8',
  'cv-theme-on-primary-12': 'on-primary-12',
  'cv-theme-on-surface-74': 'on-surface-74',
  'cv-theme-outline-state-12': 'outline-state-12',
};

// ── Component Token Mapping ──────────────────────────────────────────────────

export const COMPONENT_VARIABLE_MAP: Record<string, { surfaces: string; unit: string }> = {
  // Button
  'cv/button-height': { surfaces: 'su-button-height', unit: 'px' },

  // Chip
  'cv/chip-height': { surfaces: 'su-chip-height', unit: 'px' },

  // Shape / Border radius
  'cv/shape-small': { surfaces: 'su-radius-sm', unit: 'px' },
  'mdc/border-radius': { surfaces: 'su-radius-md', unit: 'px' },

  // Card
  'cv/card-padding': { surfaces: 'su-card-padding', unit: 'px' },

  // List
  'cv/list-item-1line-container-height': { surfaces: 'su-list-item-height-1line', unit: 'px' },
  'cv/list-item-2line-container-height': { surfaces: 'su-list-item-height-2line', unit: 'px' },
  'cv/list-item-3line-container-height': { surfaces: 'su-list-item-height-3line', unit: 'px' },
  'cv/list-item-border-radius': { surfaces: 'su-list-item-radius', unit: 'px' },
  'cv/list-1line-padding-vertical': { surfaces: 'su-list-padding-1line', unit: 'px' },
  'cv/list-2line-padding-vertical': { surfaces: 'su-list-padding-2line', unit: 'px' },
  'cv/list-3line-padding-vertical': { surfaces: 'su-list-padding-3line', unit: 'px' },
  'mdc/list-side-padding': { surfaces: 'su-list-side-padding', unit: 'px' },

  // Select
  'cv/select-height': { surfaces: 'su-select-height', unit: 'px' },

  // Text field
  'cv/text-field-height': { surfaces: 'su-text-field-height', unit: 'px' },

  // Toolbar
  'cv/toolbar-height': { surfaces: 'su-toolbar-height', unit: 'px' },

  // Tab
  'mdc/tab-height': { surfaces: 'su-tab-height', unit: 'px' },

  // Icon button
  'mdc/icon-button-size': { surfaces: 'su-icon-button-size', unit: 'px' },

  // Button horizontal padding
  'mdc/button-horizontal-padding': { surfaces: 'su-button-padding-x', unit: 'px' },

  // Code snippet
  'cv/code-snippet-header-height': { surfaces: 'su-code-snippet-header-height', unit: 'px' },

  // Divider
  'cv/divider-horizontal-margin-y': { surfaces: 'su-divider-margin-y', unit: 'px' },
};

// ── Typography Token Mapping ─────────────────────────────────────────────────

export interface TypographyScale {
  surfaces: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
  fontFamily: string;
}

export const TYPOGRAPHY_VARIABLE_MAP: Record<string, TypographyScale> = {
  'headline-1': {
    surfaces: 'headline-1',
    fontSize: 'cv-typography-headline1-font-size',
    lineHeight: 'cv-typography-headline1-line-height',
    fontWeight: 'cv-typography-headline1-font-weight',
    letterSpacing: 'cv-typography-headline1-letter-spacing',
    fontFamily: 'cv-typography-headline1-font-family',
  },
  'headline-2': {
    surfaces: 'headline-2',
    fontSize: 'cv-typography-headline2-font-size',
    lineHeight: 'cv-typography-headline2-line-height',
    fontWeight: 'cv-typography-headline2-font-weight',
    letterSpacing: 'cv-typography-headline2-letter-spacing',
    fontFamily: 'cv-typography-headline2-font-family',
  },
  'headline-3': {
    surfaces: 'headline-3',
    fontSize: 'cv-typography-headline3-font-size',
    lineHeight: 'cv-typography-headline3-line-height',
    fontWeight: 'cv-typography-headline3-font-weight',
    letterSpacing: 'cv-typography-headline3-letter-spacing',
    fontFamily: 'cv-typography-headline3-font-family',
  },
  'headline-4': {
    surfaces: 'headline-4',
    fontSize: 'cv-typography-headline4-font-size',
    lineHeight: 'cv-typography-headline4-line-height',
    fontWeight: 'cv-typography-headline4-font-weight',
    letterSpacing: 'cv-typography-headline4-letter-spacing',
    fontFamily: 'cv-typography-headline4-font-family',
  },
  'headline-5': {
    surfaces: 'headline-5',
    fontSize: 'cv-typography-headline5-font-size',
    lineHeight: 'cv-typography-headline5-line-height',
    fontWeight: 'cv-typography-headline5-font-weight',
    letterSpacing: 'cv-typography-headline5-letter-spacing',
    fontFamily: 'cv-typography-headline5-font-family',
  },
  'headline-6': {
    surfaces: 'headline-6',
    fontSize: 'cv-typography-headline6-font-size',
    lineHeight: 'cv-typography-headline6-line-height',
    fontWeight: 'cv-typography-headline6-font-weight',
    letterSpacing: 'cv-typography-headline6-letter-spacing',
    fontFamily: 'cv-typography-headline6-font-family',
  },
  'subtitle-1': {
    surfaces: 'subtitle-1',
    fontSize: 'cv-typography-subtitle1-font-size',
    lineHeight: 'cv-typography-subtitle1-line-height',
    fontWeight: 'cv-typography-subtitle1-font-weight',
    letterSpacing: 'cv-typography-subtitle1-article-letter-spacing',
    fontFamily: 'cv-typography-subtitle1-font-family',
  },
  'subtitle-2': {
    surfaces: 'subtitle-2',
    fontSize: 'cv-typography-subtitle2-font-size',
    lineHeight: 'cv-typography-subtitle2-line-height',
    fontWeight: 'cv-typography-subtitle2-font-weight',
    letterSpacing: 'cv-typography-subtitle2-article-letter-spacing',
    fontFamily: 'cv-typography-subtitle2-font-family',
  },
  'body-1': {
    surfaces: 'body-1',
    fontSize: 'cv-typography-body1-font-size',
    lineHeight: 'cv-typography-body1-line-height',
    fontWeight: 'cv-typography-body1-font-weight',
    letterSpacing: 'cv-typography-body1-article-letter-spacing',
    fontFamily: 'cv-typography-body1-font-family',
  },
  'body-2': {
    surfaces: 'body-2',
    fontSize: 'cv-typography-body2-font-size',
    lineHeight: 'cv-typography-body2-line-height',
    fontWeight: 'cv-typography-body2-font-weight',
    letterSpacing: 'cv-typography-body2-article-letter-spacing',
    fontFamily: 'cv-typography-body2-font-family',
  },
  'button': {
    surfaces: 'button',
    fontSize: 'cv-typography-button-font-size',
    lineHeight: 'cv-typography-button-line-height',
    fontWeight: 'cv-typography-button-font-weight',
    letterSpacing: 'cv-typography-button-article-letter-spacing',
    fontFamily: 'cv-typography-button-font-family',
  },
  'caption': {
    surfaces: 'caption',
    fontSize: 'cv-typography-caption-font-size',
    lineHeight: 'cv-typography-caption-line-height',
    fontWeight: 'cv-typography-caption-font-weight',
    letterSpacing: 'cv-typography-caption-article-letter-spacing',
    fontFamily: 'cv-typography-caption-font-family',
  },
  'overline': {
    surfaces: 'overline',
    fontSize: 'cv-typography-overline-font-size',
    lineHeight: 'cv-typography-overline-line-height',
    fontWeight: 'cv-typography-overline-font-weight',
    letterSpacing: 'cv-typography-overline-article-letter-spacing',
    fontFamily: 'cv-typography-overline-font-family',
  },
};

// ── Elevation Mapping ────────────────────────────────────────────────────────

export const ELEVATION_MAP: Record<string, string> = {
  'Elevation 1': '0 1px 3px 1px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  'Elevation 2': '0 2px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  'Elevation 3': '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
  'Elevation 5': '0 8px 12px 6px rgba(0, 0, 0, 0.15), 0 4px 4px 0 rgba(0, 0, 0, 0.3)',
};

// ── Lookup Helpers ───────────────────────────────────────────────────────────

/**
 * Resolve a Figma variable name to its SurfacesUI CSS custom property name.
 * Strips the `--` prefix and `var()` wrapper if present.
 *
 * @example
 * resolveVariable('var(--cv-theme-primary)') // 'primary'
 * resolveVariable('cv-theme-primary')        // 'primary'
 * resolveVariable('cv/button-height')        // { name: 'su-button-height', unit: 'px' }
 */
export function resolveColorVariable(figmaVar: string): string | undefined {
  // Strip var() wrapper and -- prefix
  const cleaned = figmaVar
    .replace(/^var\(--/, '')
    .replace(/\)$/, '')
    .replace(/^--/, '');

  return COLOR_VARIABLE_MAP[cleaned];
}

/**
 * Resolve a Figma component variable to SurfacesUI name + unit.
 */
export function resolveComponentVariable(figmaVar: string): { surfaces: string; unit: string } | undefined {
  return COMPONENT_VARIABLE_MAP[figmaVar];
}

/**
 * Get all variable mappings as a flat list for documentation/sync tooling.
 */
export function getAllMappings(): VariableMapping[] {
  const mappings: VariableMapping[] = [];

  for (const [figma, surfaces] of Object.entries(COLOR_VARIABLE_MAP)) {
    mappings.push({ figma, surfaces, category: 'color' });
  }

  for (const [figma, { surfaces, unit }] of Object.entries(COMPONENT_VARIABLE_MAP)) {
    mappings.push({ figma, surfaces, category: 'component', unit });
  }

  for (const [, scale] of Object.entries(TYPOGRAPHY_VARIABLE_MAP)) {
    mappings.push({
      figma: scale.fontSize,
      surfaces: `${scale.surfaces}-font-size`,
      category: 'typography',
      unit: 'px',
    });
  }

  for (const [figma] of Object.entries(ELEVATION_MAP)) {
    mappings.push({
      figma,
      surfaces: `elevation-${figma.split(' ')[1]}`,
      category: 'elevation',
    });
  }

  return mappings;
}
