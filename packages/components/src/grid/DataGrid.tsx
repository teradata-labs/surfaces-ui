import type { DataSource, QueryErrorInfo } from "@surfaces-ui/data";
import { type Notice, SortDirection } from "@surfaces-ui/proto";
import { DENSITY_SCALE } from "@surfaces-ui/tokens";
import { DataType, type Field } from "apache-arrow";
import { type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import type { DataMessages } from "../data/messages.js";
import { type ColumnFormat, displayCell, formatCellAs, isNumeric } from "../data/format.js";
import { dateFormat, label as text, numberFormat } from "../locale/locale.js";
import { type FilterInit, type StoredInfo, type TimeTravelInit, type ValueInit, useRowWindow } from "../data/useRowWindow.js";
import { type MenuItem, copyText, useContextMenu } from "../menu/ContextMenu.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";

export interface GridSort {
  column: string;
  desc: boolean;
}

/** How a grid's columns are laid out. Every part is optional, so `{}` is the default layout. */
export interface GridColumns {
  /** Column names in display order. Columns not named follow in the query's order. */
  order?: string[];
  /** Columns not shown. They are still fetched, so showing one again is instant. */
  hidden?: string[];
  /** Widths in px, by column name. */
  widths?: Record<string, number>;
}

/** The names to show, in order, for the columns a query returned. */
export function arrangeColumns(names: string[], layout: GridColumns = {}): string[] {
  const hidden = new Set(layout.hidden ?? []);
  const first = (layout.order ?? []).filter((name, i, all) => names.includes(name) && all.indexOf(name) === i);
  return [...first, ...names.filter((name) => !first.includes(name))].filter((name) => !hidden.has(name));
}

/** A layout with `name` moved to sit before `before` (or to the end), among the shown columns. */
export function moveColumn(names: string[], layout: GridColumns, name: string, before: string | undefined): GridColumns {
  const shown = arrangeColumns(names, layout).filter((n) => n !== name);
  const at = before === undefined ? shown.length : shown.indexOf(before);
  shown.splice(at < 0 ? shown.length : at, 0, name);
  return { ...layout, order: shown };
}

const COLUMN_MIME = "application/x-surfaces-grid-column";
const RESIZE_STEP = 16;

/** What the grid knows about its query, for surrounding UI such as "show SQL". */
export interface DataGridInfo {
  total: number | undefined;
  executedSql: string;
  notices: Notice[];
  fields: Field[];
  error: string | undefined;
  /** Code and position of the error in the SQL, when the backend reports them. */
  errorInfo: QueryErrorInfo | undefined;
  /** Set when the rows come from a result the backend kept; the data is as of `createdAt`. */
  stored: StoredInfo | undefined;
  /** Runs the query again, discarding any kept result. */
  refresh(): void;
  /** True while the first rows are on their way. */
  loading: boolean;
  /** Stops a query that is still running. */
  cancel(): void;
}

export interface DataGridProps extends DataMessages {
  /** Which source to query. */
  sourceId: string;
  /** The base SQL. Sorting, filtering and paging are applied around it by the backend. */
  sql: string;
  filters?: FilterInit[];
  parameters?: ValueInit[];
  timeTravel?: TimeTravelInit;
  /** ISO 8601 time of the run this grid belongs to; see `RowWindowQuery.notBefore`. */
  notBefore?: string;
  /** How to write particular columns, by name: currency, percent, compact numbers, dates. */
  formats?: Record<string, ColumnFormat>;
  /** Controlled sort. Omit to let the grid keep its own. */
  sorts?: GridSort[];
  onSortsChange?(sorts: GridSort[]): void;
  /** Controlled column order, hidden columns and widths. Omit to let the grid keep its own. */
  columns?: GridColumns;
  onColumnsChange?(columns: GridColumns): void;
  /** Adds "Filter to this value" and "Leave this value out" to a cell's menu. */
  onCellFilter?(column: string, value: unknown, exclude: boolean): void;
  /** Adds SQL items to the column menu, called with the generated statement. */
  onUseSql?(sql: string): void;
  /**
   * "scroll" (default) scrolls through every row, loading blocks as needed.
   * "pages" shows one page at a time with Previous and Next.
   */
  mode?: "scroll" | "pages";
  /** Rows per page in "pages" mode. Defaults to 50. */
  pageSize?: number;
  /** Height of the grid. A number is px. Defaults to 420. */
  height?: number | string;
  /**
   * The line under the rows: the row count, the time the query took, "as of" with Run again for a kept result,
   * and Show hidden columns. `false` leaves it out, for a small look at a few rows inside something else; the
   * row count is still announced. In "pages" mode the footer stays, since it holds Previous and Next.
   */
  footer?: boolean;
  /** Row height in px. Defaults to the theme's density. */
  rowHeight?: number;
  /** Called when the row count, executed SQL, notices, columns or error change. */
  onInfo?(info: DataGridInfo): void;
  /** Called with the row's values when a row is clicked. */
  onRowClick?(row: Record<string, unknown>, index: number): void;
  /** Uses this DataSource instead of the one from DataSourceProvider. */
  dataSource?: DataSource;
  /** Accessible name for the grid. */
  label?: string;
  className?: string;
}

/** Browsers stop laying out elements taller than a few tens of millions of px. */
const MAX_BODY_HEIGHT = 10_000_000;
const OVERSCAN_ROWS = 6;
const OVERSCAN_PX = 240;
const MIN_COLUMN = 60;
const MAX_COLUMN = 1200;
const count = { format: (n: number | bigint) => numberFormat().format(n) };

function defaultWidth(field: Field): number {
  const type = field.type;
  const base = DataType.isBool(type)
    ? 90
    : DataType.isTimestamp(type)
      ? 190
      : DataType.isDate(type)
        ? 120
        : isNumeric(type)
          ? 120
          : 180;
  return Math.max(base, Math.min(320, field.name.length * 9 + 48));
}

/**
 * A table that scales with the data, not the browser: rows are fetched in
 * blocks as they scroll into view, only visible rows and columns are in the
 * DOM, and sorting sends a new query instead of sorting loaded rows.
 */
export function DataGrid(props: DataGridProps) {
  const { sourceId, sql, filters, parameters, timeTravel, mode = "scroll", pageSize = 50, height = 420, label } = props;
  const dataSource = useDataSource(props.dataSource);
  const theme = useOptionalTheme();
  const rowHeight = props.rowHeight ?? DENSITY_SCALE[theme?.theme.density ?? "comfortable"].rowHeight;

  const [ownSorts, setOwnSorts] = useState<GridSort[]>([]);
  const sorts = props.sorts ?? ownSorts;
  const setSorts = (next: GridSort[]) => {
    if (props.sorts === undefined) setOwnSorts(next);
    props.onSortsChange?.(next);
  };

  const window = useRowWindow(
    dataSource,
    {
      sourceId,
      sql,
      filters,
      parameters,
      timeTravel,
      notBefore: props.notBefore,
      sorts: sorts.map((s) => ({ column: s.column, direction: s.desc ? SortDirection.DESC : SortDirection.ASC })),
    },
    { blockSize: mode === "pages" ? pageSize : 200 },
  );
  const { fields, total } = window;

  const onInfo = useRef(props.onInfo);
  onInfo.current = props.onInfo;
  useEffect(() => {
    onInfo.current?.({
      total: window.total,
      executedSql: window.executedSql,
      notices: window.notices,
      fields: window.fields,
      error: window.status === "error" ? window.error : undefined,
      errorInfo: window.status === "error" ? window.errorInfo : undefined,
      stored: window.stored,
      refresh: window.refresh,
      loading: window.status === "loading",
      cancel: window.cancel,
    });
  }, [window.total, window.executedSql, window.notices, window.fields, window.status, window.error, window.errorInfo, window.stored, window.refresh, window.cancel]);

  // Reset position when the query changes.
  const [page, setPage] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const queryKey = `${sourceId}\n${sql}\n${JSON.stringify(sorts)}`;
  useEffect(() => {
    setPage(0);
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [queryKey]);

  // Column layout: order, hidden columns and widths, the grid's own unless the host controls it.
  const [ownColumns, setOwnColumns] = useState<GridColumns>({});
  const layout = props.columns ?? ownColumns;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const setColumns = (next: GridColumns) => {
    layoutRef.current = next;
    if (props.columns === undefined) setOwnColumns(next);
    props.onColumnsChange?.(next);
  };
  const names = fields.map((f) => f.name);
  const shown = arrangeColumns(names, layout).map((name) => ({ field: fields[names.indexOf(name)]!, source: names.indexOf(name) }));
  const sizes = layout.widths ?? {};
  const setSize = (name: string, width: number | undefined) => {
    const { [name]: _, ...rest } = layoutRef.current.widths ?? {};
    setColumns({ ...layoutRef.current, widths: width === undefined ? rest : { ...rest, [name]: Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, Math.round(width))) } });
  };
  const [resizing, setResizing] = useState<string | undefined>();
  const [dropBefore, setDropBefore] = useState<string | null | undefined>();
  const [note, setNote] = useState("");
  const menu = useContextMenu();
  const gridId = useId();
  const widths = shown.map(({ field }) => sizes[field.name] ?? defaultWidth(field));
  const offsets: number[] = [];
  let totalWidth = 0;
  for (const width of widths) {
    offsets.push(totalWidth);
    totalWidth += width;
  }
  const startResize = (name: string, startWidth: number) => (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    handle.setPointerCapture?.(event.pointerId);
    setResizing(name);
    const move = (e: globalThis.PointerEvent) => setSize(name, startWidth + e.clientX - startX);
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      setResizing(undefined);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  // Viewport. jsdom and hidden containers report 0, so fall back to the props.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const viewHeight = Math.max(0, (viewport.height || (typeof height === "number" ? height - 40 : 380)) - rowHeight);
  const viewWidth = viewport.width || 960;

  // Rows in play: everything in scroll mode, one page in pages mode.
  const pages = total === undefined ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const rowBase = mode === "pages" ? page * pageSize : 0;
  const rowCount = total === undefined ? 0 : mode === "pages" ? Math.max(0, Math.min(pageSize, total - rowBase)) : total;

  // Past the browser's height limit the scrollbar becomes proportional: its
  // position maps onto the row range instead of onto pixels.
  const fullHeight = rowCount * rowHeight;
  const bodyHeight = Math.min(fullHeight, MAX_BODY_HEIGHT);
  const scaled = fullHeight > MAX_BODY_HEIGHT;
  const visibleRows = Math.ceil(viewHeight / rowHeight) + 1;
  let firstRow: number;
  let rowTop: (index: number) => number;
  if (scaled) {
    const range = Math.max(1, bodyHeight - viewHeight);
    const lead = Math.round((Math.min(scroll.top, range) / range) * Math.max(0, rowCount - visibleRows + 1));
    firstRow = lead;
    rowTop = (index) => scroll.top + (index - lead) * rowHeight;
  } else {
    firstRow = Math.max(0, Math.floor(scroll.top / rowHeight) - OVERSCAN_ROWS);
    rowTop = (index) => index * rowHeight;
  }
  const lastRow = Math.min(rowCount, firstRow + visibleRows + (scaled ? 0 : OVERSCAN_ROWS * 2));

  const { ensure } = window;
  useEffect(() => {
    if (rowCount > 0) ensure(rowBase + firstRow, rowBase + lastRow);
  }, [ensure, rowBase, firstRow, lastRow, rowCount]);

  // Columns in view.
  let firstColumn = 0;
  while (firstColumn < widths.length - 1 && offsets[firstColumn]! + widths[firstColumn]! < scroll.left - OVERSCAN_PX) firstColumn++;
  let lastColumn = firstColumn;
  while (lastColumn < widths.length && offsets[lastColumn]! < scroll.left + viewWidth + OVERSCAN_PX) lastColumn++;
  const visibleColumns = shown.slice(firstColumn, lastColumn).map(({ field, source }, i) => ({ field, source, index: firstColumn + i }));

  // The active cell, for the keyboard. `row` counts within the rows in play (a page, or everything).
  const [active, setActive] = useState<{ row: number; column: number } | undefined>();
  const activeCell = active && active.row < rowCount && active.column < shown.length ? active : undefined;
  const reveal = (row: number, column: number) => {
    const element = scroller.current;
    if (!element) return;
    if (!scaled) {
      const top = row * rowHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (top + rowHeight > element.scrollTop + viewHeight) element.scrollTop = top + rowHeight - viewHeight;
    }
    const left = offsets[column] ?? 0;
    const width = widths[column] ?? 0;
    if (left < element.scrollLeft) element.scrollLeft = left;
    else if (left + width > element.scrollLeft + viewWidth) element.scrollLeft = left + width - viewWidth;
  };
  const goTo = (row: number, column: number) => {
    if (rowCount === 0 || shown.length === 0) return;
    const next = { row: Math.max(0, Math.min(rowCount - 1, row)), column: Math.max(0, Math.min(shown.length - 1, column)) };
    setActive(next);
    reveal(next.row, next.column);
  };
  const say = (message: string) => setNote(message);
  const copy = (value: string, what: string) => void copyText(value).then((ok) => say(ok ? text("grid.copied", { what }) : text("grid.copyFailed")));
  const cellText = (row: number, column: number) => {
    const at = shown[column];
    if (!at || !window.isLoaded(rowBase + row)) return "";
    const value = window.getCell(rowBase + row, at.source);
    return value == null ? "" : formatCellAs(value, at.field.type, undefined).text;
  };
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys pressed in the header (sort buttons) are theirs.
    if (event.target !== event.currentTarget) return;
    const at = activeCell ?? { row: 0, column: 0 };
    const page = Math.max(1, Math.floor(viewHeight / rowHeight) - 1);
    const mod = event.ctrlKey || event.metaKey;
    const done = (row: number, column: number) => {
      event.preventDefault();
      goTo(row, column);
    };
    if (event.key === "ArrowDown") return done(activeCell ? at.row + 1 : 0, at.column);
    if (event.key === "ArrowUp") return done(at.row - 1, at.column);
    if (event.key === "ArrowRight") return done(at.row, activeCell ? at.column + 1 : 0);
    if (event.key === "ArrowLeft") return done(at.row, at.column - 1);
    if (event.key === "PageDown") return done(at.row + page, at.column);
    if (event.key === "PageUp") return done(at.row - page, at.column);
    if (event.key === "Home") return done(mod ? 0 : at.row, 0);
    if (event.key === "End") return done(mod ? rowCount - 1 : at.row, shown.length - 1);
    if (!activeCell) return;
    if (mod && event.key.toLowerCase() === "c") {
      event.preventDefault();
      return copy(cellText(at.row, at.column), text("grid.copiedCell"));
    }
    if (event.key === "Enter" && props.onRowClick && window.isLoaded(rowBase + at.row)) {
      event.preventDefault();
      props.onRowClick(rowObject(rowBase + at.row), rowBase + at.row);
    }
  };

  const quoted = (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);
  const useSql = (statement: string) => (props.onUseSql ? props.onUseSql(statement) : copy(statement, text("grid.copiedSql")));
  const headerMenu = (name: string, index: number): MenuItem[] => {
    const all = arrangeColumns(names, { ...layout, hidden: [] });
    const hidden = layout.hidden ?? [];
    const from = `(${sql.trim().replace(/;\s*$/, "")}) AS t`;
    return [
      { label: text("grid.sortAscending"), onSelect: () => setSorts([{ column: name, desc: false }]) },
      { label: text("grid.sortDescending"), onSelect: () => setSorts([{ column: name, desc: true }]) },
      { label: text("grid.clearSorting"), disabled: sorts.length === 0, onSelect: () => setSorts([]) },
      { separator: true },
      { label: text("grid.moveLeft"), hint: "Alt ←", disabled: index === 0, onSelect: () => setColumns(moveColumn(names, layout, name, shown[index - 1]?.field.name)) },
      { label: text("grid.moveRight"), hint: "Alt →", disabled: index >= shown.length - 1, onSelect: () => setColumns(moveColumn(names, layout, name, shown[index + 2]?.field.name)) },
      { label: text("grid.hideColumn"), disabled: shown.length <= 1, onSelect: () => setColumns({ ...layout, hidden: [...hidden, name] }) },
      { label: hidden.length ? text("grid.showAllColumnsHidden", { count: count.format(hidden.length) }) : text("grid.showAllColumns"), disabled: hidden.length === 0, onSelect: () => setColumns({ ...layout, hidden: [] }) },
      { label: text("grid.resetWidth"), hint: text("grid.resetWidthHint"), disabled: sizes[name] === undefined, onSelect: () => setSize(name, undefined) },
      { label: text("grid.resetLayout"), disabled: all.join() === names.join() && hidden.length === 0 && Object.keys(sizes).length === 0, onSelect: () => setColumns({}) },
      { separator: true },
      { label: text("grid.copyColumnName"), onSelect: () => copy(name, text("grid.copiedColumnName")) },
      { label: text("grid.sqlCountValues"), onSelect: () => useSql(`SELECT ${quoted(name)}, COUNT(*) AS row_count\nFROM ${from}\nGROUP BY ${quoted(name)}\nORDER BY row_count DESC`) },
      { label: text("grid.sqlRange"), onSelect: () => useSql(`SELECT MIN(${quoted(name)}) AS lowest, MAX(${quoted(name)}) AS highest, COUNT(*) - COUNT(${quoted(name)}) AS missing\nFROM ${from}`) },
    ];
  };
  const cellMenu = (row: number, column: number): MenuItem[] => {
    const at = shown[column];
    if (!at || !window.isLoaded(rowBase + row)) return [];
    const value = window.getCell(rowBase + row, at.source);
    const json = () => JSON.stringify(rowObject(rowBase + row), (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
    return [
      { label: text("grid.copyValue"), hint: "Ctrl/⌘ C", onSelect: () => copy(cellText(row, column), text("grid.copiedCell")) },
      { label: text("grid.copyRowJson"), onSelect: () => copy(json(), text("grid.copiedRow")) },
      ...(props.onCellFilter
        ? [
            { separator: true },
            { label: text("grid.filterToValue"), onSelect: () => props.onCellFilter?.(at.field.name, value, false) },
            { label: text("grid.leaveValueOut"), onSelect: () => props.onCellFilter?.(at.field.name, value, true) },
          ]
        : []),
    ];
  };
  const onHeaderKeyDown = (name: string, index: number) => (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (step === 0) return;
    if (event.altKey) {
      event.preventDefault();
      const target = index + step;
      if (target < 0 || target >= shown.length) return;
      setColumns(moveColumn(names, layout, name, shown[step < 0 ? target : target + 1]?.field.name));
      say(text(step < 0 ? "grid.movedLeft" : "grid.movedRight", { name }));
    } else if (event.shiftKey) {
      event.preventDefault();
      setSize(name, (widths[index] ?? MIN_COLUMN) + step * RESIZE_STEP);
    }
  };
  const onHeaderDrop = (target: string, index: number) => (event: DragEvent<HTMLElement>) => {
    const name = event.dataTransfer.getData(COLUMN_MIME);
    setDropBefore(undefined);
    if (!name || name === target) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > box.left + box.width / 2;
    setColumns(moveColumn(names, layout, name, after ? shown[index + 1]?.field.name : target));
    say(text("grid.moved", { name }));
  };

  const toggleSort = (column: string, event: MouseEvent) => {
    const current = sorts.find((s) => s.column === column);
    const next: GridSort | undefined = !current ? { column, desc: false } : current.desc ? undefined : { column, desc: true };
    if (event.shiftKey) {
      const others = sorts.filter((s) => s.column !== column);
      setSorts(next ? [...others, next] : others);
    } else {
      setSorts(next ? [next] : []);
    }
  };

  const cellStyle = (index: number): CSSProperties => ({ left: offsets[index], width: widths[index] });
  const rowObject = (row: number) => Object.fromEntries(fields.map((f, c) => [f.name, window.getCell(row, c)]));

  const rows = [];
  for (let index = firstRow; index < lastRow; index++) {
    const absolute = rowBase + index;
    const loaded = window.isLoaded(absolute);
    rows.push(
      <div
        key={absolute}
        role="row"
        aria-rowindex={absolute + 2}
        className="sf-grid-row"
        data-odd={absolute % 2 === 1 || undefined}
        data-clickable={props.onRowClick ? true : undefined}
        style={{ top: rowTop(index), height: rowHeight, width: totalWidth }}
        onClick={props.onRowClick && loaded ? () => props.onRowClick?.(rowObject(absolute), absolute) : undefined}
      >
        {visibleColumns.map(({ field, source, index: column }) => {
          if (!loaded) {
            return (
              <div key={field.name} role="gridcell" aria-colindex={column + 1} className="sf-grid-cell" style={cellStyle(column)}>
                <span className="sf-grid-skeleton" />
              </div>
            );
          }
          const cell = displayCell(window.getCell(absolute, source), field.type, props.formats?.[field.name]);
          const isActive = activeCell?.row === index && activeCell.column === column;
          return (
            <div
              key={field.name}
              role="gridcell"
              aria-colindex={column + 1}
              className="sf-grid-cell"
              data-numeric={cell.numeric || undefined}
              data-null={cell.isNull || undefined}
              data-active={isActive || undefined}
              id={isActive ? `${gridId}-active` : undefined}
              aria-selected={isActive || undefined}
              style={cellStyle(column)}
              onMouseDown={() => setActive({ row: index, column })}
              onContextMenu={(event) => {
                setActive({ row: index, column });
                menu.open(event, text("grid.cellMenu", { name: field.name }), cellMenu(index, column));
              }}
            >
              {cell.text}
            </div>
          );
        })}
      </div>,
    );
  }

  const status =
    window.status === "error"
      ? text("grid.failed")
      : total === undefined
        ? text("grid.loading")
        : text(total === 1 ? "grid.rowsOne" : "grid.rows", { count: count.format(total) });

  return (
    <div
      className={["sf-grid", props.className].filter(Boolean).join(" ")}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <div
        ref={scroller}
        className="sf-grid-scroll"
        role="grid"
        aria-label={label ?? text("grid.label")}
        aria-rowcount={total === undefined ? -1 : total + 1}
        aria-colcount={shown.length}
        aria-activedescendant={activeCell ? `${gridId}-active` : undefined}
        onKeyDown={onGridKeyDown}
        onContextMenu={(event) => {
          // The Menu key and Shift+F10 on the grid itself open the active cell's menu.
          if (event.target === event.currentTarget && activeCell) menu.open(event, text("grid.activeCellMenu"), cellMenu(activeCell.row, activeCell.column));
        }}
        aria-busy={window.status === "loading"}
        tabIndex={0}
        onScroll={(event) => setScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })}
      >
        <div role="row" aria-rowindex={1} className="sf-grid-header" style={{ width: totalWidth, height: rowHeight }}>
          {visibleColumns.map(({ field, index }) => {
            const sort = sorts.find((s) => s.column === field.name);
            const order = sorts.length > 1 && sort ? sorts.indexOf(sort) + 1 : undefined;
            return (
              <div
                key={field.name}
                role="columnheader"
                aria-colindex={index + 1}
                aria-sort={sort ? (sort.desc ? "descending" : "ascending") : "none"}
                className="sf-grid-head"
                data-numeric={isNumeric(field.type) || undefined}
                data-drop={dropBefore === field.name || undefined}
                style={cellStyle(index)}
                draggable
                onDragStart={(event) => {
                  // Dragging the edge resizes; it must not also pick the column up.
                  if (resizing) return event.preventDefault();
                  event.dataTransfer.setData(COLUMN_MIME, field.name);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(COLUMN_MIME)) return;
                  event.preventDefault();
                  setDropBefore(field.name);
                }}
                onDragLeave={() => setDropBefore(undefined)}
                onDragEnd={() => setDropBefore(undefined)}
                onDrop={onHeaderDrop(field.name, index)}
                onContextMenu={(event) => menu.open(event, text("grid.columnMenu", { name: field.name }), headerMenu(field.name, index))}
              >
                <button
                  type="button"
                  className="sf-grid-sort"
                  title={`${field.name} · ${String(field.type)}`}
                  aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Shift+ArrowLeft Shift+ArrowRight Shift+F10"
                  onClick={(event) => toggleSort(field.name, event)}
                  onKeyDown={onHeaderKeyDown(field.name, index)}
                >
                  <span className="sf-grid-name">{field.name}</span>
                  {sort && (
                    <span className="sf-grid-arrow" aria-hidden="true">
                      {sort.desc ? "↓" : "↑"}
                      {order}
                    </span>
                  )}
                </button>
                <span
                  className="sf-grid-resize"
                  data-resizing={resizing === field.name || undefined}
                  onPointerDown={startResize(field.name, widths[index]!)}
                  onDoubleClick={() => setSize(field.name, undefined)}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
        <div className="sf-grid-body" style={{ height: bodyHeight, width: totalWidth }}>
          {rows}
        </div>
        {window.status === "error" && (
          <p className="sf-grid-message" role="alert" data-error={window.error}>
            {props.errorMessage ?? window.error}
          </p>
        )}
        {window.status === "ready" && total === 0 && <p className="sf-grid-message">{props.emptyMessage ?? text("grid.noRows")}</p>}
      </div>
      {props.footer === false && mode !== "pages" ? (
        <span className="sf-visually-hidden" aria-live="polite">
          {status}
        </span>
      ) : (
        <div className="sf-grid-footer">
          <span aria-live="polite">{status}</span>
          {(layout.hidden?.length ?? 0) > 0 && (
            <button type="button" className="sf-button" onClick={() => setColumns({ ...layout, hidden: [] })}>
              {text(layout.hidden!.length === 1 ? "grid.showHiddenOne" : "grid.showHidden", { count: count.format(layout.hidden!.length) })}
            </button>
          )}
          <span className="sf-grid-note" role="status">
            {note}
          </span>
          {window.elapsedMs !== undefined && window.status === "ready" && <span>{text("grid.elapsed", { ms: window.elapsedMs })}</span>}
          {window.stored && window.status === "ready" && (
            <span className="sf-grid-asof">
              {text("grid.asOf", { time: dateFormat({ hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(window.stored.createdAt)) })}
              <button type="button" className="sf-button" onClick={window.refresh}>
                {text("grid.runAgain")}
              </button>
            </span>
          )}
          {mode === "pages" && total !== undefined && (
            <span className="sf-grid-pager">
              <button type="button" className="sf-button" disabled={page === 0} onClick={() => setPage(page - 1)}>
                {text("grid.previous")}
              </button>
              <span>{text("grid.page", { page: count.format(page + 1), pages: count.format(pages) })}</span>
              <button type="button" className="sf-button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                {text("grid.next")}
              </button>
            </span>
          )}
        </div>
      )}
      {menu.element}
    </div>
  );
}
