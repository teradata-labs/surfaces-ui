import type { DataSource } from "@surfaces-ui/data";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { FilterInit } from "../data/useRowWindow.js";
import { label as text } from "../locale/locale.js";
import { type MetricProps, formatMetric } from "../metric/Metric.js";
import { useMeasure } from "../metric/useMeasure.js";
import type { ChartAggregate, ChartGrain } from "./Chart.js";

export interface SparklineProps {
  sourceId: string;
  sql: string;
  /** The date or time column the line runs along. */
  x: string;
  grain: ChartGrain;
  column?: string;
  aggregate: ChartAggregate;
  label: string;
  format?: MetricProps["format"];
  currency?: string;
  /** Most recent buckets to draw. Defaults to 30. */
  points?: number;
  filters?: FilterInit[];
  notBefore?: string;
  dataSource?: DataSource;
  className?: string;
}

const WIDTH = 120;
const HEIGHT = 28;
const PAD = 3;

/** Points for a line through `values` in a box, with gaps where a value is missing. */
export function sparklinePoints(values: (number | null)[], width = WIDTH, height = HEIGHT, pad = PAD): { x: number; y: number; value: number }[] {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return [];
  const low = Math.min(...known);
  const high = Math.max(...known);
  const span = high - low || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.flatMap((value, i) => (value === null ? [] : [{ x: pad + i * step, y: high === low ? height / 2 : pad + (1 - (value - low) / span) * (height - pad * 2), value }]));
}

/**
 * A word-sized line next to its latest value: the trend without axes, grid
 * or legend. The low and high points are marked, and the same facts are
 * given in words for people who cannot see the line.
 */
export function Sparkline(props: SparklineProps) {
  const { sourceId, sql, x, grain, column, aggregate, label, format, currency, points = 30, filters, notBefore } = props;
  const dataSource = useDataSource(props.dataSource);
  const state = useMeasure(dataSource, { sourceId, sql, column, aggregate, filters, notBefore, x, grain, points });
  const line = sparklinePoints(state.values ?? []);
  const write = (value: number) => formatMetric(value, format, currency);
  const last = line.at(-1);
  const low = line.reduce<(typeof line)[number] | undefined>((a, p) => (!a || p.value < a.value ? p : a), undefined);
  const high = line.reduce<(typeof line)[number] | undefined>((a, p) => (!a || p.value > a.value ? p : a), undefined);
  const summary = last && low && high && line[0] ? text("sparkline.summary", { label, now: write(last.value), first: write(line[0].value), low: write(low.value), high: write(high.value), count: line.length, grain }) : text("sparkline.empty", { label });

  return (
    <span className={["sf-spark", props.className].filter(Boolean).join(" ")} aria-busy={state.loading}>
      <span className="sf-spark-label">{label}</span>
      {state.error ? (
        <span className="sf-metric-error" role="alert">
          {state.error}
        </span>
      ) : (
        <>
          <svg className="sf-spark-line" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img" aria-label={summary}>
            {line.length > 1 && <polyline points={line.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} />}
            {low && high && low !== high && (
              <>
                <circle className="sf-spark-extreme" cx={low.x} cy={low.y} r={1.8} />
                <circle className="sf-spark-extreme" cx={high.x} cy={high.y} r={1.8} />
              </>
            )}
            {last && <circle className="sf-spark-last" cx={last.x} cy={last.y} r={2.4} />}
          </svg>
          <span className="sf-spark-value">{last ? write(last.value) : state.loading ? text("metric.loading") : text("metric.none")}</span>
        </>
      )}
    </span>
  );
}
