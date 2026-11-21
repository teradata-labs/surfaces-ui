import { contrast, hexToRgb, isHex, luminance, mix, normalizeHex } from "./color.js";

/** The colours charts draw data with, for one mode. */
export interface ChartColors {
  /**
   * Categorical colours, in the order series take them. A chart assigns them
   * in sequence and never cycles: a ninth series is folded into "Other".
   */
  series: string[];
  /** The hue for magnitude (heatmaps, intensity): one hue from faint to strong. */
  sequential: string;
  /** The two poles of a scale with a meaningful middle: below it, then above it. */
  diverging: [string, string];
}

export const SERIES_MIN = 2;
export const SERIES_MAX = 12;

/**
 * Thirteen hues built in OKLCH, each as vivid as sRGB allows at its lightness
 * (to a chroma of 0.2), with a step for light surfaces and a step for dark ones.
 * Magenta sits between pink and purple for Berry's accent. Series draw from
 * the rest; yellow, mint and cyan are kept for tags and status, where a
 * label goes with the colour.
 *
 * The series hues do not share one lightness, on purpose. With red-green
 * colour blindness red, orange, amber and green are one hue, and teal, pink
 * and magenta another, so within each family the steps differ in lightness
 * instead: on light surfaces red is a crimson and green a forest green under
 * a brighter amber and orange, and pink and magenta sit below teal; on dark
 * surfaces green and teal are the bright ones. That is what keeps any two of
 * an order's first five colours apart for those readers (`LEGEND_SLOTS`).
 *
 * They are tested together: neighbours in every order, and any two of its
 * first five, stay apart with red-green colour blindness and without it, and
 * every hue a series uses reaches 3:1 on every preset's surfaces. Change one
 * only with `checkSeries` passing in both modes.
 */
export const HUES = {
  red: { light: "#C21725", dark: "#FF605B" },
  orange: { light: "#DA6600", dark: "#FE7802" },
  amber: { light: "#B27805", dark: "#EC9F00" },
  yellow: { light: "#DABD0A", dark: "#F4D40F" },
  green: { light: "#006A18", dark: "#65EA71" },
  mint: { light: "#089772", dark: "#00D7A4" },
  teal: { light: "#079390", dark: "#00CBC6" },
  cyan: { light: "#078EAD", dark: "#04C4ED" },
  blue: { light: "#217BF4", dark: "#73ACFF" },
  indigo: { light: "#696BF4", dark: "#97A1FF" },
  purple: { light: "#9D57DE", dark: "#BF82FF" },
  pink: { light: "#AC0D71", dark: "#E853A5" },
  magenta: { light: "#A52DA0", dark: "#D25BCB" },
} as const;

/**
 * The steps the series hues had before they were set apart in lightness. A theme saved with a named order in
 * these is moved to the current steps when it is read (`currentSeries`).
 */
export const RETIRED_HUES: Partial<Record<keyof typeof HUES, { light: string; dark: string }>>[] = [
  {
    red: { light: "#DE3B3D", dark: "#FF726B" },
    orange: { light: "#C85D02", dark: "#FE7802" },
    amber: { light: "#B27805", dark: "#FCAB05" },
    green: { light: "#029B29", dark: "#39C34B" },
    teal: { light: "#079390", dark: "#0EBCB8" },
    blue: { light: "#217BF4", dark: "#68A5FF" },
    indigo: { light: "#696BF4", dark: "#909AFE" },
    pink: { light: "#D13D91", dark: "#FC65B6" },
    magenta: { light: "#BE47B8", dark: "#E76EDF" },
  },
];

export type HueName = keyof typeof HUES;

