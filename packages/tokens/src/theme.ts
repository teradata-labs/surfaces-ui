import { type ChartColors, chartColors, currentHue, currentSeries, parseChartColors } from "./charts.js";
import { ensureContrast, isHex, normalizeHex, readableOn } from "./color.js";

/** The colours a theme author chooses. Everything else is derived. */
export interface Palette {
  /** Page background. */
  background: string;
  /** Cards, panels, inputs. */
  surface: string;
  /** Body text. */
  text: string;
  /** Secondary text. */
  muted: string;
  /** Brand / primary action colour. */
  accent: string;
  /** Text and icons drawn on the accent colour. */
  onAccent: string;
}

/** Syntax colours for code blocks. */
export interface CodeColors {
  keyword: string;
  string: string;
  number: string;
  /** true, false, null. */
  literal: string;
  comment: string;
  /** Object keys, column names after a dot. */
  property: string;
  function: string;
  type: string;
  punctuation: string;
}

export const CODE_TOKENS = ["keyword", "string", "number", "literal", "comment", "property", "function", "type", "punctuation"] as const satisfies readonly (keyof CodeColors)[];

export const FONTS = ["system", "rounded", "serif", "mono"] as const;
export type FontChoice = (typeof FONTS)[number];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const CONTRASTS = ["standard", "more"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const MODES = ["system", "light", "dark"] as const;
export type Mode = (typeof MODES)[number];

export const RADIUS_MIN = 0;
export const RADIUS_MAX = 28;

/** A complete theme document. This is the shape stored, shared and edited. */
export interface Theme {
  name: string;
  light: Palette;
  dark: Palette;
  /** Corner radius in px, 0–28. */
  radius: number;
  font: FontChoice;
  density: Density;
  /**
   * The colours charts draw data with, for each mode: the series colours in
   * order, a hue for magnitude and the poles of a two-sided scale. They are
   * part of the theme so that charts change with it.
   */
  charts: { light: ChartColors; dark: ChartColors };
  /**
   * Syntax colours to use instead of the defaults, for either mode. Any
   * left out are taken from the chart hues; every one is adjusted until it
   * is readable, so a theme cannot make code unreadable.
   */
  code?: { light?: Partial<CodeColors>; dark?: Partial<CodeColors> };
  /**
   * "more" draws the theme as the system's increased contrast setting would, whatever the person's own setting:
   * lines and edges a step stronger, every pane and control outlined, the quieter labels darker, and glass solid.
   * Left out, it is "standard", and `prefers-contrast: more` still turns the same on for a person who asks.
   */
  contrast?: Contrast;
}

const PALETTE_KEYS = ["background", "surface", "text", "muted", "accent", "onAccent"] as const;

function parsePalette(input: unknown, fallback: Palette, path: string): Palette {
  if (input === undefined) return fallback;
  if (typeof input !== "object" || input === null) {
    throw new Error(`${path} must be an object`);
  }
  const record = input as Record<string, unknown>;
  const out = { ...fallback };
  for (const key of PALETTE_KEYS) {
    const value = record[key];
    if (value === undefined) continue;
    if (!isHex(value)) throw new Error(`${path}.${key} must be a hex colour like #1A2B3C`);
    out[key] = normalizeHex(value);
  }
  return out;
}

/**
 * Validates an untrusted theme document (from storage, an agent, a URL) and
 * fills anything missing from `fallback`. Throws with the offending path when
 * a value is present but wrong; out-of-range radius is clamped.
 */
type Greys = Pick<Palette, "background" | "surface" | "text" | "muted" | "onAccent">;
/**
 * A preset's greys from before they changed, with what they are now. A saved theme keeps its own copy of its colours,
 * so one saved while these were current would keep them; a palette that still holds them exactly (nobody edited them)
 * is moved to the current ones. Its accent and everything else stay as saved.
 */
const RETIRED_GREYS: { name: string; mode: "light" | "dark"; was: Greys[]; now: Greys }[] = [
  {
    name: "Ink",
    mode: "light",
    was: [
      { background: "#FBFBFE", surface: "#EFF0F8", text: "#141633", muted: "#565A78", onAccent: "#FFFFFF" },
      { background: "#FBFBFD", surface: "#F0F0F4", text: "#141633", muted: "#565A78", onAccent: "#FFFFFF" },
    ],
    now: { background: "#FBFBFC", surface: "#F0F0F2", text: "#141633", muted: "#565A78", onAccent: "#FFFFFF" },
  },
  {
    name: "Ink",
    mode: "dark",
    was: [
      { background: "#0A0B18", surface: "#141629", text: "#ECEDFB", muted: "#9EA2C2", onAccent: "#0A0B18" },
      { background: "#0B0C12", surface: "#161720", text: "#ECEDFB", muted: "#9EA2C2", onAccent: "#0B0C12" },
    ],
    now: { background: "#0C0C0F", surface: "#17181B", text: "#ECEDFB", muted: "#9EA2C2", onAccent: "#0C0C0F" },
  },
  {
    name: "Sand",
    mode: "light",
    was: [
      { background: "#F8F9F5", surface: "#ECEFE6", text: "#1C1E18", muted: "#5D6255", onAccent: "#FFFFFF" },
      { background: "#F9F9F3", surface: "#EFEEE2", text: "#1E1D15", muted: "#63614F", onAccent: "#FFFFFF" },
      { background: "#FAF9F1", surface: "#F2EEDC", text: "#201D11", muted: "#666046", onAccent: "#FFFFFF" },
      { background: "#F9F9F4", surface: "#F0EEE5", text: "#201D11", muted: "#666046", onAccent: "#FFFFFF" },
    ],
    now: { background: "#F9F9F6", surface: "#EFEEE9", text: "#201D11", muted: "#666046", onAccent: "#FFFFFF" },
  },
  {
    name: "Sand",
    mode: "dark",
    was: [
      { background: "#11130F", surface: "#1B1E18", text: "#F1F3EC", muted: "#A6AB9D", onAccent: "#11130F" },
      { background: "#13120D", surface: "#1E1D15", text: "#F3F2E9", muted: "#ACAA97", onAccent: "#13120D" },
      { background: "#14120A", surface: "#201D10", text: "#F5F2E5", muted: "#B0A98E", onAccent: "#14120A" },
      { background: "#13120D", surface: "#1E1D17", text: "#F5F2E5", muted: "#B0A98E", onAccent: "#14120A" },
    ],
    now: { background: "#13120F", surface: "#1D1D1A", text: "#F5F2E5", muted: "#B0A98E", onAccent: "#14120A" },
  },
  {
    name: "Aurora",
    mode: "light",
    was: [
      { background: "#F9FCFC", surface: "#ECF4F4", text: "#0E2226", muted: "#4E6468", onAccent: "#FFFFFF" },
    ],
    now: { background: "#FAFCFC", surface: "#EFF3F3", text: "#0E2226", muted: "#4E6468", onAccent: "#FFFFFF" },
  },
  {
    name: "Aurora",
    mode: "dark",
    was: [
      { background: "#050B0D", surface: "#0D1619", text: "#E6F4F5", muted: "#93ABAF", onAccent: "#050B0D" },
    ],
    now: { background: "#070B0C", surface: "#111517", text: "#E6F4F5", muted: "#93ABAF", onAccent: "#050B0D" },
  },
  {
    name: "Berry",
    mode: "light",
    was: [
      { background: "#FDFAFC", surface: "#F4EEF3", text: "#261725", muted: "#695767", onAccent: "#FFFFFF" },
      { background: "#FCFAFC", surface: "#F2EFF2", text: "#261725", muted: "#695767", onAccent: "#FFFFFF" },
    ],
    now: { background: "#FBFAFB", surface: "#F1F0F1", text: "#261725", muted: "#695767", onAccent: "#FFFFFF" },
  },
  {
    name: "Berry",
    mode: "dark",
    was: [
      { background: "#130C10", surface: "#20161C", text: "#F7EDF2", muted: "#BCA2B0", onAccent: "#130C10" },
      { background: "#110D0F", surface: "#1D181B", text: "#F7EDF2", muted: "#BCA2B0", onAccent: "#130C10" },
    ],
    now: { background: "#100E0F", surface: "#1B191A", text: "#F7EDF2", muted: "#BCA2B0", onAccent: "#130C10" },
  },
  {
    name: "Harbor",
    mode: "light",
    was: [
      { background: "#FAFBFD", surface: "#ECF1F5", text: "#0F1F33", muted: "#4F5F74", onAccent: "#FFFFFF" },
    ],
    now: { background: "#FAFBFC", surface: "#EEF1F3", text: "#0F1F33", muted: "#4F5F74", onAccent: "#FFFFFF" },
  },
  {
    name: "Harbor",
    mode: "dark",
    was: [
      { background: "#090C11", surface: "#12181E", text: "#EAF1F8", muted: "#98AABD", onAccent: "#090C11" },
    ],
    now: { background: "#0A0C0F", surface: "#15181B", text: "#EAF1F8", muted: "#98AABD", onAccent: "#090C11" },
  },
  {
    name: "Moss",
    mode: "light",
    was: [
      { background: "#F8FCF9", surface: "#EAF3EC", text: "#131C15", muted: "#506254", onAccent: "#FFFFFF" },
    ],
    now: { background: "#F9FBFA", surface: "#EDF2EE", text: "#131C15", muted: "#506254", onAccent: "#FFFFFF" },
  },
  {
    name: "Moss",
    mode: "dark",
    was: [
      { background: "#0C0E09", surface: "#171913", text: "#EDF0E6", muted: "#A0A893", onAccent: "#0C0E09" },
    ],
    now: { background: "#0C0E0B", surface: "#171916", text: "#EDF0E6", muted: "#A0A893", onAccent: "#0C0E09" },
  },
];

function currentGreys(name: string, mode: "light" | "dark", palette: Palette): Palette {
  const same = (a: Greys, b: Palette) => (Object.keys(a) as (keyof Greys)[]).every((key) => a[key].toUpperCase() === b[key].toUpperCase());
  const retired = RETIRED_GREYS.find((r) => r.name === name && r.mode === mode && r.was.some((was) => same(was, palette)));
  return retired ? { ...palette, ...retired.now } : palette;
}

export function parseTheme(input: unknown, fallback: Theme): Theme {
  if (typeof input !== "object" || input === null) throw new Error("theme must be an object");
  const record = input as Record<string, unknown>;

  const name = record.name === undefined ? fallback.name : record.name;
  if (typeof name !== "string" || name.trim() === "") throw new Error("theme.name must be a non-empty string");

  let radius = fallback.radius;
  if (record.radius !== undefined) {
    if (typeof record.radius !== "number" || !Number.isFinite(record.radius)) {
      throw new Error("theme.radius must be a number");
    }
    radius = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(record.radius)));
  }

  const font = record.font === undefined ? fallback.font : record.font;
  if (!FONTS.includes(font as FontChoice)) throw new Error(`theme.font must be one of ${FONTS.join(", ")}`);

  const density = record.density === undefined ? fallback.density : record.density;
  if (!DENSITIES.includes(density as Density)) {
    throw new Error(`theme.density must be one of ${DENSITIES.join(", ")}`);
  }

  const contrast = record.contrast === undefined ? fallback.contrast : record.contrast;
  if (contrast !== undefined && !CONTRASTS.includes(contrast as Contrast)) {
    throw new Error(`theme.contrast must be one of ${CONTRASTS.join(", ")}`);
  }

  return {
    name: name.trim().slice(0, 60),
    light: currentGreys(name.trim(), "light", parsePalette(record.light, fallback.light, "theme.light")),
    dark: currentGreys(name.trim(), "dark", parsePalette(record.dark, fallback.dark, "theme.dark")),
    radius,
    font: font as FontChoice,
    density: density as Density,
    charts: parseCharts(record.charts, fallback),
    ...(record.code !== undefined ? { code: parseCode(record.code) } : fallback.code ? { code: fallback.code } : {}),
    ...(contrast === "more" ? { contrast: "more" as const } : {}),
  };
}

