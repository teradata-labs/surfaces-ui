import { type DataSource, collect, toRows } from "@surfaces-ui/data";
import { AggregateFunction } from "@surfaces-ui/proto";
import { type DashboardSpec, seedById } from "@surfaces-ui/seeds";
import { useEffect, useState } from "react";

export type { DashboardSpec };

/**
 * What a dataset is about, so every area can draw it: headline measures, a
 * trend and breakdowns. Seeds bring their own; the sample orders have one
 * here. Areas build their pages, demos and examples from this instead of
 * naming columns, so picking another dataset changes them all.
 */
export interface DataFocus extends DashboardSpec {
  sourceId: string;
  /** The main measure: the first headline number. */
  measure: DashboardSpec["metrics"][number];
  /** The first headline number that sums or averages a column (an amount, never a count of ids), for views that read a column's values. */
  amount: DashboardSpec["metrics"][number];
  /** A bar chart over categories (no bins): what a person clicks to cross-filter. */
  breakdown: DashboardSpec["charts"][number];
  /** A second categorical breakdown, from another chart or a split, when there is one. */
  secondBreakdown?: DashboardSpec["charts"][number];
  /** Several series over time, for colour tests: a seed's split line chart, or the trend split by the breakdown. */
  series: DashboardSpec["charts"][number];
  /** Bars split by a second category when the data has one over the same query; otherwise plain bars. */
  stacked: DashboardSpec["charts"][number];
  /** One wide query that every view of a cross-filtered dashboard shares: a measure, the categories to click, and a time column. */
  cross: CrossQuery;
  /** A table to browse and the query that lists it. */
  table: string;
  rowsSql: string;
}