/**
 * Named orders of eight hues, one leading with each preset's accent. The order
 * is what keeps series distinguishable, so these are not arbitrary. Each was
 * found by trying every order of the series hues that starts with its first
 * hue, and keeping the one that does best by two measures, in both modes:
 *
 * - Any two of the first five (`LEGEND_SLOTS`) are apart, not only
 *   neighbours, to an eye with full colour vision and to one with red-green
 *   colour blindness. A chart split five ways is read by its legend, where
 *   the first colour is matched against the third as often as against the
 *   second; blue and indigo, which are nearly one colour, are never both
 *   among them.
 * - Neighbours anywhere in the order stay apart with red-green colour
 *   blindness too.
 *
 * Hue alone cannot keep every pair of five apart with red-green colour
 * blindness (red, orange, amber and green fall together), so the hues are
 * set apart in lightness as well (see `HUES`). Past five a chart still
 * leans on its names and its table. Aurora keeps blue, indigo,
 * purple and green out of its second and third places: next to its teal they
 * read as one cool family. Moss keeps teal, blue and indigo out of the same
 * places for the same reason, next to its green.
 */
export const SERIES_ORDERS = {
  Classic: ["blue", "red", "teal", "amber", "magenta", "green", "indigo", "orange"],
  Aurora: ["teal", "amber", "magenta", "red", "indigo", "green", "blue", "orange"],
  Sand: ["orange", "teal", "purple", "green", "pink", "blue", "red", "indigo"],
  Ink: ["indigo", "red", "teal", "amber", "magenta", "green", "blue", "orange"],
  Berry: ["magenta", "red", "teal", "amber", "indigo", "green", "blue", "orange"],
  Moss: ["green", "magenta", "red", "blue", "amber", "teal", "orange", "indigo"],
} as const satisfies Record<string, readonly HueName[]>;

/**
 * Orders a named order used to have. A theme saved with one of these is moved to the order's current form when it is
 * read, so a saved theme does not keep two blues among its first colours.
 */
export const RETIRED_ORDERS: Partial<Record<SeriesOrderName, readonly HueName[][]>> = {
  Classic: [["blue", "red", "indigo", "orange", "teal", "amber", "purple", "green"]],
  Aurora: [
    ["teal", "orange", "blue", "red", "indigo", "amber", "purple", "green"],
    ["teal", "orange", "pink", "amber", "purple", "red", "indigo", "green"],
  ],
  Sand: [["orange", "blue", "green", "indigo", "red", "purple", "amber", "magenta"]],
  Ink: [["indigo", "red", "blue", "orange", "teal", "amber", "purple", "green"]],
  Berry: [["magenta", "amber", "blue", "orange", "indigo", "green", "purple", "red"]],
  Moss: [["green", "purple", "amber", "blue", "red", "indigo", "orange", "teal"]],
};

/**
 * The current form of a named order, if `series` is one as it used to be (an order since changed, or hues since
 * given other steps); otherwise `series` as it is.
 */
export function currentSeries(series: string[], mode: "light" | "dark"): string[] {
  const wanted = series.map((c) => c.toUpperCase()).join(",");
  const tables: Partial<Record<HueName, { light: string; dark: string }>>[] = [HUES, ...RETIRED_HUES];
  for (const name of Object.keys(SERIES_ORDERS) as SeriesOrderName[]) {
    const forms: (readonly HueName[])[] = [SERIES_ORDERS[name], ...(RETIRED_ORDERS[name] ?? [])];
    for (const table of tables)
      for (const hues of forms)
        if (hues.map((hue) => (table[hue] ?? HUES[hue])[mode]).join(",").toUpperCase() === wanted) return chartColors(name, mode).series;
  }
  return series;
}

/** A hue's current step, if `color` is a step it used to have; otherwise `color` as it is. */
export function currentHue(color: string, mode: "light" | "dark"): string {
  for (const table of RETIRED_HUES)
    for (const [hue, steps] of Object.entries(table) as [HueName, { light: string; dark: string }][]) if (steps[mode].toUpperCase() === color.toUpperCase() && HUES[hue][mode] !== steps[mode]) return HUES[hue][mode];
  return color;
}

export type SeriesOrderName = keyof typeof SERIES_ORDERS;
export const SERIES_ORDER_NAMES = Object.keys(SERIES_ORDERS) as SeriesOrderName[];

