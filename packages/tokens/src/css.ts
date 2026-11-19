import { rgbChannels } from "./color.js";
import { GLASS, type ResolvedColors, type ResolvedTheme, resolveTheme } from "./derive.js";
import type { Theme } from "./theme.js";

/** Prefix of every CSS custom property this library defines. */
export const VAR_PREFIX = "--sf";

/** Smallest pressable size with a mouse (WCAG 2.2 AA, 2.5.8) and with a finger (2.5.5). */
export const TARGET_MIN = 24;
export const TARGET_MIN_TOUCH = 44;

/**
 * Timing for everything that moves. Fast answers a press or a hover; base
 * opens a menu or a popover; slow moves a sheet or a drawer. The spring
 * overshoots a little, for things that arrive; the rest ease out.
 *
 * Gummy is a damped spring (about 13% past, a little back, then still) over
 * `springy` milliseconds: a press springs back with it once released, a thumb
 * slides with it to the option picked, and a control that switches on or off
 * gives one soft squish. Where `linear()` easing is missing it falls back to a
 * cubic curve with a single overshoot.
 */
export const MOTION = {
  fast: 120,
  base: 200,
  slow: 320,
  ease: "cubic-bezier(0.2, 0, 0, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.3, 0.64, 1)",
  springy: 520,
  gummy: "linear(0, 0.116, 0.366, 0.639, 0.867, 1.021, 1.103, 1.126, 1.113, 1.082, 1.047, 1.018, 0.998, 0.987, 0.984, 0.986, 0.99, 0.994, 0.998, 1, 1)",
  gummyFallback: "cubic-bezier(0.34, 1.45, 0.64, 1)",
  pressScale: 0.97,
} as const;

function colorVars(c: ResolvedColors): Record<string, string> {
  const vars: Record<string, string> = {
    "color-bg": c.background,
    "color-surface": c.surface,
    "color-surface-raised": c.surfaceRaised,
    "color-text": c.text,
    "color-muted": c.muted,
    "color-accent": c.accent,
    "color-on-accent": c.onAccent,
    "color-accent-soft": c.accentSoft,
    "color-accent-text": c.accentText,
    "color-border": c.border,
    "color-border-strong": c.borderStrong,
    "color-focus": c.focus,
    "color-success": c.success,
    "color-warning": c.warning,
    "color-danger": c.danger,
    "color-info": c.info,
  };
  c.series.forEach((value, i) => {
    vars[`series-${i + 1}`] = value;
  });
  c.sequential.forEach((value, i) => {
    vars[`sequential-${i + 1}`] = value;
  });
  c.diverging.forEach((value, i) => {
    vars[`diverging-${i + 1}`] = value;
  });
  for (const [token, value] of Object.entries(c.code)) vars[`code-${token}`] = value;
  vars["color-divider"] = c.divider;
  vars["color-accent-hover"] = c.accentHover;
  vars["color-accent-pressed"] = c.accentPressed;
  const range = (name: string, values: readonly string[]) => values.forEach((value, i) => (vars[`${name}-${i + 1}`] = value));
  range("color-bg", c.bg);
  range("color-label", c.label);
  range("color-fill", c.fill);
  range("color-gray", c.gray);
  // Glass is assembled from channels, so the see-through amounts can be turned off in one place (see GLASS_FALLBACKS).
  vars["glass-tint"] = rgbChannels(c.glass.tint);
  vars["glass-dim-color"] = rgbChannels(c.glass.dim);
  vars["glass-edge-color"] = rgbChannels(c.glass.edge);
  vars["glass-edge-alpha"] = String(c.glass.edgeAlpha);
  vars["glass-highlight-alpha"] = String(c.glass.highlightAlpha);
  vars["glass-muted"] = c.glass.muted;
  vars["glass-shadow"] = c.glass.shadow;
  return vars;
}

/**
 * The glass layers, built from the per-mode channels above. Declared once,
 * whatever the mode, so the fallbacks below change them for every mode.
 */
