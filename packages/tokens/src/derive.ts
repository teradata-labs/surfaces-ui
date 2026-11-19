import { type ChartColors, HUES, chartColors, divergingRamp, sequentialRamp } from "./charts.js";
import { contrast, ensureContrast, luminance, mix, mixOklab, over, stepByContrast } from "./color.js";
import type { CodeColors, Contrast, Density, FontChoice, Palette, Theme } from "./theme.js";

/** Every colour token components may use, derived from a six-colour palette. */
export interface ResolvedColors extends Palette {
  /** Raised surface: hover rows, nested panels. */
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  /** Tinted background for selected rows and active items. */
  accentSoft: string;
  /** Accent darkened/lightened enough to use as text on the background. */
  accentText: string;
  focus: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Categorical chart colours, in the order series should use them. */
  series: string[];
  /** One hue from faint to strong, seven steps, for magnitude. */
  sequential: string[];
  /** Seven steps from one pole through a neutral grey to the other, for values either side of a midpoint. */
  diverging: string[];
  /** Syntax colours for code blocks, each readable on the background and on surfaces. */
  code: CodeColors;
  /** A quieter line than `border`, for dividing panes and list rows where space already groups things. */
  divider: string;
  /** The accent under a pointer, and pressed. Text on the accent stays readable on both. */
  accentHover: string;
  accentPressed: string;
  /**
   * Backgrounds, from the page (1) through panes (2) and raised items (3) to
   * the deepest well (4). Each holds `label[0]` and `label[1]` at 4.5:1.
   */
  bg: [string, string, string, string];
  /**
   * Text levels: primary (1), secondary (2, the theme's muted), tertiary (3,
   * the faintest text still at 4.5:1 on the page and panes) and quaternary (4,
   * disabled text and marks, at 3:1).
   */
  label: [string, string, string, string];
  /** Fills behind controls (segments, chips, fields), strongest (1) to faintest (4). Primary text reads at 4.5:1 on each. */
  fill: [string, string, string, string];
  /** Six greys in the theme's tint, from one that marks at 3:1 (1) to one just off the page (6). */
  gray: [string, string, string, string, string, string];
  /** Glass for controls that float over content. See {@link GLASS}. */
  glass: GlassColors;
}

/**
 * How see-through each glass is: the share of the pane colour laid over what
 * is behind. Regular is for toolbars, menus, the composer and tooltips; thick
 * for larger panels with more text (a sidebar, an inspector, a sheet); clear
 * for a few controls over rich content (zoom buttons over a diagram), and it
 * dims what is behind first. Glass is for controls, never for content.
 */
export const GLASS = { regular: 0.8, thick: 0.88, clear: 0.65, dim: 0.35, blur: 24, saturate: 160, fallback: 0.96 } as const;

export interface GlassColors {
  /** The pane colour glass is made of. */
  tint: string;
  /** What clear glass dims the content behind toward. */
  dim: string;
  /** The 1px edge, drawn in the text colour at low strength. */
  edge: string;
  /** Secondary text on glass, moved until it reads at 4.5:1 over the worst thing behind regular glass. */
  muted: string;
  /** Strength of the edge, and of the highlight along the top. */
  edgeAlpha: number;
  highlightAlpha: number;
  /** The soft shadow that only floating glass has. */
  shadow: string;
}

/** Where each kind of code token takes its hue from by default. */
const CODE_HUES: Record<Exclude<keyof CodeColors, "comment" | "punctuation">, keyof typeof HUES> = {
  keyword: "purple",
  string: "teal",
  number: "orange",
  literal: "pink",
  property: "blue",
  function: "amber",
  type: "red",
};

/**
 * The colours glass may have behind it, as solid patches: blur only averages
 * what is behind, so a solid patch of the strongest colour on screen is the
 * worst case for text on glass.
 */
export function glassBackdrops(c: Pick<ResolvedColors, "background" | "surface" | "text" | "accent" | "series">): string[] {
  return [c.background, c.surface, c.text, c.accent, ...c.series];
}

/** What glass of `alpha` looks like over each backdrop; clear glass dims the backdrop first. */
export function glassOver(tint: string, alpha: number, backdrops: string[], dim?: string): string[] {
  return backdrops.map((b) => over(tint, alpha, dim ? over(dim, GLASS.dim, b) : b));
}

/**
 * Syntax colours for one mode: the chart hues, or the theme's own choices,
 * moved until they read at 4.5:1 on both the background and the surface.
 * Colour is never the only cue; code stays readable as plain text.
 */
export function codeColors(palette: Palette, overrides: Partial<CodeColors> = {}): CodeColors {
  const dark = luminance(palette.background) < 0.5;
  const readable = (c: string) => ensureContrast(ensureContrast(c, palette.background, 4.5), palette.surface, 4.5);
  const out = {} as CodeColors;
  for (const [token, hue] of Object.entries(CODE_HUES) as [keyof typeof CODE_HUES, keyof typeof HUES][]) {
    out[token] = readable(overrides[token] ?? HUES[hue][dark ? "dark" : "light"]);
  }
  out.comment = readable(overrides.comment ?? palette.muted);
  out.punctuation = readable(overrides.punctuation ?? mix(palette.text, palette.background, 0.2));
  return out;
}

const STATUS = {
  success: HUES.green.light,
  warning: HUES.amber.light,
  danger: HUES.red.light,
  info: HUES.blue.light,
} as const;