/** Chart colours for a named order. Magnitude uses the first hue; the two-sided scale runs from red to blue. */
export function chartColors(order: SeriesOrderName, mode: "light" | "dark"): ChartColors {
  const hues = SERIES_ORDERS[order];
  // Red against blue reads as opposite; a theme that leads with indigo keeps it as the cool pole.
  const cool: HueName = hues[0] === "blue" || hues[0] === "indigo" ? hues[0] : "blue";
  return { series: hues.map((hue) => HUES[hue][mode]), sequential: HUES[hues[0]][mode], diverging: [HUES.red[mode], HUES[cool][mode]] };
}

/** The named order a set of series colours came from, if it is one of them. */
export function seriesOrderOf(series: string[], mode: "light" | "dark"): SeriesOrderName | undefined {
  const wanted = series.map((c) => c.toUpperCase()).join(",");
  return SERIES_ORDER_NAMES.find((name) => chartColors(name, mode).series.join(",").toUpperCase() === wanted);
}

/** Validates untrusted chart colours, filling anything missing from `fallback`. Throws with the offending path. */
export function parseChartColors(input: unknown, fallback: ChartColors, path: string): ChartColors {
  if (input === undefined) return fallback;
  if (typeof input !== "object" || input === null) throw new Error(`${path} must be an object`);
  const record = input as Record<string, unknown>;
  const hex = (value: unknown, where: string) => {
    if (!isHex(value)) throw new Error(`${where} must be a hex colour like #1A2B3C`);
    return normalizeHex(value);
  };
  let series = fallback.series;
  if (record.series !== undefined) {
    if (!Array.isArray(record.series) || record.series.length < SERIES_MIN || record.series.length > SERIES_MAX) {
      throw new Error(`${path}.series must be a list of ${SERIES_MIN} to ${SERIES_MAX} colours`);
    }
    series = record.series.map((value, i) => hex(value, `${path}.series[${i}]`));
  }
  let diverging = fallback.diverging;
  if (record.diverging !== undefined) {
    if (!Array.isArray(record.diverging) || record.diverging.length !== 2) throw new Error(`${path}.diverging must be two colours`);
    diverging = [hex(record.diverging[0], `${path}.diverging[0]`), hex(record.diverging[1], `${path}.diverging[1]`)];
  }
  return { series, sequential: record.sequential === undefined ? fallback.sequential : hex(record.sequential, `${path}.sequential`), diverging };
}

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Machado, Oliveira and Fernandes (2009) at full severity, in linear RGB. */
const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;

