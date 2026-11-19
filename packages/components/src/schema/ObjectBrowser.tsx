import type { DataSource, Discovery } from "@surfaces-ui/data";
import { type Certification, CertificationStatus, ObjectKind, type Relation, RelationKind, TableFormat, type TableRef } from "@surfaces-ui/proto";
import { DENSITY_SCALE } from "@surfaces-ui/tokens";
import { type DragEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";
import { CertificationBadge, useOptionalDiscovery } from "../discovery/shared.js";
import { type MenuItem, copyText, useContextMenu } from "../menu/ContextMenu.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";
import { ObjectInfo, qualifiedName } from "./ObjectInfo.js";
import { type DataRef, writeDataRefs } from "./refs.js";
import type { SchemaRef } from "./SchemaExplorer.js";

/** One thing in the tree, as handed to callbacks. */
export interface BrowserItem extends SchemaRef {
  kind: "catalog" | "schema" | "table" | "column" | "join";
  catalog?: string;
  schema?: string;
  /** For a join: the table it was reached from and the matching columns. */
  join?: { from: string; keys: { leftColumn: string; rightColumn: string }[]; inferred: boolean };
}

export interface ObjectBrowserProps {
  sourceId: string;
  /** Called when an item is activated (click or Enter). */
  onSelect?(item: BrowserItem): void;
  /**
   * Called on double-click or Insert with text for an editor: a table or
   * column name, or for a join, a JOIN clause with its ON condition.
   */
  onInsert?(text: string, item: BrowserItem): void;
  /**
   * Called with SQL generated from an item's menu (select, count, a join).
   * Without it the SQL is copied to the clipboard instead.
   */
  onUseSql?(sql: string, item: BrowserItem): void;
  /** Called for "Show details" in an item's menu. Without it the browser shows the details itself. */
  onShowInfo?(item: BrowserItem): void;
  /**
   * Called to hand tables and columns to something else, such as a chat: from
   * "Add to chat" in an item's menu, or Shift+Enter. It is given every
   * selected item when the item is one of several selected (Ctrl or ⌘ click,
   * Shift click, or Space), and the item alone otherwise. Dragging carries
   * the same set.
   */
  onAttach?(refs: DataRef[], items: BrowserItem[]): void;
  /** What the attach action is called in the menu. Defaults to "Add to chat". */
  attachLabel?: string;
  /** Extra controls at the end of each table row, e.g. "Add to context". */
  renderActions?(item: BrowserItem): ReactNode;
  /** Height in px. Defaults to 480. */
  height?: number;
  /** Tables fetched per request; more load as the list is scrolled. Defaults to 200. */
  pageSize?: number;
  dataSource?: DataSource;
  /**
   * Supplies joins and certification marks. Defaults to the one from
   * DiscoveryProvider; without either, the tree shows the catalog only.
   */
  discovery?: Discovery;
  /** Accessible name. Defaults to "Data objects". */
  label?: string;
  className?: string;
}

interface TreeNode {
  id: string;
  parent: string;
  level: number;
  kind: BrowserItem["kind"] | "joins" | "note" | "more";
  label: string;
  meta?: string;
  tag?: string;
  expandable: boolean;
  error?: boolean;
  item?: BrowserItem;
  /** The table this node stands for (tables and joins), with its catalog path. */
  table?: { catalog: string; schema: string; table: string };
  /** Tables between the top of this branch and this node, to stop a walk going in circles. */
  trail: string[];
  certification?: Certification;
}

type Children = TreeNode[] | "loading" | { error: string };

/** Where the next page of a table list starts. */
interface More {
  level: number;
  where: { catalog: string; schema: string; search: string };
  token: string;
  loading: boolean;
}

interface Page {
  nodes: TreeNode[];
  more?: Omit<More, "loading">;
}

const ROOT = "";
const FORMAT_LABEL: Partial<Record<TableFormat, string>> = {
  [TableFormat.PARQUET]: "Parquet",
  [TableFormat.CSV]: "CSV",
  [TableFormat.JSON]: "JSON",
  [TableFormat.ICEBERG]: "Iceberg",
  [TableFormat.DELTA]: "Delta",
};

/** The JOIN clause that follows a join from one table to another. */
export function joinClause(from: string, to: string, keys: { leftColumn: string; rightColumn: string }[]): string {
  const on = keys.map((k) => `${from}.${k.leftColumn} = ${to}.${k.rightColumn}`).join(" AND ");
  return `JOIN ${to} ON ${on}`;
}

/**
 * A tree of everything in a source: catalogs, schemas, tables and columns,
 * and under each table the tables it joins with. Opening a join shows that
 * table's columns and its own joins, so a path can be walked across the
 * model. Certified and deprecated objects are marked. Levels with a single
 * entry are skipped.
 *
 * It is built for large catalogs: branches load when opened, table lists
 * arrive a page at a time as they are scrolled, search runs in the backend,
 * and only the rows in view are in the DOM.
 */
export function ObjectBrowser(props: ObjectBrowserProps) {
  const { sourceId, height = 480, pageSize = 200 } = props;
  const dataSource = useDataSource(props.dataSource);
  const discovery = useOptionalDiscovery(props.discovery);
  const theme = useOptionalTheme();
  const rowHeight = DENSITY_SCALE[theme?.theme.density ?? "comfortable"].rowHeight - 4;

  const [search, setSearch] = useState("");
  const [children, setChildren] = useState<Record<string, Children>>({});
  const [more, setMore] = useState<Record<string, More>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Record<string, Certification>>({});
  const [active, setActive] = useState(0);
  const [info, setInfo] = useState<BrowserItem | undefined>();
  const [note, setNote] = useState("");
  const menu = useContextMenu();
  const [scrollTop, setScrollTop] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const tableNodes = useCallback(
    async (parent: string, level: number, where: { catalog: string; schema: string; search: string }, pageToken = ""): Promise<Page> => {
      const { tables, nextPageToken } = await dataSource.listTables({ sourceId, ...where, pageSize, pageToken });
      const nodes = tables.map((summary) => {
        const ref = summary.ref as TableRef;
        return {
          id: `${parent}/t:${ref.catalog}.${ref.schema}.${ref.table}`,
          parent,
          level,
          kind: "table",
          label: ref.table,
          tag: FORMAT_LABEL[summary.format],
          expandable: true,
          table: { catalog: ref.catalog, schema: ref.schema, table: ref.table },
          trail: [ref.table.toLowerCase()],
          item: { kind: "table", sourceId, table: ref.table, catalog: ref.catalog, schema: ref.schema },
        } satisfies TreeNode;
      });
      return { nodes, more: nextPageToken ? { level, where, token: nextPageToken } : undefined };
    },
    [dataSource, sourceId, pageSize],
  );

  const load = useCallback(
    async (node: TreeNode | undefined): Promise<Page | TreeNode[]> => {
      const level = (node?.level ?? 0) + 1;
      const parent = node?.id ?? ROOT;
      if (!node) {
        const { catalogs } = await dataSource.listCatalogs({ sourceId });
        // A level with one entry adds nothing, so it is skipped.
        if (catalogs.length !== 1) {
          return catalogs.map((c) => ({ id: `c:${c.name}`, parent, level, kind: "catalog", label: c.name, expandable: true, trail: [], item: { kind: "catalog", sourceId, table: "", catalog: c.name } }));
        }
        const catalog = catalogs[0]!.name;
        const { schemas } = await dataSource.listSchemas({ sourceId, catalog });
        if (schemas.length !== 1) {
          return schemas.map((s) => ({ id: `s:${catalog}.${s.name}`, parent, level, kind: "schema", label: s.name, expandable: true, trail: [], item: { kind: "schema", sourceId, table: "", catalog, schema: s.name } }));
        }
        return tableNodes(parent, level, { catalog, schema: schemas[0]!.name, search: "" });
      }
      if (node.kind === "catalog") {
        const { schemas } = await dataSource.listSchemas({ sourceId, catalog: node.label });
        return schemas.map((s) => ({ id: `${parent}/s:${s.name}`, parent, level, kind: "schema", label: s.name, expandable: true, trail: [], item: { kind: "schema", sourceId, table: "", catalog: node.label, schema: s.name } }));
      }
      if (node.kind === "schema") return tableNodes(parent, level, { catalog: node.item?.catalog ?? "", schema: node.label, search: "" });
      if ((node.kind === "table" || node.kind === "join") && node.table) {
        const detail = (await dataSource.describeTable({ sourceId, ref: node.table })).table;
        const columns: TreeNode[] = (detail?.columns ?? []).map((column) => ({
          id: `${parent}/col:${column.name}`,
          parent,
          level,
          kind: "column",
          label: column.name,
          meta: column.nativeType.toLowerCase(),
          expandable: false,
          trail: node.trail,
          item: { kind: "column", sourceId, table: node.table!.table, column: column.name, catalog: node.table!.catalog, schema: node.table!.schema },
        }));
        if (!discovery) return columns;
        return [...columns, { id: `${parent}/joins`, parent, level, kind: "joins", label: "Joins", expandable: true, table: node.table, trail: node.trail }];
      }
      if (node.kind === "joins" && node.table && discovery) {
        const { relations } = await discovery.getRelated({
          ref: { sourceId, kind: ObjectKind.TABLE, catalog: node.table.catalog, schema: node.table.schema, table: node.table.table },
          kinds: [RelationKind.JOIN],
        });
        // A table already on the way here is left out, so a walk cannot loop.
        const onward = relations.filter((r: Relation) => r.object?.ref && !node.trail.includes(r.object.ref.table.toLowerCase()));
        if (onward.length === 0) {
          return [{ id: `${parent}/none`, parent, level, kind: "note", label: relations.length === 0 ? "No joins found" : "No further joins", expandable: false, trail: node.trail }];
        }
        return onward.map((relation) => {
          const ref = relation.object!.ref!;
          const keys = relation.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn }));
          return {
            id: `${parent}/j:${ref.table}`,
            parent,
            level,
            kind: "join",
            label: ref.table,
            meta: keys.map((k) => (k.leftColumn === k.rightColumn ? `on ${k.leftColumn}` : `on ${k.leftColumn} = ${k.rightColumn}`)).join(", "),
            tag: relation.inferred ? "Inferred" : undefined,
            expandable: true,
            table: { catalog: ref.catalog, schema: ref.schema, table: ref.table },
            trail: [...node.trail, ref.table.toLowerCase()],
            certification: relation.object?.certification,
            item: { kind: "join", sourceId, table: ref.table, catalog: ref.catalog, schema: ref.schema, join: { from: node.table!.table, keys, inferred: relation.inferred } },
          } satisfies TreeNode;
        });
      }
      return [];
    },
    [dataSource, discovery, sourceId, tableNodes],
  );

  const fill = useCallback(
    (key: string, work: Promise<Page | TreeNode[]>) => {
      setChildren((previous) => ({ ...previous, [key]: "loading" }));
      work
        .then((result) => {
          const page = Array.isArray(result) ? { nodes: result } : result;
          setChildren((previous) => ({ ...previous, [key]: page.nodes }));
          setMore((previous) => {
            const { [key]: _gone, ...rest } = previous;
            return page.more ? { ...rest, [key]: { ...page.more, loading: false } } : rest;
          });
        })
        .catch((error: unknown) => setChildren((previous) => ({ ...previous, [key]: { error: messageOf(error) } })));
    },
    [],
  );

  // The top of the tree, or the tables matching the search (found by the backend).
  useEffect(() => {
    setExpanded(new Set());
    setActive(0);
    const text = search.trim();
    const timer = setTimeout(() => {
      setChildren({});
      setMore({});
      fill(ROOT, text ? tableNodes(ROOT, 1, { catalog: "", schema: "", search: text }) : load(undefined));
    }, text ? 180 : 0);
    return () => clearTimeout(timer);
  }, [fill, load, tableNodes, search]);

  // Certification marks for the tables in this source, when a discovery backend is present.
  useEffect(() => {
    if (!discovery) return;
    let current = true;
    discovery
      // Only marked tables are fetched, so this stays small however large the catalog is.
      .search({
        query: "",
        kinds: [ObjectKind.TABLE],
        sourceIds: [sourceId],
        certificationStatuses: [CertificationStatus.CERTIFIED, CertificationStatus.DEPRECATED],
        pageSize: 1000,
      })
      .then((response) => {
        if (!current) return;
        const found: Record<string, Certification> = {};
        for (const hit of response.hits) {
          if (hit.object?.certification && hit.object.ref) found[hit.object.ref.table.toLowerCase()] = hit.object.certification;
        }
        setMarks(found);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [discovery, sourceId]);

  const toggle = (node: TreeNode) => {
    if (!node.expandable) return;
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    if (children[node.id] === undefined) fill(node.id, load(node));
  };

  const nodes = useMemo<TreeNode[]>(() => {
    const out: TreeNode[] = [];
    const walk = (key: string, level: number) => {
      const below = children[key];
      if (below === undefined) return;
      if (below === "loading") return void out.push({ id: `${key}/loading`, parent: key, level, kind: "note", label: "Loading…", expandable: false, trail: [] });
      if (!Array.isArray(below)) return void out.push({ id: `${key}/error`, parent: key, level, kind: "note", label: below.error, expandable: false, error: true, trail: [] });
      for (const node of below) {
        out.push(node);
        if (expanded.has(node.id)) walk(node.id, node.level + 1);
      }
      // Stands in for the tables not fetched yet; the next page loads when it scrolls into view.
      if (more[key]) out.push({ id: `${key}/more`, parent: key, level: more[key].level, kind: "more", label: "Loading more tables…", expandable: false, trail: [] });
    };
    walk(ROOT, 1);
    return out;
  }, [children, expanded, more]);

  const listHeight = Math.max(rowHeight, height - 44);
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const last = Math.min(nodes.length, first + Math.ceil(listHeight / rowHeight) + 8);

  // Fetch the next page of any table list whose end is in view.
  useEffect(() => {
    for (let index = first; index < last; index++) {
      const node = nodes[index];
      if (node?.kind !== "more") continue;
      const key = node.parent;
      const next = more[key];
      if (!next || next.loading) continue;
      setMore((previous) => (previous[key] ? { ...previous, [key]: { ...previous[key], loading: true } } : previous));
      tableNodes(key, next.level, next.where, next.token)
        .then((page) => {
          setChildren((previous) => {
            const existing = previous[key];
            return Array.isArray(existing) ? { ...previous, [key]: [...existing, ...page.nodes] } : previous;
          });
          setMore((previous) => {
            const { [key]: _gone, ...rest } = previous;
            return page.more ? { ...rest, [key]: { ...page.more, loading: false } } : rest;
          });
        })
        .catch(() => {
          // Leave the marker in place; scrolling to it again retries.
          setMore((previous) => (previous[key] ? { ...previous, [key]: { ...previous[key], loading: false } } : previous));
        });
    }
  }, [first, last, nodes, more, tableNodes]);

  const insertText = (item: BrowserItem) =>
    item.kind === "join" && item.join ? joinClause(item.join.from, item.table, item.join.keys) : (item.column ?? (item.table || item.schema || item.catalog || ""));

  // Several tables and columns can be selected and then dragged or attached together.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // With one catalog and one schema the tree starts at the tables; a reference then names the table alone, as the tree does.
  const flat = nodes.some((n) => n.kind === "table" && n.level === 1);
  const refOf = (item: BrowserItem): DataRef | undefined =>
    item.kind === "table" || item.kind === "column"
      ? { sourceId: item.sourceId, kind: item.kind, ...(item.catalog && !flat ? { catalog: item.catalog } : {}), ...(item.schema && !flat ? { schema: item.schema } : {}), table: item.table, ...(item.column ? { column: item.column } : {}) }
      : undefined;
  /** What an action on `item` covers: the whole selection when the item is part of it, the item alone otherwise. */
  const carried = (item: BrowserItem): BrowserItem[] => {
    const chosen = nodes.filter((n) => picked.has(n.id) && n.item && refOf(n.item)).map((n) => n.item!);
    return chosen.length > 1 && chosen.includes(item) ? chosen : refOf(item) ? [item] : [];
  };
  const attach = (item: BrowserItem) => {
    const items = carried(item);
    const refs = items.map((i) => refOf(i)!);
    if (refs.length === 0 || !props.onAttach) return;
    props.onAttach(refs, items);
    setNote(refs.length === 1 ? `Added ${refs[0]!.column ?? refs[0]!.table}.` : `Added ${refs.length} items.`);
  };
  const pick = (index: number, mode: "toggle" | "range") => {
    const node = nodes[index];
    if (!node?.item || !refOf(node.item)) return;
    setPicked((current) => {
      const next = new Set(current);
      if (mode === "toggle") {
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
      } else {
        const [from, to] = active <= index ? [active, index] : [index, active];
        for (let i = from; i <= to; i++) if (nodes[i]?.item && refOf(nodes[i]!.item!)) next.add(nodes[i]!.id);
      }
      setNote(next.size === 0 ? "" : `${next.size} selected. Drag them, or press Shift+Enter to add them.`);
      return next;
    });
    setActive(index);
  };

  const copy = (text: string, what: string) => void copyText(text).then((ok) => setNote(ok ? `Copied ${what}.` : "Could not copy: the browser refused access to the clipboard."));
  const useSql = (statement: string, item: BrowserItem) => (props.onUseSql ? props.onUseSql(statement, item) : copy(statement, "the SQL"));
  const showInfo = (item: BrowserItem) => (props.onShowInfo ? props.onShowInfo(item) : setInfo(item));
  /** The actions for an item. Each is also possible another way: Enter, Insert, drag, or the SQL editor. */
  const menuFor = (item: BrowserItem): MenuItem[] => {
    const table = qualifiedName({ catalog: item.catalog, schema: item.schema, table: item.table });
    const name = insertText(item);
    const count = carried(item).length;
    const common: MenuItem[] = [
      ...(props.onAttach && count > 0 ? [{ separator: true }, { label: count > 1 ? `${props.attachLabel ?? "Add to chat"}: ${count} items` : (props.attachLabel ?? "Add to chat"), hint: "Shift Enter", onSelect: () => attach(item) }] : []),
      { separator: true },
      { label: "Copy name", hint: "Ctrl/⌘ C", onSelect: () => copy(item.kind === "join" ? name : qualifiedName({ catalog: item.catalog, schema: item.schema, table: item.table, column: item.column }), "the name") },
      ...(props.onInsert ? [{ label: item.kind === "join" ? "Insert JOIN clause" : "Insert name into the editor", hint: "Insert", onSelect: () => props.onInsert?.(name, item) }] : []),
    ];
    if (item.kind === "catalog" || item.kind === "schema") return [{ label: `Show ${item.kind === "catalog" ? "database" : "schema"} details`, onSelect: () => showInfo(item) }, ...common];
    if (item.kind === "table") {
      return [
        { label: "Show table details", onSelect: () => showInfo(item) },
        { separator: true },
        { label: "SQL: all rows", onSelect: () => useSql(`SELECT *\nFROM ${table}`, item) },
        {
          label: "SQL: every column by name",
          onSelect: () =>
            void dataSource
              .describeTable({ sourceId, ref: { catalog: item.catalog ?? "", schema: item.schema ?? "", table: item.table } })
              .then((response) => useSql(`SELECT\n${(response.table?.columns ?? []).map((c) => `  ${qualifiedName({ column: c.name })}`).join(",\n")}\nFROM ${table}`, item))
              .catch((error: unknown) => setNote(`Could not read the columns: ${messageOf(error)}`)),
        },
        { label: "SQL: count rows", onSelect: () => useSql(`SELECT COUNT(*) AS row_count\nFROM ${table}`, item) },
        ...common,
      ];
    }
    if (item.kind === "column" && item.column) {
      const column = qualifiedName({ column: item.column });
      return [
        { label: "SQL: count each value", onSelect: () => useSql(`SELECT ${column}, COUNT(*) AS row_count\nFROM ${table}\nGROUP BY ${column}\nORDER BY row_count DESC`, item) },
        { label: "SQL: range and missing values", onSelect: () => useSql(`SELECT MIN(${column}) AS lowest, MAX(${column}) AS highest, COUNT(*) - COUNT(${column}) AS missing\nFROM ${table}`, item) },
        { label: "Show table details", onSelect: () => showInfo({ ...item, kind: "table", column: undefined }) },
        ...common,
      ];
    }
    if (item.kind === "join" && item.join) {
      return [{ label: "SQL: both tables joined", onSelect: () => useSql(`SELECT *\nFROM ${qualifiedName({ table: item.join!.from })}\n${name}`, item) }, { label: "Show table details", onSelect: () => showInfo({ ...item, kind: "table", join: undefined }) }, ...common];
    }
    return [];
  };

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
    const open = expanded.has(node.id);
    if (event.key === "ArrowRight") {
      handled();
      if (node.expandable && !open) return toggle(node);
      if (open) return focusRow(active + 1);
    }
    if (event.key === "ArrowLeft") {
      handled();
      if (open) return toggle(node);
      const parent = nodes.findIndex((n) => n.id === node.parent);
      if (parent >= 0) return focusRow(parent);
    }
    if (event.key === "Enter" && event.shiftKey && props.onAttach) {
      // The selection, wherever the keyboard is; with nothing selected, the row it is on.
      const chosen = nodes.find((n) => picked.has(n.id) && n.item)?.item;
      const item = picked.has(node.id) || !chosen ? node.item : chosen;
      if (item) return handled(), attach(item);
    }
    if (event.key === " " && node.item) return handled(), pick(active, "toggle");
    if (event.key === "Escape" && picked.size > 0) return handled(), setPicked(new Set()), setNote("");
    if (event.key === "Enter") {
      handled();
      if (node.item) props.onSelect?.(node.item);
      else toggle(node);
    }
    if (event.key === "Insert" && node.item) return handled(), props.onInsert?.(insertText(node.item), node.item);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && node.item) return handled(), copy(insertText(node.item), "the name");
    if ((event.altKey && event.key === "Enter") || (event.key === "i" && (event.ctrlKey || event.metaKey))) {
      if (node.item && node.item.kind !== "join") return handled(), showInfo(node.item.kind === "column" ? { ...node.item, kind: "table", column: undefined } : node.item);
    }
  };

  const drag = (item: BrowserItem) => (event: DragEvent) => {
    // Dragging one of several selected items carries them all.
    const refs = carried(item).map((i) => refOf(i)!);
    if (refs.length > 0) writeDataRefs(event.dataTransfer, refs, refs.length === 1 ? insertText(item) : undefined);
    else event.dataTransfer.setData("text/plain", insertText(item));
    event.dataTransfer.effectAllowed = "copy";
  };

  const rows = [];
  for (let index = first; index < last; index++) {
    const node = nodes[index]!;
    const open = expanded.has(node.id);
    const item = node.item;
    const mark = node.certification ?? (node.kind === "table" ? marks[node.label.toLowerCase()] : undefined);
    rows.push(
      <div
        key={node.id}
        id={`sf-browser-${index}`}
        className="sf-schema-row sf-browser-row"
        data-kind={node.kind === "more" ? "note" : node.kind}
        data-active={index === active || undefined}
        data-error={node.error || undefined}
        style={{ top: index * rowHeight, height: rowHeight, paddingInlineStart: `calc(var(--sf-space-2) + ${node.level - 1} * var(--sf-space-4))` }}
        role="treeitem"
        aria-level={node.level}
        aria-expanded={node.expandable ? open : undefined}
        aria-selected={picked.size > 0 ? picked.has(node.id) : index === active}
        data-picked={picked.has(node.id) || undefined}
        draggable={item !== undefined}
        onDragStart={item ? drag(item) : undefined}
        onClick={(event) => {
          // Ctrl or ⌘ adds one to the selection, Shift everything from the last row to this one; a plain click starts again.
          if (event.ctrlKey || event.metaKey) return pick(index, "toggle");
          if (event.shiftKey) return pick(index, "range");
          if (picked.size > 0) {
            setPicked(new Set());
            setNote("");
          }
          setActive(index);
          toggle(node);
          if (item) props.onSelect?.(item);
        }}
        onDoubleClick={() => item && props.onInsert?.(insertText(item), item)}
        onContextMenu={
          item
            ? (event) => {
                setActive(index);
                menu.open(event, `${node.label} actions`, menuFor(item));
              }
            : undefined
        }
      >
        <span className="sf-schema-caret" aria-hidden="true" data-open={open || undefined}>
          {node.expandable ? "▸" : ""}
        </span>
        <span className="sf-schema-name">{node.label}</span>
        <CertificationBadge certification={mark} />
        {node.meta && <span className="sf-schema-meta">{node.meta}</span>}
        {node.tag && <span className="sf-schema-tag">{node.tag}</span>}
        {(node.kind === "table" || node.kind === "join") && item && props.renderActions && (
          <span className="sf-schema-actions" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {props.renderActions(item)}
          </span>
        )}
      </div>,
    );
  }

  const top = children[ROOT];
  return (
    <div className={["sf-schema", props.className].filter(Boolean).join(" ")} style={{ height }}>
      <input
        className="sf-input sf-schema-search"
        type="search"
        placeholder="Search tables"
        aria-label="Search tables"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div
        ref={list}
        className="sf-schema-list"
        role="tree"
        aria-label={props.label ?? "Data objects"}
        aria-busy={top === undefined || top === "loading"}
        aria-activedescendant={nodes.length > 0 ? `sf-browser-${active}` : undefined}
        tabIndex={0}
        aria-multiselectable="true"
        aria-keyshortcuts="Shift+F10 Alt+Enter Insert Control+C Space Shift+Enter"
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          // The Menu key and Shift+F10 on the tree open the menu of the row the keyboard is on.
          const item = nodes[active]?.item;
          if (event.target === event.currentTarget && item) menu.open(event, `${nodes[active]!.label} actions`, menuFor(item));
        }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: nodes.length * rowHeight, position: "relative" }}>{rows}</div>
        {Array.isArray(top) && top.length === 0 && (
          <p className="sf-schema-empty">{search.trim() ? `No tables match “${search.trim()}”.` : "This source has nothing to show."}</p>
        )}
      </div>
      <p className="sf-schema-note" role="status">
        {note}
      </p>
      {info && (
        <div className="sf-schema-info">
          <ObjectInfo
            dataSource={dataSource}
            sourceId={sourceId}
            catalog={info.catalog}
            schema={info.schema}
            table={info.kind === "table" ? info.table : undefined}
            onClose={() => {
              setInfo(undefined);
              list.current?.focus();
            }}
          />
        </div>
      )}
      {menu.element}
    </div>
  );
}