function glassVars(): Record<string, string> {
  const p = VAR_PREFIX;
  return {
    "glass-alpha-regular": String(GLASS.regular),
    "glass-alpha-thick": String(GLASS.thick),
    "glass-alpha-clear": String(GLASS.clear),
    "glass-alpha-dim": String(GLASS.dim),
    "glass-blur": `${GLASS.blur}px`,
    "glass-saturate": `${GLASS.saturate}%`,
    "glass-regular": `rgb(var(${p}-glass-tint) / var(${p}-glass-alpha-regular))`,
    "glass-thick": `rgb(var(${p}-glass-tint) / var(${p}-glass-alpha-thick))`,
    "glass-clear": `rgb(var(${p}-glass-tint) / var(${p}-glass-alpha-clear))`,
    "glass-dim": `rgb(var(${p}-glass-dim-color) / var(${p}-glass-alpha-dim))`,
    "glass-edge": `rgb(var(${p}-glass-edge-color) / var(${p}-glass-edge-alpha))`,
    "glass-highlight": `rgb(255 255 255 / var(${p}-glass-highlight-alpha))`,
    "glass-filter": `blur(var(${p}-glass-blur)) saturate(var(${p}-glass-saturate))`,
  };
}

/**
 * When glass is turned off. Each keeps the edge and the layout, and only takes
 * away what is see-through: a person who asks for less transparency or more
 * contrast gets solid panes, forced colours get the system's own, and a
 * browser without backdrop blur gets panes nearly solid so text never sits
 * on raw content.
 */
const SOLID_GLASS = { "glass-alpha-regular": "1", "glass-alpha-thick": "1", "glass-alpha-clear": "1", "glass-blur": "0px", "glass-saturate": "100%" };
/** More contrast: glass is solid with a firm edge, and every pane and control draws its edge (`--sf-color-edge`). */
const MORE_CONTRAST = { ...SOLID_GLASS, "glass-edge-alpha": "0.6", "glass-highlight-alpha": "0", "color-edge": `var(${VAR_PREFIX}-color-border-strong)` };

function glassFallbacks(sel: string): string[] {
  const solid = SOLID_GLASS;
  const nearly = String(GLASS.fallback);
  return [
    `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n${block(sel, { "glass-alpha-regular": nearly, "glass-alpha-thick": nearly, "glass-alpha-clear": nearly })}\n}`,
    `@media (prefers-reduced-transparency: reduce) {\n${block(sel, solid)}\n}`,
    `@media (prefers-contrast: more) {\n${block(sel, MORE_CONTRAST)}\n}`,
    `@media (forced-colors: active) {\n${block(sel, { ...solid, "glass-shadow": "none" })}\n}`,
  ];
}

function sharedVars(t: ResolvedTheme): Record<string, string> {
  const u = t.scale.unit;
  return {
    "radius": `${t.radius}px`,
    "radius-sm": `${Math.round(t.radius / 2)}px`,
    "radius-lg": `${Math.round(t.radius * 1.5)}px`,
    "font": t.fontFamily,
    "font-mono": t.monoFamily,
    "font-size": `${t.scale.fontSize}px`,
    "font-size-sm": `${t.scale.fontSize - 2}px`,
    "font-size-lg": `${t.scale.fontSize + 4}px`,
    // A type scale: caption, body, headline, then three title sizes. Weight and size carry hierarchy, so a heading needs no box.
    "font-size-xs": `${t.scale.fontSize - 3}px`,
    "font-size-title-3": `${t.scale.fontSize + 3}px`,
    "font-size-title-2": `${t.scale.fontSize + 6}px`,
    "font-size-title-1": `${t.scale.fontSize + 10}px`,
    "font-size-large-title": `${t.scale.fontSize + 18}px`,
    "font-weight-regular": "400",
    "font-weight-medium": "500",
    "font-weight-semibold": "600",
    "font-weight-bold": "700",
    "line-height": "1.45",
    "line-height-tight": "1.2",
    "letter-spacing-title": "-0.01em",
    // Motion: short, eased, and gone for people who ask for none (see themeCss). A press answers at once and a sheet
    // settles with a little spring; nothing moves only to decorate.
    "duration-fast": `${MOTION.fast}ms`,
    "duration": `${MOTION.base}ms`,
    "duration-slow": `${MOTION.slow}ms`,
    "ease": MOTION.ease,
    "ease-out": MOTION.easeOut,
    "ease-spring": MOTION.spring,
    "duration-springy": `${MOTION.springy}ms`,
    "ease-gummy": MOTION.gummyFallback,
    "press-scale": String(MOTION.pressScale),
    // Concentric corners: an item inside a padded container takes the container's radius less the padding.
    "radius-xl": `${t.radius * 2}px`,
    "radius-full": "999px",
    "space-1": `${u}px`,
    "space-2": `${u * 2}px`,
    "space-3": `${u * 3}px`,
    "space-4": `${u * 4}px`,
    "space-6": `${u * 6}px`,
    "space-8": `${u * 8}px`,
    "control-height": `${t.scale.controlHeight}px`,
    // How tall a button, field or icon button is: follows density (32px comfortable, 24px compact). Controls use it with
    // max(--sf-target-min, ...), so on a touch screen they never go under the larger touch target.
    "control-size": `${t.scale.controlHeight - 4}px`,
    "row-height": `${t.scale.rowHeight}px`,
    // WCAG 2.2 target size (2.5.8): nothing a person presses is smaller than this.
    "target-min": `${TARGET_MIN}px`,
  };
}

