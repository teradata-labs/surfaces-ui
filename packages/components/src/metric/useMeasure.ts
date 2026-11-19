import { type DataSource, collect } from "@surfaces-ui/data";
import { useEffect, useState } from "react";
import { AGGREGATE_FUNCTIONS, type ChartAggregate, type ChartGrain, TIME_GRAINS } from "../chart/Chart.js";
import { numericValue } from "../data/format.js";
import { type FilterInit, messageOf } from "../data/useRowWindow.js";
import { SortDirection } from "@surfaces-ui/proto";

export interface MeasureQuery {
  sourceId: string;
  sql: string;
  column?: string;
  aggregate: ChartAggregate;
  filters?: FilterInit[];
  notBefore?: string;
  /** With `x` and `grain`, one value per time bucket in order; without, one value. */
  x?: string;
  grain?: ChartGrain;
  /** Most recent buckets to keep. */
  points?: number;
}

export interface MeasureState {
  values?: (number | null)[];
  error?: string;
  loading: boolean;
}

/** Asks the engine for one summarised number, or one per time bucket. Nothing is worked out in the browser. */
export function useMeasure(dataSource: DataSource, query: MeasureQuery): MeasureState {
  const [state, setState] = useState<MeasureState>({ loading: true });
  const key = JSON.stringify(query, (_, v) => (typeof v === "bigint" ? `${v}n` : v));
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    const { sourceId, sql, column, aggregate, filters, notBefore, x, grain, points = 60 } = query;
    const series = x !== undefined && grain !== undefined;
    collect(
      dataSource.execute(
        {
          sourceId,
          notBefore,
          query: {
            baseSql: sql,
            filters,
            aggregates: [{ function: AGGREGATE_FUNCTIONS[aggregate], column: column ?? "", alias: "value", percentile: aggregate === "percentile" ? 0.9 : 0 }],
            // Newest first so the limit keeps the most recent buckets; put back in order below.
            ...(series ? { buckets: [{ column: x, by: { case: "grain" as const, value: TIME_GRAINS[grain] } }], sorts: [{ column: x, direction: SortDirection.DESC }], page: { limit: points } } : {}),
          },
        },
        { signal: controller.signal },
      ),
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        const column = result.table.getChild("value");
        const field = result.table.schema.fields.find((f) => f.name === "value");
        const values = Array.from({ length: result.table.numRows }, (_, i) => (field ? numericValue(column?.get(i), field.type) : null));
        setState({ values: series ? values.reverse() : values, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ error: messageOf(error), loading: false });
      });
    return () => controller.abort();
  }, [dataSource, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
