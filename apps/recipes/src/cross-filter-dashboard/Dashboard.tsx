import { BulletGraph, Chart, ControlIcon, DataGrid, Metric, Sparkline, filterWords, sortsFromSpec } from "@surfaces-ui/components";
import { type ViewStateService, createViewState } from "@surfaces-ui/state";
import { useStore } from "@surfaces-ui/state/react";
import { useMemo } from "react";

export interface DashboardProps {
  sourceId: string;
  /** Any read-only query with `region`, `status`, `amount` and `ordered_at` columns. */
  sql: string;
  /** Pass your own to keep the filters in the address bar or in storage. Defaults to a fresh one. */
  view?: ViewStateService;
  /** A monthly order count to compare against. */
  ordersTarget?: number;
}

/**
 * Headline numbers, two charts and a table over one query. Clicking a bar
 * filters every other view; each view leaves out its own column, so the
 * bars a person clicked stay there to click again.
 */
export function Dashboard({ sourceId, sql, view: given, ordersTarget = 100 }: DashboardProps) {
  const view = useMemo(() => given ?? createViewState(), [given]);
  const state = useStore(view);
  const all = view.filters();
  // One chip per value chosen by a click, and one per any other filter, each with its own remove button.
  const chips = state.filters.flatMap((filter) =>
    filter.op === "eq" || filter.op === "in"
      ? (filter.values ?? []).map((value) => ({ key: `${filter.column}:${value}`, label: `${filter.column}: ${String(value)}`, name: `Remove filter ${filter.column} is ${value}`, remove: () => view.toggle(filter.column, value) }))
      : [{ key: `${filter.column}:${filter.op}`, label: filterWords(filter), name: `Remove filter ${filterWords(filter)}`, remove: () => view.setFilters(state.filters.filter((f) => f !== filter)) }],
  );

  return (
    <div className="sf-container">
      {/* Every filter a click made can be removed with a button, not only by clicking the bar again. */}
      <div className="sf-filter-chips" role="group" aria-label="Filters" aria-live="polite">
        {chips.length === 0 ? (
          <span>Click a bar to filter everything else.</span>
        ) : (
          chips.map((chip) => (
            <button key={chip.key} type="button" className="sf-button" aria-label={chip.name} onClick={chip.remove}>
              {chip.label} <ControlIcon icon="close" />
            </button>
          ))
        )}
        <button type="button" className="sf-button" disabled={chips.length === 0} onClick={() => view.clear()}>
          Clear filters
        </button>
      </div>

      {/* Each headline number has a comparison beside it: a trend, or a target. */}
      <div className="sf-a2-grid" style={{ ["--sf-grid-columns" as string]: 2 }}>
        <div>
          <Metric sourceId={sourceId} sql={sql} column="amount" aggregate="sum" label="Revenue" format="currency" filters={all} />
          <Sparkline sourceId={sourceId} sql={sql} x="ordered_at" grain="month" column="amount" aggregate="sum" label="Revenue by month" format="currency" points={12} filters={all} />
        </div>
        <div>
          <Metric sourceId={sourceId} sql={sql} aggregate="count" label="Orders" filters={all} />
          <BulletGraph
            sourceId={sourceId}
            sql={sql}
            aggregate="count"
            label="Orders against target"
            target={ordersTarget}
            ranges={[
              { to: ordersTarget * 0.6, label: "Poor" },
              { to: ordersTarget * 0.9, label: "Fair" },
              { to: ordersTarget * 1.2, label: "Good" },
            ]}
            filters={all}
          />
        </div>
      </div>

      <div className="sf-a2-grid">
        <Chart
          sourceId={sourceId}
          sql={sql}
          type="bar"
          x="region"
          y={[{ column: "amount", aggregate: "sum", label: "Revenue" }]}
          filters={view.filters("region")}
          onPointClick={(point) => point.x !== null && view.toggle("region", point.x)}
          height={260}
          label="Revenue by region. Click a bar to filter."
        />
        <Chart
          sourceId={sourceId}
          sql={sql}
          type="bar"
          x="status"
          y={[{ aggregate: "count", label: "Orders" }]}
          filters={view.filters("status")}
          onPointClick={(point) => point.x !== null && view.toggle("status", point.x)}
          height={260}
          label="Orders by status. Click a bar to filter."
        />
      </div>

      <DataGrid
        sourceId={sourceId}
        sql={sql}
        filters={all}
        sorts={sortsFromSpec(state.sorts)}
        onSortsChange={(sorts) => view.setSorts(sorts)}
        height={320}
        label="Orders"
      />
    </div>
  );
}
