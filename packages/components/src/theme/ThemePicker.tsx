import {
  type Density,
  type FontChoice,
  type Mode,
  type Theme,
  DENSITIES,
  FONTS,
  MODES,
  RADIUS_MAX,
  RADIUS_MIN,
  SERIES_ORDERS,
  SERIES_ORDER_NAMES,
  type SeriesOrderName,
  chartColors,
  checkSeries,
  presets as builtInPresets,
  resolveColors,
  seriesOrderOf,
  themesEqual,
  withAccent,
  withCharts,
} from "@surfaces-ui/tokens";
import { useId } from "react";
import { useTheme } from "./ThemeProvider.js";

export interface ThemePickerProps {
  /** Themes offered as one-click choices. Defaults to the built-in presets, then the ThemeProvider's own `themes`. */
  presets?: readonly Theme[];
  /** Hide controls a product does not want to expose. */
  hide?: Array<"mode" | "presets" | "accent" | "charts" | "radius" | "font" | "density">;
  className?: string;
}

const MODE_LABEL: Record<Mode, string> = { system: "System", light: "Light", dark: "Dark" };
const FONT_LABEL: Record<FontChoice, string> = {
  system: "Sans",
  rounded: "Rounded",
  serif: "Serif",
  mono: "Mono",
};
const DENSITY_LABEL: Record<Density, string> = { comfortable: "Comfortable", compact: "Compact" };

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange(value: T): void;
}

