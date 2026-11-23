import { type DataSource, collect } from "@surfaces-ui/data";
import type { SemanticModel } from "@surfaces-ui/proto";
import type { Field } from "apache-arrow";
import { type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Chart, type ChartGrain } from "../chart/Chart.js";
import type { OnContext } from "../controls/context.js";
import { ControlIcon, type ItemControl, ItemControls, standardControls } from "../controls/ItemControls.js";
import type { FilterSpec } from "@surfaces-ui/data";
import { filtersExcept, filtersFromSpec } from "@surfaces-ui/data";
import { useDataSource } from "../data/DataSourceProvider.js";
import { formatCell, numericValue } from "../data/format.js";
import { type FilterInit, messageOf } from "../data/useRowWindow.js";
import { QueryFilters } from "../filter/QueryFilters.js";
import { type MenuItem, useContextMenu } from "../menu/ContextMenu.js";
import {
  type ExploreChartType,
  type ExploreMeasureStyle,
  type ExploreState,
  type Pill,
  type PillAggregate,
  type PillFormat,
  type PillKind,
  addToShelf,
  emptyExplore,
  exploreChart,
  exploreQuery,
  movePill,
  normalizeExplore,
  pillColumn,
  pillId,
  pillNumber,
  pillProblem,
  pillsFromFields,
  suggestedView,
  removeFromShelf,
  setChartSettings,
  setMeasureStyle,
  setPill,
  suggestDerived,
  swapProblem,
} from "./model.js";
import { canPromote, mergeModelPills, pillsWithModel } from "./semantic.js";
import { ModelLineage } from "./ModelLineage.js";

export interface ExplorerProps {
  /** Where the query runs. Left out, the model's source. */
  sourceId?: string;
  /** The query to explore: a table, or a join. Every pill is a column of it or a calculation over them. Left out, the model's query. */
  sql?: string;
  /**
   * The semantic model the fields come from. Its dimensions, measures and
   * metrics become pills marked as the model's, before pills generated for
   * the columns it leaves out; when it changes, its pills follow.
   */
  model?: SemanticModel;
  /**
   * Offers "Add to the model" on a pill that is not the model's own (made
   * here, written by an agent, or changed by hand). The host saves it, for
   * example with `useSemanticModel(...).promote`, and passes the new model.
   * Resolve to a sentence saying what happened.
   */
  onPromote?(pill: Pill, all: Pill[]): Promise<string | void> | string | void;
  /** What is on the shelves, when the host holds it. With no fields, pills are generated from the query's columns. */
  value?: ExploreState;
  defaultValue?: ExploreState;
  onChange?(state: ExploreState): void;
  /**
   * Shows a box to ask for a field or a view in words ("refund rate by
   * region"). The host passes the words to its agent, which answers by
   * setting `value`. The component never calls a model itself.
   */
  onAsk?(text: string, state: ExploreState): void;
  /** Name recorded on pills a person makes or edits. Defaults to "you". */
  editor?: string;
  /** Told what a person does here as they do it (a field put on a shelf, a field made or changed, a calculation suggested), for an agent's context. */
  onContext?: OnContext;
  /** More controls for the view, shown with its chart and table switch when the view is pointed at or focused: a report's "Add to report". */
  controls?: ItemControl[];
  /** Height of the chart in px. Defaults to 300. */
  chartHeight?: number;
  /**
   * When it generates its pills and nothing is on the shelves, put a first
   * view there (see `suggestedView`), so something is drawn before anyone
   * presses a pill. Off by default: a host that holds the shelves decides.
   */
  startWithView?: boolean;
  /**
   * What the host does with the view, drawn under it at its end edge: "Put
   * this chart on the page". There, it sits with what it acts on and clear
   * of the view's own controls in its corner.
   */
  actions?: ReactNode;
  dataSource?: DataSource;
  className?: string;
}

type Shelf = "rows" | "split" | "values";
const SHELVES: { id: Shelf; label: string; takes: PillKind[]; hint: string }[] = [
  { id: "rows", label: "Break down by", takes: ["attribute"], hint: "An attribute: one bar, point or row for each of its values." },
  { id: "split", label: "Split by", takes: ["attribute"], hint: "An attribute whose values become separate series." },
  { id: "values", label: "Measure", takes: ["metric", "derived"], hint: "Metrics and calculations: what is counted or added up." },
];
const GLYPH: Record<PillKind, string> = { attribute: "Abc", metric: "Σ", derived: "ƒ" };
/** How long a finger holds a pill before it drags it rather than scrolling the page. Shorter than a long press, which opens the pill's menu. */
export const TOUCH_HOLD_MS = 300;
const KIND_WORD: Record<PillKind, string> = { attribute: "attribute", metric: "metric", derived: "calculation" };
const AGGREGATES: { value: PillAggregate; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "count", label: "Count" },
  { value: "count_distinct", label: "Count of distinct values" },
  { value: "min", label: "Smallest" },
  { value: "max", label: "Largest" },
  { value: "median", label: "Median" },
];
const GRAINS: ChartGrain[] = ["day", "week", "month", "quarter", "year"];
const FORMATS: PillFormat[] = ["number", "compact", "currency", "percent"];

interface ExploreRows {
  rows?: Record<string, unknown>[];
  types?: Record<string, Field["type"]>;
  error?: string;
}

