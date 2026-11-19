/**
 * Where a workspace's panels sit: columns from left to right, each a stack of
 * panels from top to bottom, with the share of the width each column takes
 * and the share of its column's height each panel takes. Plain data, so a
 * host can keep it, a person can change it by hand, and an agent can set it
 * ("search on the left, the map on the right" is `columns: [["search"], ["map"]]`).
 */
export interface WorkspaceLayout {
  /** Panel ids: `columns[column][row]`. */
  columns: string[][];
  /** One share per column, adding up to 1. Left out, columns are equal. */
  columnWidths?: number[];
  /** One share per panel of each column, each column adding up to 1. Left out, panels are equal. */
  rowHeights?: number[][];
  /** Panels that exist but are not shown. The rail brings them back. */
  hidden?: string[];
  /** Panels folded to their heading, so the others in their column have the room. */
  collapsed?: string[];
  /** Where each hidden panel was, so it comes back to the same place. `sole` says it had a column to itself. */
  places?: Record<string, { column: number; row: number; sole?: boolean }>;
}

/** A layout with every share filled in. */
export type FullLayout = Required<WorkspaceLayout>;

export const MAX_COLUMNS = 4;
export const MAX_ROWS = 4;
/** The smallest share a column or a panel can be resized to. */
export const MIN_SHARE = 0.12;
/** How many panels of one column are open at once before the rest fold to their headings. */
export const MAX_OPEN_ROWS = 2;

const equal = (n: number) => Array.from({ length: n }, () => 1 / n);

/** Shares clamped to the minimum and scaled to add up to 1; equal when the count is wrong or a value is not a number. */
function shares(given: number[] | undefined, count: number): number[] {
  if (count === 0) return [];
  if (!given || given.length !== count || given.some((v) => typeof v !== "number" || !Number.isFinite(v) || v <= 0)) return equal(count);
  const clamped = given.map((v) => Math.max(MIN_SHARE, v));
  const sum = clamped.reduce((a, b) => a + b, 0);
  return clamped.map((v) => v / sum);
}

/**
 * A layout that can be drawn. Unknown and repeated ids are dropped; a panel
 * the layout does not place is added to the last column (or a new one when
 * that is full); empty columns go; columns and rows past the limits are
 * folded into the last one allowed; shares are filled in. With `ids`, the
 * layout is checked against the panels that exist. Safe to call on anything,
 * including a layout from an agent or from storage.
 */
export function normalizeLayout(layout: Partial<WorkspaceLayout> | undefined, ids?: string[]): FullLayout {
  const known = ids ? new Set(ids) : undefined;
  const hidden = [...new Set((Array.isArray(layout?.hidden) ? layout.hidden : []).filter((id): id is string => typeof id === "string" && (!known || known.has(id))))];
  const seen = new Set(hidden);
  const given = Array.isArray(layout?.columns) ? layout.columns : [];
  const heightsOf = new Map<string, number>();
  given.forEach((column, c) => {
    if (Array.isArray(column)) column.forEach((id, r) => heightsOf.set(String(id), layout?.rowHeights?.[c]?.[r] ?? Number.NaN));
  });
  let columns: string[][] = [];
  const widths: number[] = [];
  given.forEach((column, c) => {
    if (!Array.isArray(column)) return;
    const kept: string[] = [];
    for (const id of column) {
      if (typeof id !== "string" || seen.has(id) || (known && !known.has(id))) continue;
      seen.add(id);
      kept.push(id);
    }
    if (kept.length === 0) return;
    columns.push(kept);
    widths.push(layout?.columnWidths?.[c] ?? Number.NaN);
  });
  let reshaped = columns.length !== given.length;
  // Panels that exist but were not placed.
  for (const id of ids ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const last = columns[columns.length - 1];
    if (last && last.length < MAX_ROWS) last.push(id);
    else if (columns.length < MAX_COLUMNS) {
      columns.push([id]);
      reshaped = true;
    } else (last ?? (columns[0] = [])).push(id);
  }
  if (columns.length > MAX_COLUMNS) {
    columns = [...columns.slice(0, MAX_COLUMNS - 1), columns.slice(MAX_COLUMNS - 1).flat()];
    reshaped = true;
  }
  const placed = new Set(columns.flat());
  const places: FullLayout["places"] = {};
  for (const [id, place] of Object.entries(layout?.places && typeof layout.places === "object" ? layout.places : {})) {
    if (hidden.includes(id) && place && Number.isInteger(place.column) && Number.isInteger(place.row) && place.column >= 0 && place.row >= 0) places[id] = { column: place.column, row: place.row, ...(place.sole ? { sole: true } : {}) };
  }
  // A column always has a panel open: folding is for making room, not for emptying a column.
  let collapsed = [...new Set((Array.isArray(layout?.collapsed) ? layout.collapsed : []).filter((id): id is string => typeof id === "string" && placed.has(id)))];
  for (const column of columns) if (column.every((id) => collapsed.includes(id))) collapsed = collapsed.filter((id) => id !== column[0]);
  return {
    columns,
    columnWidths: shares(reshaped ? undefined : widths, columns.length),
    rowHeights: columns.map((column) => shares(column.map((id) => heightsOf.get(id) ?? Number.NaN), column.length)),
    hidden,
    collapsed,
    places,
  };
}

