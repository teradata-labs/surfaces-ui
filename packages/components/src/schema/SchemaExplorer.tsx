import type { DataSource } from "@surfaces-ui/data";
import { type Column, type TableDetail, TableFormat, type TableSummary } from "@surfaces-ui/proto";
import { DENSITY_SCALE } from "@surfaces-ui/tokens";
import { type DragEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";
import { numberFormat } from "../locale/locale.js";

/** A table or column, as handed to callbacks and placed on the clipboard when dragged. */
export interface SchemaRef {
  sourceId: string;
  table: string;
  column?: string;
}

/** MIME type carrying a SchemaRef as JSON during drag and drop. */
export const SCHEMA_REF_MIME = "application/x-surfaces-ref+json";

export interface SchemaExplorerProps {
  sourceId: string;
  /** Called when a table or column is activated (click or Enter). */
  onSelect?(ref: SchemaRef, table: TableSummary): void;
  /** Called on double-click or Insert, with the name to insert into an editor. */
  onInsert?(name: string, ref: SchemaRef): void;
  /** Extra controls at the end of each table row, e.g. "add to context". */
  renderActions?(ref: SchemaRef, table: TableSummary): ReactNode;
  /** Height in px. Defaults to 420. */
  height?: number;
  dataSource?: DataSource;
  /** Accessible name. Defaults to "Tables". */
  label?: string;
  className?: string;
}

const FORMAT_LABEL: Partial<Record<TableFormat, string>> = {
  [TableFormat.PARQUET]: "Parquet",
  [TableFormat.CSV]: "CSV",
  [TableFormat.JSON]: "JSON",
  [TableFormat.ICEBERG]: "Iceberg",
  [TableFormat.DELTA]: "Delta",
};

type Node =
  | { kind: "table"; key: string; table: TableSummary; name: string; expanded: boolean }
  | { kind: "column"; key: string; table: TableSummary; tableName: string; column: Column }
  | { kind: "note"; key: string; text: string; error?: boolean };

const count = { format: (n: number) => numberFormat({ notation: "compact", maximumFractionDigits: 1 }).format(n) };

/**
 * A searchable tree of a source's tables and their columns. Columns load when
 * a table is opened; only visible rows are in the DOM, so catalogs with
 * thousands of tables stay fast. Items can be dragged into SqlEditor.
 */
export function SchemaExplorer(props: SchemaExplorerProps) {
  const { sourceId, height = 420 } = props;
  const dataSource = useDataSource(props.dataSource);
  const theme = useOptionalTheme();
  const rowHeight = DENSITY_SCALE[theme?.theme.density ?? "comfortable"].rowHeight - 4;

  const [search, setSearch] = useState("");
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [status, setStatus] = useState<{ loading: boolean; error?: string }>({ loading: true });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, TableDetail | { error: string } | "loading">>({});
  const [active, setActive] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Search runs on the backend so it works over catalogs too large to list.
  useEffect(() => {
    let current = true;
    setStatus({ loading: true });
    const timer = setTimeout(() => {
      dataSource
        .listTables({ sourceId, search: search.trim() })
        .then((response) => {
          if (!current) return;
          setTables(response.tables);
          setStatus({ loading: false });
        })
        .catch((error: unknown) => current && setStatus({ loading: false, error: messageOf(error) }));
    }, search ? 180 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dataSource, sourceId, search]);

  const toggle = (name: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    if (details[name] === undefined) {
      setDetails((previous) => ({ ...previous, [name]: "loading" }));
      dataSource
        .describeTable({ sourceId, ref: { table: name }, includeStats: true })
        .then((response) => setDetails((previous) => ({ ...previous, [name]: response.table ?? { error: "No details." } })))
        .catch((error: unknown) => setDetails((previous) => ({ ...previous, [name]: { error: messageOf(error) } })));
    }
  };

  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = [];
    for (const table of tables) {
      const name = table.ref?.table ?? "";
      const open = expanded.has(name);
      out.push({ kind: "table", key: `t:${name}`, table, name, expanded: open });
      if (!open) continue;
      const detail = details[name];
      if (detail === undefined || detail === "loading") out.push({ kind: "note", key: `n:${name}`, text: "Loading columns…" });
      else if ("error" in detail) out.push({ kind: "note", key: `n:${name}`, text: detail.error, error: true });
      else for (const column of detail.columns) out.push({ kind: "column", key: `c:${name}.${column.name}`, table, tableName: name, column });
    }
    return out;
  }, [tables, expanded, details]);

  const listHeight = Math.max(rowHeight, height - 44);
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const last = Math.min(nodes.length, first + Math.ceil(listHeight / rowHeight) + 8);

  const refOf = (node: Node): SchemaRef | undefined =>
    node.kind === "table"
      ? { sourceId, table: node.name }
      : node.kind === "column"
        ? { sourceId, table: node.tableName, column: node.column.name }
        : undefined;
  const nameOf = (ref: SchemaRef) => ref.column ?? ref.table;

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(nodes.length - 1, index));
    setActive(clamped);
    const element = list.current;
    if (!element) return;
    if (clamped * rowHeight < element.scrollTop) element.scrollTop = clamped * rowHeight;
    else if ((clamped + 1) * rowHeight > element.scrollTop + listHeight) element.scrollTop = (clamped + 1) * rowHeight - listHeight;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const node = nodes[active];
    const handled = () => event.preventDefault();
    if (event.key === "ArrowDown") return handled(), focusRow(active + 1);
    if (event.key === "ArrowUp") return handled(), focusRow(active - 1);
    if (event.key === "Home") return handled(), focusRow(0);
    if (event.key === "End") return handled(), focusRow(nodes.length - 1);
    if (!node) return;
    const ref = refOf(node);
    if (event.key === "ArrowRight" && node.kind === "table" && !node.expanded) return handled(), toggle(node.name);
    if (event.key === "ArrowLeft") {
      handled();
      if (node.kind === "table" && node.expanded) return toggle(node.name);
      if (node.kind !== "table") return focusRow(nodes.findIndex((n) => n.kind === "table" && n.name === (node.kind === "column" ? node.tableName : "")));
    }
    if (event.key === "Enter" && ref) return handled(), props.onSelect?.(ref, (node as { table: TableSummary }).table);
    if (event.key === "Insert" && ref) return handled(), props.onInsert?.(nameOf(ref), ref);
  };

  const drag = (ref: SchemaRef) => (event: DragEvent) => {
    event.dataTransfer.setData("text/plain", nameOf(ref));
    event.dataTransfer.setData(SCHEMA_REF_MIME, JSON.stringify(ref));
    event.dataTransfer.effectAllowed = "copy";
  };

  const rows = [];
  for (let index = first; index < last; index++) {
    const node = nodes[index]!;
    const ref = refOf(node);
    const common = {
      id: `sf-schema-${index}`,
      className: "sf-schema-row",
      "data-kind": node.kind,
      "data-active": index === active || undefined,
      style: { top: index * rowHeight, height: rowHeight },
    };
    if (node.kind === "note") {
      rows.push(
        <div key={node.key} {...common} role="treeitem" aria-level={2} aria-selected={false} data-error={node.error || undefined}>
          {node.text}
        </div>,
      );
      continue;
    }
    const detail = node.kind === "table" ? details[node.name] : undefined;
    const rowCount = detail && typeof detail === "object" && "rowCount" in detail ? detail.rowCount : undefined;
    rows.push(
      <div
        key={node.key}
        {...common}
        role="treeitem"
        aria-level={node.kind === "table" ? 1 : 2}
        aria-expanded={node.kind === "table" ? node.expanded : undefined}
        aria-selected={index === active}
        draggable
        onDragStart={drag(ref!)}
        onClick={() => {
          setActive(index);
          if (node.kind === "table") toggle(node.name);
          props.onSelect?.(ref!, node.table);
        }}
        onDoubleClick={() => props.onInsert?.(nameOf(ref!), ref!)}
      >
        {node.kind === "table" ? (
          <>
            <span className="sf-schema-caret" aria-hidden="true" data-open={node.expanded || undefined}>
              ▸
            </span>
            <span className="sf-schema-name">{node.name}</span>
            {rowCount !== undefined && <span className="sf-schema-meta">{count.format(Number(rowCount))} rows</span>}
            {FORMAT_LABEL[node.table.format] && <span className="sf-schema-tag">{FORMAT_LABEL[node.table.format]}</span>}
            {props.renderActions && (
              <span className="sf-schema-actions" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                {props.renderActions(ref!, node.table)}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="sf-schema-name">{node.column.name}</span>
            <span className="sf-schema-meta">{node.column.nativeType.toLowerCase()}</span>
          </>
        )}
      </div>,
    );
  }

  return (
    <div className={["sf-schema", props.className].filter(Boolean).join(" ")} style={{ height }}>
      <input
        className="sf-input sf-schema-search"
        type="search"
        placeholder="Search tables"
        aria-label="Search tables"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setActive(0);
        }}
      />
      <div
        ref={list}
        className="sf-schema-list"
        role="tree"
        aria-label={props.label ?? "Tables"}
        aria-busy={status.loading}
        aria-activedescendant={nodes.length > 0 ? `sf-schema-${active}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: nodes.length * rowHeight, position: "relative" }}>{rows}</div>
        {status.error && (
          <p className="sf-schema-empty" role="alert">
            {status.error}
          </p>
        )}
        {!status.loading && !status.error && tables.length === 0 && (
          <p className="sf-schema-empty">{search ? `No tables match “${search}”.` : "This source has no tables."}</p>
        )}
      </div>
    </div>
  );
}