/** The grouped result of what is on the shelves, asked of the engine again whenever the shelves, the pills or the filters change. */
function useExploreRows(dataSource: DataSource, sourceId: string, sql: string, state: ExploreState, limit: number): ExploreRows {
  const key = JSON.stringify([sourceId, sql, state.rows, state.split, state.values, state.filters, state.fields, limit]);
  const [result, setResult] = useState<ExploreRows & { key: string }>({ key: "" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the query.
  useEffect(() => {
    const controller = new AbortController();
    let query: ReturnType<typeof exploreQuery>;
    try {
      query = exploreQuery(state, sql, limit);
    } catch (error) {
      setResult({ key, error: messageOf(error) });
      return;
    }
    collect(dataSource.execute({ sourceId, query }, { signal: controller.signal }))
      .then((found) => {
        if (controller.signal.aborted) return;
        const types = Object.fromEntries(found.table.schema.fields.map((f) => [f.name, f.type]));
        setResult({ key, rows: found.table.toArray().map((row) => row.toJSON() as Record<string, unknown>), types });
      })
      .catch((error: unknown) => !controller.signal.aborted && setResult({ key, error: messageOf(error) }));
    return () => controller.abort();
  }, [dataSource, key]);
  return result.key === key ? result : {};
}

const shelfPills = (state: ExploreState) => [...state.rows, ...(state.split ? [state.split] : []), ...state.values].map((id) => state.fields.find((p) => p.id === id)).filter((p): p is Pill => !!p);

/** The grouped result of what is on the shelves, as a small table. The engine summarises; at most `limit` rows are asked for. */
function ExploreTable({ dataSource, sourceId, sql, state, limit = 200 }: { dataSource: DataSource; sourceId: string; sql: string; state: ExploreState; limit?: number }) {
  const result = useExploreRows(dataSource, sourceId, sql, state, limit);
  const columns = shelfPills(state);
  if (result.error)
    return (
      <p className="sf-filter-problem" role="alert">
        {result.error}
      </p>
    );
  if (!result.rows) return <p className="sf-explore-hint">Working it out…</p>;
  const cell = (pill: Pill, row: Record<string, unknown>) => {
    const value = row[pillColumn(pill)];
    const type = result.types?.[pillColumn(pill)];
    // A decimal arrives as its digits without the point; its type says where the point goes.
    if (pill.kind !== "attribute") return pillNumber(type ? numericValue(value, type) : value, pill.format);
    return value == null ? "–" : type ? formatCell(value, type).text : String(value);
  };
  return (
    <div className="sf-explore-table" tabIndex={0} role="region" aria-label="The numbers behind the view">
      <table>
        <thead>
          <tr>
            {columns.map((pill) => (
              <th key={pill.id} scope="col" data-number={pill.kind !== "attribute" || undefined}>
                {pill.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows of one result do not move.
            <tr key={i}>
              {columns.map((pill) => (
                <td key={pill.id} data-number={pill.kind !== "attribute" || undefined}>
                  {cell(pill, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length >= limit && <p className="sf-explore-hint">The first {limit} rows, in the order shown. Add a filter or a coarser breakdown to see fewer.</p>}
    </div>
  );
}

/** Values with nothing to break them down by: one number each, worked out by the engine, shown as headline figures. */
function ExploreNumbers({ dataSource, sourceId, sql, state }: { dataSource: DataSource; sourceId: string; sql: string; state: ExploreState }) {
  const result = useExploreRows(dataSource, sourceId, sql, { ...state, rows: [], split: undefined }, 1);
  const values = state.values.map((id) => state.fields.find((p) => p.id === id)).filter((p): p is Pill => !!p);
  if (result.error)
    return (
      <p className="sf-filter-problem" role="alert">
        {result.error}
      </p>
    );
  return (
    <dl className="sf-explore-numbers">
      {values.map((pill) => (
        <div key={pill.id}>
          <dt>{pill.label}</dt>
          <dd>{result.rows ? pillNumber(result.types?.[pill.id] ? numericValue(result.rows[0]?.[pill.id], result.types[pill.id]!) : result.rows[0]?.[pill.id], pill.format) : "…"}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ExploreViewProps {
  sourceId: string;
  sql: string;
  /** The pills, the shelves and the filters to draw. */
  state: ExploreState;
  /** Chart or table. Defaults to the state's own, then a chart. Values with no breakdown are always numbers. */
  view?: "chart" | "table";
  /** Height of the chart in px. Defaults to 300. */
  height?: number;
  /** Accessible description of what is drawn. */
  label?: string;
  /**
   * Makes a bar chart a filter: called with the breakdown's column and the
   * value clicked. The view then leaves out filters on that column, so the
   * bars a person clicks stay. Only for a category breakdown.
   */
  onPointClick?(column: string, value: string | number): void;
  dataSource?: DataSource;
}

/**
 * What a set of shelves draws: a chart when there is something to break
 * down by, the numbers behind it as a table, or headline figures when there
 * is nothing to break down by. One tile of a report, or the explorer's own
 * result. Everything is worked out by the engine.
 */
export function ExploreView(props: ExploreViewProps) {
  const { sourceId, sql, state, height = 300, label, onPointClick } = props;
  const dataSource = useDataSource(props.dataSource);
  const chart = useMemo(() => exploreChart(state), [state]);
  const clickable = !!onPointClick && !!chart && !chart.xGrain;
  const [filters, problem] = useMemo((): [FilterInit[], string | undefined] => {
    try {
      return [filtersFromSpec(clickable ? filtersExcept(state.filters, chart!.x) : state.filters), undefined];
    } catch (error) {
      return [[], messageOf(error)];
    }
  }, [state.filters, clickable, chart]);
  if (state.values.length === 0) return null;
  if (problem)
    return (
      <p className="sf-filter-problem" role="alert">
        {problem}
      </p>
    );
  const shown = props.view ?? state.view ?? "chart";
  if (!chart) return <ExploreNumbers dataSource={dataSource} sourceId={sourceId} sql={sql} state={state} />;
  if (shown === "table") return <ExploreTable dataSource={dataSource} sourceId={sourceId} sql={sql} state={state} />;
  return (
    <Chart
      key={JSON.stringify(chart)}
      dataSource={dataSource}
      sourceId={sourceId}
      sql={sql}
      filters={filters}
      type={chart.type}
      x={chart.x}
      xGrain={chart.xGrain}
      splitBy={chart.splitBy}
      y={chart.y}
      xTitle={chart.xTitle}
      yTitle={chart.yTitle}
      yRightTitle={chart.yRightTitle}
      yFormat={chart.yFormat}
      horizontal={chart.horizontal}
      height={height}
      label={label}
      onPointClick={clickable ? (point) => point.x != null && onPointClick!(chart.x, point.x) : undefined}
    />
  );
}

/** What the shelves say, in words: "Refund rate by Category, split by Channel". */
export function exploreReading(state: ExploreState): string {
  const label = (id: string) => state.fields.find((p) => p.id === id)?.label;
  return [
    state.values.map(label).filter(Boolean).join(" and "),
    state.rows.length > 0 ? `by ${state.rows.map(label).filter(Boolean).join(", then ")}` : "",
    state.split ? `split by ${label(state.split)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The form a pill is made or changed in. Nothing is saved until it is valid. Used by `Explorer` and `SemanticModelEditor`, so a field is edited the same way in both. */
export function PillEditor({
  pill,
  all,
  columns,
  isNew,
  modelLabel,
  onSave,
  onCancel,
  onRemove,
  onPromote,
}: {
  pill: Pill;
  all: Pill[];
  columns: Field[];
  isNew: boolean;
  modelLabel?: string;
  onSave(next: Pill): void;
  onCancel(): void;
  onRemove?(): void;
  onPromote?(): void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(pill);
  const others = all.filter((p) => p.id !== pill.id);
  const named = isNew ? { ...draft, id: pillId(draft.label || KIND_WORD[draft.kind], others.map((p) => p.id)) } : draft;
  const problem = pillProblem(named, [...others, named], columns.map((c) => c.name));
  const metrics = all.filter((p) => p.kind === "metric");
  const field = columns.find((c) => c.name === draft.column);
  const temporal = !!field && /Timestamp|Date/.test(String(field.type));
  // Calculations that name this metric follow any change to it; say so before it is saved.
  const dependents = isNew || pill.kind !== "metric" ? [] : all.filter((p) => p.kind === "derived" && new RegExp(`\\b${pill.id}\\b`).test(p.expression ?? ""));
  const changesMeaning = dependents.length > 0 && (draft.aggregate !== pill.aggregate || draft.column !== pill.column);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!problem) onSave(named);
  };
  return (
    <form className="sf-explore-editor" onSubmit={submit} aria-label={isNew ? `New ${KIND_WORD[draft.kind]}` : `Edit ${pill.label}`}>
      <p className="sf-explore-editor-title">
        <span className="sf-pill-glyph" aria-hidden="true">
          {GLYPH[draft.kind]}
        </span>
        {isNew ? `New ${KIND_WORD[draft.kind]}` : `Edit ${KIND_WORD[draft.kind]}`}
        {!isNew && pill.by && <span className="sf-explore-by"> · made by {pill.by}</span>}
      </p>
      {modelLabel && <p className="sf-explore-hint">Defined in the {modelLabel} model. A change here stays in this view until it is added to the model again.</p>}
      <label htmlFor={`${id}-label`}>Label</label>
      <input id={`${id}-label`} className="sf-input" value={draft.label} autoFocus onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      {draft.kind !== "derived" && (
        <>
          <label htmlFor={`${id}-column`}>Column</label>
          <select id={`${id}-column`} className="sf-input" value={draft.column ?? ""} onChange={(e) => setDraft({ ...draft, column: e.target.value || undefined })}>
            {draft.kind === "metric" && <option value="">(rows)</option>}
            {columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
      {draft.kind === "attribute" && temporal && (
        <>
          <label htmlFor={`${id}-grain`}>Grouped by</label>
          <select id={`${id}-grain`} className="sf-input" value={draft.grain ?? "month"} onChange={(e) => setDraft({ ...draft, grain: e.target.value as ChartGrain })}>
            {GRAINS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </>
      )}
      {draft.kind === "metric" && (
        <>
          <label htmlFor={`${id}-aggregate`}>Summarised as</label>
          <select id={`${id}-aggregate`} className="sf-input" value={draft.aggregate ?? "sum"} onChange={(e) => setDraft({ ...draft, aggregate: e.target.value as PillAggregate })}>
            {AGGREGATES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </>
      )}
      {draft.kind === "derived" && (
        <>
          <label htmlFor={`${id}-expression`}>Calculation</label>
          <textarea
            id={`${id}-expression`}
            className="sf-input sf-explore-expression"
            rows={2}
            spellCheck={false}
            value={draft.expression ?? ""}
            aria-describedby={`${id}-names`}
            placeholder="refund_amount / line_amount"
            onChange={(e) => setDraft({ ...draft, expression: e.target.value })}
          />
          <p id={`${id}-names`} className="sf-explore-hint">
            Metrics, numbers, + − × ÷ and parentheses. Worked out by the database after summarising. Press a metric to add it:
          </p>
          <div className="sf-explore-names">
            {metrics.map((m) => (
              <button key={m.id} type="button" className="sf-pill" data-kind="metric" title={m.label} onClick={() => setDraft({ ...draft, expression: `${draft.expression ?? ""}${draft.expression && !/[\s(]$/.test(draft.expression) ? " " : ""}${m.id}` })}>
                <span className="sf-pill-glyph" aria-hidden="true">
                  Σ
                </span>
                {m.id}
              </button>
            ))}
          </div>
        </>
      )}
      {draft.kind !== "attribute" && (
        <>
          <label htmlFor={`${id}-format`}>Shown as</label>
          <select id={`${id}-format`} className="sf-input" value={draft.format ?? "number"} onChange={(e) => setDraft({ ...draft, format: e.target.value as PillFormat })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={`${id}-description`}>What it means (optional)</label>
      <input id={`${id}-description`} className="sf-input" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined })} />
      {changesMeaning && (
        <p className="sf-explore-warning" role="status">
          {dependents.length === 1 ? "A calculation uses" : `${dependents.length} calculations use`} this metric and will change with it: {dependents.map((p) => p.label).join(", ")}. To keep {dependents.length === 1 ? "it" : "them"} as {dependents.length === 1 ? "it is" : "they are"}, cancel and duplicate this metric instead.
        </p>
      )}
      {problem && (
        <p className="sf-filter-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="sf-explore-editor-actions">
        <button type="submit" className="sf-button" data-variant="primary" disabled={!!problem}>
          {isNew ? "Add" : "Save"}
        </button>
        <button type="button" className="sf-button" onClick={onCancel}>
          Cancel
        </button>
        {onPromote && (
          <button type="button" className="sf-button" onClick={onPromote}>
            Add to the model
          </button>
        )}
        {onRemove && (
          <button type="button" className="sf-button" data-variant="danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Exploring a query with pills. Every column becomes a pill generated on the
 * spot: an attribute to break down by or a metric to measure. Calculations
 * over metrics (a rate, a margin) are pills too, suggested, written by an
 * agent or made by hand, and every pill can be edited. Putting pills on the
 * shelves draws a chart and the numbers behind it, worked out by the
 * database. The shelves and the pills are plain data, so an agent can set
 * exactly what a person can drag, and sees what a person did.
 */
export function Explorer(props: ExplorerProps) {
  const { onChange, onAsk, editor = "you", chartHeight = 300, model } = props;
  const sourceId = props.sourceId ?? model?.sourceId ?? "";
  const sql = props.sql ?? model?.sql ?? "";
  const dataSource = useDataSource(props.dataSource);
  const menu = useContextMenu();
  const uid = useId();
  const [own, setOwn] = useState<ExploreState>(props.defaultValue ?? emptyExplore);
  const state = useMemo(() => normalizeExplore(props.value ?? own), [props.value, own]);
  // As given, before anything is taken off the shelves: shelves can name pills that are only generated once the columns are known.
  const latest = useRef(props.value ?? own);
  latest.current = props.value ?? own;
  const modelRef = useRef(model);
  modelRef.current = model;
  const set = useCallback(
    (next: ExploreState) => {
      const clean = normalizeExplore(next);
      setOwn(clean);
      onChange?.(clean);
    },
    [onChange],
  );

  const [columns, setColumns] = useState<Field[]>([]);
  const [problem, setProblem] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ pill: Pill; isNew: boolean } | undefined>();
  const [search, setSearch] = useState("");
  const context = useRef(props.onContext);
  context.current = props.onContext;
  /** Says what happened to the person, and tells the host the same as context for an agent. */
  const say = (kind: string, summary: string, subject?: Record<string, unknown>) => {
    setNote(summary);
    context.current?.({ kind, summary, ...(subject ? { subject } : {}) });
  };
  const [ask, setAsk] = useState("");
  // Calculations and filters start folded unless there are some already; then each stays as a person leaves it.
  const [calculationsOpen, setCalculationsOpen] = useState(() => (props.value ?? props.defaultValue)?.fields?.some((p) => p.kind === "derived") ?? false);
  const [filtersOpen, setFiltersOpen] = useState(() => ((props.value ?? props.defaultValue)?.filters?.length ?? 0) > 0);
  const [view, setView] = useState<"chart" | "table">("chart");
  const shown = state.view ?? view;

  // The query's columns: what a pill can be made from. With no pills given, they are generated from these.
  useEffect(() => {
    const controller = new AbortController();
    setProblem(undefined);
    collect(dataSource.execute({ sourceId, query: { baseSql: sql, page: { limit: 1 } } }, { signal: controller.signal }))
      .then((result) => {
        if (controller.signal.aborted) return;
        const found = result.table.schema.fields;
        setColumns(found);
        if (latest.current.fields.length === 0) {
          const fields = modelRef.current ? pillsWithModel(modelRef.current, found) : pillsFromFields(found);
          const empty = latest.current.rows.length === 0 && latest.current.values.length === 0 && !latest.current.split;
          set({ ...latest.current, fields, ...(props.startWithView && empty ? suggestedView(fields) : {}) });
          const own = fields.filter((p) => p.model).length;
          say(
            "fields.generated",
            own > 0 ? `${own} fields from the ${modelRef.current?.label || modelRef.current?.name} model, and ${fields.length - own} generated from the other columns.` : `${fields.length} fields generated from the columns. Edit any of them, or add your own.`,
            { fields: fields.map((p) => ({ id: p.id, kind: p.kind, label: p.label, ...(p.model ? { model: p.model } : {}) })) },
          );
        }
      })
      .catch((error: unknown) => !controller.signal.aborted && setProblem(messageOf(error)));
    return () => controller.abort();
  }, [dataSource, sourceId, sql]); // eslint-disable-line react-hooks/exhaustive-deps

  // A model that changes (a field added to it here or elsewhere) brings its pills along; pills changed by hand stay as they are.
  useEffect(() => {
    if (!model || latest.current.fields.length === 0) return;
    const merged = mergeModelPills(latest.current.fields, model);
    if (JSON.stringify(merged) !== JSON.stringify(latest.current.fields)) set({ ...latest.current, fields: merged });
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  const promote = async (target: Pill) => {
    if (!props.onPromote) return;
    try {
      const said = await props.onPromote(target, state.fields);
      say("field.promoted", said || `${target.label} offered to the model.`, { field: target, ...(model ? { model: model.name } : {}) });
    } catch (error) {
      setNote(messageOf(error));
    }
  };
  const offer = (target: Pill) => !!props.onPromote && canPromote(target, model);

  const pill = (id: string) => state.fields.find((p) => p.id === id);
  const onShelf = (id: string): Shelf | undefined => (state.rows.includes(id) ? "rows" : state.split === id ? "split" : state.values.includes(id) ? "values" : undefined);
  const put = (id: string, shelf?: Shelf, at?: number) => {
    const target = pill(id);
    if (!target) return;
    const where = shelf ?? (target.kind === "attribute" ? "rows" : "values");
    const name = SHELVES.find((s) => s.id === where)!.label;
    if (!SHELVES.find((s) => s.id === where)!.takes.includes(target.kind)) return setNote(`${target.label} is ${target.kind === "attribute" ? "an attribute" : `a ${KIND_WORD[target.kind]}`}, so it cannot go on “${name}”.`);
    const was = onShelf(id);
    const next = addToShelf(state, id, where, at);
    set(next);
    const list = where === "split" ? [] : next[where];
    const place = list.indexOf(id) + 1;
    say(
      "shelf.changed",
      was === where && list.length > 1 ? `${target.label} moved to place ${place} of ${list.length} on “${name}”.` : `${target.label} added to “${name}”.`,
      { ...(was === where ? { moved: target.id } : { added: target.id }), shelf: where, rows: next.rows, split: next.split ?? null, values: next.values },
    );
  };
  const shift = (target: Pill, by: -1 | 1) => {
    const shelf = onShelf(target.id);
    if (shelf !== "rows" && shelf !== "values") return;
    const next = movePill(state, target.id, by);
    if (next === state) return setNote(`${target.label} is already ${by < 0 ? "first" : "last"} on “${SHELVES.find((s) => s.id === shelf)!.label}”.`);
    set(next);
    say("shelf.changed", `${target.label} moved to place ${next[shelf].indexOf(target.id) + 1} of ${next[shelf].length} on “${SHELVES.find((s) => s.id === shelf)!.label}”.`, { moved: target.id, shelf, rows: next.rows, split: next.split ?? null, values: next.values });
  };
  const take = (id: string, shelf: Shelf) => {
    const next = removeFromShelf(state, id, shelf);
    set(next);
    say("shelf.changed", `${pill(id)?.label ?? id} removed from “${SHELVES.find((s) => s.id === shelf)!.label}”.`, { removed: id, shelf, rows: next.rows, split: next.split ?? null, values: next.values });
  };
  const removeField = (target: Pill) => {
    set(setPill(state, target.id, undefined));
    say("field.removed", `${target.label} removed.`, { field: target });
  };
  const CHART_WORD: Record<ExploreChartType, string> = { bar: "bars", line: "a line", area: "an area" };
  const chartTypeNow: ExploreChartType = state.chart?.type ?? (pill(state.rows[0] ?? "")?.grain ? "line" : "bar");
  const setType = (type: ExploreChartType) => {
    set(setChartSettings(state, { type }));
    say("chart.changed", `Drawn as ${CHART_WORD[type]}.`, { chart: { type } });
  };
  const cannotSwap = swapProblem(state);
  const swapped = !!state.chart?.swap && !cannotSwap;
  const swap = () => {
    const next = !swapped;
    set(setChartSettings(state, { swap: next }));
    say("chart.changed", next ? "Axes swapped: the bars run across, the breakdown down the side." : "Axes back: the bars stand up, the breakdown along the bottom.", { chart: { swap: next } });
  };
  const styleOf = (id: string) => state.chart?.measures?.[id] ?? {};
  const restyle = (target: Pill, style: ExploreMeasureStyle) => {
    set(setMeasureStyle(state, target.id, style));
    const said = style.type ? `${target.label} drawn as ${CHART_WORD[style.type]}.` : style.axis === "right" ? `${target.label} measured on its own scale, at the right.` : `${target.label} measured on the left scale.`;
    say("chart.changed", said, { measure: target.id, ...style });
  };
  // Two scales when some measures, but not all, are on the right (all on the right is drawn as one scale, on the left).
  const onRight = state.values.filter((id) => styleOf(id).axis === "right").length;
  const twoScales = onRight > 0 && onRight < state.values.length;
  // Which side's scale a measure is read against, marked on its pill when there are two.
  const sideOf = (id: string): "left" | "right" | undefined => (twoScales ? (styleOf(id).axis === "right" ? "right" : "left") : undefined);
  // What each shelf puts on the chart, said on the shelf itself.
  const axisOf: Record<Shelf, string> = { rows: swapped ? "Y axis" : "X axis", values: swapped ? "X axis" : twoScales ? "Y axes" : "Y axis", split: "Colour" };

  const blank = (kind: PillKind): Pill => ({ id: "", kind, label: "", by: editor, ...(kind === "metric" ? { aggregate: "sum" as const, column: columns.find((c) => /Int|Float|Decimal/.test(String(c.type)))?.name } : kind === "attribute" ? { column: columns[0]?.name } : { expression: "", format: "number" as const }) });

  const menuFor = (target: Pill): MenuItem[] => [
    ...(target.kind === "attribute"
      ? [
          { label: "Break down by this", onSelect: () => put(target.id, "rows"), hint: "Enter" },
          { label: "Split by this", onSelect: () => put(target.id, "split"), hint: "S" },
        ]
      : [{ label: "Measure this", onSelect: () => put(target.id, "values"), hint: "Enter" }]),
    ...(onShelf(target.id) ? [{ label: "Take off the shelves", onSelect: () => take(target.id, onShelf(target.id)!), hint: "Delete" }] : []),
    ...((onShelf(target.id) === "rows" || onShelf(target.id) === "values") && state[onShelf(target.id) as "rows" | "values"].length > 1
      ? [
          { label: "Move earlier", onSelect: () => shift(target, -1), hint: "Alt+←", disabled: state[onShelf(target.id) as "rows" | "values"][0] === target.id },
          { label: "Move later", onSelect: () => shift(target, 1), hint: "Alt+→", disabled: state[onShelf(target.id) as "rows" | "values"].at(-1) === target.id },
        ]
      : []),
    { separator: true },
    { label: "Edit", onSelect: () => setEditing({ pill: target, isNew: false }), hint: "E" },
    { label: "Remove the field", onSelect: () => removeField(target), hint: "Shift+Delete" },
    { label: "Duplicate", onSelect: () => setEditing({ pill: { ...target, label: `${target.label} copy`, by: editor, model: undefined }, isNew: true }), hint: "D" },
    ...(offer(target) ? [{ label: model && [...model.dimensions, ...model.measures, ...model.metrics].some((f) => f.name === target.id) ? "Update it in the model" : "Add to the model", onSelect: () => void promote(target), hint: "M" }] : []),
  ];

  // Dragging a pill: pointer events, so a finger and a pen work as a mouse does. A press that does not move is a click.
  // A finger has to hold still on a pill for a moment before it drags it (`TOUCH_HOLD_MS`): a finger that moves at once is scrolling the page,
  // which matters on a phone, where the pills fill the screen. A pen and a mouse drag at once.
  const [ghost, setGhost] = useState<{ label: string; kind: PillKind; x: number; y: number; over?: Shelf; id?: string; place?: number } | undefined>();
  const press = (target: Pill, from?: Shelf) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    let held = event.pointerType !== "touch";
    const shelfAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-shelf]") as HTMLElement | null)?.dataset.shelf as Shelf | undefined;
    // Where among the shelf's other pills the pointer is: before the first whose middle it has not passed, reading line by line.
    const placeAt = (shelf: Shelf, x: number, y: number): number | undefined => {
      if (shelf === "split") return undefined;
      const wraps = Array.from(document.querySelectorAll<HTMLElement>(`[data-shelf="${shelf}"] [data-pill]`)).filter((w) => w.dataset.pill !== target.id);
      const index = wraps.findIndex((w) => {
        const r = w.getBoundingClientRect();
        return y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
      });
      return index < 0 ? wraps.length : index;
    };
    const hold = held
      ? undefined
      : window.setTimeout(() => {
          held = true;
          // Lifted where the finger is, so the person sees it is now theirs to move.
          setGhost({ label: target.label, kind: target.kind, x: start.x, y: start.y, over: shelfAt(start.x, start.y) });
        }, TOUCH_HOLD_MS);
    // Once a finger holds a pill, the page must not scroll under it.
    const still = (e: TouchEvent) => held && e.cancelable && e.preventDefault();
    const move = (e: PointerEvent) => {
      const far = Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 6;
      if (!held) return far ? void stop(e) : undefined;
      if (!dragging && !far) return;
      dragging = true;
      const over = shelfAt(e.clientX, e.clientY);
      setGhost({ label: target.label, kind: target.kind, x: e.clientX, y: e.clientY, over, id: target.id, ...(over ? { place: placeAt(over, e.clientX, e.clientY) } : {}) });
    };
    const stop = (e: Event) => {
      window.clearTimeout(hold);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("contextmenu", stop);
      window.removeEventListener("touchmove", still);
      window.removeEventListener("keydown", cancel);
      setGhost(undefined);
      return e;
    };
    const up = (e: PointerEvent) => {
      stop(e);
      if (!dragging) return;
      // The click that follows a drag must not also act.
      // Only the click the browser sends with this pointerup: when none comes (a drop outside any common ancestor), the next real click must still work.
      const swallow = (click: MouseEvent) => click.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      const shelf = shelfAt(e.clientX, e.clientY);
      if (shelf) put(target.id, shelf, placeAt(shelf, e.clientX, e.clientY));
      else if (from) take(target.id, from);
    };
    const cancel = (e: globalThis.KeyboardEvent) => e.key === "Escape" && stop(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    // The browser took the touch for a scroll, or a long press opened the pill's menu: no drag.
    window.addEventListener("pointercancel", stop);
    window.addEventListener("contextmenu", stop);
    window.addEventListener("touchmove", still, { passive: false });
    window.addEventListener("keydown", cancel);
  };

  const pillKeys = (target: Pill) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "s" && target.kind === "attribute") put(target.id, "split");
    else if (event.key === "e") setEditing({ pill: target, isNew: false });
    else if (event.key === "d") setEditing({ pill: { ...target, label: `${target.label} copy`, by: editor, model: undefined }, isNew: true });
    else if (event.key === "m" && offer(target)) void promote(target);
    else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowUp")) shift(target, -1);
    else if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowDown")) shift(target, 1);
    else if ((event.key === "Delete" || event.key === "Backspace") && event.shiftKey) removeField(target);
    else if ((event.key === "Delete" || event.key === "Backspace") && onShelf(target.id)) take(target.id, onShelf(target.id)!);
    else return;
    event.preventDefault();
  };

  /** While dragging over a shelf: true for the pill the dragged one would land before. */
  const insertBefore = (shelf: Shelf, id: string) => {
    if (!ghost || ghost.place === undefined || shelf === "split") return false;
    const others = state[shelf].filter((item) => item !== ghost.id);
    return others[ghost.place] === id;
  };
  const drawPill = (target: Pill, shelf?: Shelf) => {
    const bad = pillProblem(target, state.fields, columns.length > 0 ? columns.map((c) => c.name) : undefined);
    const side = shelf === "values" && chart && shown === "chart" ? sideOf(target.id) : undefined;
    const tag = shelf ? undefined : target.model ? "model" : target.by && target.by !== "the columns" ? (target.by === "suggested from the columns" ? "suggested" : target.by) : undefined;
    return (
      <span key={target.id} className="sf-pill-wrap" data-pill={shelf ? target.id : undefined} data-insert={shelf && ghost?.over === shelf && ghost.id !== target.id && insertBefore(shelf, target.id) ? "before" : undefined} data-kind={target.kind} data-on={(!shelf && onShelf(target.id)) || undefined} data-bad={bad ? "true" : undefined}>
        <button
          type="button"
          className="sf-pill"
          data-kind={target.kind}
          title={[target.description, bad, target.kind === "derived" ? target.expression : undefined, target.model ? `From the ${model?.label || target.model} model` : undefined, target.by ? `Made by ${target.by}` : undefined].filter(Boolean).join(" · ")}
          aria-keyshortcuts={`Enter S E D${offer(target) ? " M" : ""} Delete Shift+Delete${shelf === "rows" || shelf === "values" ? " Alt+ArrowLeft Alt+ArrowRight" : ""} Shift+F10`}
          onPointerDown={press(target, shelf)}
          onClick={() => (shelf ? setEditing({ pill: target, isNew: false }) : put(target.id))}
          onKeyDown={pillKeys(target)}
          onContextMenu={(event) => menu.open(event, `${target.label} actions`, menuFor(target))}
        >
          <span className="sf-pill-glyph" aria-hidden="true">
            {GLYPH[target.kind]}
          </span>
          <span className="sf-pill-label">
            {target.label}
            {/* Read after the visible name, so what is said begins with what is seen (WCAG 2.5.3). */}
            {" "}
            <span className="sf-visually-hidden">{`(${KIND_WORD[target.kind]}${tag ? `, ${tag === "model" ? "from the model" : `by ${tag}`}` : ""}${side ? `, ${side} scale` : ""}${shelf ? "" : onShelf(target.id) ? ", in use" : ""}${bad ? `, problem: ${bad}` : ""})`}</span>
          </span>
          {side && (
            <span className="sf-pill-side" data-side={side} aria-hidden="true">
              {side}
            </span>
          )}
          {tag && (
            <span className="sf-pill-by" data-model={target.model ? "true" : undefined} aria-hidden="true">
              {tag}
            </span>
          )}
        </button>
        {shelf ? (
          <button type="button" className="sf-pill-x" aria-label={`Take ${target.label} off “${SHELVES.find((s) => s.id === shelf)!.label}”`} onClick={() => take(target.id, shelf)}>
            <ControlIcon icon="close" />
          </button>
        ) : (
          <>
            <button type="button" className="sf-pill-x" data-control="edit" aria-label={`Edit ${target.label}`} onClick={() => setEditing({ pill: target, isNew: false })}>
              <ControlIcon icon="edit" />
            </button>
            {/* A pill in use can be taken off from where it is picked, without finding it on its shelf. */}
            {onShelf(target.id) && (
              <button type="button" className="sf-pill-x" aria-label={`Take ${target.label} off “${SHELVES.find((s) => s.id === onShelf(target.id))!.label}”`} onClick={() => take(target.id, onShelf(target.id)!)}>
                <ControlIcon icon="close" />
              </button>
            )}
          </>
        )}
      </span>
    );
  };

  const words = search.trim().toLowerCase();
  const group = (kind: PillKind) => state.fields.filter((p) => p.kind === kind && (!words || p.label.toLowerCase().includes(words) || p.id.includes(words)));
  const chart = useMemo(() => exploreChart(state), [state]);
  const reading = exploreReading(state);

  const suggest = () => {
    const found = suggestDerived(state.fields);
    if (found.length === 0) return setNote("Nothing more to suggest from these columns. Make a calculation of your own with “New calculation”.");
    set({ ...state, fields: [...state.fields, ...found] });
    say("fields.suggested", `${found.length} ${found.length === 1 ? "calculation" : "calculations"} suggested from the column names: ${found.map((p) => p.label).join(", ")}. They are guesses to keep, edit or remove.`, { fields: found });
  };

  return (
    <div className={["sf-explore", props.className].filter(Boolean).join(" ")}>
      {model?.dataset && <ModelLineage model={model} compact />}
      {/* The layout is on this inner frame: `.sf-explore` is the container whose width it answers to, and a box cannot answer its own size query. */}
      <div className="sf-explore-frame">
      <aside className="sf-explore-fields" aria-label="Fields">
        <input className="sf-input" type="search" placeholder="Find a field" aria-label="Find a field" value={search} onChange={(e) => setSearch(e.target.value)} />
        {(["attribute", "metric"] as PillKind[]).map((kind) => (
          <section key={kind} aria-label={kind === "attribute" ? "Attributes" : "Metrics"}>
            <h4 className="sf-explore-heading">
              {kind === "attribute" ? "Attributes" : kind === "metric" ? "Metrics" : "Calculations"}
              <button type="button" className="sf-explore-add" aria-label={`New ${KIND_WORD[kind]}`} onClick={() => setEditing({ pill: blank(kind), isNew: true })}>
                <ControlIcon icon="add" />
              </button>
            </h4>
            <div className="sf-explore-pills">
              {group(kind).map((p) => drawPill(p))}
              {group(kind).length === 0 && <p className="sf-explore-hint">{words ? "None match." : "None."}</p>}
            </div>
          </section>
        ))}
        {/* Calculations are for later: folded unless there were some to begin with, or a search finds one. */}
        <details className="sf-explore-more" open={calculationsOpen || (!!words && group("derived").length > 0)} onToggle={(e) => setCalculationsOpen(e.currentTarget.open)}>
          <summary>
            Calculations
            {state.fields.some((p) => p.kind === "derived") && <span className="sf-explore-count">{state.fields.filter((p) => p.kind === "derived").length}</span>}
          </summary>
          <section aria-label="Calculations">
            <h4 className="sf-explore-heading">
              Calculations
              <button type="button" className="sf-explore-add" aria-label={`New ${KIND_WORD.derived}`} onClick={() => setEditing({ pill: blank("derived"), isNew: true })}>
                <ControlIcon icon="add" />
              </button>
            </h4>
            <div className="sf-explore-pills">
              {group("derived").map((p) => drawPill(p))}
              {group("derived").length === 0 && <p className="sf-explore-hint">{words ? "None match." : "None yet. A calculation is arithmetic over metrics: a rate, a margin, an average."}</p>}
            </div>
          </section>
          <button type="button" className="sf-button" onClick={suggest}>
            Suggest calculations
          </button>
        </details>
        {editing && (
          <PillEditor
            key={`${editing.pill.id}-${editing.isNew}`}
            pill={editing.pill}
            all={state.fields}
            columns={columns}
            isNew={editing.isNew}
            modelLabel={editing.pill.model ? model?.label || editing.pill.model : undefined}
            onPromote={!editing.isNew && offer(editing.pill) ? () => (void promote(editing.pill), setEditing(undefined)) : undefined}
            onCancel={() => setEditing(undefined)}
            onSave={(next) => {
              // Changed by hand, it is no longer the model's definition until it is added again.
              const changed = { ...next, by: editor, model: undefined };
              set(setPill(state, editing.isNew ? changed.id : editing.pill.id, changed));
              say(editing.isNew ? "field.added" : "field.changed", `${changed.label} ${editing.isNew ? "added" : "saved"}.`, { field: changed, ...(editing.isNew ? {} : { was: editing.pill }) });
              setEditing(undefined);
            }}
            onRemove={
              editing.isNew
                ? undefined
                : () => {
                    set(setPill(state, editing.pill.id, undefined));
                    say("field.removed", `${editing.pill.label} removed.`, { field: editing.pill });
                    setEditing(undefined);
                  }
            }
          />
        )}
      </aside>

      <div className="sf-explore-main">
        {onAsk && (
          <form
            className="sf-explore-ask"
            onSubmit={(event) => {
              event.preventDefault();
              if (!ask.trim()) return;
              onAsk(ask.trim(), state);
              say("asked", `Asked: “${ask.trim()}”.`, { text: ask.trim() });
              setAsk("");
            }}
          >
            <input className="sf-input" aria-label="Ask for a field or a view" placeholder="Ask for a field or a view: refund rate by region, split by channel" value={ask} onChange={(e) => setAsk(e.target.value)} />
            <button type="submit" className="sf-button" disabled={!ask.trim()}>
              Ask
            </button>
          </form>
        )}
        <div className="sf-explore-shelves">
          {SHELVES.map((shelf) => {
            const ids = shelf.id === "split" ? (state.split ? [state.split] : []) : state[shelf.id];
            return (
              <div key={shelf.id} className="sf-explore-shelf" data-shelf={shelf.id} data-over={ghost?.over === shelf.id || undefined} data-accepts={ghost ? shelf.takes.includes(ghost.kind) : undefined} role="group" aria-label={shelf.label}>
                <span className="sf-explore-shelf-name" title={shelf.hint}>
                  {shelf.label}
                </span>
                {chart && shown === "chart" && (shelf.id !== "split" || state.values.length === 1) && (
                  <span className="sf-explore-axis" data-axis={shelf.id === "split" ? "colour" : axisOf[shelf.id] === "X axis" ? "x" : "y"} title={shelf.id === "values" && twoScales ? "Each measure's pill says which side's scale it is read against." : undefined}>
                    {axisOf[shelf.id]}
                  </span>
                )}
                {ids.map((id) => pill(id)).filter((p): p is Pill => !!p).map((p) => drawPill(p, shelf.id))}
                {ids.length === 0 && <span className="sf-explore-hint">{ghost ? (shelf.takes.includes(ghost.kind) ? "Drop here" : "Not for this field") : shelf.id === "values" ? "Press a metric" : shelf.id === "rows" ? "Press an attribute" : "Optional"}</span>}
              </div>
            );
          })}
        </div>
        {chart && shown === "chart" && (
          <div className="sf-explore-chart-settings">
            <div className="sf-segmented sf-result-views" role="group" aria-label="Draw as">
              {(["bar", "line", "area"] as ExploreChartType[]).map((type) => (
                <button key={type} type="button" className="sf-segment" data-checked={chartTypeNow === type || undefined} aria-pressed={chartTypeNow === type} onClick={() => setType(type)}>
                  {type === "bar" ? "Bars" : type === "line" ? "Line" : "Area"}
                </button>
              ))}
            </div>
            <button type="button" className="sf-button" aria-pressed={swapped} aria-disabled={!!cannotSwap || undefined} title={cannotSwap} aria-describedby={cannotSwap ? `${uid}-swap` : undefined} onClick={() => !cannotSwap && swap()}>
              Swap axes
            </button>
            {cannotSwap && (
              <span id={`${uid}-swap`} className="sf-explore-hint">
                {cannotSwap}
              </span>
            )}
            {state.values.length > 1 && (
              <ul className="sf-explore-measures" aria-label="Each measure">
                {state.values.map((id) => pill(id)).filter((p): p is Pill => !!p).map((p) => (
                  <li key={p.id}>
                    <span className="sf-explore-measure-name">{p.label}</span>
                    <select className="sf-input" aria-label={`Draw ${p.label} as`} value={styleOf(p.id).type ?? chartTypeNow} onChange={(e) => restyle(p, { type: e.target.value as ExploreChartType })}>
                      <option value="bar">Bars</option>
                      <option value="line">Line</option>
                      <option value="area">Area</option>
                    </select>
                    <select className="sf-input" aria-label={`Scale for ${p.label}`} value={styleOf(p.id).axis ?? "left"} onChange={(e) => restyle(p, { axis: e.target.value as "left" | "right" })}>
                      <option value="left">Left scale</option>
                      <option value="right">Right scale</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {/* Filters fold away until there are some. */}
        <details className="sf-explore-more" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
          <summary>
            Filters
            {state.filters.length > 0 && <span className="sf-explore-count">{state.filters.length}</span>}
          </summary>
          <QueryFilters sourceId={sourceId} sql={sql} filters={state.filters} onChange={(next: FilterSpec[]) => set({ ...state, filters: next })} onContext={props.onContext} dataSource={dataSource} />
        </details>

        {problem && (
          <p className="sf-filter-problem" role="alert">
            {problem}
          </p>
        )}
        {state.values.length === 0 ? (
          <p className="sf-explore-empty">Press a metric to measure it, then an attribute to break it down. Each press, drag or edit asks the database again; nothing is worked out in this page.</p>
        ) : (
          // The view's own controls sit over its corner and show on hover or focus, like a tile's.
          <div className="sf-explore-result sf-controls-host" data-controls="corner">
            <ItemControls
              label={`${reading || "View"} controls`}
              controls={[
                ...(chart ? standardControls(reading || "this view", { view: { now: shown, toggle: () => (props.value?.view !== undefined || state.view ? set({ ...state, view: shown === "chart" ? "table" : "chart" }) : setView(shown === "chart" ? "table" : "chart")) } }) : []),
                // Last, so a pinned one sits in the corner itself when the rest are quiet.
                ...(props.controls ?? []),
              ]}
            />
            <p className="sf-explore-reading">{reading}</p>
            {!chart && <p className="sf-explore-hint">With nothing to break down by there is one number each. Press an attribute for a chart.</p>}
            <ExploreView dataSource={dataSource} sourceId={sourceId} sql={sql} state={state} view={shown} height={chartHeight} label={reading} />
            {props.actions && <div className="sf-explore-actions">{props.actions}</div>}
          </div>
        )}
        <p className="sf-explore-note" role="status">
          {note}
        </p>
      </div>
      </div>
      {ghost && (
        <span className="sf-pill sf-pill-ghost" data-kind={ghost.kind} aria-hidden="true" style={{ left: ghost.x, top: ghost.y }}>
          <span className="sf-pill-glyph">{GLYPH[ghost.kind]}</span>
          {ghost.label}
        </span>
      )}
      {menu.element}
    </div>
  );
}
