import type { DataSource } from "@surfaces-ui/data";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { FilterInit } from "../data/useRowWindow.js";
import { label as text } from "../locale/locale.js";
import { type MetricProps, formatMetric } from "../metric/Metric.js";
import { useMeasure } from "../metric/useMeasure.js";
import type { ChartAggregate } from "./Chart.js";

export interface BulletGraphProps {
  sourceId: string;
  sql: string;
  column?: string;
  aggregate: ChartAggregate;
  label: string;
  /** The value to compare against, drawn as a tick across the bar. */
  target?: number;
  /**
   * Where the qualitative bands end, lowest first, with a name for each:
   * `[{ to: 50, label: "Poor" }, { to: 80, label: "Fair" }, { to: 100, label: "Good" }]`.
   * The last band's end is the end of the scale. Up to five.
   */
  ranges: { to: number; label: string }[];
  format?: MetricProps["format"];
  currency?: string;
  filters?: FilterInit[];
  notBefore?: string;
  dataSource?: DataSource;
  className?: string;
}

/** The band a value falls in, or the last one when it is past the end. */
export function bulletBand(value: number, ranges: { to: number; label: string }[]): { to: number; label: string } | undefined {
  return ranges.find((r) => value <= r.to) ?? ranges.at(-1);
}

/**
 * Stephen Few's bullet graph: one measure as a bar from zero, a tick for the
 * target, and shaded bands that say whether the value is poor, fair or good.
 * It replaces a gauge in a fraction of the space. The bands differ in
 * lightness only, and the reading is also written out in words.
 */
export function BulletGraph(props: BulletGraphProps) {
  const { sourceId, sql, column, aggregate, label, target, format, currency, filters, notBefore } = props;
  const ranges = [...props.ranges].sort((a, b) => a.to - b.to).slice(0, 5);
  const dataSource = useDataSource(props.dataSource);
  const state = useMeasure(dataSource, { sourceId, sql, column, aggregate, filters, notBefore });
  const value = state.values?.[0] ?? undefined;
  const write = (n: number) => formatMetric(n, format, currency);
  const end = Math.max(ranges.at(-1)?.to ?? 0, target ?? 0, value ?? 0) || 1;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / end) * 100))}%`;
  const band = value == null ? undefined : bulletBand(value, ranges);
  const reading =
    value == null
      ? text(state.loading ? "bullet.loading" : "bullet.empty", { label })
      : text("bullet.reading", {
          label,
          value: write(value),
          band: band ? `, ${band.label.toLowerCase()}` : "",
          target: target !== undefined ? text(value >= target ? "bullet.targetMet" : "bullet.targetNotMet", { target: write(target) }) : "",
        });

  return (
    <div className={["sf-bullet", props.className].filter(Boolean).join(" ")} aria-busy={state.loading}>
      <div className="sf-bullet-head">
        <span className="sf-bullet-label">{label}</span>
        {state.error ? (
          <span className="sf-metric-error" role="alert">
            {state.error}
          </span>
        ) : (
          <span className="sf-bullet-value">
            {value == null ? (state.loading ? text("metric.loading") : text("metric.none")) : write(value)}
            {band && <span className="sf-bullet-band"> {band.label}</span>}
          </span>
        )}
      </div>
      <div className="sf-bullet-track" role="img" aria-label={reading}>
        {ranges.map((range, i) => (
          <span key={range.to} className="sf-bullet-range" data-band={i + 1} style={{ left: pct(ranges[i - 1]?.to ?? 0), right: `calc(100% - ${pct(range.to)})` }} />
        ))}
        {value != null && <span className="sf-bullet-bar" style={{ width: pct(value) }} />}
        {target !== undefined && <span className="sf-bullet-target" style={{ left: pct(target) }} />}
      </div>
      <div className="sf-bullet-scale" aria-hidden="true">
        <span>{write(0)}</span>
        {target !== undefined && <span>{text("bullet.target", { target: write(target) })}</span>}
        <span>{write(end)}</span>
      </div>
    </div>
  );
}
