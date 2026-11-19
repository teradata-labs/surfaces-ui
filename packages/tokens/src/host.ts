import { colorDistance } from "./charts.js";
import { isHex, normalizeHex } from "./color.js";
import { resolveColors } from "./derive.js";
import { presets } from "./presets.js";
import { RADIUS_MAX, RADIUS_MIN, type Theme, withAccent } from "./theme.js";

/**
 * The style variables an embedding host shares with a page inside it, by the names MCP Apps uses
 * (`hostContext.styles.variables`). Only the ones a theme can be read from are listed.
 */
export type HostStyleVariables = Partial<Record<"--color-background-primary" | "--color-background-secondary" | "--color-text-primary" | "--color-text-secondary" | "--color-border-primary" | "--color-ring-primary" | "--border-radius-md", string>>;

/** A theme's colours in one mode as host style variables, for a host that embeds a page drawn with this library. */
export function hostStyleVariables(theme: Theme, mode: "light" | "dark"): HostStyleVariables {
  const c = resolveColors(theme[mode], theme.charts[mode]);
  return {
    "--color-background-primary": c.background,
    "--color-background-secondary": c.surface,
    "--color-text-primary": c.text,
    "--color-text-secondary": c.muted,
    "--color-border-primary": c.border,
    "--color-ring-primary": c.accent,
    "--border-radius-md": `${theme.radius}px`,
  };
}

/**
 * The theme a page inside a host should take from the host's style variables: the preset whose accent is nearest the
 * host's (so its surfaces and chart colours belong with it), carrying the host's own accent and corner radius. Anything
 * missing or not a colour is ignored, and with no accent the base theme is kept, so a host that shares nothing changes
 * nothing. The accent is adjusted to stay visible, as any accent is.
 */
export function themeFromHostStyles(variables: Record<string, string | undefined> | undefined, base: Theme): Theme {
  const accent = variables?.["--color-ring-primary"]?.trim();
  if (!accent || !isHex(accent)) return base;
  const wanted = normalizeHex(accent);
  const near = (theme: Theme) => Math.min(colorDistance(theme.light.accent, wanted), colorDistance(theme.dark.accent, wanted));
  const preset = [...presets].sort((a, b) => near(a) - near(b))[0] ?? base;
  let theme = near(preset) < 1 ? preset : { ...withAccent(preset, wanted), charts: preset.charts };
  const radius = Number.parseFloat(variables?.["--border-radius-md"] ?? "");
  if (Number.isFinite(radius)) theme = { ...theme, radius: Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.round(radius))) };
  return theme;
}
