import type { MessageInitShape } from "@bufbuild/protobuf";
import { type FilterSpec, type SortSpec, filtersExcept, filtersFromSpec, parseFilterSpecs, parseSortSpecs, selectValues, sortsFromSpec, toggleValueFilter } from "@surfaces-ui/data";
import { SortDirection, type FilterSchema, type SortSchema } from "@surfaces-ui/proto";
import { type Store, createStore } from "./store.js";

type FilterInit = MessageInitShape<typeof FilterSchema>;
type SortInit = MessageInitShape<typeof SortSchema>;

/** A plain value a person picked: a category, a number, a date as ISO text. */
export type Picked = string | number | boolean;

/**
 * What a set of views over the same data share, in the same plain form a
 * page's filters, a component's props and an agent use (`FilterSpec`,
 * `SortSpec` from `@surfaces-ui/data`), so the list can be saved, put in a
 * link, handed to an agent or bound into a surface as it is.
 */
export interface ViewState {
  filters: FilterSpec[];
  sorts: SortSpec[];
}

export const emptyViewState: ViewState = { filters: [], sorts: [] };

const RANGE_OPS = new Set(["between", "gte", "lte"]);

/**
 * The filters a view should send for this state. Pass `except` to leave out
 * one column: a chart that picks regions must not filter itself down to the
 * region just picked, or there would be nothing left to click. A relative
 * date (`since`) is worked out now, so it never goes stale.
 */
export function viewFilters(state: ViewState, except?: string, now: Date = new Date()): FilterInit[] {
  return filtersFromSpec(except === undefined ? state.filters : filtersExcept(state.filters, except), now);
}

/** The sorts a view should send for this state. */
export function viewSorts(state: ViewState): SortInit[] {
  return sortsFromSpec(state.sorts).map((s) => ({ column: s.column, direction: s.desc ? SortDirection.DESC : SortDirection.ASC }));
}

export interface ViewStateService extends Store<ViewState> {
  /** Adds the value to a column's choice, or takes it out if it is already chosen (`toggleValueFilter`). */
  toggle(column: string, value: Picked): void;
  /** Replaces a column's choice of values. An empty list clears it. */
  select(column: string, values: Picked[]): void;
  /** Sets an inclusive range on a column; either end may be open, and neither clears it. */
  setRange(column: string, range: { from?: Picked; to?: Picked } | undefined): void;
  /** Replaces the whole filter list, as a `FilterBar` or an agent would. */
  setFilters(filters: FilterSpec[]): void;
  setSorts(sorts: SortSpec[]): void;
  /** Clears every filter on one column, or every filter. Sorts are kept. */
  clear(column?: string): void;
  /** Filters for a view, leaving out the column that view itself controls. */
  filters(except?: string): FilterInit[];
  /** How many columns are filtered. */
  activeCount(): number;
}

/**
 * Shared filter and sort state for views over the same data. Charts, grids
 * and pivots that read it stay in step, which is what makes cross-filtering
 * work: one view writes a choice and the others query again. Filtering still
 * happens in the engine; this only holds what was chosen.
 */
export function createViewState(initial: ViewState = emptyViewState): ViewStateService {
  const store = createStore<ViewState>(initial);
  const setList = (change: (filters: FilterSpec[]) => FilterSpec[]) => store.set((state) => ({ ...state, filters: change(state.filters) }));
  return {
    ...store,
    toggle: (column, value) => setList((filters) => toggleValueFilter(filters, column, value)),
    select: (column, values) => setList((filters) => selectValues(filters, column, values)),
    setRange(column, range) {
      setList((filters) => {
        const others = filters.filter((f) => !(f.column === column && RANGE_OPS.has(f.op)));
        const { from, to } = range ?? {};
        if (from !== undefined && to !== undefined) return [...others, { column, op: "between", values: [from, to] }];
        if (from !== undefined) return [...others, { column, op: "gte", values: [from] }];
        if (to !== undefined) return [...others, { column, op: "lte", values: [to] }];
        return others;
      });
    },
    setFilters: (filters) => setList(() => [...filters]),
    setSorts: (sorts) => store.set((state) => ({ ...state, sorts: [...sorts] })),
    clear: (column) => setList((filters) => (column === undefined ? [] : filtersExcept(filters, column))),
    filters: (except) => viewFilters(store.get(), except),
    activeCount: () => new Set(store.get().filters.map((f) => f.column)).size,
  };
}

/**
 * Checks a view state from an untrusted place (storage, the address bar)
 * before it is used: only filters that could be sent are kept. A view state
 * saved in the older form (`selections`, `ranges`) is read and turned into
 * the filter list it meant.
 */
export function parseViewState(input: unknown): ViewState | undefined {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as { filters?: unknown; sorts?: unknown; selections?: unknown; ranges?: unknown };
  const sorts = parseSortSpecs(raw.sorts);
  if (raw.filters !== undefined || (raw.selections === undefined && raw.ranges === undefined)) return { filters: parseFilterSpecs(raw.filters), sorts };
  // The older form: values chosen per column, and an inclusive range per column.
  const entries = (value: unknown) => (value !== null && typeof value === "object" && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : []);
  const older: unknown[] = [];
  for (const [column, values] of entries(raw.selections)) {
    if (Array.isArray(values)) older.push(values.length === 1 ? { column, op: "eq", values } : { column, op: "in", values });
  }
  for (const [column, range] of entries(raw.ranges)) {
    const { from, to } = (range ?? {}) as { from?: unknown; to?: unknown };
    const has = (v: unknown) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    if (has(from) && has(to)) older.push({ column, op: "between", values: [from, to] });
    else if (has(from)) older.push({ column, op: "gte", values: [from] });
    else if (has(to)) older.push({ column, op: "lte", values: [to] });
  }
  return { filters: parseFilterSpecs(older), sorts };
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