/**
 * Makes room in a panel's column for it: the panel is open, and if that puts
 * more than `MAX_OPEN_ROWS` open in the column, the others fold to their
 * headings, the ones nearest the top first.
 */
function settle(layout: FullLayout, id: string): FullLayout {
  const at = placeOf(layout, id);
  if (!at) return layout;
  const kept = layout.collapsed.filter((p) => p !== id);
  const open = layout.columns[at.column]!.filter((p) => !kept.includes(p));
  const folded = open.filter((p) => p !== id).slice(0, Math.max(0, open.length - MAX_OPEN_ROWS));
  return normalizeLayout({ ...layout, collapsed: [...kept, ...folded] });
}

/** Opens a folded panel. If its column then has too many open, the others fold. */
export function expandPanel(layout: WorkspaceLayout, id: string): FullLayout {
  return settle(normalizeLayout(layout), id);
}

/** Folds a panel to its heading. The only open panel of a column stays open. */
export function collapsePanel(layout: WorkspaceLayout, id: string): FullLayout {
  const full = normalizeLayout(layout);
  const at = placeOf(full, id);
  if (!at || full.collapsed.includes(id)) return full;
  if (full.columns[at.column]!.filter((p) => !full.collapsed.includes(p)).length <= 1) return full;
  return normalizeLayout({ ...full, collapsed: [...full.collapsed, id] });
}

/**
 * Widths for a layout that gained one column at `at`: the new column takes a
 * modest share and the others keep their proportions, so adding a panel does
 * not shrink a wide one to an equal slice.
 */
function widthsWithColumn(widths: number[], at: number): number[] {
  const share = Math.max(MIN_SHARE, Math.min(0.28, 1 / (widths.length + 1)));
  const next = widths.map((w) => w * (1 - share));
  next.splice(at, 0, share);
  return next;
}

/** Where a panel is, or undefined when it is hidden or unknown. */
export function placeOf(layout: WorkspaceLayout, id: string): { column: number; row: number } | undefined {
  for (let column = 0; column < layout.columns.length; column++) {
    const row = layout.columns[column]!.indexOf(id);
    if (row !== -1) return { column, row };
  }
  return undefined;
}

/** Moves a panel to a row of a column that exists. Dropping it where it already is changes nothing. */
export function movePanel(layout: WorkspaceLayout, id: string, toColumn: number, toRow: number): FullLayout {
  const full = normalizeLayout(layout);
  const from = placeOf(full, id);
  if (!from || toColumn < 0 || toColumn >= full.columns.length) return full;
  if (from.column === toColumn && (from.row === toRow || from.row === toRow - 1)) return full;
  if (from.column !== toColumn && full.columns[toColumn]!.length >= MAX_ROWS) return full;
  const columns = full.columns.map((column) => [...column]);
  columns[from.column]!.splice(from.row, 1);
  const row = from.column === toColumn && from.row < toRow ? toRow - 1 : toRow;
  columns[toColumn]!.splice(Math.max(0, Math.min(row, columns[toColumn]!.length)), 0, id);
  // A column the panel left empty goes, and with it that column's share of the width.
  return settle(normalizeLayout({ ...full, columns, rowHeights: undefined }), id);
}

/** Moves a panel into a new column of its own, placed before the column at `insertAt`. */
export function movePanelToNewColumn(layout: WorkspaceLayout, id: string, insertAt: number): FullLayout {
  const full = normalizeLayout(layout);
  const from = placeOf(full, id);
  if (!from) return full;
  const alone = full.columns[from.column]!.length === 1;
  // A panel already alone in its column only changes place among the columns.
  if (!alone && full.columns.length >= MAX_COLUMNS) return full;
  const columns = full.columns.map((column) => [...column]);
  columns[from.column]!.splice(from.row, 1);
  const kept = columns.filter((column) => column.length > 0);
  const at = alone && from.column < insertAt ? insertAt - 1 : insertAt;
  kept.splice(Math.max(0, Math.min(at, kept.length)), 0, [id]);
  // A panel that leaves a shared column for one of its own adds a column: the others keep their proportions.
  const where = Math.max(0, Math.min(at, kept.length - 1));
  return settle(normalizeLayout({ columns: kept, hidden: full.hidden, collapsed: full.collapsed, places: full.places, ...(alone ? {} : { columnWidths: widthsWithColumn(full.columnWidths, where) }) }), id);
}

/**
 * Moves a panel one step, for a keyboard or a menu: up or down within its
 * column, or left or right into the next column (a new column at the edge).
 */
