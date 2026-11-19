import type { MessageInitShape } from "@bufbuild/protobuf";
import { FilterOperator, type FilterSchema, SortDirection, type SortSchema, type ValueSchema } from "@surfaces-ui/proto";
import { type Store, createStore } from "./store.js";

type FilterInit = MessageInitShape<typeof FilterSchema>;
type SortInit = MessageInitShape<typeof SortSchema>;
type ValueInit = MessageInitShape<typeof ValueSchema>;

/** A plain value a person picked: a category, a number, a date as ISO text. */
export type Picked = string | number | boolean;

/** What a set of views over the same data share. */
export interface ViewState {
  /** Values chosen per column, e.g. by clicking chart bars. A row matches when its value is one of them. */
  selections: Record<string, Picked[]>;
  /** An inclusive range per column, e.g. a date range. Either end may be open. */
  ranges: Record<string, { from?: Picked; to?: Picked }>;
  sorts: { column: string; desc: boolean }[];
}

export const emptyViewState: ViewState = { selections: {}, ranges: {}, sorts: [] };

const toValue = (value: Picked): ValueInit =>
  typeof value === "number"
    ? Number.isInteger(value)
      ? { kind: { case: "intValue", value: BigInt(value) } }
      : { kind: { case: "doubleValue", value } }
    : typeof value === "boolean"
      ? { kind: { case: "boolValue", value } }
      : { kind: { case: "stringValue", value } };

/**
 * The filters a view should send for this state. Pass `except` to leave out
 * one column: a chart that picks regions must not filter itself down to the
 * region just picked, or there would be nothing left to click.
 */
export function viewFilters(state: ViewState, except?: string): FilterInit[] {
  const filters: FilterInit[] = [];
  for (const [column, values] of Object.entries(state.selections)) {
    if (column === except || values.length === 0) continue;
    filters.push({ column, operator: values.length === 1 ? FilterOperator.EQ : FilterOperator.IN, values: values.map(toValue) });
  }
  for (const [column, range] of Object.entries(state.ranges)) {
    if (column === except) continue;
    if (range.from !== undefined && range.to !== undefined) filters.push({ column, operator: FilterOperator.BETWEEN, values: [toValue(range.from), toValue(range.to)] });
    else if (range.from !== undefined) filters.push({ column, operator: FilterOperator.GTE, values: [toValue(range.from)] });
    else if (range.to !== undefined) filters.push({ column, operator: FilterOperator.LTE, values: [toValue(range.to)] });
  }
  return filters;
}

/** The sorts a view should send for this state. */
export function viewSorts(state: ViewState): SortInit[] {
  return state.sorts.map((s) => ({ column: s.column, direction: s.desc ? SortDirection.DESC : SortDirection.ASC }));
}

export interface ViewStateService extends Store<ViewState> {
  /** Adds the value to a column's selection, or removes it if it is already chosen. */
  toggle(column: string, value: Picked): void;
  /** Replaces a column's selection. An empty list clears it. */
  select(column: string, values: Picked[]): void;
  setRange(column: string, range: { from?: Picked; to?: Picked } | undefined): void;
  setSorts(sorts: ViewState["sorts"]): void;
  /** Clears one column's selection and range, or everything. */
  clear(column?: string): void;
  /** Filters for a view, leaving out the column that view itself controls. */
  filters(except?: string): FilterInit[];
  /** How many columns are filtered. */
  activeCount(): number;
}

/**
 * Shared filter, range and sort state for views over the same data. Charts,
 * grids and pivots that read it stay in step, which is what makes
 * cross-filtering work: one view writes a selection and the others re-query.
 * Filtering still happens in the engine; this only holds what was chosen.
 */
