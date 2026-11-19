/** Colour maths used to derive readable, consistent tokens from a few inputs. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Returns the colour as upper-case #RRGGBB. Throws on anything else. */
export function normalizeHex(value: string): string {
  if (!isHex(value)) throw new Error(`Not a hex colour: ${String(value)}`);
  const body = value.slice(1);
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(normalizeHex(hex).slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mixes `amount` (0–1) of `b` into `a`. */
export function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);

/** A colour in OKLab: perceived lightness and two opponent axes. */
export function toOklab(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function fromOklab([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return rgbToHex({
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}

/**
 * Mixes `amount` (0–1) of `b` into `a` in OKLab, so the steps between two
 * colours look evenly spaced and a tinted grey keeps its tint.
 */
export function mixOklab(a: string, b: string, amount: number): string {
  const x = toOklab(a);
  const y = toOklab(b);
  const t = Math.max(0, Math.min(1, amount));
  return fromOklab([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/**
 * The step from `from` toward `to` that is furthest along while still reaching
 * `ratio` contrast against every one of `grounds`. Used to generate a range of
 * levels by how readable each must be, rather than by a fixed share, so every
 * theme keeps its hue and every level passes.
 */
export function stepByContrast(from: string, to: string, ratio: number, grounds: string[]): string {
  const passes = (c: string) => grounds.every((g) => contrast(c, g) >= ratio);
  if (!passes(from)) return normalizeHex(from);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (passes(mixOklab(from, to, mid))) lo = mid;
    else hi = mid;
  }
  return mixOklab(from, to, lo);
}

/** A colour's channels as `R G B`, for `rgb(var(--x) / alpha)` in CSS. */
export function rgbChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/** Lays `color` at `alpha` over `under`: what a see-through layer looks like on a solid patch. */
export function over(color: string, alpha: number, under: string): string {
  return mix(under, color, alpha);
}

/** Black or white, whichever reads better on `background`. */
export function readableOn(background: string): string {
  return contrast(background, "#FFFFFF") >= contrast(background, "#000000") ? "#FFFFFF" : "#000000";
}

/**
 * Moves a colour's lightness toward white or black until it reaches `ratio`
 * contrast against `against`, keeping hue and saturation. Returns the closest
 * it can get if the ratio is out of reach.
 */
export function ensureContrast(color: string, against: string, ratio: number): string {
  if (contrast(color, against) >= ratio) return normalizeHex(color);
  const hsl = rgbToHsl(hexToRgb(color));
  const lighten = luminance(against) < 0.5;
  let best = normalizeHex(color);
  for (let step = 1; step <= 50; step++) {
    const l = lighten ? hsl.l + ((1 - hsl.l) * step) / 50 : hsl.l - (hsl.l * step) / 50;
    best = rgbToHex(hslToRgb({ ...hsl, l }));
    if (contrast(best, against) >= ratio) break;
  }
  return best;
}

/** Rotates a colour's hue by `degrees`. */
export function rotateHue(color: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(color));
  return rgbToHex(hslToRgb({ ...hsl, h: hsl.h + degrees }));
}
