import type { FilterSpec } from "../data/controls.js";
import { type ExploreChartSettings, type ExploreState, type Pill, normalizeExplore } from "./model.js";

/** One view on a report: what is on its shelves, drawn from the report's pills and filters. */
export interface ReportTile {
  id: string;
  /** Shown above the tile. Left out, the shelves are read out: "Refund rate by Category". */
  title?: string;
  rows: string[];
  split?: string;
  values: string[];
  view?: "chart" | "table";
  /** How its chart is drawn: type, axes swapped, each measure's own type and scale. */
  chart?: ExploreChartSettings;
  /** How many of the report's three columns it takes. Defaults to 1; headline numbers take the row. */
  span?: 1 | 2 | 3;
}

/**
 * A report: pills defined once, filters shared by every view, and the views
 * themselves as tiles. This is the whole of a dashboard as plain JSON, so
 * it can be saved, reviewed, sent to an agent and written by one.
 */
export interface ReportState {
  title?: string;
  /** The report's fields. Every tile and the builder use these, so a metric means the same thing everywhere on it. */
  fields: Pill[];
  /** Filters every tile follows. */
  filters: FilterSpec[];
  tiles: ReportTile[];
  /** What is on the builder's shelves: the tile being made, or the one being changed. */
  draft?: Pick<ReportTile, "rows" | "split" | "values" | "view" | "chart">;
  /** The tile the draft will replace, when one is being changed. */
  editing?: string;
}

export const emptyReport: ReportState = { fields: [], filters: [], tiles: [] };
export const MAX_TILES = 24;

/** A tile's shelves as an explorer state over the report's pills and filters. */
export function tileState(report: ReportState, tile: Pick<ReportTile, "rows" | "split" | "values" | "view" | "chart">): ExploreState {
  return normalizeExplore({ fields: report.fields, rows: tile.rows, ...(tile.split ? { split: tile.split } : {}), values: tile.values, filters: report.filters, ...(tile.view ? { view: tile.view } : {}), ...(tile.chart ? { chart: tile.chart } : {}) });
}

/** The builder's own state: the draft over the report's pills and filters. */
export function draftState(report: ReportState): ExploreState {
  // Not normalised here: a draft can name pills that are generated only once the columns are known.
  const draft = report.draft ?? { rows: [], values: [] };
  return { fields: report.fields, rows: draft.rows, ...(draft.split ? { split: draft.split } : {}), values: draft.values, filters: report.filters, ...(draft.view ? { view: draft.view } : {}), ...(draft.chart ? { chart: draft.chart } : {}) };
}

/** The report after the builder changed: its pills and filters are the report's, the shelves are the draft. */
export function withDraft(report: ReportState, state: ExploreState): ReportState {
  return { ...report, fields: state.fields, filters: state.filters, draft: { rows: state.rows, ...(state.split ? { split: state.split } : {}), values: state.values, ...(state.view ? { view: state.view } : {}), ...(state.chart ? { chart: state.chart } : {}) } };
}

const nextId = (tiles: ReportTile[]) => {
  for (let n = tiles.length + 1; ; n++) if (!tiles.some((t) => t.id === `tile-${n}`)) return `tile-${n}`;
};

/**
 * Keeps the draft as a tile: a new one at the end, or in place of the tile
 * being changed. A draft with nothing to measure is not kept. The shelves
 * are left as they are, so the next tile starts from this one.
 */
export function keepDraft(report: ReportState, title?: string): ReportState {
  const draft = report.draft;
  const state = draft ? tileState(report, draft) : undefined;
  if (!draft || !state || state.values.length === 0) return report;
  const shelves = { rows: state.rows, ...(state.split ? { split: state.split } : {}), values: state.values, ...(draft.view ? { view: draft.view } : {}), chart: state.chart };
  if (report.editing && report.tiles.some((t) => t.id === report.editing)) {
    return { ...report, tiles: report.tiles.map((t) => (t.id === report.editing ? { ...t, ...shelves, ...(shelves.split ? {} : { split: undefined }), ...(title !== undefined ? { title: title || undefined } : {}) } : t)), editing: undefined };
  }
  if (report.tiles.length >= MAX_TILES) return report;
  // Headline numbers read best across the top of the row.
  const span = state.rows.length === 0 ? 3 : 1;
  const { chart, ...rest } = shelves;
  return { ...report, tiles: [...report.tiles, { id: nextId(report.tiles), ...(title ? { title } : {}), ...rest, ...(chart ? { chart } : {}), span }] };
}

/** Opens a tile in the builder, to change it. */
export function editTile(report: ReportState, id: string): ReportState {
  const tile = report.tiles.find((t) => t.id === id);
  if (!tile) return report;
  return { ...report, editing: id, draft: { rows: tile.rows, ...(tile.split ? { split: tile.split } : {}), values: tile.values, ...(tile.view ? { view: tile.view } : {}), ...(tile.chart ? { chart: tile.chart } : {}) } };
}

export function removeTile(report: ReportState, id: string): ReportState {
  return { ...report, tiles: report.tiles.filter((t) => t.id !== id), ...(report.editing === id ? { editing: undefined } : {}) };
}

/** Moves a tile one place earlier (-1) or later (1). At an end, nothing changes. */
export function moveTile(report: ReportState, id: string, by: -1 | 1): ReportState {
  const from = report.tiles.findIndex((t) => t.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= report.tiles.length) return report;
  const tiles = [...report.tiles];
  [tiles[from], tiles[to]] = [tiles[to]!, tiles[from]!];
  return { ...report, tiles };
}

export function setTile(report: ReportState, id: string, change: Partial<Pick<ReportTile, "title" | "span" | "view">>): ReportState {
  return { ...report, tiles: report.tiles.map((t) => (t.id === id ? { ...t, ...change } : t)) };
}

/**
 * A report with nothing that cannot be drawn: tiles that name pills that are
 * gone lose them, a tile left with nothing to measure is dropped, and ids
 * are made unlike each other. Whatever its source (a saved page, an agent),
 * a report goes through this before it is shown.
 */
export function normalizeReport(report: ReportState): ReportState {
  // Before the pills exist (they are generated once the columns are known) there is nothing to check tiles against.
  if (report.fields.length === 0) return report;
  const seen = new Set<string>();
  const tiles: ReportTile[] = [];
  for (const tile of report.tiles.slice(0, MAX_TILES)) {
    const state = tileState(report, tile);
    if (state.values.length === 0) continue;
    let id = tile.id || nextId(tiles);
    if (seen.has(id)) id = nextId(tiles);
    seen.add(id);
    const span = tile.span === 2 || tile.span === 3 ? tile.span : 1;
    tiles.push({ id, ...(tile.title ? { title: tile.title } : {}), rows: state.rows, ...(state.split ? { split: state.split } : {}), values: state.values, ...(tile.view ? { view: tile.view } : {}), ...(state.chart ? { chart: state.chart } : {}), span });
  }
  return { ...report, tiles, ...(report.editing && !tiles.some((t) => t.id === report.editing) ? { editing: undefined } : {}) };
}