export function shiftPanel(layout: WorkspaceLayout, id: string, direction: "left" | "right" | "up" | "down"): FullLayout {
  const full = normalizeLayout(layout);
  const from = placeOf(full, id);
  if (!from) return full;
  if (direction === "up") return from.row === 0 ? full : movePanel(full, id, from.column, from.row - 1);
  if (direction === "down") return from.row >= full.columns[from.column]!.length - 1 ? full : movePanel(full, id, from.column, from.row + 2);
  const next = from.column + (direction === "left" ? -1 : 1);
  if (next < 0) return full.columns[from.column]!.length > 1 ? movePanelToNewColumn(full, id, 0) : full;
  if (next >= full.columns.length) return full.columns[from.column]!.length > 1 ? movePanelToNewColumn(full, id, full.columns.length) : full;
  return movePanel(full, id, next, full.columns[next]!.length);
}

/** Takes a panel off the workspace, remembering where it was. The last panel showing stays. */
export function hidePanel(layout: WorkspaceLayout, id: string): FullLayout {
  const full = normalizeLayout(layout);
  const at = placeOf(full, id);
  if (!at || full.columns.flat().length <= 1) return full;
  return normalizeLayout({
    ...full,
    columns: full.columns.map((column) => column.filter((p) => p !== id)),
    hidden: [...full.hidden, id],
    places: { ...full.places, [id]: { ...at, ...(full.columns[at.column]!.length === 1 ? { sole: true } : {}) } },
    rowHeights: undefined,
  });
}

/**
 * Brings a hidden panel back. It returns to where it was: its own column
 * again if it had one, or its place in the column it shared. Otherwise it joins the last column while that holds fewer
 * than `MAX_OPEN_ROWS`, and takes a new column after that, so opening a third
 * and fourth panel does not squeeze them all into one column. With no room
 * for a column it joins the emptiest one, and that column's other panels fold.
 */
export function showPanel(layout: WorkspaceLayout, id: string): FullLayout {
  const full = normalizeLayout(layout);
  if (!full.hidden.includes(id)) return full;
  const hidden = full.hidden.filter((p) => p !== id);
  const { [id]: was, ...places } = full.places;
  const columns = full.columns.map((column) => [...column]);
  const base = { ...full, hidden, places, rowHeights: undefined };
  // It had a column to itself: it gets one again, in the same position.
  if (was?.sole && columns.length < MAX_COLUMNS) {
    const at = Math.min(was.column, columns.length);
    columns.splice(at, 0, [id]);
    return settle(normalizeLayout({ ...base, columns, columnWidths: widthsWithColumn(full.columnWidths, at) }), id);
  }
  const back = was && !was.sole ? columns[was.column] : undefined;
  if (back && back.length < MAX_ROWS) {
    back.splice(Math.min(was!.row, back.length), 0, id);
    return settle(normalizeLayout({ ...base, columns }), id);
  }
  const last = columns[columns.length - 1];
  if (last && last.length < MAX_OPEN_ROWS) {
    last.push(id);
    return settle(normalizeLayout({ ...base, columns }), id);
  }
  if (columns.length < MAX_COLUMNS) return settle(normalizeLayout({ ...base, columns: [...columns, [id]], columnWidths: widthsWithColumn(full.columnWidths, columns.length) }), id);
  const roomy = columns.filter((column) => column.length < MAX_ROWS).sort((a, b) => a.length - b.length)[0] ?? last ?? (columns[0] = []);
  roomy.push(id);
  return settle(normalizeLayout({ ...base, columns }), id);
}

/** Moves the line between two shares by `delta` (a share of the whole), keeping both at or above the minimum. */
function slide(values: number[], index: number, delta: number): number[] {
  const a = values[index];
  const b = values[index + 1];
  if (a === undefined || b === undefined) return values;
  const moved = Math.max(MIN_SHARE - a, Math.min(b - MIN_SHARE, delta));
  // Two shares that are both already at the minimum cannot move.
  if (a + b < MIN_SHARE * 2) return values;
  const next = [...values];
  next[index] = a + moved;
  next[index + 1] = b - moved;
  return next;
}

/** Moves the divider after column `index` by `delta`, a share of the workspace's width. */
export function resizeColumns(layout: WorkspaceLayout, index: number, delta: number): FullLayout {
  const full = normalizeLayout(layout);
  return { ...full, columnWidths: slide(full.columnWidths, index, delta) };
}

/** Moves the divider after row `index` of a column by `delta`, a share of the column's height. */
export function resizeRows(layout: WorkspaceLayout, column: number, index: number, delta: number): FullLayout {
  const full = normalizeLayout(layout);
  const heights = full.rowHeights[column];
  if (!heights) return full;
  return { ...full, rowHeights: full.rowHeights.map((row, c) => (c === column ? slide(heights, index, delta) : row)) };
}
