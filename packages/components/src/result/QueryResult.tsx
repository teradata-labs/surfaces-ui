import { type DataSource, type QueryErrorInfo, collect, queryErrorInfo } from "@surfaces-ui/data";
import { AggregateFunction, SortDirection } from "@surfaces-ui/proto";
import { DataType, type Field } from "apache-arrow";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Chart, type ChartAggregate, type ChartGrain, type ChartMeasure } from "../chart/Chart.js";
import type { ChartType, LegendPlacement, SeriesType } from "../chart/option.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { downloadBlob, exportCsv } from "../data/export.js";
import { type ColumnFormat, formatCell, isNumeric } from "../data/format.js";
import type { FilterInit, TimeTravelInit } from "../data/useRowWindow.js";
import { FilterBar } from "../filter/FilterBar.js";
import { valueFilter } from "../data/controls.js";
import { DataGrid, type DataGridInfo, type GridColumns, type GridSort } from "../grid/DataGrid.js";
import { type LabelKey, label as text, numberFormat } from "../locale/locale.js";
import { PivotTable } from "../pivot/PivotTable.js";
import { QueryPlan } from "../plan/QueryPlan.js";

export type ResultView = "grid" | "chart" | "pivot";

export interface QueryResultProps {
  sourceId: string;
  sql: string;
  timeTravel?: TimeTravelInit;
  /**
   * ISO 8601 time of this run, e.g. when Run was pressed. Change it to run
   * the same SQL again; a backend that keeps results otherwise reuses its copy.
   */
  notBefore?: string;
  /** Which view opens first. Defaults to "grid". */
  defaultView?: ResultView;
  /**
   * The state of the controls, set from outside: by an agent, a saved page or
   * a URL. Each replaces what a person had set when its value changes, and a
   * person can go on changing it by hand afterwards.
   */
  view?: ResultView;
  filters?: FilterInit[];
  sorts?: GridSort[];
  columns?: GridColumns;
  /**
   * Called when a person changes the view, filters, sorts or columns, with
   * all four as they now stand. Pass them back (as props, or to an agent as
   * catalog props) to restore the result exactly.
   */
  onControlsChange?(controls: { view: ResultView; filters: FilterInit[]; sorts: GridSort[]; columns: GridColumns }): void;
  /** Height of the grid, chart or pivot area in px. Defaults to 420. */
  height?: number;
  /** Name for exported files, without an extension. Defaults to "result". */
  exportName?: string;
  /** Called when the query fails (or with undefined when it works), so an editor can mark the problem. */
  onError?(message: string | undefined, info?: QueryErrorInfo): void;
  dataSource?: DataSource;
  className?: string;
}

const VIEWS: { id: ResultView; label: LabelKey }[] = [
  { id: "grid", label: "result.tabTable" },
  { id: "chart", label: "result.tabChart" },
  { id: "pivot", label: "result.tabPivot" },
];
const CHART_TYPES: ChartType[] = ["bar", "line", "area", "scatter", "pie"];
const SERIES_TYPES: SeriesType[] = ["bar", "line", "area", "scatter"];
const GRAINS: ChartGrain[] = ["hour", "day", "week", "month", "quarter", "year"];
const LEGENDS: LegendPlacement[] = ["top", "bottom", "right", "none"];

/** Aggregates offered in the pickers; "p90" is the 90th percentile. */
const SUMMARIES = ["sum", "avg", "median", "count", "count_distinct", "min", "max", "stddev", "p90"] as const;
type Summary = (typeof SUMMARIES)[number];
const SUMMARY_LABEL: Record<Summary, LabelKey> = {
  sum: "result.sum",
  avg: "result.avg",
  median: "result.median",
  count: "result.count",
  count_distinct: "result.countDistinct",
  min: "result.min",
  max: "result.max",
  stddev: "result.stddev",
  p90: "result.p90",
};
const FORMAT_LABEL: Record<ColumnFormat["kind"], LabelKey> = {
  number: "result.formatNumber",
  compact: "result.formatCompact",
  currency: "result.formatCurrency",
  percent: "result.formatPercent",
  text: "result.formatText",
  date: "result.formatDate",
  datetime: "result.formatDatetime",
};

