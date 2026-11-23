import type { MessageInitShape } from "@bufbuild/protobuf";
import { type DataSource, collect } from "@surfaces-ui/data";
import { SortDirection, type ViewQuerySchema } from "@surfaces-ui/proto";
import type { DataType, Table } from "apache-arrow";
import { useEffect, useMemo, useState } from "react";
import { AGGREGATE_FUNCTIONS, type ChartAggregate, type ChartGrain, TIME_GRAINS, measureOutputs } from "../chart/Chart.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { DataMessages } from "../data/messages.js";
import { formatCell } from "../data/format.js";
import { label, numberFormat } from "../locale/locale.js";
import { type FilterInit, type TimeTravelInit, type ValueInit, messageOf } from "../data/useRowWindow.js";

/** A column to group by: its name, or a date or time column grouped by a grain. */
export type PivotDimension = string | { column: string; grain?: ChartGrain; label?: string };

export interface PivotMeasure {
  /** Column to summarise. Optional only for `count`, which then counts rows. */
  column?: string;
  aggregate: ChartAggregate;
  /** For `percentile`: a fraction from 0 to 1. Defaults to 0.9. */
  percentile?: number;
  label?: string;
}

export interface PivotTableProps extends DataMessages {
  sourceId: string;
  /** The base SQL. Grouping and aggregation are applied around it by the backend. */
  sql: string;
  /** Columns whose values become the rows. */
  rows: PivotDimension[];
  /** Columns whose values become the columns. Leave empty for a grouped summary table. */
  columns?: PivotDimension[];
  /** What is shown in each cell. */
  measures: PivotMeasure[];
  filters?: FilterInit[];
  parameters?: ValueInit[];
  timeTravel?: TimeTravelInit;
  /** ISO 8601 time of the run this pivot belongs to; see `RowWindowQuery.notBefore`. */
  notBefore?: string;
  /** Show a total for each row and column and a grand total. Defaults to true. */
  totals?: boolean;
  /** Most column values shown. Defaults to 50. */
  maxColumns?: number;
  /** Most cells fetched. Defaults to 20,000; the pivot says when it was cut off. */
  limit?: number;
  /** Height of the scrolling area. A number is px. Defaults to 420. */
  height?: number | string;
  /** Accessible name for the table. */
  label?: string;
  dataSource?: DataSource;
  className?: string;
}

const columnOf = (dimension: PivotDimension) => (typeof dimension === "string" ? dimension : dimension.column);
const grainOf = (dimension: PivotDimension) => (typeof dimension === "string" ? undefined : dimension.grain);
const labelOf = (dimension: PivotDimension) => (typeof dimension === "string" ? dimension : (dimension.label ?? dimension.column));

/**
 * The query for one level of a pivot: grouped by `dimensions` with every
 * measure aggregated by the engine. Totals are separate queries at a coarser
 * level, because an average or a distinct count cannot be added up from cells.
 */
export function buildPivotQuery(
  dimensions: PivotDimension[],
  measures: PivotMeasure[],
  base: { sql: string; filters?: FilterInit[]; parameters?: ValueInit[]; limit: number },
): MessageInitShape<typeof ViewQuerySchema> {
  return {
    baseSql: base.sql,
    filters: base.filters,
    parameters: base.parameters,
    groupBy: dimensions.filter((d) => !grainOf(d)).map(columnOf),
    buckets: dimensions.filter(grainOf).map((d) => ({ column: columnOf(d), by: { case: "grain" as const, value: TIME_GRAINS[grainOf(d)!] } })),
    aggregates: measureOutputs(measures).map((o) => ({
      function: AGGREGATE_FUNCTIONS[o.measure.aggregate!],
      column: o.measure.column ?? "",
      alias: o.column,
      percentile: o.measure.aggregate === "percentile" ? (o.measure.percentile ?? 0.9) : 0,
    })),
    sorts: dimensions.map((d) => ({ column: columnOf(d), direction: SortDirection.ASC })),
    page: dimensions.length > 0 ? { limit: base.limit } : undefined,
  };
}

const GRAIN_LENGTH: Partial<Record<ChartGrain, number>> = { year: 4, month: 7, day: 10, week: 10, hour: 16, minute: 16 };

/** Text for a row or column heading; a bucketed time is shortened to its grain. */
function heading(value: unknown, type: DataType | undefined, grain: ChartGrain | undefined): string {
  if (value == null) return label("pivot.none");
  const text = type ? formatCell(value, type).text : String(value);
  if (!grain) return text;
  if (grain === "quarter") return `${text.slice(0, 4)} Q${Math.floor(Number(text.slice(5, 7)) / 3 - 1 / 3) + 1}`;
  return text.slice(0, GRAIN_LENGTH[grain] ?? text.length);
}

interface Level {
  /** Summarised values by the joined key of the level's dimensions. */
  values: Map<string, string[]>;
  keys: { id: string; labels: string[]; order: unknown[] }[];
}

const SEPARATOR = "\u001f";