export function createViewState(initial: ViewState = emptyViewState): ViewStateService {
  const store = createStore<ViewState>(initial);
  const without = <V,>(record: Record<string, V>, column: string) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== column));
  const service: ViewStateService = {
    ...store,
    toggle(column, value) {
      store.set((state) => {
        const current = state.selections[column] ?? [];
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        return { ...state, selections: next.length === 0 ? without(state.selections, column) : { ...state.selections, [column]: next } };
      });
    },
    select(column, values) {
      store.set((state) => ({ ...state, selections: values.length === 0 ? without(state.selections, column) : { ...state.selections, [column]: [...values] } }));
    },
    setRange(column, range) {
      store.set((state) => ({
        ...state,
        ranges: !range || (range.from === undefined && range.to === undefined) ? without(state.ranges, column) : { ...state.ranges, [column]: range },
      }));
    },
    setSorts: (sorts) => store.set((state) => ({ ...state, sorts })),
    clear(column) {
      store.set((state) => (column === undefined ? { ...state, selections: {}, ranges: {} } : { ...state, selections: without(state.selections, column), ranges: without(state.ranges, column) }));
    },
    filters: (except) => viewFilters(store.get(), except),
    activeCount: () => new Set([...Object.keys(store.get().selections), ...Object.keys(store.get().ranges)]).size,
  };
  return service;
}

/** Checks a view state from an untrusted place (storage, the address bar) before it is used. */
export function parseViewState(input: unknown): ViewState | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const raw = input as Partial<Record<keyof ViewState, unknown>>;
  const picked = (v: unknown): v is Picked => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  const record = (value: unknown) => (value !== null && typeof value === "object" && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : []);
  const selections: ViewState["selections"] = {};
  for (const [column, values] of record(raw.selections)) {
    if (Array.isArray(values) && values.every(picked) && values.length > 0 && values.length <= 1000) selections[column] = values;
  }
  const ranges: ViewState["ranges"] = {};
  for (const [column, value] of record(raw.ranges)) {
    const range = value as { from?: unknown; to?: unknown } | null;
    if (!range || typeof range !== "object") continue;
    const next = { ...(picked(range.from) ? { from: range.from } : {}), ...(picked(range.to) ? { to: range.to } : {}) };
    if (next.from !== undefined || next.to !== undefined) ranges[column] = next;
  }
  const sorts = Array.isArray(raw.sorts)
    ? raw.sorts.filter((s): s is ViewState["sorts"][number] => s !== null && typeof s === "object" && typeof (s as { column?: unknown }).column === "string").map((s) => ({ column: s.column, desc: s.desc === true }))
    : [];
  return { selections, ranges, sorts };
}

export interface QueryRun {
  sql: string;
  /** ISO 8601 time Run was pressed. Pass it to every view of the run as `notBefore`. */
  ranAt: string;
}

export interface QueryRunsState {
  /** What is on screen. */
  current?: QueryRun;
  /** Earlier runs, newest first, without repeats of the same SQL in a row. */
  history: QueryRun[];
}

export interface QueryRunsService extends Store<QueryRunsState> {
  /** Runs SQL: every view given the new `ranAt` runs the query again, once between them. */
  run(sql: string): QueryRun;
  /** Runs the current SQL again. */
  rerun(): QueryRun | undefined;
}

/**
 * Tracks what was run and when. The time of a run is the `notBefore` that
 * grids, charts and pivots share, so one press of Run executes the query
 * once however many views show it.
 */
export function createQueryRuns(options: { limit?: number; now?: () => Date } = {}): QueryRunsService {
  const limit = options.limit ?? 50;
  const now = options.now ?? (() => new Date());
  const store = createStore<QueryRunsState>({ history: [] });
  const run = (sql: string): QueryRun => {
    const next = { sql, ranAt: now().toISOString() };
    store.set((state) => ({
      current: next,
      history: state.current && state.current.sql.trim() !== sql.trim() ? [state.current, ...state.history].slice(0, limit) : state.history,
    }));
    return next;
  };
  return { ...store, run, rerun: () => (store.get().current ? run(store.get().current!.sql) : undefined) };
}
