import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { CONTROLS_HOST, type ItemControl, ItemControls } from "../controls/ItemControls.js";
import { label as text } from "../locale/locale.js";
import { type MenuItem, useContextMenu } from "../menu/ContextMenu.js";

/** Which way a `DataTable` is sorted: a column's id, and whether largest or latest comes first. */
export interface DataTableSort {
  column: string;
  desc: boolean;
}

/** One column of a `DataTable`. */
export interface DataTableColumn<Row> {
  /** Tells columns apart, and names the sort the table reports. */
  id: string;
  /** The heading. */
  label: string;
  /** Draws the cell. Without it the cell is the row's value under `id`, as text. */
  cell?(row: Row): ReactNode;
  /** Whether a press on the heading asks the host to sort by this column. The table never sorts rows itself. */
  sortable?: boolean;
  /** "end" for numbers, so their digits line up. */
  align?: "start" | "end";
  /**
   * When the column is shown. "always" (the default) at every width; "medium" from 36rem of the table's own width;
   * "wide" from 52rem. Keep the column that names a row, and anything a person must see to act, at "always".
   */
  show?: "always" | "medium" | "wide";
}

export interface DataTableProps<Row> {
  /** What the rows are, for assistive technology: "People". */
  label: string;
  columns: readonly DataTableColumn<Row>[];
  /** The rows to show, already sorted, filtered and paged by the host. The table shows them in the order given. */
  rows: readonly Row[];
  /** A value that tells rows apart and stays the same when the rows change: an id. */
  rowKey(row: Row): string;
  /** The row's name, for its check box and its controls: "Ana Admin". Defaults to the first column's text. */
  rowName?(row: Row): string;
  /** The column that names each row, drawn as the row's header. Defaults to the first. */
  rowHeader?: string;
  /** How the host has sorted `rows`. */
  sort?: DataTableSort;
  /** Asked for when a sortable heading is pressed: the column, ascending first, then the other way. */
  onSortChange?(sort: DataTableSort): void;
  /** The keys of the rows ticked. Giving it, with `onSelectedChange`, adds a check box to each row and the heading. */
  selected?: ReadonlySet<string>;
  onSelectedChange?(selected: Set<string>): void;
  /** Whether a row can be ticked. One that cannot shows no check box: the person's own account, say. */
  selectable?(row: Row): boolean;
  /**
   * Every row that matches is selected, past this page too (see `SelectionBar`). Each box is shown ticked; changing
   * any box reports the rows on this page as ticked or not, so the host goes back to choosing row by row.
   */
  allSelected?: boolean;
  /** The actions on one row, drawn with `ItemControls`: the everyday ones only, with the rest a press further on. */
  rowControls?(row: Row): ItemControl[];
  /** "hover" shows a row's controls when it is pointed at or has focus (always on touch); "always" (the default) keeps them shown. */
  controlsShow?: "hover" | "always";
  /** A menu for a row, opened by a right click, a long press, the Menu key or Shift+F10 on it. Offer nothing here that is not also on the page. */
  rowMenu?(row: Row): MenuItem[];
  /** A word put on the row as `data-state`, for the host's own styling: "off". */
  rowState?(row: Row): string | undefined;
  /** The rows are being fetched: the table is marked busy and keeps what it shows. */
  loading?: boolean;
  /** Shown in place of rows when there are none. */
  empty?: ReactNode;
  className?: string;
}

const cellText = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

/**
 * The rows an app holds, as a table: people, invitations, jobs. Headings ask the host to sort; check boxes say which
 * rows are chosen; each row can carry its everyday actions and a menu. It sorts, filters and pages nothing itself:
 * the host asks its own server and hands over one page. For the rows of a query use `DataGrid`, which asks the engine.
 */