interface SeriesState {
  id: number;
  column: string;
  summary: Summary;
  /** Empty draws the series as the chart's type. */
  type: SeriesType | "";
  axis: "left" | "right";
}

interface ChartState {
  type: ChartType;
  x: string;
  grain: ChartGrain;
  bins: number;
  splitBy: string;
  /** Plot rows as they are (sampled when there are many) instead of summarising. */
  raw: boolean;
  stacked: boolean;
  legend: LegendPlacement | "";
  series: SeriesState[];
}

interface PivotState {
  row: string;
  column: string;
  grain: ChartGrain;
  measure: string;
  summary: Summary;
}

function measureOf(column: string, summary: Summary): { column?: string; aggregate: ChartAggregate; percentile?: number } {
  if (summary === "count") return { aggregate: "count" };
  if (summary === "p90") return { column, aggregate: "percentile", percentile: 0.9 };
  return { column, aggregate: summary };
}

const isTime = (field: Field | undefined) => field !== undefined && (DataType.isTimestamp(field.type) || DataType.isDate(field.type));

/** The plan is asked for only when a person opens it: explaining a query is a call to the engine. */
function PlanDetails(props: { sourceId: string; sql: string; filters: FilterInit[]; dataSource: DataSource }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="sf-result-sql" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{text("result.plan")}</summary>
      {open && <QueryPlan {...props} />}
    </details>
  );
}

/**
 * A query's result with everything around it: filters; a table, a chart and
 * a pivot of the same query; and the SQL the engine ran. Filters apply to
 * every view, and all views belong to one run of the query.
 */