/** Reads one grouped result: its keys in first-seen order and each measure's text. */
function readLevel(table: Table, dimensions: PivotDimension[], aliases: string[]): Level {
  const dims = dimensions.map((d) => {
    const vector = table.getChild(columnOf(d));
    return { vector, type: vector?.type as DataType | undefined, grain: grainOf(d) };
  });
  const measures = aliases.map((alias) => {
    const vector = table.getChild(alias);
    return { vector, type: vector?.type as DataType | undefined };
  });
  const level: Level = { values: new Map(), keys: [] };
  for (let i = 0; i < table.numRows; i++) {
    const raw = dims.map((d) => d.vector?.get(i) ?? null);
    const id = raw.map((v) => (v == null ? "\u0000" : String(v))).join(SEPARATOR);
    if (!level.values.has(id)) {
      level.keys.push({ id, labels: raw.map((v, d) => heading(v, dims[d]!.type, dims[d]!.grain)), order: raw });
    }
    level.values.set(
      id,
      measures.map((m) => {
        const value = m.vector?.get(i);
        return value == null || !m.type ? "" : formatCell(value, m.type).text;
      }),
    );
  }
  return level;
}

function compareKeys(a: unknown[], b: unknown[]): number {
  for (let i = 0; i < a.length; i++) {
    const [x, y] = [a[i], b[i]];
    if (x === y) continue;
    if (x == null) return 1;
    if (y == null) return -1;
    if ((typeof x === "number" || typeof x === "bigint") && (typeof y === "number" || typeof y === "bigint")) return x < y ? -1 : 1;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

export interface PivotModel {
  rowKeys: { id: string; labels: string[] }[];
  columnKeys: { id: string; labels: string[] }[];
  /** Column values that exist but are not shown because of `maxColumns`. */
  hiddenColumns: number;
  /** Text of each measure for a cell; empty strings where there is no data. */
  cell(row: string, column: string): string[];
  rowTotal(row: string): string[];
  columnTotal(column: string): string[];
  grandTotal: string[];
}

/** Arranges the grouped results into rows and columns. Pure, so it can be tested without rendering. */
export function pivotModel(input: {
  rows: PivotDimension[];
  columns: PivotDimension[];
  aliases: string[];
  cells: Table;
  rowTotals?: Table;
  columnTotals?: Table;
  grandTotal?: Table;
  maxColumns: number;
}): PivotModel {
  const { rows, columns, aliases } = input;
  const all = readLevel(input.cells, [...rows, ...columns], aliases);
  const rowLevel = readLevel(input.rowTotals ?? input.cells, rows, aliases);
  const columnLevel = readLevel(input.columnTotals ?? input.cells, columns, aliases);
  const sortedColumns = columns.length === 0 ? [] : [...columnLevel.keys].sort((a, b) => compareKeys(a.order, b.order));
  const empty = aliases.map(() => "");
  const join = (row: string, column: string) => [row, column].filter((part, i) => (i === 0 ? rows.length > 0 : columns.length > 0)).join(SEPARATOR);
  const grand = input.grandTotal ? readLevel(input.grandTotal, [], aliases).values.get("") : undefined;
  return {
    rowKeys: rows.length === 0 ? [{ id: "", labels: [] }] : rowLevel.keys,
    columnKeys: sortedColumns.slice(0, input.maxColumns),
    hiddenColumns: Math.max(0, sortedColumns.length - input.maxColumns),
    cell: (row, column) => all.values.get(join(row, column)) ?? empty,
    rowTotal: (row) => (input.rowTotals ? rowLevel.values.get(row) : undefined) ?? empty,
    columnTotal: (column) => (input.columnTotals ? columnLevel.values.get(column) : undefined) ?? empty,
    grandTotal: grand ?? empty,
  };
}

interface Loaded {
  model: PivotModel;
  truncated: boolean;
  /** The query answered with no rows. */
  empty: boolean;
}

const count = { format: (n: number | bigint) => numberFormat().format(n) };

/**
 * A pivot table over a query: row values down the side, column values across
 * the top, and summarised measures in the cells. The engine does the grouping
 * and the totals; the browser only arranges the summarised rows.
 */
export function PivotTable(props: PivotTableProps) {
  const { sourceId, sql, rows, columns = [], measures, filters, parameters, timeTravel, notBefore, totals = true, maxColumns = 50, limit = 20_000, height = 420 } = props;
  const dataSource = useDataSource(props.dataSource);
  const [state, setState] = useState<{ loaded?: Loaded; error?: string; loading: boolean }>({ loading: true });
  const outputs = useMemo(() => measureOutputs(measures), [JSON.stringify(measures)]); // eslint-disable-line react-hooks/exhaustive-deps
  // A total adds up; a maximum, minimum or average over everything is not one, so its row and column say "All".
  const totalKey = measures.every((m) => m.aggregate === "sum" || m.aggregate === "count" || m.aggregate === "count_distinct") ? "pivot.total" : "pivot.all";
  const key = JSON.stringify([sourceId, sql, rows, columns, measures, filters, parameters, timeTravel, notBefore, totals, maxColumns, limit], (_, v) =>
    typeof v === "bigint" ? `${v}n` : v,
  );

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    if (measures.length === 0 || rows.length + columns.length === 0) {
      setState({ loading: false });
      return;
    }
    const base = { sql, filters, parameters, limit: limit + 1 };
    const run = (dimensions: PivotDimension[]) =>
      collect(
        dataSource.execute({ sourceId, timeTravel, notBefore, query: buildPivotQuery(dimensions, measures, base) }, { signal: controller.signal }),
      ).then((result) => result.table);
    const crossed = columns.length > 0 && rows.length > 0;
    Promise.all([
      run([...rows, ...columns]),
      totals && crossed ? run(rows) : undefined,
      totals && crossed ? run(columns) : undefined,
      totals ? run([]) : undefined,
    ])
      .then(([cells, rowTotals, columnTotals, grandTotal]) => {
        if (controller.signal.aborted) return;
        const model = pivotModel({ rows, columns, aliases: outputs.map((o) => o.column), cells, rowTotals, columnTotals, grandTotal, maxColumns });
        setState({ loaded: { model, truncated: cells.numRows > limit, empty: cells.numRows === 0 }, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ error: messageOf(error), loading: false });
      });
    return () => controller.abort();
  }, [dataSource, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const className = ["sf-pivot", props.className].filter(Boolean).join(" ");
  if (state.error) {
    return (
      <div className={className}>
        <p className="sf-chart-message" role="alert" data-error={state.error}>
          {props.errorMessage ?? state.error}
        </p>
      </div>
    );
  }
  const model = state.loaded?.model;
  if (!model) {
    return (
      <div className={className} aria-busy={state.loading}>
        <p className="sf-chart-message">{state.loading ? label("pivot.loading") : label("pivot.choose")}</p>
      </div>
    );
  }

  if (state.loaded?.empty) {
    return (
      <div className={className} aria-busy={state.loading}>
        <p className="sf-chart-message">{props.emptyMessage ?? label("pivot.empty")}</p>
      </div>
    );
  }

  const crossed = model.columnKeys.length > 0;
  const showMeasureRow = crossed && outputs.length > 1;
  const showRowTotals = totals && crossed && rows.length > 0;
  const showColumnTotals = totals && rows.length > 0;
  const numbers = (values: string[], keyPrefix: string, total = false) =>
    values.map((text, m) => (
      <td key={`${keyPrefix}-${m}`} className="sf-pivot-value" data-total={total || undefined}>
        {text}
      </td>
    ));

  return (
    <div className={className} aria-busy={state.loading}>
      <div className="sf-pivot-scroll" style={{ maxHeight: height }} tabIndex={0} role="region" aria-label={props.label ?? label("pivot.label")}>
        <table>
          <thead>
            <tr>
              {rows.map((d) => (
                <th key={columnOf(d)} scope="col" rowSpan={showMeasureRow ? 2 : 1}>
                  {labelOf(d)}
                </th>
              ))}
              {crossed
                ? model.columnKeys.map((column) => (
                    <th key={column.id} scope="colgroup" colSpan={outputs.length} className="sf-pivot-value">
                      {column.labels.join(" / ")}
                    </th>
                  ))
                : outputs.map((o) => (
                    <th key={o.column} scope="col" className="sf-pivot-value">
                      {o.label}
                    </th>
                  ))}
              {showRowTotals && (
                <th scope="colgroup" colSpan={outputs.length} className="sf-pivot-value" data-total>
                  {label(totalKey)}
                </th>
              )}
            </tr>
            {showMeasureRow && (
              <tr>
                {[...model.columnKeys, ...(showRowTotals ? [{ id: "total" }] : [])].flatMap((column) =>
                  outputs.map((o) => (
                    <th key={`${column.id}-${o.column}`} scope="col" className="sf-pivot-value" data-total={column.id === "total" || undefined}>
                      {o.label}
                    </th>
                  )),
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {model.rowKeys.map((row) => (
              <tr key={row.id}>
                {row.labels.map((text, i) => (
                  <th key={i} scope="row">
                    {text}
                  </th>
                ))}
                {crossed ? model.columnKeys.flatMap((column) => numbers(model.cell(row.id, column.id), column.id)) : numbers(model.cell(row.id, ""), "value")}
                {showRowTotals && numbers(model.rowTotal(row.id), "total", true)}
              </tr>
            ))}
          </tbody>
          {showColumnTotals && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={rows.length}>
                  {label(totalKey)}
                </th>
                {crossed
                  ? model.columnKeys.flatMap((column) => numbers(model.columnTotal(column.id), column.id, true))
                  : numbers(model.grandTotal, "value", true)}
                {showRowTotals && numbers(model.grandTotal, "total", true)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {state.loaded?.truncated && (
        <p className="sf-chart-note">{label("pivot.truncated", { limit: count.format(limit) })}</p>
      )}
      {model.hiddenColumns > 0 && (
        <p className="sf-chart-note">{label("pivot.hiddenColumns", { shown: count.format(model.columnKeys.length), total: count.format(model.columnKeys.length + model.hiddenColumns) })}</p>
      )}
    </div>
  );
}
