import { CONTROLS_QUIET, ItemControls, standardControls } from "@surfaces-ui/components";
import { type PointerEvent as ReactPointerEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { analyticsCatalog } from "../analytics.js";
import { besideMessages, gridShares, gridWidthsMessages, heightMessages, heightProp, moveComponentMessages, placeOfComponent, slideShares, stepComponentMessages } from "../arrange.js";
import type { Catalog } from "../catalog.js";
import { isLocked } from "../personal.js";
import { catalogJson } from "../generate.js";
import type { Surface, SurfaceComponent, SurfaceMessage } from "../surface.js";

type HeightBounds = Record<string, { properties?: Record<string, { minimum?: number; maximum?: number }> }>;

/** How far a pointer travels, in pixels, before a press on a bar becomes a drag. */
const DRAG_START = 6;

/**
 * How tall a component is drawn when its `height` is not set yet: the pixel
 * height its renderer gave the part that `height` sizes (a grid's rows, a
 * chart's plot), read from that element's own style. The box around it is
 * taller by its toolbar, so measuring the box would make the first resize
 * jump. Falls back to the box when nothing inside carries a height.
 */
export function drawnHeight(drawn: Element | null | undefined): number {
  if (!(drawn instanceof HTMLElement)) return 320;
  for (const element of [drawn, ...drawn.querySelectorAll<HTMLElement>("*")]) {
    const own = element.style?.height || element.style?.getPropertyValue("--sf-workspace-height");
    const pixels = own && /^\d+(\.\d+)?px$/.test(own) ? Number.parseFloat(own) : Number.NaN;
    if (pixels >= 40) return pixels;
  }
  return drawn.getBoundingClientRect().height || 320;
}

type Side = "before" | "after" | "inside" | "left" | "right";
type Result = { messages: SurfaceMessage[] } | { error: string };
/** A size being dragged, shown before it is sent: a component's height prop, or a container's widths. */
type Preview = { id: string; prop: "height" | "minHeight" | "widths"; value: number | number[] };

/**
 * Where a dragged component would land for a pointer at (x, y) over a frame.
 * Side by side (in a Row or Grid), the nearer half decides before or after.
 * In a stack, the outer fifth on either side means beside it, and otherwise
 * the nearer half decides above or below.
 */
export function landing(box: { left: number; top: number; width: number; height: number }, across: boolean, x: number, y: number): Exclude<Side, "inside"> {
  if (across) return x < box.left + box.width / 2 ? "before" : "after";
  const edge = Math.min(box.width * 0.2, 96);
  if (x < box.left + edge) return "left";
  if (x > box.left + box.width - edge) return "right";
  return y < box.top + box.height / 2 ? "before" : "after";
}

/** Tracks a pointer from a press to its release, wherever it goes. Works for a mouse, a pen and a finger alike. */
function track(event: ReactPointerEvent<HTMLElement>, onMove: (dx: number, dy: number, e: PointerEvent) => void, onEnd: (dx: number, dy: number, dropped: boolean) => void) {
  const start = { x: event.clientX, y: event.clientY };
  const done = (e: PointerEvent | KeyboardEvent, dropped: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    const at = "clientX" in e ? { x: e.clientX, y: e.clientY } : start;
    onEnd(at.x - start.x, at.y - start.y, dropped);
  };
  const move = (e: PointerEvent) => {
    e.preventDefault();
    onMove(e.clientX - start.x, e.clientY - start.y, e);
  };
  const up = (e: PointerEvent) => done(e, true);
  const cancel = (e: PointerEvent) => done(e, false);
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    done(e, false);
  };
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}

