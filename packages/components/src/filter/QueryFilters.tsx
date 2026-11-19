import type { DataSource } from "@surfaces-ui/data";
import { collect } from "@surfaces-ui/data";
import { AggregateFunction, SortDirection } from "@surfaces-ui/proto";
import type { Field } from "apache-arrow";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnContext } from "../controls/context.js";
import { type FilterSpec, filterWords, filtersFromSpec, filtersToSpec, joinRelative, splitRelative } from "../data/controls.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { formatCell } from "../data/format.js";
import { type FilterInit, messageOf } from "../data/useRowWindow.js";
import { FilterBar } from "./FilterBar.js";

export interface QueryFiltersProps {
  sourceId: string;
  /** The query whose columns can be filtered. Views that share these filters should read the same columns. */
  sql: string;
  /** The filter list, in its plain form: what a page, a URL or an agent holds. */
  filters: FilterSpec[];
  onChange(filters: FilterSpec[]): void;
  /** Offer only these columns. All of the query's columns otherwise. */
  columns?: string[];
  /** Told when a person adds or removes a filter, with the whole list, for an agent's context. */
  onContext?: OnContext;
  dataSource?: DataSource;
  className?: string;
}

/**
 * A filter bar over a query, holding its filters in their plain form: it
 * finds the query's columns itself, offers each column's values from the
 * engine, and keeps a quick date range relative ("last 30 days" as `since
 * 30d`, not a date). Give the same list to every view on a page and they
 * all follow it. It only edits the list; it never queries rows to show.
 */
export function QueryFilters({ sourceId, sql, filters, onChange, columns, onContext, className, ...rest }: QueryFiltersProps) {
  const dataSource = useDataSource(rest.dataSource);
  const [fields, setFields] = useState<Field[]>([]);
  const [problem, setProblem] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    setProblem(undefined);
    // One row is asked for; only the result's columns are used.
    collect(dataSource.execute({ sourceId, query: { baseSql: sql, page: { limit: 1 } } }, { signal: controller.signal }))
      .then((result) => !controller.signal.aborted && setFields(result.table.schema.fields))
      .catch((error: unknown) => !controller.signal.aborted && (setFields([]), setProblem(messageOf(error))));
    return () => controller.abort();
  }, [dataSource, sourceId, sql]);

  const loadValues = useCallback(
    async (column: string) => {
      const result = await collect(
        dataSource.execute({
          sourceId,
          query: { baseSql: sql, groupBy: [column], aggregates: [{ function: AggregateFunction.COUNT, alias: "sf_count" }], sorts: [{ column: "sf_count", direction: SortDirection.DESC }], page: { limit: 50 } },
        }),
      );
      const values = result.table.getChildAt(0);
      const type = result.table.schema.fields[0]?.type;
      return Array.from({ length: result.table.numRows }, (_, i) => values?.get(i))
        .filter((v) => v != null)
        .map((v) => (type ? formatCell(v, type).text : String(v)));
    },
    [dataSource, sourceId, sql],
  );

  const offered = useMemo(() => (columns?.length ? fields.filter((f) => columns.includes(f.name)) : fields), [fields, columns]);
  const { fixed, relative } = useMemo(() => splitRelative(filters), [filters]);
  // A list that cannot be read is shown as a problem and edited from empty, never silently dropped.
  const [shown, unreadable] = useMemo((): [FilterInit[], string | undefined] => {
    try {
      return [filtersFromSpec(fixed), undefined];
    } catch (error) {
      return [[], error instanceof Error ? error.message : "The filters could not be read."];
    }
  }, [fixed]);

  const change = (next: FilterSpec[]) => {
    onChange(next);
    onContext?.({ kind: "filter.changed", summary: next.length === 0 ? "Cleared every filter." : `Filters are now: ${next.map(filterWords).join("; ")}.`, subject: { filters: next } });
  };

  return (
    <div className={["sf-query-filters", className].filter(Boolean).join(" ")}>
      <FilterBar fields={offered} filters={shown} onChange={(next) => change(joinRelative(filtersToSpec(next), relative))} loadValues={loadValues} relative={relative} onRelativeChange={(next) => change(joinRelative(fixed, next))} />
      {(problem ?? unreadable) && (
        <p className="sf-filter-problem" role="alert">
          {problem ?? unreadable}
        </p>
      )}
    </div>
  );
}