function oklab([r, g, b]: number[]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function linearRgb(hex: string, kind?: keyof typeof CVD): number[] {
  const { r, g, b } = hexToRgb(hex);
  const rgb = [linear(r), linear(g), linear(b)];
  if (!kind) return rgb;
  return CVD[kind].map((row) => Math.min(1, Math.max(0, row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!)));
}

/**
 * How different two colours look, as distance in OKLab times 100. With a
 * `kind`, both are first seen as someone with that colour blindness sees them.
 */
export function colorDistance(a: string, b: string, kind?: keyof typeof CVD): number {
  const [l1, a1, b1] = oklab(linearRgb(a, kind));
  const [l2, a2, b2] = oklab(linearRgb(b, kind));
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export interface SeriesIssue {
  /** "error" should be fixed; "warning" is acceptable when the chart also labels its series or offers a table. */
  severity: "error" | "warning";
  /** The 1-based slots involved. */
  slots: number[];
  message: string;
}

/** Neighbouring series closer than this look alike to everyone. */
export const DISTANCE_FLOOR = 15;
/** Neighbouring series closer than this look alike with red-green colour blindness. */
export const CVD_FLOOR = 6;
export const CVD_TARGET = 8;
/** How many series a chart's legend is commonly read across: any two of the first this many must be apart, neighbours or not. */
export const LEGEND_SLOTS = 5;
/** Two of the first `LEGEND_SLOTS` colours closer than this read as one colour in a legend. */
export const LEGEND_FLOOR = 13;
export const MARK_CONTRAST = 3;

/**
 * Checks a categorical palette against the surface it will be drawn on:
 * neighbours must be told apart by everyone, including people with red-green
 * colour blindness, any two of the first `LEGEND_SLOTS` must be told apart
 * (a stack of five is read from its legend, where every colour is matched
 * against every other; two that only red-green colour blindness brings
 * together are a warning), and each colour should stand out from the surface.
 */
export function checkSeries(series: string[], surface: string): SeriesIssue[] {
  const issues: SeriesIssue[] = [];
  for (let i = 0; i + 1 < series.length; i++) {
    const [a, b] = [series[i]!, series[i + 1]!];
    const slots = [i + 1, i + 2];
    const seen = colorDistance(a, b);
    const blind = Math.min(colorDistance(a, b, "protan"), colorDistance(a, b, "deutan"));
    if (seen < DISTANCE_FLOOR) issues.push({ severity: "error", slots, message: `Colours ${slots[0]} and ${slots[1]} are too alike to tell apart.` });
    else if (blind < CVD_FLOOR) issues.push({ severity: "error", slots, message: `Colours ${slots[0]} and ${slots[1]} look the same with red-green colour blindness.` });
    else if (blind < CVD_TARGET) issues.push({ severity: "warning", slots, message: `Colours ${slots[0]} and ${slots[1]} are close with red-green colour blindness; label the series.` });
  }
  // The first few colours are matched against each other in a legend, so they must all differ, not only in turn.
  for (let i = 0; i < Math.min(series.length, LEGEND_SLOTS); i++) {
    for (let j = i + 2; j < Math.min(series.length, LEGEND_SLOTS); j++) {
      const [a, b] = [series[i]!, series[j]!];
      if (colorDistance(a, b) < LEGEND_FLOOR) {
        issues.push({ severity: "error", slots: [i + 1, j + 1], message: `Colours ${i + 1} and ${j + 1} are too alike to tell apart in a legend.` });
      } else if (Math.min(colorDistance(a, b, "protan"), colorDistance(a, b, "deutan")) < CVD_TARGET) {
        issues.push({ severity: "warning", slots: [i + 1, j + 1], message: `Colours ${i + 1} and ${j + 1} are close with red-green colour blindness; make one lighter or darker, or label the series.` });
      }
    }
  }
  series.forEach((color, i) => {
    if (contrast(color, surface) < MARK_CONTRAST) {
      issues.push({ severity: "warning", slots: [i + 1], message: `Colour ${i + 1} is faint against the background; charts using it should label values or offer a table.` });
    }
  });
  return issues;
}

/**
 * One hue from faint to strong, for magnitude. The faint end sits near the
 * surface so "almost nothing" recedes, in light and dark alike.
 */
export function sequentialRamp(hue: string, surface: string, steps = 7): string[] {
  const dark = luminance(surface) < 0.5;
  const faint = mix(surface, hue, dark ? 0.3 : 0.2);
  const strong = mix(hue, dark ? "#FFFFFF" : "#000000", dark ? 0.35 : 0.4);
  const middle = (steps - 1) / 2;
  return Array.from({ length: steps }, (_, i) => (i <= middle ? mix(faint, hue, middle === 0 ? 1 : i / middle) : mix(hue, strong, (i - middle) / (steps - 1 - middle))));
}

/**
 * A scale with a meaningful middle: the first pole fading to a neutral grey,
 * then strengthening to the second. The middle is grey, never a hue, so it
 * reads as "neither".
 */
export function divergingRamp(poles: [string, string], surface: string, steps = 7): string[] {
  const dark = luminance(surface) < 0.5;
  const neutral = mix(surface, dark ? "#FFFFFF" : "#000000", dark ? 0.16 : 0.07);
  const arm = Math.floor(steps / 2);
  const side = (pole: string) => Array.from({ length: arm }, (_, i) => mix(neutral, pole, (arm - i) / arm));
  return [...side(poles[0]), neutral, ...side(poles[1]).reverse()];
}