/** The nearest ancestor that scrolls up and down, or the page itself. */
function scrollerOf(element: Element): Element {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const flow = getComputedStyle(at).overflowY;
    if ((flow === "auto" || flow === "scroll") && at.scrollHeight > at.clientHeight) return at;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** How near an edge of the scrolling area, in pixels, a drag starts to scroll it; and how far each tick scrolls. */
const SCROLL_EDGE = 64;
const SCROLL_STEP = 14;

/**
 * How far to scroll for a pointer at `y` inside an area from `top` to
 * `bottom`: up near the top edge, down near the bottom, faster the nearer
 * the edge, and not at all in between.
 */
export function scrollFor(y: number, top: number, bottom: number): number {
  if (y < top + SCROLL_EDGE) return -Math.ceil(SCROLL_STEP * Math.min(1, (top + SCROLL_EDGE - y) / SCROLL_EDGE));
  if (y > bottom - SCROLL_EDGE) return Math.ceil(SCROLL_STEP * Math.min(1, (y - (bottom - SCROLL_EDGE)) / SCROLL_EDGE));
  return 0;
}

/**
 * A change redraws the surface, which takes the control a person was on with
 * it, more than once as the change settles. Focus is put back on the same
 * control of the same component, so a second arrow press lands where the
 * first did.
 */
function focusAgain(selector: string) {
  let ticks = 0;
  const attempt = () => {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && document.activeElement !== element) element.focus();
    if (++ticks < 10) window.setTimeout(attempt, 80);
  };
  window.setTimeout(attempt, 0);
}
/** One of a frame's own controls (move, remove), by what it does. */
const inBar = (id: string, control: string) => `.sf-arrange-frame[data-component="${CSS.escape(id)}"] > .sf-arrange-bar [data-control="${control}"]`;
const inFrame = (id: string, control: string) => `.sf-arrange-frame[data-component="${CSS.escape(id)}"] > ${control}`;

/**
 * Arranging a surface by hand. Optional for any host: pass `frame` to
 * `SurfaceView` while `arranging`, draw `shown(surface)`, and turn each
 * change (`apply`) into a step of your own, such as a page edit. What it
 * sends is the same JSON an agent sends to arrange a surface.
 * Each component gets a frame with a bar: drag
 * it by the bar to before or after another, beside one in a stack, or into a
 * container; resize it by the handle under it (its height) or the handle
 * between it and its neighbour in a Grid or Row (their widths). Everything a
 * drag does, the bar's arrows and the handles' arrow keys do too. Dragging
 * uses pointer events, so it works by touch. A size is shown as it changes
 * and sent, as one A2UI message, when the pointer is released.
 */