function block(selector: string, vars: Record<string, string>, extra = ""): string {
  const lines = Object.entries(vars).map(([k, v]) => `  ${VAR_PREFIX}-${k}: ${v};`);
  if (extra) lines.push(`  ${extra}`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

/** Variables as a flat map for one mode, e.g. for inline styles or tests. */
export function themeVars(theme: Theme, mode: "light" | "dark"): Record<string, string> {
  const resolved = resolveTheme(theme);
  const all = { ...sharedVars(resolved), ...glassVars(), ...colorVars(resolved[mode]) };
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [`${VAR_PREFIX}-${k}`, v]));
}

export interface ThemeCssOptions {
  /**
   * Element the variables are set on. Defaults to `:root`. Use a class or
   * attribute selector to theme one region of a page.
   */
  selector?: string;
}

/**
 * CSS that defines every `--sf-*` variable for a theme.
 *
 * Light values apply by default and dark values follow the system setting.
 * Setting `data-theme="light"` or `data-theme="dark"` on the scoped element
 * forces a mode regardless of the system.
 */
export function themeCss(theme: Theme, options: ThemeCssOptions = {}): string {
  const sel = options.selector ?? ":root";
  const resolved = resolveTheme(theme);
  const light = colorVars(resolved.light);
  const dark = colorVars(resolved.dark);
  return [
    block(sel, { ...sharedVars(resolved), ...glassVars(), "color-edge": "transparent", ...light }, "color-scheme: light;"),
    `@media (prefers-color-scheme: dark) {\n${block(`${sel}:not([data-theme="light"])`, dark, "color-scheme: dark;")}\n}`,
    block(`${sel}[data-theme="dark"]`, dark, "color-scheme: dark;"),
    `@media (pointer: coarse) {\n${block(sel, { "target-min": `${TARGET_MIN_TOUCH}px` })}\n}`,
    ...glassFallbacks(sel),
    // A theme that asks for more contrast gets it whatever the person's own setting, after the fallbacks so it wins.
    ...(resolved.contrast === "more" ? [block(sel, MORE_CONTRAST)] : []),
    `@supports (transition-timing-function: linear(0, 1)) {\n${block(sel, { "ease-gummy": MOTION.gummy })}\n}`,
    // 2.3.3: no movement for people who ask for none. Durations go to zero, so anything timed to them ends at once,
    // and a press no longer shrinks.
    `@media (prefers-reduced-motion: reduce) {\n${block(sel, { "duration-fast": "0ms", "duration": "0ms", "duration-slow": "0ms", "duration-springy": "0ms", "press-scale": "1" })}\n}`,
  ].join("\n\n");
}