export function QueryResult(props: QueryResultProps) {
  const { sourceId, sql, timeTravel, notBefore, height = 420, onError } = props;
  const dataSource = useDataSource(props.dataSource);
  const id = useId();
  const [view, setView] = useState<ResultView>(props.defaultView ?? "grid");
  const [filters, setFilters] = useState<FilterInit[]>(props.filters ?? []);
  const [sorts, setSorts] = useState<GridSort[]>(props.sorts ?? []);
  const [columns, setColumns] = useState<GridColumns>(props.columns ?? {});
  const outside = (value: unknown) => JSON.stringify(value ?? null, (_, v) => (typeof v === "bigint" ? `${v}n` : v));
  const given = useRef({ filters: props.filters, sorts: props.sorts, columns: props.columns });
  given.current = { filters: props.filters, sorts: props.sorts, columns: props.columns };
  useEffect(() => {
    if (props.filters) setFilters(props.filters);
  }, [outside(props.filters)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (props.sorts) setSorts(props.sorts);
  }, [outside(props.sorts)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (props.columns) setColumns(props.columns);
  }, [outside(props.columns)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (props.view) setView(props.view);
  }, [props.view]);
  // Report what a person changed; the first render only shows what was given.
  const onControls = useRef(props.onControlsChange);
  onControls.current = props.onControlsChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onControls.current?.({ view, filters, sorts, columns });
  }, [view, filters, sorts, columns]);
  const [fields, setFields] = useState<Field[]>([]);
  const [info, setInfo] = useState<DataGridInfo | undefined>();
  const [chart, setChart] = useState<ChartState>({
    type: "bar",
    x: "",
    grain: "month",
    bins: 0,
    splitBy: "",
    raw: false,
    stacked: false,
    legend: "",
    series: [],
  });
  const [pivot, setPivot] = useState<PivotState>({ row: "", column: "", grain: "month", measure: "", summary: "sum" });
  const [nextId, setNextId] = useState(1);
  const [formats, setFormats] = useState<Record<string, ColumnFormat>>({});
  const [formatColumn, setFormatColumn] = useState("");
  const [tool, setTool] = useState<{ status: string; exporting?: AbortController }>({ status: "" });

  // The values of a column, most common first, for picking in a filter.
  const loadValues = useCallback(
    async (column: string) => {
      const result = await collect(
        dataSource.execute({
          sourceId,
          timeTravel,
          notBefore,
          query: {
            baseSql: sql,
            groupBy: [column],
            aggregates: [{ function: AggregateFunction.COUNT, alias: "sf_count" }],
            sorts: [{ column: "sf_count", direction: SortDirection.DESC }],
            page: { limit: 50 },
          },
        }),
      );
      const values = result.table.getChildAt(0);
      const type = result.table.schema.fields[0]?.type;
      return Array.from({ length: result.table.numRows }, (_, i) => values?.get(i))
        .filter((v) => v != null)
        .map((v) => (type ? formatCell(v, type).text : String(v)));
    },
    [dataSource, sourceId, sql, notBefore, timeTravel], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const download = async () => {
    const controller = new AbortController();
    setTool({ status: text("result.preparing"), exporting: controller });
    try {
      const result = await exportCsv(
        dataSource,
        { sourceId, timeTravel, notBefore, query: { baseSql: sql, filters } },
        { signal: controller.signal, onProgress: (rows) => setTool({ status: text("result.rowsSoFar", { count: numberFormat().format(rows) }), exporting: controller }) },
      );
      downloadBlob(result.blob, `${props.exportName ?? "result"}.csv`);
      setTool({ status: text(result.truncated ? "result.savedTruncated" : "result.saved", { count: numberFormat().format(result.rows) }) });
    } catch (error) {
      setTool({ status: controller.signal.aborted ? text("result.exportStopped") : queryErrorInfo(error).message });
    }
  };
  const copySql = () => {
    void navigator.clipboard?.writeText(info?.executedSql || sql).then(
      () => setTool({ status: text("result.sqlCopied") }),
      () => setTool({ status: text("result.copyNotAllowed") }),
    );
  };
  const formatKind = formats[formatColumn]?.kind ?? "";

  // A one-row probe tells us the result's columns before any view is configured.
  const timeTravelKey = JSON.stringify(timeTravel ?? null, (_, v) => (typeof v === "bigint" ? `${v}n` : v));
  useEffect(() => {
    const controller = new AbortController();
    // A new query starts from what was set from outside, not from the last query's filters.
    setFilters(given.current.filters ?? []);
    setSorts(given.current.sorts ?? []);
    collect(dataSource.execute({ sourceId, timeTravel, notBefore, query: { baseSql: sql, page: { limit: 1 } } }, { signal: controller.signal }))
      .then((result) => {
        if (controller.signal.aborted) return;
        const found = result.table.schema.fields;
        setFields(found);
        const x = found.find(isTime) ?? found.find((f) => !isNumeric(f.type)) ?? found[0];
        // Prefer a measure-like column: skip identifiers, and favour decimals over integers.
        const measures = found.filter((f) => isNumeric(f.type) && f !== x && !/(^|_)id$/i.test(f.name));
        const y = measures.find((f) => !DataType.isInt(f.type)) ?? measures[0] ?? found.find((f) => isNumeric(f.type) && f !== x);
        const category = found.find((f) => !isNumeric(f.type) && !isTime(f));
        setChart((previous) => ({
          ...previous,
          type: isTime(x) ? "line" : "bar",
          x: x?.name ?? "",
          splitBy: "",
          series: [{ id: 0, column: y?.name ?? "", summary: y ? "sum" : "count", type: "", axis: "left" }],
        }));
        setPivot((previous) => ({
          ...previous,
          row: category?.name ?? x?.name ?? "",
          column: found.find((f) => f !== category && isTime(f))?.name ?? "",
          measure: y?.name ?? "",
          summary: y ? "sum" : "count",
        }));
        onError?.(undefined);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFields([]);
        const errorInfo = queryErrorInfo(error);
        onError?.(errorInfo.message, errorInfo);
      });
    return () => controller.abort();
  }, [dataSource, sourceId, sql, timeTravelKey, notBefore]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (name: string) => fields.find((f) => f.name === name);
  const numericFields = fields.filter((f) => isNumeric(f.type));
  const xField = field(chart.x);
  const xIsTime = isTime(xField);
  const xIsNumber = xField !== undefined && isNumeric(xField.type);
  const y: ChartMeasure[] = chart.series.map((s) => ({
    ...(chart.raw ? { column: s.column } : measureOf(s.column, s.summary)),
    type: s.type || undefined,
    axis: s.axis,
  }));
  const chartReady = chart.x !== "" && chart.series.length > 0 && chart.series.every((s) => s.column !== "" || (!chart.raw && s.summary === "count"));
  const setSeries = (seriesId: number, change: Partial<SeriesState>) =>
    setChart((previous) => ({ ...previous, series: previous.series.map((s) => (s.id === seriesId ? { ...s, ...change } : s)) }));
  const compound = chart.type !== "pie";
  const pivotReady = pivot.row !== "" && (pivot.summary === "count" || pivot.measure !== "");
  const dimension = (name: string) => (isTime(field(name)) ? { column: name, grain: pivot.grain } : name);
  const select = (label: string, value: string, options: { value: string; label: string }[], onChange: (value: string) => void) => (
    <label>
      <span>{label}</span>
      <select className="sf-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const names = (list: Field[]) => list.map((f) => ({ value: f.name, label: f.name }));
  const none = (label: string) => [{ value: "", label }];
  const summaries = SUMMARIES.map((s) => ({ value: s, label: text(SUMMARY_LABEL[s]) }));
  const grains = GRAINS.map((g) => ({ value: g, label: g }));

  return (
    <section className={["sf-result", "sf-container", props.className].filter(Boolean).join(" ")}>
      <div className="sf-result-bar">
        <div className="sf-segmented sf-result-views" role="tablist" aria-label={text("result.views")}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`${id}-${v.id}`}
              aria-selected={view === v.id}
              aria-controls={`${id}-panel`}
              className="sf-segment"
              data-checked={view === v.id || undefined}
              onClick={() => setView(v.id)}
            >
              {text(v.label)}
            </button>
          ))}
        </div>
        <FilterBar fields={fields} filters={filters} onChange={setFilters} loadValues={loadValues} />
      </div>

      <div className="sf-result-tools">
        {tool.exporting ? (
          <button type="button" className="sf-button" onClick={() => tool.exporting?.abort()}>
            {text("result.stopExport")}
          </button>
        ) : (
          <button type="button" className="sf-button" disabled={fields.length === 0} onClick={() => void download()}>
            {text("result.downloadCsv")}
          </button>
        )}
        <button type="button" className="sf-button" onClick={copySql}>
          {text("result.copySql")}
        </button>
        {info?.loading && view === "grid" && (
          <button type="button" className="sf-button" onClick={info.cancel}>
            {text("result.cancelQuery")}
          </button>
        )}
        {view === "grid" && fields.length > 0 && (
          <>
            <label>
              <span>{text("result.format")}</span>
              <select className="sf-input" aria-label={text("result.formatColumn")} value={formatColumn} onChange={(e) => setFormatColumn(e.target.value)}>
                <option value="">{text("result.chooseColumn")}</option>
                {fields.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
              </select>
            </label>
            {formatColumn && (
              <select
                className="sf-input"
                aria-label={text("result.howToShow", { column: formatColumn })}
                value={formatKind}
                onChange={(e) => {
                  const kind = e.target.value as ColumnFormat["kind"] | "";
                  setFormats((previous) => {
                    const { [formatColumn]: _dropped, ...rest } = previous;
                    return kind ? { ...rest, [formatColumn]: { kind, ...(kind === "currency" ? { decimals: 2 } : {}) } } : rest;
                  });
                }}
              >
                <option value="">{text("result.asItIs")}</option>
                {(isNumeric(field(formatColumn)?.type ?? fields[0]!.type)
                  ? (["number", "compact", "currency", "percent", "text"] as const)
                  : isTime(field(formatColumn))
                    ? (["date", "datetime"] as const)
                    : (["text"] as const)
                ).map((kind) => (
                  <option key={kind} value={kind}>
                    {text(FORMAT_LABEL[kind])}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <span className="sf-result-tools-status" role="status">
          {tool.status}
        </span>
      </div>

      {view === "chart" && (
        <div className="sf-result-chart-controls">
          <div className="sf-result-control-row">
            {select(text("result.chartType"), chart.type, CHART_TYPES.map((t) => ({ value: t, label: t })), (type) => setChart({ ...chart, type: type as ChartType }))}
            {select(text(chart.type === "pie" ? "result.slices" : "result.xAxis"), chart.x, names(fields), (x) => setChart({ ...chart, x }))}
            {!chart.raw && xIsTime && select(text("result.every"), chart.grain, grains, (grain) => setChart({ ...chart, grain: grain as ChartGrain }))}
            {!chart.raw &&
              xIsNumber &&
              select(
                text("result.bins"),
                String(chart.bins),
                [{ value: "0", label: text("result.binsEach") }, ...[10, 20, 50].map((n) => ({ value: String(n), label: text("result.binsAbout", { count: n }) }))],
                (bins) => setChart({ ...chart, bins: Number(bins) }),
              )}
            {compound &&
              select(text("result.splitBy"), chart.splitBy, [...none(text("result.nothing")), ...names(fields.filter((f) => f.name !== chart.x))], (splitBy) =>
                setChart({ ...chart, splitBy }),
              )}
            {compound &&
              select(
                text("result.legend"),
                chart.legend,
                [...none(text("result.automatic")), ...LEGENDS.map((l) => ({ value: l, label: l === "none" ? text("result.legendHidden") : l }))],
                (legend) => setChart({ ...chart, legend: legend as LegendPlacement | "" }),
              )}
            {compound && (
              <label className="sf-result-check">
                <input type="checkbox" checked={chart.stacked} onChange={(e) => setChart({ ...chart, stacked: e.target.checked })} />
                <span>{text("result.stack")}</span>
              </label>
            )}
            <label className="sf-result-check">
              <input type="checkbox" checked={chart.raw} onChange={(e) => setChart({ ...chart, raw: e.target.checked })} />
              <span>{text("result.plotEachRow")}</span>
            </label>
          </div>
          {chart.series.map((s, index) => (
            <div key={s.id} className="sf-result-control-row" role="group" aria-label={text("result.series", { number: index + 1 })}>
              {!chart.raw && select(index === 0 ? text("result.yAxis") : text("result.series", { number: index + 1 }), s.summary, summaries, (summary) => setSeries(s.id, { summary: summary as Summary }))}
              {(chart.raw || s.summary !== "count") &&
                select(
                  chart.raw ? (index === 0 ? text("result.yAxis") : text("result.series", { number: index + 1 })) : text("result.of"),
                  s.column,
                  names(chart.raw || s.summary === "min" || s.summary === "max" || s.summary === "count_distinct" ? fields : numericFields),
                  (column) => setSeries(s.id, { column }),
                )}
              {compound &&
                select(
                  text("result.drawnAs"),
                  s.type,
                  [...none(text("result.drawnAsChart", { type: chart.type })), ...SERIES_TYPES.map((t) => ({ value: t, label: t }))],
                  (type) => setSeries(s.id, { type: type as SeriesType | "" }),
                )}
              {compound &&
                select(
                  text("result.scale"),
                  s.axis,
                  [
                    { value: "left", label: text("result.leftAxis") },
                    { value: "right", label: text("result.rightAxis") },
                  ],
                  (axis) => setSeries(s.id, { axis: axis as "left" | "right" }),
                )}
              {chart.series.length > 1 && (
                <button
                  type="button"
                  className="sf-button"
                  aria-label={text("result.removeSeries", { number: index + 1 })}
                  onClick={() => setChart({ ...chart, series: chart.series.filter((other) => other.id !== s.id) })}
                >
                  {text("result.remove")}
                </button>
              )}
            </div>
          ))}
          {compound && chart.series.length < 6 && (
            <div className="sf-result-control-row">
              <button
                type="button"
                className="sf-button"
                onClick={() => {
                  const last = chart.series.at(-1);
                  setChart({
                    ...chart,
                    series: [...chart.series, { id: nextId, column: last?.column ?? numericFields[0]?.name ?? "", summary: "avg", type: "line", axis: "right" }],
                  });
                  setNextId(nextId + 1);
                }}
              >
                {text("result.addSeries")}
              </button>
            </div>
          )}
        </div>
      )}

      {view === "pivot" && (
        <div className="sf-result-chart-controls">
          <div className="sf-result-control-row">
            {select(text("result.rows"), pivot.row, names(fields), (row) => setPivot({ ...pivot, row }))}
            {select(text("result.columns"), pivot.column, [...none(text("result.none")), ...names(fields.filter((f) => f.name !== pivot.row))], (column) =>
              setPivot({ ...pivot, column }),
            )}
            {(isTime(field(pivot.row)) || isTime(field(pivot.column))) &&
              select(text("result.datesBy"), pivot.grain, grains, (grain) => setPivot({ ...pivot, grain: grain as ChartGrain }))}
            {select(text("result.values"), pivot.summary, summaries, (summary) => setPivot({ ...pivot, summary: summary as Summary }))}
            {pivot.summary !== "count" &&
              select(
                text("result.of"),
                pivot.measure,
                names(pivot.summary === "min" || pivot.summary === "max" || pivot.summary === "count_distinct" ? fields : numericFields),
                (measure) => setPivot({ ...pivot, measure }),
              )}
          </div>
        </div>
      )}

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}`}>
        {view === "grid" ? (
          <DataGrid
            dataSource={dataSource}
            sourceId={sourceId}
            sql={sql}
            filters={filters}
            timeTravel={timeTravel}
            notBefore={notBefore}
            formats={formats}
            height={height}
            sorts={sorts}
            onSortsChange={setSorts}
            columns={columns}
            onColumnsChange={setColumns}
            onCellFilter={(column, value, exclude) => setFilters((current) => [...current, valueFilter(column, value, exclude)])}
            onInfo={(next) => {
              setInfo(next);
              if (next.error) onError?.(next.error, next.errorInfo);
            }}
          />
        ) : view === "chart" ? (
          chartReady ? (
            <div className="sf-result-chart">
              <Chart
                dataSource={dataSource}
                sourceId={sourceId}
                sql={sql}
                filters={filters}
                timeTravel={timeTravel}
                notBefore={notBefore}
                type={chart.type}
                x={chart.x}
                xGrain={!chart.raw && xIsTime ? chart.grain : undefined}
                xBins={!chart.raw && xIsNumber && chart.bins > 0 ? chart.bins : undefined}
                y={chart.type === "pie" ? y.slice(0, 1) : y}
                splitBy={compound && chart.splitBy ? chart.splitBy : undefined}
                stacked={chart.stacked}
                legend={chart.legend || undefined}
                height={height - 24}
              />
            </div>
          ) : (
            <p className="sf-chart-message" style={{ minHeight: height }}>
              {text("result.chooseChart")}
            </p>
          )
        ) : pivotReady ? (
          <PivotTable
            dataSource={dataSource}
            sourceId={sourceId}
            sql={sql}
            filters={filters}
            timeTravel={timeTravel}
            notBefore={notBefore}
            rows={[dimension(pivot.row)]}
            columns={pivot.column ? [dimension(pivot.column)] : []}
            measures={[measureOf(pivot.measure, pivot.summary)]}
            height={height}
          />
        ) : (
          <p className="sf-chart-message" style={{ minHeight: height }}>
            {text("result.choosePivot")}
          </p>
        )}
      </div>

      {view === "grid" && info?.executedSql && (
        <details className="sf-result-sql">
          <summary>{text("result.sqlSent")}</summary>
          <pre tabIndex={0}>{info.executedSql}</pre>
          {info.stored && (
            <p className="sf-result-notice">
              {text("result.stored")}
            </p>
          )}
          {info.notices.map((notice) => (
            <p key={notice.code} className="sf-result-notice">
              {notice.message}
            </p>
          ))}
        </details>
      )}
      {fields.length > 0 && <PlanDetails sourceId={sourceId} sql={sql} filters={filters} dataSource={dataSource} />}
    </section>
  );
}
