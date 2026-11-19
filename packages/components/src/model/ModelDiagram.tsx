import { type DataSource, type Discovery, type TypeFamily, mostRowsPerKey, typeFamily } from "@surfaces-ui/data";
import { type Certification, type Column, type ForeignKey, ObjectKind, RelationKind } from "@surfaces-ui/proto";
import { type DragEvent, type PointerEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";
import { CertificationBadge, useOptionalDiscovery } from "../discovery/shared.js";
import { PanZoomControls, usePanZoom } from "../panzoom/usePanZoom.js";
import { SCHEMA_REF_MIME, type SchemaRef } from "../schema/SchemaExplorer.js";
import { ControlIcon } from "../controls/ItemControls.js";

export interface ModelJoinKey {
  leftColumn: string;
  rightColumn: string;
}

/** Which rows a join keeps, read from its left table to its right: only rows that match, every left row, every right row, or every row of both. */
export type JoinKind = "inner" | "left" | "right" | "full";

export const JOIN_KINDS: JoinKind[] = ["inner", "left", "right", "full"];

/** A relationship between two tables on the diagram. */
export interface ModelJoin {
  left: string;
  right: string;
  keys: ModelJoinKey[];
  /** Which rows it keeps. Left out, an inner join: only rows that match. */
  type?: JoinKind;
  /** True when guessed from names and types rather than drawn or confirmed by a person. */
  inferred?: boolean;
  /** True when the backend reports it as a foreign key the table declares. */
  declared?: boolean;
}

export interface DataModel {
  tables: string[];
  joins: ModelJoin[];
}

export interface ModelDiagramProps {
  sourceId: string;
  /** Tables to start with. Changing this list starts the diagram again. */
  tables?: string[];
  /** Joins to start with. */
  joins?: ModelJoin[];
  /** Called whenever tables or joins change, and when the query changes because the tables' columns have been read; `query` is what `modelSql` makes of them. */
  onChange?(model: DataModel, query: ModelSql): void;
  /**
   * The first table's rows are the result's rows, as in a semantic model:
   * the first table is marked as where the rows come from and can be
   * changed, the rest are laid out as the detail they add, a new join keeps
   * every row of the side nearer the first table, each join says whether it
   * adds one row of detail or can repeat rows, and each column shows its
   * name in the result.
   */
  rowsFrom?: boolean;
  /** Result column names something uses (a model's fields). Others are dimmed. */
  usedColumns?: string[];
  /** Shows a "Use as query" button and is called with SQL that joins the tables. */
  onUseSql?(sql: string, model: DataModel): void;
  /** Add the joins the discovery backend finds between tables on the diagram, labelled "Inferred". Defaults to true. */
  suggestJoins?: boolean;
  /** Height of the canvas in px. Defaults to 420. */
  height?: number;
  dataSource?: DataSource;
  /** Supplies suggested joins and certification marks. Defaults to the one from DiscoveryProvider; optional. */
  discovery?: Discovery;
  /** Accessible name. Defaults to "Data model". */
  label?: string;
  className?: string;
}

const CARD_WIDTH = 240;
const HEAD_HEIGHT = 34;
const ROW_HEIGHT = 24;
const MAX_ROWS = 10;
const GAP = 60;

const lower = (name: string) => name.toLowerCase();
const same = (a: string, b: string) => lower(a) === lower(b);
const quote = (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);
/** A table's name in SQL. One written with its database or schema (`sales.orders`) is already SQL and is left as it is, not quoted into one name. */
const quoteTable = (name: string) => (/^[A-Za-z_]\w*(\.[A-Za-z_]\w*){1,2}$/.test(name) ? name : quote(name));

/** A join's identity, whichever way round it was drawn. */
export function joinId(join: ModelJoin): string {
  const forward = lower(join.left) <= lower(join.right);
  const [a, b] = forward ? [join.left, join.right] : [join.right, join.left];
  const keys = join.keys.map((k) => (forward ? `${k.leftColumn}=${k.rightColumn}` : `${k.rightColumn}=${k.leftColumn}`)).sort();
  return lower(`${a}|${b}|${keys.join("&")}`);
}

/** The text of a join condition, e.g. `orders.customer_id = customers.customer_id`. */
export function joinText(join: ModelJoin): string {
  return join.keys.map((k) => `${quoteTable(join.left)}.${quote(k.leftColumn)} = ${quoteTable(join.right)}.${quote(k.rightColumn)}`).join(" AND ");
}

const KEYWORD: Record<JoinKind, string> = { inner: "JOIN", left: "LEFT OUTER JOIN", right: "RIGHT OUTER JOIN", full: "FULL OUTER JOIN" };
const FLIPPED: Record<JoinKind, JoinKind> = { inner: "inner", left: "right", right: "left", full: "full" };

/** Which rows a join of this kind keeps, in words, named from the join's left and right tables. */
export function kindText(join: Pick<ModelJoin, "left" | "right">, kind: JoinKind): string {
  return kind === "inner" ? "Only rows that match" : kind === "left" ? `Every ${join.left} row` : kind === "right" ? `Every ${join.right} row` : "Every row of both";
}

/** The same join drawn the other way round: tables, columns and the side it keeps all swapped, so it keeps the same rows. */
export function flipJoin(join: ModelJoin): ModelJoin {
  return {
    ...join,
    left: join.right,
    right: join.left,
    keys: join.keys.map((k) => ({ leftColumn: k.rightColumn, rightColumn: k.leftColumn })),
    ...(join.type ? { type: FLIPPED[join.type] } : {}),
  };
}

/** A join as the query reads it from `from`: drawn with `from` on its left. */
export function joinFrom(join: ModelJoin, from: string): ModelJoin {
  return same(join.left, from) ? join : flipJoin(join);
}

/** One column of a joined result: the table and column it comes from, and its name in the result. */
export interface OutputColumn {
  table: string;
  column: string;
  name: string;
}

/**
 * The names the joined tables' columns take in the result, in the order the
 * query reads the tables: the first use of a name keeps it, and a name a
 * later table repeats gets `_1`, `_2` and so on (`store_id_1`). The query
 * writes these as aliases, so the names are the same on every engine.
 */
export function outputColumns(tables: string[], columnsOf: (table: string) => string[]): OutputColumn[] {
  const uses = new Map<string, number>();
  const taken = new Set<string>();
  const out: OutputColumn[] = [];
  for (const table of tables) {
    for (const column of columnsOf(table)) {
      let n = uses.get(lower(column)) ?? 0;
      let name = n === 0 ? column : `${column}_${n}`;
      // A table with a real column called store_id_1 does not lose it to a renamed one.
      while (taken.has(lower(name))) name = `${column}_${++n}`;
      uses.set(lower(column), n + 1);
      taken.add(lower(name));
      out.push({ table, column, name });
    }
  }
  return out;
}

/** A column name in SQL, always quoted, so a name such as `format` or `Region` reads the same on every engine. */
const quoteAlways = (name: string) => `"${name.replace(/"/g, '""')}"`;

export interface ModelSql {
  sql: string;
  /** Tables no join reaches, left out of the query rather than cross-joined. */
  unjoined: string[];
  /** The tables in the order the query reads them, the first table first. */
  order: string[];
  /** The result's columns, when every table's columns were known. */
  columns?: OutputColumn[];
}

/**
 * SQL that joins the diagram's tables, starting from the first and following
 * joins outwards, each with the join kind it was given (an inner join when
 * none). Tables no join reaches are returned in `unjoined`, not cross-joined.
 *
 * With `columnsOf` knowing every table's columns and two tables sharing a
 * column name, the query names each
 * column, giving a name a later table repeats its own alias
 * (`outputColumns`). Engines differ over `SELECT *` across tables that share
 * a column name (DuckDB renames, Teradata and others refuse it inside a
 * query), so the named form is the one that runs everywhere. Without the
 * columns it falls back to `SELECT *`.
 */
export function modelSql(model: DataModel, columnsOf?: (table: string) => string[] | undefined): ModelSql {
  const [first, ...rest] = model.tables;
  if (!first) return { sql: "", unjoined: [], order: [] };
  const reached = [first];
  const pending = new Set(rest.map(lower));
  const lines = [`FROM ${quoteTable(first)}`];
  for (let progress = true; progress && pending.size > 0; ) {
    progress = false;
    for (const join of model.joins) {
      const leftIn = reached.some((t) => same(t, join.left));
      const rightIn = reached.some((t) => same(t, join.right));
      if (leftIn === rightIn) continue;
      const next = leftIn ? join.right : join.left;
      if (!pending.has(lower(next))) continue;
      // Every join between the new table and those already reached goes into one ON clause.
      const conditions = model.joins
        .filter((j) => (same(j.left, next) && reached.some((t) => same(t, j.right))) || (same(j.right, next) && reached.some((t) => same(t, j.left))))
        .map(joinText);
      // Read from the side already reached, so "every orders row" stays that whichever way the line was drawn.
      const kind = joinFrom(join, leftIn ? join.left : join.right).type ?? "inner";
      lines.push(`${KEYWORD[kind]} ${quoteTable(next)} ON ${conditions.join(" AND ")}`);
      reached.push(next);
      pending.delete(lower(next));
      progress = true;
    }
  }
  const unjoined = model.tables.filter((t) => pending.has(lower(t)));
  const known = columnsOf ? reached.map((t) => columnsOf(t)) : [];
  if (!columnsOf || known.some((c) => !c || c.length === 0)) return { sql: [`SELECT *`, ...lines].join("\n"), unjoined, order: reached };
  const columns = outputColumns(reached, (t) => known[reached.indexOf(t)] ?? []);
  // With no name repeated, every engine reads SELECT * the same way, and it stays short.
  if (columns.every((c) => c.name === c.column)) return { sql: [`SELECT *`, ...lines].join("\n"), unjoined, order: reached, columns };
  const list = columns.map((c) => `${quoteTable(c.table)}.${quoteAlways(c.column)}${c.name === c.column ? "" : ` AS ${quoteAlways(c.name)}`}`);
  return { sql: [`SELECT ${list.join(",\n  ")}`, ...lines].join("\n"), unjoined, order: reached, columns };
}

/**
 * Whether each row of `from` finds at most one row of the other table, from
 * what the tables declare: "one" when the other side's columns are its whole
 * primary key or `from` declares them as a foreign key to it, "many" when the
 * other table has a primary key the join does not use, "unknown" when it
 * declares none (files usually do not): ask the engine with `mostRowsPerKey`.
 */
export type JoinShape = "one" | "many" | "unknown";

export function joinShape(join: ModelJoin, from: string, columnsOf: (table: string) => Column[] | undefined, foreignKeysOf: (table: string) => ForeignKey[] | undefined = () => undefined): JoinShape {
  const read = joinFrom(join, from);
  const near = read.keys.map((k) => k.leftColumn);
  const far = read.keys.map((k) => k.rightColumn);
  const key = (columnsOf(read.right) ?? []).filter((c) => c.primaryKey).map((c) => c.name);
  if (key.length > 0 && key.every((k) => far.some((f) => same(f, k)))) return "one";
  const declared = (foreignKeysOf(read.left) ?? []).some(
    (fk) => same(fk.references?.table ?? "", read.right) && fk.columns.length > 0 && fk.columns.every((c) => near.some((n) => same(n, c))) && fk.referencedColumns.every((c) => far.some((f) => same(f, c))),
  );
  if (declared) return "one";
  return key.length > 0 ? "many" : "unknown";
}

/** How far each table is from the first through joins: 0 for the first, 1 for those it joins, and so on. Tables no join reaches come after the rest. */
export function joinDepths(tables: string[], joins: ModelJoin[]): Map<string, number> {
  const depth = new Map<string, number>();
  if (tables[0]) depth.set(tables[0], 0);
  for (let grew = true; grew; ) {
    grew = false;
    for (const join of joins) {
      const l = tables.find((t) => same(t, join.left));
      const r = tables.find((t) => same(t, join.right));
      if (!l || !r) continue;
      const [a, b] = depth.has(l) && !depth.has(r) ? [l, r] : depth.has(r) && !depth.has(l) ? [r, l] : [];
      if (a && b) {
        depth.set(b, depth.get(a)! + 1);
        grew = true;
      }
    }
  }
  const last = Math.max(0, ...depth.values()) + 1;
  for (const t of tables) if (!depth.has(t)) depth.set(t, last);
  return depth;
}

const FAMILY_TEXT: Record<TypeFamily, string> = { number: "a number", text: "text", time: "a date or time", boolean: "true or false", binary: "binary data", nested: "nested data", unknown: "of an unknown type" };

export { type TypeFamily, typeFamily };

export type JoinCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a join can work at all. It refuses a table joined to itself, a
 * column the table does not have, keys that cannot be compared (nested or
 * binary data) and keys of different kinds, such as a number against text.
 * `columnsOf` returns undefined for a table whose columns are not known yet;
 * such a table is given the benefit of the doubt.
 */
export function checkJoin(join: ModelJoin, columnsOf: (table: string) => Column[] | undefined): JoinCheck {
  if (same(join.left, join.right)) return { ok: false, reason: "A join needs two different tables." };
  if (join.keys.length === 0) return { ok: false, reason: "A join needs a column from each table." };
  for (const key of join.keys) {
    const sides = [
      { table: join.left, name: key.leftColumn },
      { table: join.right, name: key.rightColumn },
    ].map((side) => {
      const columns = columnsOf(side.table);
      const column = columns?.find((c) => same(c.name, side.name));
      return { ...side, known: columns !== undefined, column, family: column ? typeFamily(column) : ("unknown" as TypeFamily) };
    });
    for (const side of sides) {
      if (side.known && !side.column) return { ok: false, reason: `${side.table} has no column ${side.name}.` };
      if (side.family === "nested" || side.family === "binary") return { ok: false, reason: `${side.table}.${side.name} holds ${FAMILY_TEXT[side.family]}, which cannot be matched.` };
    }
    const [a, b] = sides as [(typeof sides)[number], (typeof sides)[number]];
    if (a.family !== "unknown" && b.family !== "unknown" && a.family !== b.family) {
      return { ok: false, reason: `${a.table}.${a.name} is ${FAMILY_TEXT[a.family]} and ${b.table}.${b.name} is ${FAMILY_TEXT[b.family]}, so they can never match.` };
    }
  }
  return { ok: true };
}

/** True when `from` already reaches `to` through joins, so one more join between them closes a loop. */
export function connected(joins: ModelJoin[], from: string, to: string): boolean {
  const seen = new Set([lower(from)]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const join of joins) {
      const [l, r] = [lower(join.left), lower(join.right)];
      if (seen.has(l) !== seen.has(r)) {
        seen.add(l);
        seen.add(r);
        grew = true;
      }
    }
  }
  return seen.has(lower(to));
}

