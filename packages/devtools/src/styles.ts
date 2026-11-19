/*
 * The dev tools' own styles, added to the page (and to a popped-out window)
 * as a <style> element when the tools are on, so a host adds no stylesheet
 * for them. Every colour, size and time is a --sf-* token.
 */

/** For the floating button and the dock: loaded with the widget. */
export const SHELL_CSS = `
.sf-devtools-button {
  position: fixed;
  right: var(--sf-space-3);
  bottom: var(--sf-space-3);
  z-index: 2147483000;
  display: inline-flex;
  align-items: center;
  gap: var(--sf-space-1);
  height: max(var(--sf-target-min), var(--sf-control-size));
  min-width: max(var(--sf-target-min), var(--sf-control-size));
  padding: 0 var(--sf-space-2);
  border: 1px solid var(--sf-glass-edge);
  border-radius: var(--sf-radius-full);
  background: var(--sf-glass-regular);
  -webkit-backdrop-filter: var(--sf-glass-filter);
  backdrop-filter: var(--sf-glass-filter);
  box-shadow: inset 0 1px 0 var(--sf-glass-highlight), var(--sf-glass-shadow);
  color: var(--sf-color-text);
  font: inherit;
  font-size: var(--sf-font-size-sm);
  font-weight: var(--sf-font-weight-medium);
  cursor: pointer;
  transition: transform var(--sf-press-time) var(--sf-press-ease);
}
.sf-devtools-button:active { transform: scale(var(--sf-press-scale)); }
.sf-devtools-button:focus-visible,
.sf-devtools-grip:focus-visible {
  outline: 2px solid var(--sf-color-focus);
  outline-offset: 2px;
}
.sf-devtools-button svg { width: 1.1em; height: 1.1em; }
.sf-devtools-count {
  padding: 0 var(--sf-space-1);
  border-radius: var(--sf-radius-full);
  background: var(--sf-color-danger);
  color: var(--sf-color-bg);
  font-size: var(--sf-font-size-xs);
  font-weight: var(--sf-font-weight-semibold);
  font-variant-numeric: tabular-nums;
}
.sf-devtools-inline { position: relative; min-height: 4rem; }
.sf-devtools-inline > .sf-devtools-button { position: absolute; }
.sf-devtools-dock {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  border: 1px solid var(--sf-glass-edge);
  background: var(--sf-color-bg-1, var(--sf-color-bg));
  color: var(--sf-color-text);
  box-shadow: var(--sf-glass-shadow);
  font-size: var(--sf-font-size-sm);
  animation: sf-fade var(--sf-duration) var(--sf-ease-out);
}
/* Focus is moved here when the tools open, so the next Tab is inside them; the frame itself is not a control. */
.sf-devtools-dock:focus { outline: none; }
.sf-devtools-dock[data-dock="bottom"] { left: 0; right: 0; bottom: 0; flex-direction: column; }
.sf-devtools-dock[data-dock="right"] { top: 0; right: 0; bottom: 0; flex-direction: row; max-width: 100vw; }
.sf-devtools-inline > .sf-devtools-dock { position: relative; inset: auto; flex-direction: column; margin-top: var(--sf-space-2); border-radius: var(--sf-radius); }
.sf-devtools-grip {
  flex: none;
  border: 0;
  padding: 0;
  background: var(--sf-color-divider);
  touch-action: none;
}
.sf-devtools-dock[data-dock="bottom"] > .sf-devtools-grip { height: var(--sf-space-1); cursor: ns-resize; }
.sf-devtools-dock[data-dock="right"] > .sf-devtools-grip { width: var(--sf-space-1); cursor: ew-resize; }
.sf-devtools-grip:hover { background: var(--sf-color-accent); }
.sf-devtools-host { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.sf-devtools-wait { padding: var(--sf-space-3); color: var(--sf-color-muted); }
/* Narrow screens: the dock is always along the bottom, full width. */
@media (max-width: 40rem) {
  /* One edge only on a narrow screen, so no control to change it. */
  .sf-devtools-icon.sf-devtools-dockside { display: none; }
  .sf-devtools-dock[data-dock="right"] { top: auto; left: 0; flex-direction: column; }
  .sf-devtools-dock[data-dock="right"] > .sf-devtools-grip { width: auto; height: var(--sf-space-1); cursor: ns-resize; }
}
@media (forced-colors: active) {
  .sf-devtools-button, .sf-devtools-dock { border-color: CanvasText; }
}
/* While a person is picking a component on the page. */
.sf-devtools-picking, .sf-devtools-picking * { cursor: crosshair !important; }
.sf-devtools-picking .sf-devtools-dock *, .sf-devtools-picking .sf-devtools-button { cursor: revert !important; }
/* Over the component picked in the panel, on the page. It never takes a press. */
.sf-devtools-inspect {
  position: fixed;
  top: 0;
  left: 0;
  /* Under the tools' own drawer and button. */
  z-index: 2147482999;
  pointer-events: none;
  box-sizing: border-box;
  outline: 2px solid var(--sf-color-focus);
  outline-offset: 1px;
  border-radius: var(--sf-radius-sm);
}
.sf-devtools-inspect::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--sf-color-accent); opacity: 0.14; }
@media (forced-colors: active) {
  .sf-devtools-inspect { outline-color: Highlight; }
  .sf-devtools-inspect::before { display: none; }
}
`;

