import { type DataSource, collect } from "@surfaces-ui/data";
import { useEffect, useState } from "react";
import { AGGREGATE_FUNCTIONS, type ChartAggregate } from "../chart/Chart.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { DataMessages } from "../data/messages.js";
import { numericValue } from "../data/format.js";
import { label as text, numberFormat } from "../locale/locale.js";
import { type FilterInit, type TimeTravelInit, messageOf } from "../data/useRowWindow.js";

export interface MetricProps extends DataMessages {
  sourceId: string;
  /** The base SQL. The engine reduces it to the one number. */
  sql: string;
  /** Column to summarise. Optional only for `count`, which then counts rows. */
  column?: string;
  aggregate: ChartAggregate;
  /** For `percentile`: a fraction from 0 to 1. Defaults to 0.9. */
  percentile?: number;
  label: string;
  /** How the number is written. Defaults to "number". */
  format?: "number" | "compact" | "currency" | "percent";
  /** ISO 4217 code for `currency`. Defaults to USD. */
  currency?: string;
  filters?: FilterInit[];
  timeTravel?: TimeTravelInit;
  /** ISO 8601 time of the run this belongs to; see `RowWindowQuery.notBefore`. */
  notBefore?: string;
  dataSource?: DataSource;
  className?: string;
}

/** Writes a number the way a headline figure is read. */
export function formatMetric(value: number, format: MetricProps["format"] = "number", currency = "USD"): string {
  const options: Intl.NumberFormatOptions =
    format === "currency"
      ? // Cents only under a thousand: "$1,904" sits beside "$498.2K" as one way of writing money.
        Math.abs(value) >= 100_000
        ? { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
        : Math.abs(value) >= 1_000
          ? { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }
          : { style: "currency", currency, maximumFractionDigits: 2 }
      : format === "percent"
        ? { style: "percent", maximumFractionDigits: 1 }
        : format === "compact"
          ? { notation: "compact", maximumFractionDigits: 1 }
          : { maximumFractionDigits: 2 };
  return numberFormat(options).format(value);
}

/**
 * One headline number worked out by the engine from a query: a total, an
 * average, a count. Unlike a number written into a page, it follows the
 * data and any filters applied.
 */
export function Metric(props: MetricProps) {
  const { sourceId, sql, column, aggregate, percentile, label, format, currency, filters, timeTravel, notBefore } = props;
  const dataSource = useDataSource(props.dataSource);
  const [state, setState] = useState<{ value?: number | null; error?: string; loading: boolean }>({ loading: true });
  const key = JSON.stringify([sourceId, sql, column, aggregate, percentile, filters, timeTravel, notBefore], (_, v) => (typeof v === "bigint" ? `${v}n` : v));

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    collect(
      dataSource.execute(
        {
          sourceId,
          timeTravel,
          notBefore,
          query: {
            baseSql: sql,
            filters,
            aggregates: [{ function: AGGREGATE_FUNCTIONS[aggregate], column: column ?? "", alias: "value", percentile: aggregate === "percentile" ? (percentile ?? 0.9) : 0 }],
          },
        },
        { signal: controller.signal },
      ),
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        const field = result.table.schema.fields.find((f) => f.name === "value");
        const raw = result.table.getChild("value")?.get(0);
        setState({ value: field ? numericValue(raw, field.type) : null, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ error: messageOf(error), loading: false });
      });
    return () => controller.abort();
  }, [dataSource, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={["sf-a2-stat sf-metric", props.className].filter(Boolean).join(" ")} aria-busy={state.loading}>
      <span className="sf-a2-stat-label">{label}</span>
      {state.error ? (
        <span className="sf-metric-error" role="alert" data-error={state.error}>
          {props.errorMessage ?? state.error}
        </span>
      ) : (
        <span className="sf-a2-stat-value">{state.value === undefined ? text("metric.loading") : state.value === null ? (props.emptyMessage ?? text("metric.none")) : formatMetric(state.value, format, currency)}</span>
      )}
    </div>
  );
}