function parseCodeMode(input: unknown, path: string): Partial<CodeColors> | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "object" || input === null) throw new Error(`${path} must be an object`);
  const out: Partial<CodeColors> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(CODE_TOKENS as readonly string[]).includes(key)) throw new Error(`${path}.${key} is not a code token; use one of ${CODE_TOKENS.join(", ")}`);
    if (!isHex(value)) throw new Error(`${path}.${key} must be a hex colour like #1A2B3C`);
    out[key as keyof CodeColors] = normalizeHex(value);
  }
  return out;
}

function parseCode(input: unknown): NonNullable<Theme["code"]> {
  if (typeof input !== "object" || input === null) throw new Error("theme.code must be an object");
  const record = input as Record<string, unknown>;
  const light = parseCodeMode(record.light, "theme.code.light");
  const dark = parseCodeMode(record.dark, "theme.code.dark");
  return { ...(light ? { light } : {}), ...(dark ? { dark } : {}) };
}

/** A theme saved before chart colours were part of it gets the fallback's. */
function parseCharts(input: unknown, fallback: Theme): Theme["charts"] {
  const base = fallback.charts ?? { light: chartColors("Classic", "light"), dark: chartColors("Classic", "dark") };
  if (input === undefined) return base;
  if (typeof input !== "object" || input === null) throw new Error("theme.charts must be an object");
  const record = input as Record<string, unknown>;
  const light = parseChartColors(record.light, base.light, "theme.charts.light");
  const dark = parseChartColors(record.dark, base.dark, "theme.charts.dark");
  // A theme saved with an order since changed, or with hues as they used to be, takes its current form; colours a person chose are kept.
  const current = (colors: ChartColors, mode: "light" | "dark"): ChartColors => {
    const series = currentSeries(colors.series, mode);
    if (series === colors.series) return colors;
    return { series, sequential: currentHue(colors.sequential, mode), diverging: [currentHue(colors.diverging[0], mode), currentHue(colors.diverging[1], mode)] };
  };
  return { light: current(light, "light"), dark: current(dark, "dark") };
}

/** Returns the theme with different chart colours. */
export function withCharts(theme: Theme, charts: Theme["charts"]): Theme {
  return { ...theme, name: "Custom", charts };
}

/**
 * Returns the theme with a new accent. The accent is adjusted per mode so it
 * stays visible on that mode's background, and the on-accent colour is picked
 * for readability, so any colour a person chooses yields a usable theme.
 */
export function withAccent(theme: Theme, accent: string): Theme {
  const apply = (palette: Palette): Palette => {
    const adjusted = ensureContrast(accent, palette.background, 3);
    return { ...palette, accent: adjusted, onAccent: readableOn(adjusted) };
  };
  return { ...theme, name: "Custom", light: apply(theme.light), dark: apply(theme.dark) };
}

export function themesEqual(a: Theme, b: Theme): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
