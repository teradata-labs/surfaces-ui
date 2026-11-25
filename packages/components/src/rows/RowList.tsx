import { type DataSource, collect } from "@surfaces-ui/data";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { OnContext } from "../controls/context.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { DataNotes, dataNotes } from "../data/DataNotes.js";
import type { DataMessages } from "../data/messages.js";
import { plainValue } from "../data/format.js";
import { type FilterInit, type SortInit, type TimeTravelInit, messageOf } from "../data/useRowWindow.js";
import { label as text, numberFormat } from "../locale/locale.js";

/** One row of a query as plain values: numbers as numbers, dates and times as ISO text, a missing value as null. */
export type PlainRow = Record<string, string | number | boolean | null>;

/** The most rows a list will hold, however many times "Show more" is pressed. A list is for reading; a table pages. */
export const ROW_LIST_MAX = 200;
/** The most rows fetched at a time. */
export const ROW_LIST_PAGE_MAX = 100;

export interface RowListProps extends DataMessages {
  sourceId: string;
  /** The base SQL. The engine sorts, filters and pages it. */
  sql: string;
  /** What the rows are, for assistive technology: "Posts". */
  label: string;
  /** Draws one row. Called once for each row on screen. */
  renderRow(row: PlainRow, index: number): ReactNode;
  filters?: FilterInit[];
  sorts?: SortInit[];
  /** Rows fetched at a time, 1 to `ROW_LIST_PAGE_MAX`. Defaults to 20. */
  pageSize?: number;
  /** A column whose value tells rows apart, so a row keeps its place when the list changes. */
  rowKey?: string;
  /** "list" stacks the rows; "grid" lays them out as cards, as many across as fit. */
  layout?: "list" | "grid";
  timeTravel?: TimeTravelInit;
  /** ISO 8601 time of the run this belongs to; see `RowWindowQuery.notBefore`. */
  notBefore?: string;
  /** Told when a person asks for more rows. */
  onContext?: OnContext;
  dataSource?: DataSource;
  className?: string;
}

interface State {
  rows: PlainRow[];
  /** Whether the engine has rows past those held. */
  more: boolean;
  loading: boolean;
  error?: string;
  /** What the list was not filtered by, for its readers (see `DataNotes`). */
  notes?: string[];
}

/**
 * Anything drawn once per row of a query: a feed of posts, a list of cards, rows that each carry their own
 * buttons. It asks the engine for a page at a time, in the order and under the filters given, and holds at most
 * `ROW_LIST_MAX` rows: past that a person filters, or reads a table. Nothing is sorted or filtered here.
 */
export function RowList(props: RowListProps) {
  const { sourceId, sql, label, renderRow, filters, sorts, rowKey, layout = "list", timeTravel, notBefore } = props;
  const dataSource = useDataSource(props.dataSource);
  const pageSize = Math.max(1, Math.min(ROW_LIST_PAGE_MAX, Math.trunc(props.pageSize ?? 20)));
  const [state, setState] = useState<State>({ rows: [], more: false, loading: true });
  const [pages, setPages] = useState(1);
  const key = JSON.stringify([sourceId, sql, filters, sorts, pageSize, timeTravel, notBefore], (_, v) => (typeof v === "bigint" ? `${v}n` : v));
  // A new query starts from its first page.
  const queried = useRef(key);
  const page = queried.current === key ? pages : 1;
  useEffect(() => {
    if (queried.current !== key) {
      queried.current = key;
      setPages(1);
    }
  }, [key]);

  useEffect(() => {
    const controller = new AbortController();
    const first = page === 1;
    setState((previous) => ({ rows: first ? [] : previous.rows, more: false, loading: true }));
    const offset = (page - 1) * pageSize;
    // One row more than asked for says whether there is another page, with no count query.
    const limit = Math.min(pageSize, ROW_LIST_MAX - offset) + 1;
    collect(dataSource.execute({ sourceId, timeTravel, notBefore, query: { baseSql: sql, filters, sorts, page: { limit, offset: BigInt(offset) } } }, { signal: controller.signal }))
      .then((result) => {
        if (controller.signal.aborted) return;
        const fields = result.table.schema.fields;
        const columns = fields.map((_, i) => result.table.getChildAt(i)!);
        const fetched = Array.from({ length: result.table.numRows }, (_, r) => Object.fromEntries(fields.map((f, c) => [f.name, plainValue(columns[c]!.get(r), f.type)])) as PlainRow);
        setState((previous) => ({ rows: [...(first ? [] : previous.rows), ...fetched.slice(0, limit - 1)], more: fetched.length >= limit, loading: false, notes: dataNotes(result.header.notices) }));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((previous) => ({ rows: first ? [] : previous.rows, more: false, loading: false, error: messageOf(error) }));
      });
    return () => controller.abort();
  }, [dataSource, key, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const { rows } = state;
  const full = rows.length >= ROW_LIST_MAX;
  const showMore = () => {
    setPages(page + 1);
    props.onContext?.({ kind: "rows.more", summary: `Asked for more of ${label}, past the first ${rows.length}.`, subject: { label, shown: rows.length } });
  };
  return (
    <div className={["sf-rowlist", props.className].filter(Boolean).join(" ")} aria-busy={state.loading}>
      {rows.length > 0 && (
        <ul className="sf-rowlist-rows" data-layout={layout} aria-label={label}>
          {rows.map((row, index) => (
            <li key={rowKey && row[rowKey] != null ? `${String(row[rowKey])}:${index}` : index}>{renderRow(row, index)}</li>
          ))}
        </ul>
      )}
      {state.error ? (
        <p className="sf-rowlist-note" role="alert" data-error={state.error}>
          {props.errorMessage ?? state.error}
        </p>
      ) : (
        <p className="sf-rowlist-note" role="status">
          {state.loading
            ? text("rows.loading")
            : rows.length === 0
              ? (props.emptyMessage ?? text("rows.empty"))
              : full && state.more
                ? text("rows.full", { count: numberFormat().format(rows.length) })
                : state.more
                  ? text("rows.some", { count: numberFormat().format(rows.length) })
                  : ""}
        </p>
      )}
      <DataNotes notes={state.notes} />
      {state.more && !full && !state.loading && (
        <button type="button" className="sf-button" onClick={showMore}>
          {text("rows.more")}
        </button>
      )}
    </div>
  );
}