function Segmented<T extends string>({ label, value, options, labels, onChange }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className="sf-field">
      <legend className="sf-label">{label}</legend>
      <div className="sf-segmented">
        {options.map((option) => (
          <label key={option} className="sf-segment" data-checked={option === value || undefined}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            <span>{labels[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Lets a person choose how the product looks: light or dark, a preset, their
 * own accent colour, the colours charts use, corner radius, font and density.
 * Chart colours are checked as they are edited, so a palette whose
 * neighbours would be confused is flagged before it reaches a chart. Reads and writes the
 * nearest ThemeProvider, so changes apply live and persist through its store.
 */
export function ThemePicker({ presets: given, hide = [], className }: ThemePickerProps) {
  const { theme, mode, resolvedMode, setTheme, setMode, themes } = useTheme();
  const presets = given ?? [...builtInPresets, ...themes.filter((t) => !builtInPresets.some((p) => p.name.toLowerCase() === t.name.toLowerCase()))];
  const accentId = useId();
  const radiusId = useId();
  const presetName = useId();
  const orderId = useId();
  const colors = resolveColors(theme[resolvedMode], theme.charts[resolvedMode]);
  const chart = theme.charts[resolvedMode];
  const order = seriesOrderOf(chart.series, resolvedMode);
  // Colours are judged against the surface charts are drawn on.
  const issues = checkSeries(chart.series, colors.surface);
  const clashes = issues.filter((issue) => issue.slots.length === 2);
  const faint = issues.filter((issue) => issue.slots.length === 1).map((issue) => issue.slots[0]!);
  const setChart = (change: Partial<typeof chart>) => setTheme(withCharts(theme, { ...theme.charts, [resolvedMode]: { ...chart, ...change } }));
  const show = (control: NonNullable<ThemePickerProps["hide"]>[number]) => !hide.includes(control);

  return (
    <div className={["sf-theme-picker", className].filter(Boolean).join(" ")}>
      {show("mode") && (
        <Segmented label="Appearance" value={mode} options={MODES} labels={MODE_LABEL} onChange={setMode} />
      )}

      {show("presets") && (
        <fieldset className="sf-field">
          <legend className="sf-label">Theme</legend>
          <div className="sf-preset-grid">
            {presets.map((preset) => {
              const c = resolveColors(preset[resolvedMode], preset.charts[resolvedMode]);
              const selected = themesEqual(preset, theme);
              return (
                <label key={preset.name} className="sf-preset" data-checked={selected || undefined}>
                  <input
                    type="radio"
                    name={presetName}
                    checked={selected}
                    onChange={() => setTheme(preset)}
                  />
                  <span
                    className="sf-preset-swatch"
                    aria-hidden="true"
                    style={{ background: c.background, borderColor: c.border, borderRadius: Math.min(preset.radius, 10) }}
                  >
                    <span style={{ background: c.surface, borderRadius: Math.min(preset.radius, 6) / 2 }}>
                      <span style={{ background: c.accent, borderRadius: Math.min(preset.radius, 6) / 2 }} />
                    </span>
                    {c.series.slice(0, 4).map((color, i) => (
                      <span key={i} className="sf-preset-bar" style={{ background: color, blockSize: `${[62, 100, 44, 80][i]}%`, borderRadius: Math.min(preset.radius, 4) / 2 }} />
                    ))}
                  </span>
                  <span className="sf-preset-name">{preset.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {show("accent") && (
        <div className="sf-field sf-field-row">
          <label className="sf-label" htmlFor={accentId}>
            Accent colour
          </label>
          <span className="sf-color">
            <input
              id={accentId}
              type="color"
              value={theme[resolvedMode].accent}
              onChange={(e) => setTheme(withAccent(theme, e.target.value))}
            />
            <code>{theme[resolvedMode].accent}</code>
          </span>
        </div>
      )}

      {show("charts") && (
        <fieldset className="sf-field">
          <legend className="sf-label">Chart colours</legend>
          <div className="sf-field-row">
            <label className="sf-chart-order-label" htmlFor={orderId}>
              Series order
            </label>
            <select
              id={orderId}
              className="sf-input"
              value={order ?? "custom"}
              onChange={(e) => {
                const name = e.target.value as SeriesOrderName;
                if (name in SERIES_ORDERS) setTheme(withCharts(theme, { light: chartColors(name, "light"), dark: chartColors(name, "dark") }));
              }}
            >
              {SERIES_ORDER_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}: {SERIES_ORDERS[name][0]} first
                </option>
              ))}
              {!order && <option value="custom">Your own colours</option>}
            </select>
          </div>
          <div className="sf-series-slots" role="group" aria-label={`Series colours, ${resolvedMode} mode`}>
            {chart.series.map((color, i) => (
              <input
                key={i}
                type="color"
                aria-label={`Series ${i + 1}`}
                title={`Series ${i + 1}: ${color}`}
                value={color}
                onChange={(e) => setChart({ series: chart.series.map((c, at) => (at === i ? e.target.value.toUpperCase() : c)) })}
              />
            ))}
          </div>
          <div className="sf-field-row">
            <span className="sf-ramp" role="img" aria-label="Scale for amounts, faint to strong">
              {colors.sequential.map((color, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </span>
            <input type="color" aria-label="Colour for amounts" value={chart.sequential} onChange={(e) => setChart({ sequential: e.target.value.toUpperCase() })} />
          </div>
          <div className="sf-field-row">
            <span className="sf-ramp" role="img" aria-label="Scale for values below and above a midpoint">
              {colors.diverging.map((color, i) => (
                <span key={i} style={{ background: color }} />
              ))}
            </span>
            <span className="sf-color">
              <input type="color" aria-label="Colour for below the midpoint" value={chart.diverging[0]} onChange={(e) => setChart({ diverging: [e.target.value.toUpperCase(), chart.diverging[1]] })} />
              <input type="color" aria-label="Colour for above the midpoint" value={chart.diverging[1]} onChange={(e) => setChart({ diverging: [chart.diverging[0], e.target.value.toUpperCase()] })} />
            </span>
          </div>
          <ul className="sf-series-issues" aria-live="polite" aria-label="Checks on these colours">
            {clashes.length === 0 ? (
              <li data-ok="">
                <span aria-hidden="true">✓</span> Neighbouring series can be told apart, with or without colour blindness.
              </li>
            ) : (
              clashes.map((issue) => (
                <li key={issue.message} data-severity={issue.severity}>
                  <span aria-hidden="true">{issue.severity === "error" ? "!" : "–"}</span> {issue.message}
                </li>
              ))
            )}
            {faint.length > 0 && (
              <li data-severity="warning">
                <span aria-hidden="true">–</span> {faint.length === 1 ? `Colour ${faint[0]} is` : `Colours ${faint.join(", ")} are`} light against this background. Charts
                using {faint.length === 1 ? "it" : "them"} should show values or offer a table.
              </li>
            )}
          </ul>
        </fieldset>
      )}

      {show("radius") && (
        <div className="sf-field">
          <div className="sf-field-row">
            <label className="sf-label" htmlFor={radiusId}>
              Corner radius
            </label>
            <output htmlFor={radiusId} className="sf-value">
              {theme.radius}px
            </output>
          </div>
          <input
            id={radiusId}
            className="sf-range"
            type="range"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={1}
            value={theme.radius}
            onChange={(e) => setTheme({ ...theme, name: "Custom", radius: Number(e.target.value) })}
          />
        </div>
      )}

      {show("font") && (
        <Segmented
          label="Font"
          value={theme.font}
          options={FONTS}
          labels={FONT_LABEL}
          onChange={(font) => setTheme({ ...theme, name: "Custom", font })}
        />
      )}

      {show("density") && (
        <Segmented
          label="Density"
          value={theme.density}
          options={DENSITIES}
          labels={DENSITY_LABEL}
          onChange={(density) => setTheme({ ...theme, name: "Custom", density })}
        />
      )}
    </div>
  );
}