const SAMPLE: DashboardSpec = {
  title: "Sample orders",
  description: "Orders by region and status through 2026.",
  metrics: [
    { label: "Revenue", sql: "SELECT * FROM orders", column: "amount", aggregate: "sum", format: "currency" },
    { label: "Orders", sql: "SELECT * FROM orders", column: "order_id", aggregate: "count", format: "compact" },
    { label: "Median order", sql: "SELECT * FROM orders", column: "amount", aggregate: "median", format: "currency" },
  ],
  trend: { label: "Revenue by month", sql: "SELECT * FROM orders", x: "ordered_at", column: "amount", aggregate: "sum", format: "currency" },
  charts: [
    { label: "Revenue by region", sql: "SELECT * FROM orders", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum", label: "Revenue" }], yTitle: "Revenue" },
    { label: "Orders by status", sql: "SELECT * FROM orders", type: "bar", x: "status", y: [{ aggregate: "count", label: "Orders" }] },
  ],
};

export interface CrossQuery {
  sql: string;
  measure: { column: string; label: string; format?: "number" | "compact" | "currency" | "percent" };
  /** What one row is, for the count: "orders", "claims". */
  rows: string;
  /** Categories, each drawn as bars that filter the rest. */
  dimensions: string[];
  time: string;
}

/**
 * Per dataset, a query wide enough to cross-filter: the fact table joined to
 * the dimension that gives it a second category. Columns of one query mean
 * nothing to another, so every view of the dashboard reads this one.
 */
const CROSS: Record<string, CrossQuery> = {
  sample: { sql: "SELECT * FROM orders", measure: { column: "amount", label: "Revenue", format: "currency" }, rows: "Orders", dimensions: ["region", "status"], time: "ordered_at" },
  retail: {
    sql: "SELECT o.ordered_at, o.channel, o.status, s.region, i.line_amount\nFROM orders o\nJOIN order_items i ON i.order_id = o.order_id\nJOIN stores s ON s.store_id = o.store_id",
    measure: { column: "line_amount", label: "Revenue", format: "currency" },
    rows: "Order lines",
    dimensions: ["channel", "region", "status"],
    time: "ordered_at",
  },
  healthcare: {
    sql: "SELECT e.admitted_at, e.encounter_type, p.specialty, c.payer, c.paid_amount\nFROM encounters e\nJOIN providers p ON p.provider_id = e.provider_id\nJOIN claims c ON c.encounter_id = e.encounter_id",
    measure: { column: "paid_amount", label: "Paid", format: "currency" },
    rows: "Claims",
    dimensions: ["encounter_type", "specialty", "payer"],
    time: "admitted_at",
  },
  fraud: {
    sql: "SELECT t.txn_at, t.channel, m.category, m.risk_level, t.amount\nFROM transactions t\nJOIN merchants m ON m.merchant_id = t.merchant_id",
    measure: { column: "amount", label: "Amount", format: "currency" },
    rows: "Transactions",
    dimensions: ["channel", "category", "risk_level"],
    time: "txn_at",
  },
  telco: {
    sql: "SELECT s.joined_on, s.region, p.plan_type, p.monthly_fee\nFROM subscribers s\nJOIN plans p ON p.plan_id = s.plan_id",
    measure: { column: "monthly_fee", label: "Monthly fees", format: "currency" },
    rows: "Subscribers",
    dimensions: ["region", "plan_type"],
    time: "joined_on",
  },
  transportation: {
    sql: "SELECT t.scheduled_start, t.status, r.depot, t.distance_km\nFROM trips t\nJOIN routes r ON r.route_id = t.route_id",
    measure: { column: "distance_km", label: "Distance (km)", format: "compact" },
    rows: "Trips",
    dimensions: ["depot", "status"],
    time: "scheduled_start",
  },
  manufacturing: {
    sql: "SELECT w.started_at, w.shift, l.product_family, w.produced_qty\nFROM work_orders w\nJOIN lines l ON l.line_id = w.line_id",
    measure: { column: "produced_qty", label: "Units made", format: "compact" },
    rows: "Work orders",
    dimensions: ["product_family", "shift"],
    time: "started_at",
  },
};

const categorical = (c: DashboardSpec["charts"][number]) => c.type === "bar" && !c.xBins && !c.xGrain;

export function focusFor(sourceId: string, firstTable: string): DataFocus {
  const seed = seedById(sourceId);
  const spec = seed?.dashboard ?? SAMPLE;
  const bars = spec.charts.filter(categorical);
  const breakdown = bars[0] ?? spec.charts[0]!;
  const split = spec.charts.find((c) => c.splitBy);
  const secondBreakdown =
    bars[1] ?? (split ? { label: `${split.y[0]?.label ?? "Count"} by ${split.splitBy}`, sql: split.sql, type: "bar" as const, x: split.splitBy!, y: split.y } : undefined);
  const table = seed ? firstTable : "orders";
  const { trend } = spec;
  const series =
    spec.charts.find((c) => c.splitBy && c.xGrain) ??
    (breakdown.sql === trend.sql
      ? { label: `${trend.label}, one line per ${breakdown.x}`, sql: trend.sql, type: "line" as const, x: trend.x, xGrain: "month" as const, y: [{ column: trend.column, aggregate: trend.aggregate, label: spec.metrics[0]!.label }], splitBy: breakdown.x }
      : { ...trend, type: "line" as const, xGrain: "month" as const, y: [{ column: trend.column, aggregate: trend.aggregate, label: trend.label }] });
  const stacked =
    secondBreakdown && secondBreakdown.sql === breakdown.sql && secondBreakdown.x !== breakdown.x
      ? { label: `${breakdown.label}, by ${secondBreakdown.x}`, sql: breakdown.sql, type: "bar" as const, x: breakdown.x, splitBy: secondBreakdown.x, y: [{ aggregate: "count" as const, label: "Rows" }] }
      : series.splitBy
        ? { label: `${series.y[0]?.label ?? "Rows"} by ${series.splitBy}`, sql: series.sql, type: "bar" as const, x: series.splitBy, y: series.y }
        : breakdown;
  const amount = spec.metrics.find((m) => m.column && (m.aggregate === "sum" || m.aggregate === "avg")) ?? spec.metrics[0]!;
  return { ...spec, sourceId, measure: spec.metrics[0]!, amount, breakdown, secondBreakdown, series, stacked, cross: CROSS[seed?.id ?? "sample"] ?? CROSS.sample!, table, rowsSql: `SELECT * FROM ${table}` };
}

/**
 * Bands for a bullet graph from the data's own spread: the lowest, middle
 * and top thirds of a column's values, worked out by the engine. The top
 * band stops at the 95th percentile so a few huge values do not squash it. Used where
 * there is no business target, so the graph says "low, typical, high"
 * rather than inventing a goal.
 */
export function useThirds(dataSource: DataSource, sourceId: string, sql: string, column: string | undefined): { to: number; label: string }[] | undefined {
  const [ranges, setRanges] = useState<{ to: number; label: string }[]>();
  useEffect(() => {
    if (!column) return;
    let current = true;
    const pct = (alias: string, percentile: number) => ({ column, function: AggregateFunction.PERCENTILE, percentile, alias });
    void collect(dataSource.execute({ sourceId, query: { baseSql: sql, aggregates: [pct("p33", 1 / 3), pct("p67", 2 / 3), pct("top", 0.95)] } }))
      .then(({ table }) => {
        const row = toRows(table)[0] ?? {};
        const n = (k: string) => Number(row[k]);
        if (current && [n("p33"), n("p67"), n("top")].every(Number.isFinite)) {
          setRanges([
            { to: n("p33"), label: "Low third" },
            { to: n("p67"), label: "Middle third" },
            { to: n("top"), label: "Top third (to the 95th percentile)" },
          ]);
        }
      })
      .catch(() => current && setRanges(undefined));
    return () => {
      current = false;
    };
  }, [dataSource, sourceId, sql, column]);
  return ranges;
}