/** A colour moved just far enough to reach `ratio` against each of `grounds`, which lie on the same side of it. */
function readable(color: string, ratio: number, grounds: string[]): string {
  let out = color;
  for (let pass = 0; pass < 3; pass++) for (const ground of grounds) out = ensureContrast(out, ground, ratio);
  return out;
}

/**
 * Every colour token for one mode. Chart colours are used as the theme gives
 * them: they are chosen as a set, so they are not adjusted one by one.
 */
export function resolveColors(palette: Palette, charts?: ChartColors, code?: Partial<CodeColors>, level: Contrast = "standard"): ResolvedColors {
  const more = level === "more";
  const { background, surface, text, accent } = palette;
  const dark = luminance(background) < 0.5;
  const chart = charts ?? chartColors("Classic", dark ? "dark" : "light");
  const accentSoft = mix(background, accent, dark ? 0.24 : 0.12);
  // Status colours are written as text too ("Changes or removes data"), on the page and on cards, so they are text colours.
  const status = (c: string) => readable(c, 4.5, [background, surface]);
  const surfaceRaised = mix(surface, text, dark ? 0.08 : 0.05);
  const deepest = mixOklab(surface, text, dark ? 0.14 : 0.09);
  const pane = [background, surface, surfaceRaised];
  const muted = readable(palette.muted, 4.5, [...pane, deepest]);
  // With more contrast the quieter labels move up a level: tertiary text to 7:1, quaternary to 4.5:1.
  const label3 = stepByContrast(text, background, more ? 7 : 4.5, [...pane, deepest]);
  const label4 = stepByContrast(text, background, more ? 4.5 : 3, [background, surface]);
  // A fill goes no further toward the text colour than secondary text allows: a button's hint or a chip's count stays at 4.5:1 on it, pressed or not.
  const deepestFill = stepByContrast(background, text, 4.5, [muted]);
  const fill = (dark ? [0.24, 0.18, 0.13, 0.08] : [0.16, 0.12, 0.08, 0.05]).map((t) => {
    const step = mixOklab(background, text, t);
    return contrast(muted, step) >= 4.5 ? step : deepestFill;
  }) as ResolvedColors["fill"];
  const gray1 = stepByContrast(text, background, 3, [background, surface]);
  const gray = [gray1, ...[0.3, 0.5, 0.68, 0.82, 0.92].map((t) => mixOklab(gray1, background, t))] as ResolvedColors["gray"];
  const series = [...chart.series];
  const backdrops = glassBackdrops({ background, surface, text, accent, series });
  const regular = glassOver(surface, GLASS.regular, backdrops);
  return {
    ...palette,
    muted,
    surfaceRaised,
    // With more contrast an edge reaches 3:1, so a field, a pane or a control can be found by its outline alone.
    border: more ? stepByContrast(text, background, 3, [background, surface]) : mix(background, text, dark ? 0.2 : 0.14),
    borderStrong: more ? stepByContrast(text, background, 4.5, [background, surface]) : mix(background, text, dark ? 0.4 : 0.32),
    accentSoft,
    // Accent text sits on the page, on cards and on the accent's own soft tint (a current item, a badge).
    accentText: readable(accent, 4.5, [background, surface, accentSoft]),
    focus: ensureContrast(accent, background, 3),
    success: status(STATUS.success),
    warning: status(STATUS.warning),
    danger: status(STATUS.danger),
    info: status(STATUS.info),
    series,
    sequential: sequentialRamp(chart.sequential, surface),
    diverging: divergingRamp(chart.diverging, surface),
    code: codeColors(palette, code),
    divider: more ? mixOklab(background, text, dark ? 0.4 : 0.34) : mix(background, text, dark ? 0.14 : 0.09),
    accentHover: mixOklab(accent, text, 0.12),
    accentPressed: mixOklab(accent, text, 0.24),
    bg: [background, surface, surfaceRaised, deepest],
    label: [text, muted, label3, label4],
    fill,
    gray,
    glass: {
      tint: surface,
      dim: background,
      edge: text,
      muted: readable(muted, 4.5, regular),
      edgeAlpha: dark ? 0.12 : 0.1,
      highlightAlpha: dark ? 0.1 : 0.55,
      shadow: dark ? "0 10px 30px rgb(0 0 0 / 0.4)" : "0 10px 30px rgb(0 0 0 / 0.1)",
    },
  };
}

export const FONT_STACKS: Record<FontChoice, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  serif: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
};

export const MONO_STACK = FONT_STACKS.mono;

export interface Scale {
  /** Base spacing unit in px; spacing tokens are multiples of it. */
  unit: number;
  /** Height of a single-line control or table row, px. */
  controlHeight: number;
  rowHeight: number;
  fontSize: number;
}

export const DENSITY_SCALE: Record<Density, Scale> = {
  comfortable: { unit: 4, controlHeight: 36, rowHeight: 36, fontSize: 14 },
  compact: { unit: 3, controlHeight: 28, rowHeight: 28, fontSize: 13 },
};

export interface ResolvedTheme {
  name: string;
  light: ResolvedColors;
  dark: ResolvedColors;
  radius: number;
  fontFamily: string;
  monoFamily: string;
  scale: Scale;
  contrast: Contrast;
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return {
    name: theme.name,
    light: resolveColors(theme.light, theme.charts?.light, theme.code?.light, theme.contrast),
    dark: resolveColors(theme.dark, theme.charts?.dark, theme.code?.dark, theme.contrast),
    contrast: theme.contrast ?? "standard",
    radius: theme.radius,
    fontFamily: FONT_STACKS[theme.font],
    monoFamily: MONO_STACK,
    scale: DENSITY_SCALE[theme.density],
  };
}
