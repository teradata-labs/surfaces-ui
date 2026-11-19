import { Chart, CodeBlock, DataGrid, ThemePicker, useTheme } from "@surfaces-ui/components";
import { themeCss } from "@surfaces-ui/tokens";
import { useState } from "react";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

function Export() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<"json" | "css">("json");
  const text = tab === "json" ? JSON.stringify(theme, null, 2) : themeCss(theme);
  return (
    <section className="card export">
      <div className="card-head">
        <h2>Use this theme</h2>
        <div className="tabs" role="tablist" aria-label="Export format">
          {(["json", "css"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "json" ? "Theme JSON" : "CSS variables"}
            </button>
          ))}
        </div>
      </div>
      <CodeBlock code={text} language={tab} label={tab === "json" ? "Theme JSON" : "CSS variables"} />
    </section>
  );
}

/** The theme picker beside live components, so every change is visible on real data. */
export function ThemePage({ source }: { source: ActiveSource }) {
  const { sourceId } = source;
  const focus = focusFor(sourceId, firstTable(source));
  const { series, stacked, breakdown } = focus;
  const parts = focus.secondBreakdown ?? breakdown;
  const measure = breakdown.y[0];
  return (
    <div className="layout">
      <aside className="card controls" aria-label="Theme controls">
        <ThemePicker />
      </aside>
      <div className="stage">
        <section className="card">
          <div className="card-head">
            <h2>{series.label}</h2>
          </div>
          <Chart sourceId={sourceId} sql={series.sql} type="line" x={series.x} xGrain={series.xGrain ?? "month"} splitBy={series.splitBy} y={series.y} legend="bottom" height={260} />
        </section>
        <div className="sf-a2-grid">
          <section className="card">
            <div className="card-head">
              <h2>{stacked.label}</h2>
            </div>
            <Chart sourceId={sourceId} sql={stacked.sql} type="bar" x={stacked.x} splitBy={stacked.splitBy} stacked={Boolean(stacked.splitBy)} y={stacked.y} legend="bottom" height={260} />
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{parts.label}, as parts of a whole</h2>
            </div>
            {/* A colour test card: a pie shows every series colour side by side. */}
            <Chart sourceId={sourceId} sql={parts.sql} type="pie" x={parts.x} y={parts.y} advice={false} height={260} />
          </section>
        </div>
        <section className="card">
          <div className="card-head">
            <h2>{breakdown.label}, with {measure?.column ? `the average ${measure.column}` : "the count"} as a line</h2>
          </div>
          <Chart
            sourceId={sourceId}
            sql={breakdown.sql}
            type="bar"
            x={breakdown.x}
            y={[
              ...breakdown.y.slice(0, 1),
              measure?.column ? { column: measure.column, aggregate: "avg" as const, label: `Average ${measure.column}`, type: "line" as const, axis: "right" as const } : { aggregate: "count" as const, label: "Rows", type: "line" as const, axis: "right" as const },
            ]}
            // A colour test card, not a chart to read: it uses two scales on purpose to show a line over bars.
            advice={false}
            legend="bottom"
            height={260}
          />
        </section>
        <DataGrid sourceId={sourceId} sql={focus.rowsSql} height={260} label={focus.table} />
        <Export />
      </div>
    </div>
  );
}