export function useArrange(options: {
  /** The surface as its messages make it. */
  surface: Surface | undefined;
  /** The catalog the surface is drawn from, for which prop sizes each component and its limits. Defaults to the analytics catalog. */
  catalog?: Catalog;
  /** Adds messages that change the surface, as one step that can be undone. */
  apply(messages: SurfaceMessage[], title: string): void;
  /** Says what happened, or why something could not be done. */
  say(status: { text: string; error?: boolean }): void;
  remove(id: string): void;
}) {
  const { surface } = options;
  const catalog = options.catalog ?? analyticsCatalog;
  // Each component's props as JSON Schema: where a height's least and most come from.
  const schema = useMemo(() => catalogJson(catalog).components as HeightBounds, [catalog]);
  const latest = useRef(options);
  latest.current = options;
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState("");
  const [dropAt, setDropAt] = useState<{ id: string; side: Side }>();
  const dropRef = useRef<{ id: string; side: Side } | undefined>(undefined);
  const [ghost, setGhost] = useState<{ x: number; y: number; title: string }>();
  const [sizing, setSizing] = useState<{ id: string; text: string }>();
  const [preview, setPreview] = useState<Preview>();

  const done = (result: Result, title: string) => {
    if ("error" in result) return latest.current.say({ text: result.error, error: true });
    if (result.messages.length === 0) return;
    latest.current.apply(result.messages, title);
    latest.current.say({ text: `${title}.` });
  };
  const step = (id: string, by: -1 | 1) => done(stepComponentMessages(latest.current.surface, id, by), `Moved "${id}" ${by === -1 ? "earlier" : "later"}`);

  const endDrag = () => {
    dropRef.current = undefined;
    setDragId("");
    setDropAt(undefined);
    setGhost(undefined);
  };
  const drop = (id: string, target: { id: string; side: Side }) => {
    const now = latest.current.surface;
    if (!id || id === target.id) return;
    if (target.side === "inside") return done(moveComponentMessages(now, id, target.id, Number.MAX_SAFE_INTEGER), `Moved "${id}" into "${target.id}"`);
    if (target.side === "left" || target.side === "right") return done(besideMessages(now, id, target.id, target.side), `Put "${id}" to the ${target.side} of "${target.id}"`);
    const place = placeOfComponent(now, target.id);
    if (place) done(moveComponentMessages(now, id, place.parent, place.index + (target.side === "after" ? 1 : 0)), `Moved "${id}" ${target.side} "${target.id}"`);
  };
  /** What a pointer at (x, y) is over, for the component being dragged: never that component itself or anything inside it. */
  const under = (id: string, x: number, y: number): { id: string; side: Side } | undefined => {
    const hit = document.elementFromPoint(x, y);
    const own = document.querySelector(inFrame(id, ".sf-arrange-bar"))?.parentElement;
    const strip = hit?.closest<HTMLElement>(".sf-arrange-inside");
    if (strip?.dataset.container && !own?.contains(strip)) return { id: strip.dataset.container, side: "inside" };
    let frame = hit?.closest<HTMLElement>(".sf-arrange-frame") ?? null;
    if (frame && own && (frame === own || own.contains(frame))) return undefined;
    if (!frame?.dataset.component) return undefined;
    return { id: frame.dataset.component, side: landing(frame.getBoundingClientRect(), frame.hasAttribute("data-across"), x, y) };
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string, title: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    let moving = false;
    // A finger on the bar cannot scroll the page, so the drag does: held near the top or bottom of the scrolling area, it scrolls that way.
    const scroller = scrollerOf(event.currentTarget);
    let at = { x: event.clientX, y: event.clientY };
    const aim = () => {
      const target = under(id, at.x, at.y);
      dropRef.current = target;
      setDropAt((now) => (target && now?.id === target.id && now.side === target.side ? now : target));
    };
    const scrolling = window.setInterval(() => {
      if (!moving) return;
      const box = scroller === document.scrollingElement || scroller === document.documentElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const by = scrollFor(at.y, box.top, box.bottom);
      if (by === 0) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + by;
      // What is under a still pointer changes as the surface moves beneath it.
      if (scroller.scrollTop !== before) aim();
    }, 16);
    track(
      event,
      (dx, dy, e) => {
        if (!moving) {
          if (Math.hypot(dx, dy) < DRAG_START) return;
          moving = true;
          setDragId(id);
        }
        at = { x: e.clientX, y: e.clientY };
        setGhost({ x: e.clientX, y: e.clientY, title });
        aim();
      },
      (_dx, _dy, dropped) => {
        window.clearInterval(scrolling);
        const target = dropRef.current;
        endDrag();
        if (moving && dropped && target) drop(id, target);
      },
    );
  };

  const bounds = (kind: string) => {
    const prop = heightProp(kind, catalog);
    return prop ? schema[kind]?.properties?.[prop] : undefined;
  };
  const clamp = (kind: string, height: number) => Math.max(bounds(kind)?.minimum ?? 0, Math.min(bounds(kind)?.maximum ?? Number.MAX_SAFE_INTEGER, Math.round(height / 10) * 10));
  /** What is drawn for a frame: the element after its bar. */
  const drawnOf = (handle: HTMLElement) => handle.parentElement?.querySelector(":scope > .sf-arrange-bar")?.nextElementSibling;
  const heightHandle = (component: SurfaceComponent) => {
    const id = component.id;
    const kind = String(component.component);
    const prop = heightProp(kind, catalog);
    if (!prop) return null;
    const now = typeof component[prop] === "number" ? (component[prop] as number) : undefined;
    // A height that was never set starts from what is on screen: the renderer's own height, or the box as it is.
    const from = (handle: HTMLElement) => now ?? (prop === "height" ? drawnHeight(drawnOf(handle)) : (drawnOf(handle)?.getBoundingClientRect().height ?? 120));
    const set = (height: number) => done(heightMessages(latest.current.surface, id, height, bounds(kind), catalog), `Resized "${id}" to ${clamp(kind, height)} pixels tall`);
    return (
      // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize handle.
      <div
        className="sf-arrange-resize"
        data-edge="bottom"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={`Resize ${kind} ${id}: taller or shorter`}
        aria-valuenow={now}
        aria-valuemin={bounds(kind)?.minimum}
        aria-valuemax={bounds(kind)?.maximum}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const start = from(event.currentTarget);
          track(
            event,
            (_dx, dy) => {
              const value = clamp(kind, start + dy);
              // Drawn at its new height as the pointer moves; the message is sent on release.
              setPreview({ id, prop, value });
              setSizing({ id, text: `${value} px tall` });
            },
            (_dx, dy, dropped) => {
              setPreview(undefined);
              setSizing(undefined);
              if (dropped) set(start + dy);
            },
          );
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          set(from(event.currentTarget) + (event.key === "ArrowDown" ? 20 : -20));
          focusAgain(inFrame(id, '.sf-arrange-resize[data-edge="bottom"]'));
        }}
      />
    );
  };
  const widthHandle = (component: SurfaceComponent, place: { parent: string; index: number }) => {
    const container = surface?.components[place.parent];
    if (!container || (container.component !== "Grid" && container.component !== "Row")) return null;
    const shares = gridShares(container);
    // In a grid the line sits after a column; in a row, after a child.
    const at = container.component === "Grid" ? place.index % shares.length : place.index;
    // The line after the last one has nothing on its other side.
    if (at >= shares.length - 1) return null;
    const id = component.id;
    const words = (next: number[]) => next.map((w) => `${Math.round(w * 100)}%`).join(" and ");
    const set = (next: number[]) => done(gridWidthsMessages(latest.current.surface, place.parent, next, catalog), `Resized "${place.parent}" to ${words(next)}`);
    return (
      // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize handle.
      <div
        className="sf-arrange-resize"
        data-edge="right"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={`Resize ${String(component.component)} ${id} and what is to its right: wider or narrower`}
        aria-valuenow={Math.round((shares[at] ?? 0) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const width = event.currentTarget.closest("[data-arrange-container]")?.getBoundingClientRect().width;
          if (!width) return;
          track(
            event,
            (dx) => {
              const next = slideShares(shares, at, dx / width);
              setPreview({ id: place.parent, prop: "widths", value: next });
              setSizing({ id, text: next.map((w) => `${Math.round(w * 100)}%`).join(" · ") });
            },
            (dx, _dy, dropped) => {
              setPreview(undefined);
              setSizing(undefined);
              if (dropped) set(slideShares(shares, at, dx / width));
            },
          );
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          set(slideShares(shares, at, event.key === "ArrowRight" ? 0.04 : -0.04));
          focusAgain(inFrame(id, '.sf-arrange-resize[data-edge="right"]'));
        }}
      />
    );
  };

  const frame = (component: SurfaceComponent, drawn: ReactNode): ReactNode => {
    const id = component.id;
    const kind = String(component.component);
    const place = placeOfComponent(surface, id);
    const holds = Array.isArray(component.children);
    // A place to drop into a container: at its end, and the only way into an empty one.
    const inside = holds && dragId && dragId !== id && (
      <div className="sf-arrange-inside" data-container={id} data-over={(dropAt?.id === id && dropAt.side === "inside") || undefined}>
        Drop at the end of {kind} {id}
      </div>
    );
    if (!place) {
      return (
        <>
          {drawn}
          {inside}
        </>
      );
    }
    const across = ["Row", "Grid"].includes(String(surface?.components[place.parent]?.component));
    return (
      <div
        className="sf-arrange-frame"
        data-component={id}
        data-dragging={dragId === id || undefined}
        data-over={dropAt?.id === id && dropAt.side !== "inside" ? dropAt.side : undefined}
        data-across={across || undefined}
      >
        <div className="sf-arrange-bar" onPointerDown={(event) => startDrag(event, id, `${kind} ${id}`)}>
          <span className="sf-arrange-grip" aria-hidden="true">
            ⠿
          </span>
          <span className="sf-arrange-name">
            {kind} <code>{id}</code>
            {sizing?.id === id && <span className="sf-arrange-size"> {sizing.text}</span>}
          </span>
          {/* The same controls a report's tiles have, so moving and removing look and read alike everywhere. They belong to the editor, so nothing quiets them. */}
          <ItemControls
            label={`${kind} ${id} controls`}
            show="always"
            quietable={false}
            controls={standardControls(`${kind} ${id}`, {
              [across ? "earlier" : "up"]:
                place.index === 0
                  ? false
                  : () => {
                      step(id, -1);
                      focusAgain(`${inBar(id, across ? "earlier" : "up")}:not([aria-disabled]), ${inBar(id, across ? "later" : "down")}`);
                    },
              [across ? "later" : "down"]:
                place.index >= place.count - 1
                  ? false
                  : () => {
                      step(id, 1);
                      focusAgain(`${inBar(id, across ? "later" : "down")}:not([aria-disabled]), ${inBar(id, across ? "earlier" : "up")}`);
                    },
              // A part the page keeps (`surfaces_locked`) shows the control greyed, so a person can see it stays.
              remove: isLocked(component) ? false : () => latest.current.remove(id),
            })}
          />
        </div>
        {drawn}
        {inside}
        {heightHandle(component)}
        {widthHandle(component, place)}
      </div>
    );
  };

  /** The surface with the size being dragged applied to it, so it is drawn as it will be. */
  const shown = (drawn: Surface): Surface => {
    const target = preview && drawn.components[preview.id];
    return preview && target ? { ...drawn, components: { ...drawn.components, [preview.id]: { ...target, [preview.prop]: preview.value } } } : drawn;
  };

  return {
    arranging,
    toggle: () => {
      endDrag();
      setPreview(undefined);
      setSizing(undefined);
      setArranging((on) => !on);
    },
    frame,
    shown,
    step,
    /** What is being dragged, to draw by the pointer (`ArrangeGhost`). */
    ghost,
    /** Props for the element around the surface: one layer of controls at a time, and no text selected while dragging. */
    region: {
      className: arranging ? `sf-arrange-region ${CONTROLS_QUIET}` : "sf-arrange-region",
      "data-arranging": arranging || undefined,
      "data-dragging": ghost ? true : undefined,
    },
  };
}