/** For the panel: loaded with it, only when the tools are opened. */
export const PANEL_CSS = `
.sf-devtools {
  flex: 1;
  min-height: 0;
  min-width: 0;
  /* A column, not grid rows: the note between the bar and the body is absent when it is empty, and the body must still take what is left. */
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  container-name: sf-devtools;
  background: var(--sf-color-bg-1, var(--sf-color-bg));
  color: var(--sf-color-text);
  font-size: var(--sf-font-size-sm);
}
.sf-devtools-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sf-space-2);
  padding: var(--sf-space-1) var(--sf-space-2);
  border-bottom: 1px solid var(--sf-color-divider);
}
.sf-devtools-title { margin: 0; font-size: var(--sf-font-size-sm); font-weight: var(--sf-font-weight-semibold); }
.sf-devtools-scrub { flex: 1 1 16rem; display: flex; align-items: center; gap: var(--sf-space-1); min-width: 0; }
.sf-devtools-scrub input[type="range"] { flex: 1; min-width: 4rem; accent-color: var(--sf-color-accent); height: var(--sf-target-min); }
.sf-devtools-step { min-width: 0; color: var(--sf-color-muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sf-devtools-actions { display: flex; align-items: center; gap: var(--sf-space-1); margin-left: auto; }
.sf-devtools-icon {
  display: inline-grid;
  place-items: center;
  width: max(var(--sf-target-min), var(--sf-control-size));
  height: max(var(--sf-target-min), var(--sf-control-size));
  padding: 0;
  border: 1px solid var(--sf-color-edge, transparent);
  border-radius: var(--sf-radius);
  background: var(--sf-color-fill-2);
  color: var(--sf-color-text);
  cursor: pointer;
  transition: background-color var(--sf-duration-fast) var(--sf-ease), transform var(--sf-press-time) var(--sf-press-ease);
}
.sf-devtools-icon:hover:not([aria-disabled="true"]) { background: var(--sf-color-fill-1); }
.sf-devtools-icon:active:not([aria-disabled="true"]) { transform: scale(var(--sf-press-scale)); }
.sf-devtools-icon[aria-pressed="true"] { background: var(--sf-color-accent-soft); color: var(--sf-color-accent-text); }
.sf-devtools-icon[aria-disabled="true"] { color: var(--sf-color-label-4, var(--sf-color-muted)); cursor: default; }
.sf-devtools-icon[aria-pressed="true"] { background: var(--sf-color-accent-soft); color: var(--sf-color-accent-text); }
.sf-devtools-icon:focus-visible, .sf-devtools-rows:focus-visible, .sf-devtools-tree:focus-visible, .sf-devtools-chip:focus-visible, .sf-devtools-detail:focus-visible, .sf-devtools-preview:focus-visible {
  outline: 2px solid var(--sf-color-focus);
  outline-offset: -2px;
}
.sf-devtools-icon svg { width: 1.15em; height: 1.15em; }
.sf-devtools-note {
  margin: 0;
  padding: var(--sf-space-1) var(--sf-space-2);
  border-bottom: 1px solid var(--sf-color-divider);
  background: var(--sf-color-accent-soft);
  color: var(--sf-color-text);
}
.sf-devtools-note:empty { display: none; }
.sf-devtools-body { position: relative; flex: 1 1 0; min-height: 0; min-width: 0; overflow: auto; padding: var(--sf-space-2); }
.sf-devtools-workspace { height: 100%; }
.sf-devtools-pane { display: flex; flex-direction: column; gap: var(--sf-space-2); flex: 1 1 auto; min-height: 0; min-width: 0; }
.sf-devtools-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sf-space-1); }
.sf-devtools-chip {
  min-height: var(--sf-target-min);
  padding: 0 var(--sf-space-2);
  border: 1px solid var(--sf-color-edge, transparent);
  border-radius: var(--sf-radius-full);
  background: var(--sf-color-fill-3);
  color: var(--sf-color-muted);
  font: inherit;
  font-size: var(--sf-font-size-xs);
  cursor: pointer;
  transition: background-color var(--sf-duration-fast) var(--sf-ease);
}
.sf-devtools-chip[aria-pressed="true"] { background: var(--sf-color-accent-soft); color: var(--sf-color-accent-text); font-weight: var(--sf-font-weight-semibold); }
.sf-devtools-only { display: inline-flex; align-items: center; gap: var(--sf-space-1); align-self: flex-start; padding-inline-start: var(--sf-space-2); border-radius: var(--sf-radius-full); background: var(--sf-color-accent-soft); color: var(--sf-color-accent-text); font-size: var(--sf-font-size-xs); font-weight: var(--sf-font-weight-semibold); }
.sf-devtools-only code { font-family: var(--sf-font-mono); font-weight: var(--sf-font-weight-regular); }
.sf-devtools-causes { display: flex; flex-direction: column; gap: var(--sf-space-1); flex: none; }
.sf-devtools-cause { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; align-items: start; gap: var(--sf-space-2); }
.sf-devtools-cause small { color: var(--sf-color-muted); font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); overflow-wrap: anywhere; }
.sf-devtools-cause-mark { font-size: var(--sf-font-size-xs); font-weight: var(--sf-font-weight-semibold); color: var(--sf-color-muted); }
.sf-devtools-cause[data-severity="error"] .sf-devtools-cause-mark { color: var(--sf-color-danger); }
.sf-devtools-cause[data-severity="warning"] .sf-devtools-cause-mark { color: var(--sf-color-warning); }
.sf-devtools-cause-by { margin: 0; color: var(--sf-color-muted); font-size: var(--sf-font-size-xs); }
.sf-devtools-said { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
div.sf-devtools-said { display: flex; flex-direction: column; gap: var(--sf-space-2); white-space: normal; }
div.sf-devtools-said > p { margin: 0; white-space: pre-wrap; }
div.sf-devtools-said ul { margin: 0; padding-inline-start: var(--sf-space-4); display: flex; flex-direction: column; gap: var(--sf-space-1); font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); }
div.sf-devtools-said summary { padding-block: var(--sf-space-1); color: var(--sf-color-muted); cursor: pointer; }
div.sf-devtools-said details[open] > summary { margin-block-end: var(--sf-space-1); }
.sf-devtools-filters label { display: inline-flex; align-items: center; gap: var(--sf-space-1); color: var(--sf-color-muted); }
.sf-devtools-rows, .sf-devtools-tree {
  position: relative;
  flex: 1 1 4.5rem;
  min-height: 4.5rem;
  overflow: auto;
  border-radius: var(--sf-radius-sm);
  background: var(--sf-color-bg-2, var(--sf-color-surface));
}
.sf-devtools-row {
  position: absolute;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 6.5em 5.5em minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--sf-space-2);
  padding: 0 var(--sf-space-2);
  border-bottom: 1px solid var(--sf-color-divider);
  cursor: default;
  white-space: nowrap;
}
.sf-devtools-row > span { overflow: hidden; text-overflow: ellipsis; }
.sf-devtools-row[aria-selected="true"] { background: var(--sf-color-accent-soft); }
.sf-devtools-row[data-later] { color: var(--sf-color-muted); }
.sf-devtools-time, .sf-devtools-ms { color: var(--sf-color-muted); font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); font-variant-numeric: tabular-nums; }
.sf-devtools-kind { font-size: var(--sf-font-size-xs); color: var(--sf-color-muted); }
.sf-devtools-name { font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); }
.sf-devtools-name small { color: var(--sf-color-muted); font-size: inherit; }
.sf-devtools-status { font-size: var(--sf-font-size-xs); font-weight: var(--sf-font-weight-semibold); }
.sf-devtools-status[data-status="error"] { color: var(--sf-color-danger); }
.sf-devtools-status[data-status="warning"] { color: var(--sf-color-warning); }
.sf-devtools-status[data-status="ok"] { color: var(--sf-color-success); }
.sf-devtools-status[data-status="running"] { color: var(--sf-color-muted); }
.sf-devtools-status[data-status="cancelled"] { color: var(--sf-color-muted); font-weight: var(--sf-font-weight-regular); }
/* What a row holds in full gets most of a pane: the list above it keeps a few rows, and the pane scrolls when both cannot fit. */
.sf-devtools-detail { flex: 3 1 9rem; min-height: 9rem; overflow: auto; display: flex; flex-direction: column; gap: var(--sf-space-2); }
/* A code block hides its overflow, so as a flex item it would shrink to nothing; it keeps its own height and the detail scrolls. */
.sf-devtools-detail > * { flex: none; }
.sf-devtools-detail h4, .sf-devtools-pane h4 { margin: 0; font-size: var(--sf-font-size-xs); font-weight: var(--sf-font-weight-semibold); color: var(--sf-color-muted); }
.sf-devtools-facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0 var(--sf-space-2); margin: 0; }
.sf-devtools-facts dt { color: var(--sf-color-muted); }
.sf-devtools-facts dd { margin: 0; overflow-wrap: anywhere; font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); }
.sf-devtools-empty { margin: 0; padding: var(--sf-space-2); color: var(--sf-color-muted); }
.sf-devtools-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--sf-space-1); }
.sf-devtools-list li { overflow-wrap: anywhere; }
.sf-devtools-list code { font-family: var(--sf-font-mono); font-size: var(--sf-font-size-xs); }
.sf-devtools-problem { color: var(--sf-color-danger); }
.sf-devtools-node {
  display: flex;
  align-items: center;
  gap: var(--sf-space-1);
  min-height: var(--sf-target-min);
  padding: 0 var(--sf-space-2);
  border-bottom: 1px solid var(--sf-color-divider);
  white-space: nowrap;
}
.sf-devtools-node[aria-selected="true"] { background: var(--sf-color-accent-soft); }
.sf-devtools-node small { color: var(--sf-color-muted); }
.sf-devtools-preview { flex: 1; min-height: 0; overflow: auto; }
.sf-devtools-select { max-width: 100%; }
@container sf-devtools (max-width: 40rem) {
  /* The title and the host's controls share the first line; the scrubber takes the second. */
  .sf-devtools-scrub { order: 3; flex-basis: 100%; }
  .sf-devtools-scrub .sf-devtools-step { flex: 0 1 8rem; }
  .sf-devtools-row { grid-template-columns: 6.5em minmax(0, 1fr) auto; }
  .sf-devtools-row .sf-devtools-kind, .sf-devtools-row .sf-devtools-ms { display: none; }
  .sf-devtools-workspace { height: auto; }
  .sf-devtools-pane { flex: none; }
  .sf-devtools-rows, .sf-devtools-tree { flex: none; height: 14rem; }
  .sf-devtools-detail { flex: none; max-height: 20rem; }
  .sf-devtools-preview { flex: none; }
}
@media (forced-colors: active) {
  .sf-devtools-row[aria-selected="true"], .sf-devtools-node[aria-selected="true"] { outline: 2px solid Highlight; outline-offset: -2px; }
}
`;

/** Adds a stylesheet to a document once, by id. */
export function addStyles(doc: Document, id: string, css: string): void {
  const existing = doc.getElementById(id);
  if (existing) {
    // Kept in step, so a newer copy of the styles (a hot reload, a second version on the page) is not left stale.
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = css;
  doc.head.appendChild(style);
}
