import { type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { type MenuItem, useContextMenu } from "../menu/ContextMenu.js";
import { WorkspaceIcon, type WorkspaceIconName } from "./icons.js";
import { type FullLayout, MAX_COLUMNS, MAX_ROWS, type WorkspaceLayout, collapsePanel, expandPanel, hidePanel, movePanel, movePanelToNewColumn, normalizeLayout, placeOf, resizeColumns, resizeRows, shiftPanel, showPanel } from "./layout.js";

export interface WorkspacePanel {
  id: string;
  /** Shown in the panel's heading, and on the rail unless `shortTitle` is given. One to three words. */
  title: string;
  /** A shorter name for the rail, where there is room for about ten characters a line: "Data" for "Data model". */
  shortTitle?: string;
  /** The rail's icon: one of the built-in names, or your own node. Left out, the title's first letter. */
  icon?: WorkspaceIconName | ReactNode;
  /** The content scrolls inside itself and should fill the panel (a conversation with its composer). Stacked in a narrow
   * container, where other panels are as tall as their content, such a panel is given about a screenful instead. */
  fill?: boolean;
  content: ReactNode;
}

export interface WorkspaceProps {
  /** What the workspace is, for assistive technology: "Playground panels". */
  label: string;
  panels: WorkspacePanel[];
  /** Where the panels sit. Give it with `onLayoutChange` to hold the layout yourself; otherwise the workspace keeps it. */
  layout?: WorkspaceLayout;
  /** Where the panels start when the workspace keeps the layout. Defaults to one column. */
  defaultLayout?: WorkspaceLayout;
  /** Called with the whole layout when a person moves, resizes, shows or hides a panel. */
  onLayoutChange?(layout: FullLayout): void;
  /** Which side the rail of panel toggles sits on; `false` leaves it out. Defaults to the right. */
  rail?: "left" | "right" | false;
  /**
   * Whether the rail shows a short name under each icon. The rail is icons
   * only unless this is set, with each panel's name in a tooltip that shows
   * at once on hover or focus. A person switches between the two with the
   * button at the rail's foot. Give it with `onRailLabelsChange` to hold the
   * choice yourself. A workspace inside another is always icons only.
   */
  railLabels?: boolean;
  /** Whether names show to begin with, when the workspace holds the choice. Defaults to false. */
  defaultRailLabels?: boolean;
  onRailLabelsChange?(labels: boolean): void;
  /** A CSS height. A workspace needs one: its panels scroll inside it. Defaults to 32rem. */
  height?: string | number;
  className?: string;
}

/** True inside a workspace, so a workspace drawn within another knows to keep its rail to icons. */
const Nested = createContext(false);

type Drop = { kind: "row"; column: number; row: number } | { kind: "column"; at: number };
const sameDrop = (a: Drop | undefined, b: Drop) => !!a && a.kind === b.kind && (a.kind === "row" ? a.column === (b as typeof a).column && a.row === (b as typeof a).row : a.at === (b as typeof a).at);

/** How far a pointer travels, in pixels, before a press on a heading becomes a drag. */
const DRAG_START = 6;

/** One step of a keyboard resize, as a share of the whole. */
const KEY_STEP = 0.04;

/**
 * Panels in columns that a person arranges: drag a panel by its heading to
 * another column, to a place in a stack, or to an edge for a column of its
 * own; drag a divider to resize; hide a panel and bring it back from the
 * rail. Everything a drag does, the "Move" menu in each heading and the arrow
 * keys on a divider do too, so the workspace works without a pointer. The
 * layout is plain data (`WorkspaceLayout`), so a host can keep it and an
 * agent can set it.
 */
export function Workspace({ label, panels, layout: given, defaultLayout, onLayoutChange, rail = "right", railLabels: givenLabels, defaultRailLabels = false, onRailLabelsChange, height = "32rem", className }: WorkspaceProps) {
  const nested = useContext(Nested);
  const [keptLabels, setKeptLabels] = useState(defaultRailLabels);
  // Two rails with names, one inside the other, leave too little for the panels.
  const railLabels = !nested && (givenLabels ?? keptLabels);
  const root = useRef<HTMLDivElement>(null);
  // The rail's tooltip: shown the moment a button is hovered or focused, not after the browser's delay.
  const [tip, setTip] = useState<{ text: string; style: CSSProperties }>();
  const showTip = (text: string) => (event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const frame = root.current?.getBoundingClientRect();
    const rail = event.currentTarget.closest(".sf-workspace-rail");
    if (!frame || !rail) return;
    const button = event.currentTarget.getBoundingClientRect();
    const bar = rail.getBoundingClientRect();
    // Beside a rail that stands, on the side the panels are; under a rail that lies along the top.
    const standing = bar.height >= bar.width;
    const style: CSSProperties = !standing
      ? { top: button.bottom - frame.top, left: button.left + button.width / 2 - frame.left, transform: "translate(-50%, 0)", marginTop: "var(--sf-space-1)" }
      : rail.getAttribute("data-side") === "left"
        ? { top: button.top + button.height / 2 - frame.top, left: bar.right - frame.left, transform: "translate(0, -50%)" }
        : { top: button.top + button.height / 2 - frame.top, right: frame.right - bar.left, transform: "translate(0, -50%)" };
    setTip({ text, style });
  };
  const hideTip = () => setTip(undefined);
  const tipOn = (text: string) => ({
    onPointerEnter: showTip(text),
    onPointerLeave: hideTip,
    onFocus: showTip(text),
    onBlur: hideTip,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") hideTip();
    },
  });
  const ids = useMemo(() => panels.map((p) => p.id), [panels]);
  const idsKey = ids.join("\u0000");
  const [kept, setKept] = useState<WorkspaceLayout | undefined>(defaultLayout);
  // biome-ignore lint/correctness/useExhaustiveDependencies: idsKey stands for ids.
  const layout = useMemo(() => normalizeLayout(given ?? kept, ids), [given, kept, idsKey]);
  const latest = useRef(layout);
  latest.current = layout;
  const change = useCallback(
    (next: FullLayout) => {
      if (JSON.stringify(next) === JSON.stringify(latest.current)) return;
      setKept(next);
      onLayoutChange?.(next);
    },
    [onLayoutChange],
  );

  const byId = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  const grid = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string>();
  const [over, setOver] = useState<Drop>();
  const [said, setSaid] = useState("");
  const dragged = useRef<string | undefined>(undefined);

  const endDrag = () => {
    dragged.current = undefined;
    setDragging(undefined);
    setOver(undefined);
  };
  const drop = (target: Drop) => {
    const id = dragged.current;
    if (id) change(target.kind === "row" ? movePanel(latest.current, id, target.column, target.row) : movePanelToNewColumn(latest.current, id, target.at));
    endDrag();
  };
  /**
   * Dragging a panel by its heading. It is followed with pointer events, not
   * the browser's own drag and drop, so a finger and a pen move a panel the
   * way a mouse does. The drag begins once the pointer has travelled a little,
   * so a press on the heading is still a press; what is under the pointer is
   * looked up as it moves; Escape gives up.
   */
  const [ghost, setGhost] = useState<{ x: number; y: number; title: string }>();
  const overRef = useRef<Drop | undefined>(undefined);
  const startDrag = (event: PointerEvent<HTMLElement>, id: string, title: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, select, input, a")) return;
    const from = { x: event.clientX, y: event.clientY };
    let moving = false;
    const stop = (dropped: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      const target = overRef.current;
      overRef.current = undefined;
      setGhost(undefined);
      if (moving && dropped && target) drop(target);
      else endDrag();
    };
    const move = (e: globalThis.PointerEvent) => {
      if (!moving) {
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_START) return;
        moving = true;
        dragged.current = id;
        setDragging(id);
      }
      e.preventDefault();
      setGhost({ x: e.clientX, y: e.clientY, title });
      // The zone under the pointer, if it is one of this workspace's own (not a workspace drawn inside a panel).
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-drop]");
      const target = under && under.closest(".sf-workspace") === root.current ? (JSON.parse(under.dataset.drop ?? "null") as Drop | null) : null;
      overRef.current = target ?? undefined;
      setOver((now) => (target ? (sameDrop(now, target) ? now : target) : undefined));
    };
    const up = () => stop(true);
    const cancel = () => stop(false);
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      stop(false);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  };

  /** A place a dragged panel can be dropped. Only drawn while a panel is being dragged. */
  const zone = (target: Drop, className: string, name: string) => (
    <div className={className} data-drop={JSON.stringify(target)} data-over={sameDrop(over, target) || undefined} aria-hidden="true">
      <span>{name}</span>
    </div>
  );

  /** A divider a person drags or moves with the arrow keys. */
  const divider = (orientation: "vertical" | "horizontal", name: string, now: number, resize: (delta: number) => void) => {
    const start = (event: PointerEvent<HTMLDivElement>) => {
      const box = (orientation === "vertical" ? grid.current : event.currentTarget.closest(".sf-workspace-column"))?.getBoundingClientRect();
      const along = orientation === "vertical" ? box?.width : box?.height;
      if (!along) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      let last = orientation === "vertical" ? event.clientX : event.clientY;
      const move = (e: globalThis.PointerEvent) => {
        const at = orientation === "vertical" ? e.clientX : e.clientY;
        resize((at - last) / along);
        last = at;
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    };
    const key = (event: KeyboardEvent<HTMLDivElement>) => {
      const less = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
      const more = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
      if (event.key !== less && event.key !== more) return;
      event.preventDefault();
      resize(event.key === more ? KEY_STEP : -KEY_STEP);
    };
    return (
      // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a splitter; <hr> cannot be focused or dragged.
      <div
        className="sf-workspace-divider"
        role="separator"
        tabIndex={0}
        aria-orientation={orientation}
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(now * 100)}
        onPointerDown={start}
        onKeyDown={key}
      />
    );
  };

  const move = (id: string, title: string, how: string) => {
    const before = latest.current;
    const next =
      how === "hide"
        ? hidePanel(before, id)
        : how === "new-left"
          ? movePanelToNewColumn(before, id, 0)
          : how === "new-right"
            ? movePanelToNewColumn(before, id, before.columns.length)
            : shiftPanel(before, id, how as "left" | "right" | "up" | "down");
    const place = placeOf(next, id);
    setSaid(JSON.stringify(next) === JSON.stringify(before) ? `${title} cannot move that way.` : place ? `${title} is now in column ${place.column + 1} of ${next.columns.length}, place ${place.row + 1}.` : `${title} is hidden. The panels rail brings it back.`);
    change(next);
  };

  const menu = useContextMenu();
  /** Everything a drag can do to a panel, as a menu. A way that would change nothing is greyed out. */
  const moves = (id: string, title: string): MenuItem[] => {
    const now = JSON.stringify(latest.current);
    const item = (label: string, how: string, next: FullLayout): MenuItem => ({ label, disabled: JSON.stringify(next) === now, onSelect: () => move(id, title, how) });
    const at = latest.current;
    return [
      item("Move left", "left", shiftPanel(at, id, "left")),
      item("Move right", "right", shiftPanel(at, id, "right")),
      item("Move up", "up", shiftPanel(at, id, "up")),
      item("Move down", "down", shiftPanel(at, id, "down")),
      { separator: true },
      item("To a new column on the left", "new-left", movePanelToNewColumn(at, id, 0)),
      item("To a new column on the right", "new-right", movePanelToNewColumn(at, id, at.columns.length)),
      { separator: true },
      item("Hide", "hide", hidePanel(at, id)),
    ];
  };

  const columnCount = layout.columns.length;
  const railBar = rail && (
    <div className="sf-workspace-rail" role="toolbar" aria-label={`${label}: show or hide panels`} aria-orientation="vertical" data-side={rail} data-labels={railLabels || undefined}>
      {panels.map((panel) => {
        const shown = !layout.hidden.includes(panel.id);
        const only = shown && layout.columns.flat().length <= 1;
        return (
          <button
            key={panel.id}
            type="button"
            className="sf-workspace-rail-button"
            aria-pressed={shown}
            // The whole title is the button's name; the rail may show a shorter one.
            aria-label={panel.title}
            // Not `disabled`: a disabled button cannot be hovered or focused, so it could not say why it does nothing.
            aria-disabled={only || undefined}
            {...tipOn(only ? `${panel.title}: the only panel showing` : shown ? `Hide ${panel.title}` : `Show ${panel.title}`)}
            onClick={() => {
              if (only) return;
              setTip(undefined);
              setSaid(shown ? `${panel.title} is hidden.` : `${panel.title} is showing.`);
              change(shown ? hidePanel(latest.current, panel.id) : showPanel(latest.current, panel.id));
            }}
          >
            <WorkspaceIcon icon={panel.icon} title={panel.title} />
            {railLabels && <span className="sf-workspace-rail-label">{panel.shortTitle ?? panel.title}</span>}
          </button>
        );
      })}
      {!nested && (
        <button
          type="button"
          className="sf-workspace-rail-size"
          aria-pressed={railLabels}
          aria-label="Show panel names on the rail"
          {...tipOn(railLabels ? "Icons only" : "Show names")}
          onClick={() => {
            setTip(undefined);
            setKeptLabels(!railLabels);
            onRailLabelsChange?.(!railLabels);
          }}
        >
          <span aria-hidden="true">{(rail === "left") === railLabels ? "«" : "»"}</span>
        </button>
      )}
    </div>
  );

  return (
    <div ref={root} className={`sf-workspace sf-container${className ? ` ${className}` : ""}`} role="group" aria-label={label} style={{ "--sf-workspace-height": typeof height === "number" ? `${height}px` : height } as CSSProperties}>
      {/* The frame, not the workspace itself, is laid out: a container's own box cannot answer its own size query. */}
      <div className="sf-workspace-frame">
      {rail === "left" && railBar}
      <div className="sf-workspace-grid" ref={grid} data-dragging={dragging ? true : undefined}>
        {dragging && columnCount < MAX_COLUMNS && zone({ kind: "column", at: 0 }, "sf-workspace-drop-column", "New column")}
        {layout.columns.map((column, c) => (
          <div key={column.join("\u0000")} className="sf-workspace-column-wrap" style={{ flexGrow: layout.columnWidths[c], flexBasis: 0 }}>
            <div className="sf-workspace-column">
              {column.map((id, r) => {
                const panel = byId.get(id);
                if (!panel) return null;
                const folded = layout.collapsed.includes(id);
                const nextFolded = layout.collapsed.includes(column[r + 1] ?? "");
                const canDropHere = dragging && (dragged.current === undefined || placeOf(layout, dragging)?.column === c || column.length < MAX_ROWS);
                return (
                  <div key={id} className="sf-workspace-cell" data-folded={folded || undefined} style={folded ? undefined : { flexGrow: layout.rowHeights[c]?.[r] ?? 1, flexBasis: 0 }}>
                    {canDropHere && zone({ kind: "row", column: c, row: r }, "sf-workspace-drop-row", "Drop here")}
                    <section className="sf-workspace-panel" aria-label={panel.title} data-fill={panel.fill || undefined} data-dragging={dragging === id || undefined} data-folded={folded || undefined}>
                      <header
                        className="sf-workspace-panel-head"
                        onPointerDown={(event) => startDrag(event, id, panel.title)}
                        onContextMenu={(event) => menu.open(event, `Move ${panel.title}`, moves(id, panel.title))}
                      >
                        <span className="sf-workspace-grip" aria-hidden="true">
                          ⠿
                        </span>
                        {column.length > 1 && (
                          <button
                            type="button"
                            className="sf-workspace-fold"
                            aria-expanded={!folded}
                            aria-label={folded ? `Open ${panel.title}` : `Fold ${panel.title} to its heading`}
                            onClick={() => {
                              setSaid(folded ? `${panel.title} is open.` : `${panel.title} is folded.`);
                              change(folded ? expandPanel(latest.current, id) : collapsePanel(latest.current, id));
                            }}
                          >
                            <span aria-hidden="true">{folded ? "▸" : "▾"}</span>
                          </button>
                        )}
                        <h3 className="sf-workspace-panel-title">{panel.title}</h3>
                        <button
                          type="button"
                          className="sf-workspace-menu-button"
                          aria-label={`Move ${panel.title}`}
                          aria-haspopup="menu"
                          onClick={(event) => menu.open(event, `Move ${panel.title}`, moves(id, panel.title))}
                        >
                          <span aria-hidden="true">⋯</span>
                        </button>
                      </header>
                      {/* A folded panel keeps its content, hidden, so what a person typed there is still there when it opens. */}
                      <div className="sf-workspace-panel-body" hidden={folded}>
                        <Nested.Provider value={true}>{panel.content}</Nested.Provider>
                      </div>
                    </section>
                    {!dragging && r < column.length - 1 && !folded && !nextFolded && divider("horizontal", `Resize ${panel.title} and the panel below it`, layout.rowHeights[c]?.[r] ?? 0.5, (delta) => change(resizeRows(latest.current, c, r, delta)))}
                    {dragging && r === column.length - 1 && canDropHere && zone({ kind: "row", column: c, row: column.length }, "sf-workspace-drop-row", "Drop here")}
                  </div>
                );
              })}
            </div>
            {c < columnCount - 1 &&
              (dragging
                ? columnCount < MAX_COLUMNS && zone({ kind: "column", at: c + 1 }, "sf-workspace-drop-column", "New column")
                : divider("vertical", `Resize column ${c + 1} and column ${c + 2}`, layout.columnWidths[c] ?? 0.5, (delta) => change(resizeColumns(latest.current, c, delta))))}
          </div>
        ))}
        {dragging && columnCount < MAX_COLUMNS && zone({ kind: "column", at: columnCount }, "sf-workspace-drop-column", "New column")}
      </div>
      {rail === "right" && railBar}
      </div>
      {/* The buttons carry their names for assistive technology; this is the same words for the eye. */}
      {tip && (
        <div className="sf-workspace-tip" aria-hidden="true" style={tip.style}>
          {tip.text}
        </div>
      )}
      {ghost && (
        <div className="sf-workspace-ghost" aria-hidden="true" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.title}
        </div>
      )}
      {menu.element}
      <p className="sf-workspace-said" role="status">
        {said}
      </p>
    </div>
  );
}