interface Point {
  x: number;
  y: number;
}

/** Where a new table goes: the next free slot in rows of three. */
function slot(index: number): Point {
  return { x: 16 + (index % 3) * (CARD_WIDTH + GAP), y: 16 + Math.floor(index / 3) * (HEAD_HEIGHT + ROW_HEIGHT * (MAX_ROWS + 2) + 24) };
}

type Detail = Column[] | "loading" | { error: string };

/**
 * A relationship diagram of tables: each table is a card listing its
 * columns, and lines connect the columns that join. Drag a card to arrange
 * it, drag a column onto a column of another table to draw a join, and drop
 * a table from ObjectBrowser to add it. Suggested joins are dashed and
 * labelled "Inferred" until a person confirms them.
 *
 * Everything the canvas does is also available from the keyboard through
 * the lists and the "Add join" form beneath it.
 */
export function ModelDiagram(props: ModelDiagramProps) {
  const { sourceId, height = 420, suggestJoins = true, rowsFrom = false } = props;
  const dataSource = useDataSource(props.dataSource);
  const discovery = useOptionalDiscovery(props.discovery);
  const id = useId();
  const startKey = JSON.stringify([props.tables ?? [], props.joins ?? []]);

  const [tables, setTables] = useState<string[]>(props.tables ?? []);
  const [joins, setJoins] = useState<ModelJoin[]>(props.joins ?? []);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [marks, setMarks] = useState<Record<string, Certification>>({});
  // What each table declares about itself: its description and foreign keys.
  const [about, setAbout] = useState<Record<string, { comment: string; foreignKeys: ForeignKey[] }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<{ table: string; column: string; to: Point } | undefined>();
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<string[]>([]);
  const [draft, setDraft] = useState({ left: "", leftColumn: "", right: "", rightColumn: "" });
  const [status, setStatus] = useState("");
  const [problem, setProblem] = useState("");
  const [retries, setRetries] = useState(0);
  // The engine's answer, per join and direction, to how many rows of the far table share one key.
  const [counts, setCounts] = useState<Record<string, number | "checking" | { error: string }>>({});
  const canvas = useRef<HTMLDivElement>(null);
  const moving = useRef<{ table: string; dx: number; dy: number } | undefined>(undefined);
  const considered = useRef(new Set<string>());
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;

  // New starting tables or joins from the host start the diagram again.
  const started = useRef(startKey);
  useEffect(() => {
    if (started.current === startKey) return;
    started.current = startKey;
    considered.current = new Set();
    setTables(props.tables ?? []);
    setJoins(props.joins ?? []);
    setPositions({});
  }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo<DataModel>(() => ({ tables, joins }), [tables, joins]);

  /** The side of a join nearer the first table: the one the query reaches first. */
  const nearOf = (join: ModelJoin, current: DataModel = model): string => {
    const order = modelSql(current).order;
    const rank = (t: string) => {
      const i = order.findIndex((o) => same(o, t));
      return i >= 0 ? i : order.length + current.tables.findIndex((x) => same(x, t));
    };
    return rank(join.left) <= rank(join.right) ? join.left : join.right;
  };
  /** With rowsFrom, a join no one gave a kind keeps every row of its nearer side, so adding detail never drops the first table's rows. */
  const orient = (join: ModelJoin, current: DataModel): ModelJoin => (!rowsFrom || join.type ? join : { ...joinFrom(join, nearOf(join, current)), type: "left" });

  // Replies are kept while the source they were asked of is still the one shown,
  // even if this effect runs again before they arrive (it does not ask twice).
  const live = useRef({ sourceId, dataSource });
  live.current = { sourceId, dataSource };

  // Columns, certification and suggested joins for each table as it arrives.
  useEffect(() => {
    const current = () => live.current.sourceId === sourceId && live.current.dataSource === dataSource;
    for (const table of tables) {
      if (details[table] !== undefined) continue;
      setDetails((previous) => ({ ...previous, [table]: "loading" }));
      dataSource
        .describeTable({ sourceId, ref: { table } })
        .then((response) => {
          if (!current()) return;
          setDetails((previous) => ({ ...previous, [table]: response.table?.columns ?? [] }));
          setAbout((previous) => ({ ...previous, [table]: { comment: response.table?.summary?.comment ?? "", foreignKeys: response.table?.foreignKeys ?? [] } }));
        })
        .catch((error: unknown) => current() && setDetails((previous) => ({ ...previous, [table]: { error: messageOf(error) } })));
      if (!discovery) continue;
      const ref = { sourceId, kind: ObjectKind.TABLE, table };
      discovery
        .getObject({ ref })
        .then((response) => {
          const mark = response.profile?.object?.certification;
          if (current() && mark) setMarks((previous) => ({ ...previous, [table]: mark }));
        })
        .catch(() => {});
    }
  }, [tables, dataSource, discovery, sourceId, retries]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!discovery || !suggestJoins) return;
    let current = true;
    for (const table of tables) {
      discovery
        .getRelated({ ref: { sourceId, kind: ObjectKind.TABLE, table }, kinds: [RelationKind.JOIN] })
        .then((response) => {
          if (!current) return;
          const found: ModelJoin[] = [];
          for (const relation of response.relations) {
            const other = relation.object?.ref?.table;
            if (!other || !tables.some((t) => same(t, other)) || relation.keys.length === 0) continue;
            const join: ModelJoin = { left: table, right: other, keys: relation.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn })), inferred: relation.inferred };
            // A suggestion is offered once; removing it does not bring it back.
            if (considered.current.has(joinId(join))) continue;
            considered.current.add(joinId(join));
            found.push(join);
          }
          if (found.length > 0) setJoins((previous) => [...previous, ...found.filter((j) => !previous.some((p) => joinId(p) === joinId(j))).map((j) => orient(j, { tables, joins: previous }))]);
        })
        .catch(() => {});
    }
    return () => {
      current = false;
    };
  }, [tables, discovery, sourceId, suggestJoins]);

  // Foreign keys a table declares become joins once both tables are on the diagram.
  // They are facts from the backend, not guesses, so they are not marked "Inferred".
  useEffect(() => {
    const found: ModelJoin[] = [];
    for (const table of tables) {
      for (const fk of about[table]?.foreignKeys ?? []) {
        const other = tables.find((t) => same(t, fk.references?.table ?? ""));
        if (!other || fk.columns.length === 0) continue;
        const join: ModelJoin = { left: table, right: other, keys: fk.columns.map((c, i) => ({ leftColumn: c, rightColumn: fk.referencedColumns[i] ?? c })), declared: true };
        if (considered.current.has(joinId(join))) continue;
        considered.current.add(joinId(join));
        found.push(join);
      }
    }
    if (found.length === 0) return;
    setJoins((previous) => {
      // A declared key settles a guess about the same columns.
      const kept = previous.map((p) => {
        const match = found.find((f) => joinId(f) === joinId(p));
        return match ? { ...p, inferred: false, declared: true } : p;
      });
      return [...kept, ...found.filter((f) => !previous.some((p) => joinId(p) === joinId(f))).map((f) => orient(f, { tables, joins: kept }))];
    });
  }, [tables, about]); // eslint-disable-line react-hooks/exhaustive-deps

  // Table search runs in the backend, so it works on catalogs too large to list.
  useEffect(() => {
    const text = search.trim();
    if (!text) return setMatches([]);
    let current = true;
    const timer = setTimeout(() => {
      dataSource
        .listTables({ sourceId, search: text, pageSize: 8 })
        .then((response) => current && setMatches(response.tables.map((t) => t.ref?.table ?? "").filter((name) => name && !tables.some((t) => same(t, name)))))
        .catch((error: unknown) => {
          if (!current) return;
          setMatches([]);
          setProblem(`Could not search for tables: ${messageOf(error)}`);
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [search, dataSource, sourceId, tables]);

  const positionOf = (table: string): Point => positions[table] ?? layout?.[table] ?? slot(tables.findIndex((t) => t === table));
  const columnsOf = (table: string): Column[] => (Array.isArray(details[table]) ? (details[table] as Column[]) : []);
  const visibleColumns = (table: string) => (expanded.has(table) ? columnsOf(table) : columnsOf(table).slice(0, MAX_ROWS));
  const cardHeight = (table: string) => {
    const all = columnsOf(table).length;
    const shown = visibleColumns(table).length;
    return HEAD_HEIGHT + Math.max(1, shown + (all > MAX_ROWS ? 1 : 0)) * ROW_HEIGHT + 6;
  };

  const addTable = (name: string, at?: Point) => {
    if (!name || tables.some((t) => same(t, name))) return;
    if (at) setPositions((previous) => ({ ...previous, [name]: at }));
    setTables((previous) => [...previous, name]);
    setStatus(`Added ${name}.`);
    setSearch("");
  };
  const removeTable = (name: string) => {
    setTables((previous) => previous.filter((t) => t !== name));
    setJoins((previous) => previous.filter((j) => !same(j.left, name) && !same(j.right, name)));
    setStatus(`Removed ${name}.`);
  };
  const knownColumns = (table: string) => (Array.isArray(details[table]) ? (details[table] as Column[]) : undefined);
  const check = (join: ModelJoin) => checkJoin(join, knownColumns);
  const refuse = (reason: string) => {
    setProblem(`Not joined. ${reason}`);
    setStatus("");
  };
  const removeKey = (join: ModelJoin, key: ModelJoinKey) => {
    setJoins((previous) =>
      previous.flatMap((j) => {
        if (joinId(j) !== joinId(join)) return [j];
        const keys = j.keys.filter((k) => !(same(k.leftColumn, key.leftColumn) && same(k.rightColumn, key.rightColumn)));
        return keys.length > 0 ? [{ ...j, keys }] : [];
      }),
    );
    setProblem("");
    setStatus(`Removed ${joinText({ ...join, keys: [key] })}.`);
  };
  const addJoin = (join: ModelJoin) => {
    const result = check(join);
    if (!result.ok) return refuse(result.reason);
    const isNew = !joins.some((j) => joinId(j) === joinId(join));
    // A second route between two tables is allowed, but it narrows the result, so say so.
    const loop = isNew && connected(joins.filter(present).filter((j) => joinId({ ...j, keys: [] }) !== joinId({ ...join, keys: [] })), join.left, join.right);
    setProblem("");
    considered.current.add(joinId(join));
    setJoins((previous) => {
      const existing = previous.findIndex((j) => joinId(j) === joinId(join));
      // Drawing a join that was only suggested confirms it.
      if (existing >= 0) return previous.map((j, i) => (i === existing ? { ...j, inferred: false } : j));
      return [...previous, orient(join, { tables, joins: previous })];
    });
    setStatus(`Joined ${joinText(join)}.${loop ? ` ${join.left} and ${join.right} were already connected another way, so rows must now match on both routes.` : ""}`);
  };
  /** Set which rows a join keeps, `read` being the join as the person saw it (its left side first). */
  const setKind = (join: ModelJoin, read: ModelJoin, kind: JoinKind) => {
    setJoins((previous) => previous.map((j) => (joinId(j) === joinId(join) ? { ...read, type: kind } : j)));
    setStatus(`${joinText(read)} now keeps ${kindText(read, kind).toLowerCase()}.`);
  };
  /** Make another table the one whose rows the result's rows are. Joins that kept every row of their nearer side go on doing so from the new first table. */
  const makeBase = (table: string) => {
    const nextTables = [table, ...tables.filter((t) => !same(t, table))];
    setJoins((previous) =>
      previous.map((j) => {
        const kept = joinFrom(j, nearOf(j, { tables, joins: previous })).type === "left";
        return kept ? { ...joinFrom(j, nearOf(j, { tables: nextTables, joins: previous })), type: "left" as const } : j;
      }),
    );
    setTables(nextTables);
    setStatus(`The rows now come from ${table}: one row of the result is one ${table} row.`);
  };
  const countKey = (join: ModelJoin, far: string) => `${joinId(join)}>${lower(far)}`;
  /** Ask the engine how many rows of the far table share one key: one grouped count, no values back. */
  const checkRows = (join: ModelJoin, near: string) => {
    const read = joinFrom(join, near);
    const key = countKey(join, read.right);
    setCounts((previous) => ({ ...previous, [key]: "checking" }));
    mostRowsPerKey(dataSource, { sourceId, sql: `SELECT * FROM ${quoteTable(read.right)}`, columns: read.keys.map((k) => k.rightColumn) })
      .then((most) => {
        setCounts((previous) => ({ ...previous, [key]: most }));
        setStatus(most > 1 ? `Up to ${most} ${read.right} rows share one ${read.keys.map((k) => k.rightColumn).join(" and ")}, so this join can repeat ${read.left} rows.` : `Each ${read.left} row finds at most one ${read.right} row.`);
      })
      .catch((error: unknown) => setCounts((previous) => ({ ...previous, [key]: { error: messageOf(error) } })));
  };

  const present = (join: ModelJoin) => tables.some((t) => same(t, join.left)) && tables.some((t) => same(t, join.right));
  // With rowsFrom the first table stands at the left and each table sits one column further out than the table it adds detail to.
  const layout = rowsFrom
    ? (() => {
        const depths = joinDepths(tables, joins);
        const next = new Map<number, number>();
        const out: Record<string, Point> = {};
        for (const table of tables) {
          const depth = depths.get(table) ?? 0;
          const y = next.get(depth) ?? 16;
          out[table] = { x: 16 + depth * (CARD_WIDTH + GAP * 2), y };
          next.set(depth, y + cardHeight(table) + 24);
        }
        return out;
      })()
    : undefined;
  // The drawing's extent on the plane, which fit to view frames.
  const extent = {
    width: tables.length === 0 ? 0 : Math.max(...tables.map((t) => positionOf(t).x + CARD_WIDTH)) + 16,
    height: tables.length === 0 ? 0 : Math.max(...tables.map((t) => positionOf(t).y + cardHeight(t))) + 16,
  };
  const panZoom = usePanZoom({ content: extent });
  const setViewport = panZoom.viewportRef;
  const canvasRef = useCallback(
    (element: HTMLDivElement | null) => {
      canvas.current = element;
      setViewport(element);
    },
    [setViewport],
  );
  // A pointer on the plane, whatever the pan and zoom.
  const canvasPoint = (event: { clientX: number; clientY: number }): Point => panZoom.pointToWorld(event);

  const startMove = (table: string) => (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const point = canvasPoint(event);
    const at = positionOf(table);
    moving.current = { table, dx: point.x - at.x, dy: point.y - at.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const startLink = (table: string, column: string) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    setLink({ table, column, to: canvasPoint(event) });
    canvas.current?.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const point = canvasPoint(event);
    const move = moving.current;
    if (move) setPositions((previous) => ({ ...previous, [move.table]: { x: Math.max(0, point.x - move.dx), y: Math.max(0, point.y - move.dy) } }));
    else if (link) setLink({ ...link, to: point });
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    moving.current = undefined;
    if (!link) return;
    canvas.current?.releasePointerCapture?.(event.pointerId);
    const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>("[data-model-column]");
    const table = target?.dataset.modelTable;
    const column = target?.dataset.modelColumn;
    if (table && column) addJoin({ left: link.table, right: table, keys: [{ leftColumn: link.column, rightColumn: column }] });
    else setStatus("Drop the column on a column of another table to join them.");
    setLink(undefined);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    const raw = event.dataTransfer.getData(SCHEMA_REF_MIME);
    if (!raw) return;
    event.preventDefault();
    try {
      const ref = JSON.parse(raw) as SchemaRef;
      const point = canvasPoint(event);
      addTable(ref.table, { x: Math.max(0, point.x - CARD_WIDTH / 2), y: Math.max(0, point.y - HEAD_HEIGHT / 2) });
    } catch {
      // Not one of ours.
    }
  };

  /** Where a join line meets a table: beside the column's row, on the side facing the other table. */
  const anchor = (table: string, column: string, other: string): Point => {
    const at = positionOf(table);
    const index = visibleColumns(table).findIndex((c) => same(c.name, column));
    const row = index >= 0 ? index : visibleColumns(table).length;
    const facingRight = positionOf(other).x + CARD_WIDTH / 2 >= at.x + CARD_WIDTH / 2;
    return { x: at.x + (facingRight ? CARD_WIDTH : 0), y: at.y + HEAD_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2 };
  };
  const curve = (from: Point, to: Point) => {
    const bend = Math.max(40, Math.abs(to.x - from.x) / 2);
    const direction = to.x >= from.x ? 1 : -1;
    return `M ${from.x} ${from.y} C ${from.x + bend * direction} ${from.y}, ${to.x - bend * direction} ${to.y}, ${to.x} ${to.y}`;
  };

  const width = Math.max(extent.width + 16, 320);
  const depth = Math.max(extent.height + 16, 120);
  const shown = joins.filter(present);
  const broken = new Map(shown.flatMap((j) => { const r = check(j); return r.ok ? [] : [[joinId(j), r.reason] as const]; }));
  const unreadable = tables.filter((t) => typeof details[t] === "object" && !Array.isArray(details[t]));
  // SQL is built only from joins that can work, over tables that could be read.
  // With rowsFrom a guess no one confirmed stays out of the query too.
  const generated = modelSql(
    { tables: tables.filter((t) => !unreadable.includes(t)), joins: shown.filter((j) => !broken.has(joinId(j)) && !(rowsFrom && j.inferred)) },
    (t) => (Array.isArray(details[t]) ? (details[t] as Column[]).map((c) => c.name) : undefined),
  );
  // Report the tables and joins, and the query again once the columns are read and it can name them.
  const reported = useRef({ model, sql: generated.sql });
  useEffect(() => {
    if (reported.current.model === model && reported.current.sql === generated.sql) return;
    reported.current = { model, sql: generated.sql };
    onChange.current?.(model, generated);
  });
  const outputName = new Map((generated.columns ?? []).map((c) => [lower(`${c.table}.${c.column}`), c.name]));
  const used = props.usedColumns ? new Set(props.usedColumns.map(lower)) : undefined;
  const base = tables[0] ?? "";
  /** What a join does to the rows, read from its nearer side: its shape (from the tables' keys, or the engine's count) and what its kind keeps. */
  const effectOf = (join: ModelJoin) => {
    const near = rowsFrom ? nearOf(join) : join.left;
    const read = joinFrom(join, near);
    const far = read.right;
    const counted = counts[countKey(join, far)];
    const shape: JoinShape | "checking" = typeof counted === "number" ? (counted > 1 ? "many" : "one") : counted === "checking" ? "checking" : joinShape(join, near, knownColumns, (t) => about[t]?.foreignKeys);
    const shapeText =
      shape === "one"
        ? `One ${far} row for each ${near} row${typeof counted === "number" ? ", checked by the engine" : ""}.`
        : shape === "many"
          ? typeof counted === "number"
            ? `Can repeat ${near} rows: up to ${counted} ${far} rows share one ${read.keys.map((k) => k.rightColumn).join(" and ")}.`
            : `Can repeat ${near} rows: ${far} has a key this join does not use, so more than one row may match.`
          : shape === "checking"
            ? `Counting ${far} rows per key…`
            : `Not known whether ${far} has more than one row per ${near} row.`;
    const kind = read.type ?? "inner";
    const kindNote =
      kind === "inner"
        ? `${near} rows with no ${far} row are dropped.`
        : kind === "right" || kind === "full"
          ? `Adds ${far} rows that match no ${near} row${rowsFrom ? `, so not every row is a ${base} row` : ""}.`
          : "";
    const error = typeof counted === "object" ? counted.error : "";
    return { near, far, read, shape, shapeText, kind, kindNote, error, chip: shape === "one" ? "1 per row" : shape === "many" ? "▲ can repeat" : shape === "checking" ? "Counting…" : "? not known" };
  };
  // The one on the canvas is for a pointer; the keyboard reaches the same choice in the list beneath, once.
  const kindSelect = (join: ModelJoin, read: ModelJoin, className: string, onCanvas = false) => (
    <select
      className={className}
      tabIndex={onCanvas ? -1 : undefined}
      value={read.type ?? "inner"}
      aria-label={`Rows kept by ${joinText(read)}${onCanvas ? ", on the diagram" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(e) => setKind(join, read, e.target.value as JoinKind)}
    >
      {JOIN_KINDS.map((k) => (
        <option key={k} value={k}>
          {kindText(read, k)}
        </option>
      ))}
    </select>
  );
  // The form offers only columns that could match the one already chosen.
  const draftFamily = draft.left && draft.leftColumn ? typeFamily(columnsOf(draft.left).find((c) => c.name === draft.leftColumn) ?? { nativeType: "", arrowType: "" }) : "unknown";
  const joinable = (table: string, against: TypeFamily) =>
    columnsOf(table)
      .filter((c) => { const f = typeFamily(c); return f !== "nested" && f !== "binary" && (against === "unknown" || f === "unknown" || f === against); })
      .map((c) => c.name);
  const referenceOf = (table: string, column: string) => {
    const fk = about[table]?.foreignKeys.find((f) => f.columns.some((c) => same(c, column)));
    if (!fk) return undefined;
    const at = fk.columns.findIndex((c) => same(c, column));
    return `${fk.references?.table}.${fk.referencedColumns[at] ?? column}`;
  };
  const keyColumns = new Set(joins.flatMap((j) => j.keys.flatMap((k) => [lower(`${j.left}.${k.leftColumn}`), lower(`${j.right}.${k.rightColumn}`)])));
  const pick = (label: string, value: string, options: string[], change: (value: string) => void) => (
    <label>
      <span>{label}</span>
      <select className="sf-input" value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={["sf-model", props.className].filter(Boolean).join(" ")}>
      <div className="sf-model-bar">
        <input
          className="sf-input"
          type="search"
          placeholder="Add a table"
          aria-label="Add a table"
          aria-controls={`${id}-matches`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span id={`${id}-matches`} className="sf-model-matches">
          {matches.map((name) => (
            <button key={name} type="button" className="sf-button" onClick={() => addTable(name)}>
              Add {name}
            </button>
          ))}
        </span>
        {props.onUseSql && (
          <button type="button" className="sf-button" data-variant="primary" disabled={generated.sql === ""} onClick={() => props.onUseSql?.(generated.sql, model)}>
            Use as query
          </button>
        )}
      </div>

      {tables.length > 0 && <PanZoomControls panZoom={panZoom} label="Zoom the data model" />}
      <div
        ref={canvasRef}
        className="sf-model-canvas sf-panzoom"
        style={{ height }}
        role="group"
        aria-label={props.label ?? "Data model"}
        aria-describedby={`${id}-keys`}
        data-linking={link ? "" : undefined}
        {...panZoom.viewportProps}
        onPointerMove={(event) => {
          onPointerMove(event);
          panZoom.viewportProps.onPointerMove(event);
        }}
        onPointerUp={(event) => {
          onPointerUp(event);
          panZoom.viewportProps.onPointerUp(event);
        }}
        onPointerCancel={(event) => {
          onPointerUp(event);
          panZoom.viewportProps.onPointerCancel(event);
        }}
        onDragOver={(event) => event.dataTransfer.types.includes(SCHEMA_REF_MIME) && event.preventDefault()}
        onDrop={onDrop}
      >
        <span id={`${id}-keys`} className="sf-a2-visually-hidden">
          Drag the background or scroll to move around. Plus and minus zoom, 0 fits the diagram to view, arrow keys move it.
        </span>
        <div className="sf-model-plane sf-panzoom-plane" style={{ width, height: depth, ...panZoom.planeStyle }} data-animate={panZoom.animate || undefined}>
          <svg className="sf-model-lines" width={width} height={depth} aria-hidden="true">
            {joins.filter(present).flatMap((join) =>
              join.keys.map((k) => (
                <path
                  key={`${joinId(join)}:${k.leftColumn}:${k.rightColumn}`}
                  d={curve(anchor(join.left, k.leftColumn, join.right), anchor(join.right, k.rightColumn, join.left))}
                  data-inferred={join.inferred || undefined}
                  data-broken={broken.has(joinId(join)) || undefined}
                  data-fanout={(rowsFrom && effectOf(join).shape === "many") || undefined}
                />
              )),
            )}
            {link && <path d={curve(anchor(link.table, link.column, link.table), link.to)} data-drawing="" />}
          </svg>
          {tables.map((table) => {
            const at = positionOf(table);
            const detail = details[table];
            const all = columnsOf(table);
            const isBase = rowsFrom && table === base;
            const inQuery = generated.order.some((t) => same(t, table));
            const usedHere = used ? all.filter((c) => used.has(lower(outputName.get(lower(`${table}.${c.name}`)) ?? c.name))).length : 0;
            return (
              <section
                key={table}
                className="sf-model-card"
                data-pan-ignore=""
                data-base={isBase || undefined}
                data-outside={(rowsFrom && !inQuery) || undefined}
                style={{ left: at.x, top: at.y, width: CARD_WIDTH }}
                aria-label={`Table ${table}${isBase ? ", where the rows come from" : ""}`}
              >
                <header className="sf-model-head" style={{ height: HEAD_HEIGHT }} onPointerDown={startMove(table)}>
                  <span className="sf-model-name" title={about[table]?.comment || undefined}>
                    {table}
                    {about[table]?.comment && <span className="sf-a2-visually-hidden">. {about[table]!.comment}</span>}
                  </span>
                  {isBase && (
                    <span className="sf-schema-tag" title="One row of the result is one row of this table">
                      Rows
                    </span>
                  )}
                  {used && Array.isArray(detail) && (
                    <span className="sf-model-used" title={`${usedHere} of ${all.length} columns are used by a field`}>
                      {usedHere}/{all.length}
                      <span className="sf-a2-visually-hidden"> columns used</span>
                    </span>
                  )}
                  <CertificationBadge certification={marks[table]} />
                  <button type="button" className="sf-model-remove" aria-label={`Remove ${table} from the diagram`} onClick={() => removeTable(table)}>
                    <ControlIcon icon="close" />
                  </button>
                </header>
                {detail === undefined || detail === "loading" ? (
                  <p className="sf-model-note" style={{ height: ROW_HEIGHT }}>
                    Loading…
                  </p>
                ) : !Array.isArray(detail) ? (
                  <p className="sf-model-note" role="alert">
                    Could not read this table: {detail.error}{" "}
                    <button
                      type="button"
                      className="sf-button"
                      onClick={() => {
                        setDetails((previous) => Object.fromEntries(Object.entries(previous).filter(([name]) => name !== table)));
                        setRetries((n) => n + 1);
                      }}
                    >
                      Try again
                    </button>
                  </p>
                ) : (
                  <ul className="sf-model-columns">
                    {visibleColumns(table).map((column) => {
                      const refers = referenceOf(table, column.name);
                      const facts = [
                        column.primaryKey && "primary key",
                        refers && `refers to ${refers}`,
                        column.partitionKey && "partition key",
                        !column.nullable && !column.primaryKey && "never empty",
                      ].filter(Boolean) as string[];
                      const named = outputName.get(lower(`${table}.${column.name}`));
                      const renamed = rowsFrom && named !== undefined && named !== column.name;
                      return (
                        <li
                          key={column.name}
                          style={{ height: ROW_HEIGHT }}
                          data-model-table={table}
                          data-model-column={column.name}
                          data-key={keyColumns.has(lower(`${table}.${column.name}`)) || undefined}
                          data-unused={(used && !used.has(lower(named ?? column.name))) || undefined}
                          title={[`${column.name} ${column.nativeType.toLowerCase()}${facts.length ? ` · ${facts.join(" · ")}` : ""}`, column.comment, "Drag onto a column of another table to join"].filter(Boolean).join("\n")}
                          onPointerDown={startLink(table, column.name)}
                        >
                          <span className="sf-model-keys" aria-hidden="true">
                            {column.primaryKey && <abbr className="sf-model-key" data-kind="pk">PK</abbr>}
                            {refers && <abbr className="sf-model-key" data-kind="fk">FK</abbr>}
                          </span>
                          <span className="sf-model-column">{column.name}</span>
                          <span className="sf-model-type">{renamed ? <span className="sf-model-as">as {named}</span> : column.nativeType.toLowerCase()}</span>
                          {renamed && <span className="sf-a2-visually-hidden">, named {named} in the result because an earlier table has a column of this name</span>}
                          {(facts.length > 0 || column.comment) && <span className="sf-a2-visually-hidden">{[...facts, column.comment].filter(Boolean).join(". ")}</span>}
                        </li>
                      );
                    })}
                    {all.length > MAX_ROWS && (
                      <li style={{ height: ROW_HEIGHT }}>
                        <button
                          type="button"
                          className="sf-model-more"
                          onClick={() =>
                            setExpanded((previous) => {
                              const next = new Set(previous);
                              if (next.has(table)) next.delete(table);
                              else next.add(table);
                              return next;
                            })
                          }
                        >
                          {expanded.has(table) ? "Show fewer" : `${all.length - MAX_ROWS} more columns`}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}
          {shown.flatMap((join) =>
            join.keys.map((k) => {
              const from = anchor(join.left, k.leftColumn, join.right);
              const to = anchor(join.right, k.rightColumn, join.left);
              return (
                <button
                  key={`cut:${joinId(join)}:${k.leftColumn}:${k.rightColumn}`}
                  type="button"
                  className="sf-model-cut"
                  style={{ left: (from.x + to.x) / 2, top: (from.y + to.y) / 2 }}
                  aria-label={`Remove the line ${joinText({ ...join, keys: [k] })}`}
                  title="Remove this join"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => removeKey(join, k)}
                >
                  <ControlIcon icon="close" />
                </button>
              );
            }),
          )}
          {shown.map((join) => {
            const k = join.keys[0];
            if (!k || broken.has(joinId(join))) return null;
            const from = anchor(join.left, k.leftColumn, join.right);
            const to = anchor(join.right, k.rightColumn, join.left);
            const effect = effectOf(join);
            return (
              <div
                key={`box:${joinId(join)}`}
                className="sf-model-joinbox"
                data-pan-ignore=""
                data-shape={rowsFrom ? effect.shape : undefined}
                style={{ left: (from.x + to.x) / 2, top: (from.y + to.y) / 2 }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {kindSelect(join, effect.read, "sf-model-kind", true)}
                {rowsFrom && (
                  <span className="sf-model-shape" title={`${effect.shapeText} ${effect.kindNote}`.trim()}>
                    {effect.chip}
                  </span>
                )}
              </div>
            );
          })}
          {tables.length === 0 && <p className="sf-model-empty">Add a table above, or drag one here from the browser.</p>}
        </div>
      </div>
      {tables.length > 0 && (
        <p className="sf-model-legend">
          <abbr className="sf-model-key" data-kind="pk">PK</abbr> primary key <abbr className="sf-model-key" data-kind="fk">FK</abbr> refers to another table. Point at a
          column for its description.
        </p>
      )}

      <p className="sf-model-status" aria-live="polite">
        {status}
      </p>
      {problem && (
        <p className="sf-model-problem" role="alert">
          {problem}{" "}
          <button type="button" className="sf-button" onClick={() => setProblem("")}>
            Dismiss
          </button>
        </p>
      )}

      <section className="sf-model-joins" aria-label="Joins">
        {rowsFrom && tables.length > 1 && (
          <label className="sf-model-base">
            <span aria-hidden="true">Rows come from</span>
            <select className="sf-input" aria-label="Rows come from" value={base} onChange={(e) => makeBase(e.target.value)}>
              {tables.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="sf-object-muted">One row of the result is one {base} row; the other tables add detail to it.</span>
          </label>
        )}
        <h4 className="sf-object-label">Joins</h4>
        {joins.filter(present).length === 0 ? (
          <p className="sf-object-muted">None yet. Drag a column onto a column of another table, or add one below.</p>
        ) : (
          <ul>
            {joins.filter(present).map((join) => {
              const effect = effectOf(join);
              return (
              <li key={joinId(join)} data-shape={rowsFrom ? effect.shape : undefined}>
                <code>{joinText(effect.read)}</code>
                {join.inferred && <span className="sf-schema-tag">Inferred</span>}
                {join.declared && !join.inferred && <span className="sf-schema-tag">Declared</span>}
                {kindSelect(join, effect.read, "sf-input sf-model-kind-field")}
                {rowsFrom && !broken.has(joinId(join)) && (
                  <span className="sf-model-effect">
                    {effect.shape === "many" && <span aria-hidden="true">▲ </span>}
                    {effect.shapeText} {effect.kindNote}
                    {join.inferred && " Not in the query until confirmed."}
                    {effect.error && <span role="alert"> The engine could not count: {effect.error}</span>}
                  </span>
                )}
                {rowsFrom && !broken.has(joinId(join)) && effect.shape !== "checking" && (effect.shape === "unknown" || effect.shape === "many" || effect.error) && (
                  <button type="button" className="sf-button" onClick={() => checkRows(join, effect.near)}>
                    Check with the engine
                  </button>
                )}
                {broken.has(joinId(join)) && <span className="sf-model-broken">▲ Will not work, left out of the SQL. {broken.get(joinId(join))}</span>}
                {join.inferred && !broken.has(joinId(join)) && (
                  <button type="button" className="sf-button" onClick={() => addJoin(join)}>
                    Confirm
                  </button>
                )}
                <button
                  type="button"
                  className="sf-button"
                  aria-label={`Remove join ${joinText(join)}`}
                  onClick={() => {
                    setJoins((previous) => previous.filter((j) => joinId(j) !== joinId(join)));
                    setProblem("");
                    setStatus("Removed the join.");
                  }}
                >
                  Remove
                </button>
              </li>
              );
            })}
          </ul>
        )}
        {tables.length > 1 && (
          <form
            className="sf-model-add"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.left || !draft.leftColumn || !draft.right || !draft.rightColumn) return setStatus("Choose two tables and a column in each.");
              addJoin({ left: draft.left, right: draft.right, keys: [{ leftColumn: draft.leftColumn, rightColumn: draft.rightColumn }] });
              setDraft({ left: "", leftColumn: "", right: "", rightColumn: "" });
            }}
          >
            {pick("Table", draft.left, tables, (left) => setDraft({ ...draft, left, leftColumn: "" }))}
            {pick("Column", draft.leftColumn, joinable(draft.left, "unknown"), (leftColumn) => setDraft({ ...draft, leftColumn, rightColumn: "" }))}
            {pick("Joins table", draft.right, tables.filter((t) => t !== draft.left), (right) => setDraft({ ...draft, right, rightColumn: "" }))}
            {pick("On column", draft.rightColumn, joinable(draft.right, draftFamily), (rightColumn) => setDraft({ ...draft, rightColumn }))}
            <button type="submit" className="sf-button">
              Add join
            </button>
          </form>
        )}
      </section>

      {generated.sql && (
        <details className="sf-result-sql">
          <summary>SQL for this model</summary>
          <pre tabIndex={0}>{generated.sql}</pre>
          {generated.unjoined.length > 0 && <p className="sf-result-notice">Not joined to the rest, so left out: {generated.unjoined.join(", ")}.</p>}
          {unreadable.length > 0 && <p className="sf-result-notice">Could not be read, so left out: {unreadable.join(", ")}.</p>}
          {broken.size > 0 && <p className="sf-result-notice">{broken.size === 1 ? "One join" : `${broken.size} joins`} cannot work and {broken.size === 1 ? "is" : "are"} left out. See the list above.</p>}
        </details>
      )}
    </div>
  );
}
