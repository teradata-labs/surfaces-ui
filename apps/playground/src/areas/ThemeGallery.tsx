import { Chart, Metric, ThemeProvider, useTheme } from "@surfaces-ui/components";
import { type Theme, presets, resolveColors } from "@surfaces-ui/tokens";
import { useState } from "react";
import { type DataFocus, focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

/** One preset, drawn with its own theme: controls, text, the colours charts use, and a live chart. */
function Tile({ theme, mode, focus, onUse }: { theme: Theme; mode: "light" | "dark"; focus: DataFocus; onUse(): void }) {
  const { sourceId, measure: m, stacked } = focus;
  const colors = resolveColors(theme[mode], theme.charts[mode]);
  return (
    <ThemeProvider key={`${theme.name}-${mode}`} scope="scoped" storage={null} initialTheme={theme} initialMode={mode}>
      <article className="gallery-tile" aria-label={`${theme.name}, ${mode}`}>
        <header className="gallery-head">
          <h3>{theme.name}</h3>
          <span className="gallery-meta">
            {theme.font} font · {theme.density} · {theme.radius}px corners
          </span>
        </header>
        <div className="gallery-row">
          <button type="button" className="sf-button" data-variant="primary" onClick={onUse}>
            Use {theme.name}
          </button>
          <button type="button" className="sf-button">
            Cancel
          </button>
          <input className="sf-input" aria-label={`Sample input, ${theme.name}`} placeholder="Search tables" readOnly />
        </div>
        <p className="gallery-text">
          Revenue is up 5.4% on last quarter. <span>Updated nightly from the orders table.</span>
        </p>
        <div className="gallery-swatches" role="img" aria-label="Series colours, in order">
          {colors.series.map((color, i) => (
            <span key={i} style={{ background: color }} />
          ))}
        </div>
        <div className="gallery-ramps">
          <div className="sf-ramp" role="img" aria-label="Scale for amounts">
            {colors.sequential.map((color, i) => (
              <span key={i} style={{ background: color }} />
            ))}
          </div>
          <div className="sf-ramp" role="img" aria-label="Scale either side of a midpoint">
            {colors.diverging.map((color, i) => (
              <span key={i} style={{ background: color }} />
            ))}
          </div>
        </div>
        <div className="gallery-card">
          <Metric sourceId={sourceId} sql={m.sql} column={m.column} aggregate={m.aggregate} label={m.label} format={m.format} />
          <Chart sourceId={sourceId} sql={stacked.sql} type="bar" x={stacked.x} splitBy={stacked.splitBy} stacked={Boolean(stacked.splitBy)} y={stacked.y} label={stacked.label} legend="none" height={150} />
        </div>
      </article>
    </ThemeProvider>
  );
}

/** Every built-in theme side by side, in light or dark, each drawn with its own colours. */
export function ThemeGallery({ source }: { source: ActiveSource }) {
  const { setTheme, setMode, theme: current } = useTheme();
  const [mode, setShown] = useState<"light" | "dark">("light");
  const focus = focusFor(source.sourceId, firstTable(source));
  return (
    <section className="card gallery">
      <div className="card-head">
        <h2>Themes</h2>
        <div className="sf-segmented sf-result-views" role="tablist" aria-label="Show themes in">
          {(["light", "dark"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className="sf-segment" data-checked={mode === m || undefined} onClick={() => setShown(m)}>
              {m === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>
      <div className="gallery-grid">
        {presets.map((preset) => (
          <Tile
            key={`${preset.name}-${mode}`}
            theme={preset}
            mode={mode}
            focus={focus}
            onUse={() => {
              setTheme(preset);
              setMode(mode);
            }}
          />
        ))}
      </div>
      <p className="hint">
        Each tile is drawn with that theme alone. The page around them uses {current.name}; press a tile&apos;s button to switch the whole page to it.
      </p>
    </section>
  );
}