export function DataTable<Row>(props: DataTableProps<Row>) {
  const { label, columns, rows, rowKey, sort, onSortChange, selected, onSelectedChange, selectable, allSelected, rowControls, rowMenu, rowState, loading, empty, className } = props;
  const controlsShow = props.controlsShow ?? "always";
  const header = props.rowHeader ?? columns[0]?.id;
  const nameOf = (row: Row) => props.rowName?.(row) ?? cellText((row as Record<string, unknown>)[columns[0]?.id ?? ""]);
  const menu = useContextMenu();
  const selecting = selected !== undefined && onSelectedChange !== undefined;
  const choosable = selecting ? rows.filter((row) => selectable?.(row) ?? true) : [];
  const ticked = (row: Row) => allSelected || (selected?.has(rowKey(row)) ?? false);
  const tickedOnPage = choosable.filter(ticked).length;
  const pageAll = choosable.length > 0 && tickedOnPage === choosable.length;
  const pageSome = tickedOnPage > 0 && !pageAll;
  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = pageSome;
  }, [pageSome]);

  const tickPage = (on: boolean) => {
    if (!onSelectedChange) return;
    const next = new Set(allSelected ? [] : selected);
    for (const row of choosable) {
      if (on) next.add(rowKey(row));
      else next.delete(rowKey(row));
    }
    onSelectedChange(next);
  };
  const tickRow = (row: Row, on: boolean) => {
    if (!onSelectedChange) return;
    // Leaving "all that match" for row by row: what was ticked on this page stays ticked.
    const next = new Set(allSelected ? choosable.map(rowKey) : selected);
    if (on) next.add(rowKey(row));
    else next.delete(rowKey(row));
    onSelectedChange(next);
  };
  const sortBy = (column: string) => onSortChange?.({ column, desc: sort?.column === column ? !sort.desc : false });
  const span = columns.length + (selecting ? 1 : 0) + (rowControls ? 1 : 0);

  return (
    <div className={["sf-data-table", className].filter(Boolean).join(" ")}>
      <div className="sf-data-table-scroll">
        <table aria-label={label} aria-busy={loading || undefined}>
          <thead>
            <tr>
              {selecting && (
                <th scope="col" className="sf-data-table-check">
                  {choosable.length > 0 ? (
                    <input ref={headBox} type="checkbox" aria-label={text("table.selectPage")} checked={pageAll} onChange={(event) => tickPage(event.target.checked)} />
                  ) : (
                    <span className="sf-visually-hidden">{text("table.select")}</span>
                  )}
                </th>
              )}
              {columns.map((column) => {
                const sorted = sort?.column === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    data-align={column.align}
                    data-show={column.show && column.show !== "always" ? column.show : undefined}
                    aria-sort={sorted ? (sort.desc ? "descending" : "ascending") : undefined}
                  >
                    {column.sortable && onSortChange ? (
                      <button type="button" className="sf-data-table-sort" data-sorted={sorted ? (sort.desc ? "desc" : "asc") : undefined} onClick={() => sortBy(column.id)}>
                        {column.label}
                        <span className="sf-data-table-arrow" aria-hidden="true">
                          {sorted ? (sort.desc ? "↓" : "↑") : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
              {rowControls && (
                <th scope="col" className="sf-data-table-actions">
                  <span className="sf-visually-hidden">{text("table.actions")}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="sf-data-table-empty">
                <td colSpan={span}>{loading ? text("table.loading") : (empty ?? text("table.empty"))}</td>
              </tr>
            )}
            {rows.map((row) => {
              const key = rowKey(row);
              const name = nameOf(row);
              const canTick = selecting && (selectable?.(row) ?? true);
              const onContextMenu = rowMenu ? (event: MouseEvent<HTMLElement>) => menu.open(event, name, rowMenu(row)) : undefined;
              return (
                <tr
                  key={key}
                  className={rowControls && controlsShow === "hover" ? CONTROLS_HOST : undefined}
                  data-state={rowState?.(row)}
                  data-selected={(canTick && ticked(row)) || undefined}
                  onContextMenu={onContextMenu}
                >
                  {selecting && (
                    <td className="sf-data-table-check">
                      {canTick && <input type="checkbox" aria-label={text("table.selectRow", { name })} checked={ticked(row)} onChange={(event) => tickRow(row, event.target.checked)} />}
                    </td>
                  )}
                  {columns.map((column) => {
                    const Cell = column.id === header ? "th" : "td";
                    return (
                      <Cell key={column.id} scope={Cell === "th" ? "row" : undefined} data-align={column.align} data-show={column.show && column.show !== "always" ? column.show : undefined}>
                        {column.cell ? column.cell(row) : cellText((row as Record<string, unknown>)[column.id])}
                      </Cell>
                    );
                  })}
                  {rowControls && (
                    <td className="sf-data-table-actions">
                      <ItemControls label={text("table.rowControls", { name })} controls={rowControls(row)} show={controlsShow} quietable={false} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {menu.element}
    </div>
  );
}