export type Arrange = ReturnType<typeof useArrange>;

/** The chip that follows the pointer while a component is dragged. Draw it once, anywhere inside the host. */
export function ArrangeGhost({ arrange }: { arrange: Arrange }) {
  if (!arrange.ghost) return null;
  return (
    <div className="sf-arrange-ghost" style={{ left: arrange.ghost.x, top: arrange.ghost.y }} aria-hidden="true">
      {arrange.ghost.title}
    </div>
  );
}

/** The button that turns arranging on and off. */
export function ArrangeToggle({ arrange, label = "Arrange" }: { arrange: Arrange; label?: string }) {
  return (
    <button type="button" className="sf-button" aria-pressed={arrange.arranging} onClick={arrange.toggle}>
      {arrange.arranging ? "Done arranging" : label}
    </button>
  );
}

/** While arranging is on: how to arrange, and what the last change did or why it could not be done. */
export function ArrangeHelp({ arrange, status }: { arrange: Arrange; status?: { text: string; error?: boolean } }) {
  if (!arrange.arranging) return null;
  return (
    <div className="sf-arrange-help">
      <p>
        Drag a component by its bar to move it, to either side of one to put the two side by side, or onto the end of a container. Drag the handle under it to change its height, or at its
        right edge to change widths. Arrow keys do the same on the bar and the handles; Escape stops a drag.
      </p>
      {status?.text && <p role={status.error ? "alert" : "status"}>{status.text}</p>}
    </div>
  );
}
