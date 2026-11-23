import { SERIES_ORDER_NAMES, type SeriesOrderName, chartColors, checkSeries } from "./charts.js";
import { contrast, isHex } from "./color.js";
import { resolveColors } from "./derive.js";
import { presetByName, presets } from "./presets.js";
import { DENSITIES, type Density, FONTS, type FontChoice, MODES, type Mode, RADIUS_MAX, RADIUS_MIN, type Theme, withAccent, withCharts } from "./theme.js";

/**
 * A change to the look of a page asked for in plain terms: by an agent, a
 * URL or a setting. Every part is optional; what is left out stays as it is.
 */
export interface ThemeRequest {
  /** A theme by name: a built-in one, e.g. "Aurora", or one the host adds (`ThemeRequestOptions.themes`). */
  preset?: string;
  mode?: Mode;
  /** A hex colour for buttons, links and selection. */
  accent?: string;
  radius?: number;
  font?: FontChoice;
  density?: Density;
  /** A named order of chart colours, e.g. "Aurora". */
  seriesOrder?: SeriesOrderName;
}

export interface ThemeRequestResult {
  theme: Theme;
  /** Set only when the request asked for a mode. */
  mode?: Mode;
  /** What was asked for but refused or adjusted, in words a person can read. */
  problems: string[];
}

export interface ThemeRequestOptions {
  /**
   * The host's own themes, chosen by name as the built-in presets are (a
   * company's brand themes, say). Each should come through `parseTheme`
   * first. A name a built-in preset has is never looked up here.
   */
  themes?: readonly Theme[];
}

/** The fields a theme request may carry, for an agent's tool or catalog description. */
export const THEME_REQUEST_FIELDS = {
  presets: presets.map((p) => p.name),
  modes: MODES,
  fonts: FONTS,
  densities: DENSITIES,
  seriesOrders: SERIES_ORDER_NAMES,
  radius: [RADIUS_MIN, RADIUS_MAX],
} as const;

/**
 * Applies a request to a theme. Anything that is not understood, or that
 * would leave text or charts hard to read, is left out and reported: a
 * request can restyle a page but cannot make it unreadable.
 */
export function applyThemeRequest(request: ThemeRequest, current: Theme, options: ThemeRequestOptions = {}): ThemeRequestResult {
  const problems: string[] = [];
  const themes = options.themes ?? [];
  let theme = current;
  if (request.preset !== undefined) {
    const preset = typeof request.preset === "string" ? presetByName(request.preset, themes) : undefined;
    if (preset) theme = preset;
    else problems.push(`There is no theme called ${String(request.preset)}. Choose from ${themeNames(themes).join(", ")}.`);
  }
  if (request.accent !== undefined) {
    if (!isHex(request.accent)) problems.push("The accent must be a hex colour like #2F5BEA.");
    else {
      const next = withAccent(theme, request.accent);
      const faint = (["light", "dark"] as const).filter((m) => contrast(resolveColors(next[m]).accent, next[m].background) < 3);
      if (faint.length > 0) problems.push(`That accent is too close to the ${faint.join(" and ")} background to see, so it was not used.`);
      else theme = next;
    }
  }
  if (request.radius !== undefined) {
    if (typeof request.radius !== "number" || !Number.isFinite(request.radius)) problems.push("The corner radius must be a number.");
    else theme = { ...theme, radius: Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(request.radius))) };
  }
  if (request.font !== undefined) {
    if (FONTS.includes(request.font)) theme = { ...theme, font: request.font };
    else problems.push(`The font must be one of ${FONTS.join(", ")}.`);
  }
  if (request.density !== undefined) {
    if (DENSITIES.includes(request.density)) theme = { ...theme, density: request.density };
    else problems.push(`The density must be one of ${DENSITIES.join(", ")}.`);
  }
  if (request.seriesOrder !== undefined) {
    if (!SERIES_ORDER_NAMES.includes(request.seriesOrder)) problems.push(`The chart colours must be one of ${SERIES_ORDER_NAMES.join(", ")}.`);
    else {
      const charts = { light: chartColors(request.seriesOrder, "light"), dark: chartColors(request.seriesOrder, "dark") };
      const bad = (["light", "dark"] as const).some((m) => checkSeries(charts[m].series, theme[m].surface).some((issue) => issue.severity === "error"));
      if (bad) problems.push("Those chart colours cannot be told apart on this theme, so they were not used.");
      else theme = withCharts(theme, charts);
    }
  }
  let mode: Mode | undefined;
  if (request.mode !== undefined) {
    if (MODES.includes(request.mode)) mode = request.mode;
    else problems.push(`The mode must be one of ${MODES.join(", ")}.`);
  }
  // A named theme (built in or the host's) keeps its name only while it is unchanged.
  if (!presets.includes(theme) && !themes.includes(theme) && theme !== current) theme = { ...theme, name: "Custom" };
  return { theme, ...(mode ? { mode } : {}), problems };
}

/** The names a request may choose from: the built-in presets, then the host's own themes whose names are not taken. */
export function themeNames(themes: readonly Theme[] = []): string[] {
  const names = presets.map((p) => p.name);
  for (const t of themes) if (!names.some((n) => n.toLowerCase() === t.name.toLowerCase())) names.push(t.name);
  return names;
}
