import { CONTROLS_QUIET, ItemControls, ResizeHandle, standardControls } from "@surfaces-ui/components";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { analyticsCatalog } from "../analytics.js";
import { MIN_COLUMN_SHARE, besideMessages, gridShares, gridWidthsMessages, heightMessages, heightProp, moveComponentMessages, placeOfComponent, setComponentMessages, slideShares, spaceDefault, spaceMessages, spaceProps, stepComponentMessages } from "../arrange.js";
import { SPACE_STEPS, type SpaceStep } from "../basics.js";
import { spaceName, spaceStep, spaceVar } from "../layout.js";
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
/** A size being dragged, shown before it is sent: a component's height prop, a container's widths, or its gap or padding. */
type Preview = { id: string; prop: "height" | "minHeight" | "widths" | "gap" | "padding"; value: number | number[] | SpaceStep };

/**
 * How many pixels a step of the spacing scale is where it is drawn: read from the theme's `--sf-space-<step>` on
 * `element` (the density changes it), four pixels a step when there is no theme to read.
 */
export function spacePixels(step: SpaceStep, element?: Element | null): number {
  if (step === "none") return 0;
  const read = element ? Number.parseFloat(getComputedStyle(element).getPropertyValue(`--sf-space-${step}`)) : Number.NaN;
  return Number.isFinite(read) ? read : step * 4;
}

/** A step as a designer reads it: "16 px · space-4", or "0 px · none". */
export function spaceLabel(step: SpaceStep, element?: Element | null): string {
  return `${Math.round(spacePixels(step, element))} px · ${spaceName(step)}`;
}

/**
 * Which container receives a component dropped at `target`: the container itself for a drop inside it, and
 * otherwise what holds the component it lands beside.
 */
export function receivingContainer(surface: Surface | undefined, target: { id: string; side: string } | undefined): string | undefined {
  if (!target) return undefined;
  return target.side === "inside" ? target.id : placeOfComponent(surface, target.id)?.parent;
}

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
  /**
   * The surface as it shipped, before anyone arranged it. With it, Enter or a
   * double click on a handle puts a size back to what it is there: a Grid's
   * or Row's widths where it still has as many columns, and a component's
   * height. Without it, or for what the shipped surface does not have, widths
   * go back to equal and a height to what the component chooses.
   */
  shipped?: Surface;
  /**
   * Keeps the size handles while nobody is arranging: between a Grid's or
   * Row's columns, and under a component with a height of its own (a chart or a table, say) or one
   * whose height is set. A drag sends the
   * same messages Arrange does, as one step. Moving and removing stay inside
   * Arrange. Pass `surfaceFrame` to `SurfaceView` to draw them. Off by default.
   */
  resizeWhileViewing?: boolean;
  /**
   * The component selected, for a host that keeps its own selection (an outline, an inspector). Without it, Arrange
   * keeps one: a click on a component's frame, or focus on its bar, selects it. A selected Row, Column or Grid shows
   * handles in its gap and at its padding (a Card at its padding), which drag, or take the arrow keys, from one
   * step of the spacing scale to the next.
   */
  selected?: string;
  /** Told when a person selects a component by clicking its frame or focusing its bar. */
  onSelect?(id: string): void;
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
  const [ownSelected, setOwnSelected] = useState("");
  const selected = options.selected ?? ownSelected;
  const select = (id: string) => {
    if (options.selected === undefined) setOwnSelected(id);
    latest.current.onSelect?.(id);
  };
  // The container a dragged component would land in, outlined while it is over it.
  const receiving = dragId ? receivingContainer(surface, dropAt) : undefined;

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
  /** What is drawn for a frame: the element after its bar while arranging, the frame's first child while viewing. */
  const drawnOf = (handle: HTMLElement) => {
    const frame = handle.parentElement;
    return frame?.querySelector(":scope > .sf-arrange-bar")?.nextElementSibling ?? frame?.firstElementChild;
  };
  /** The frame a handle belongs to, by its component and whether it is the arranging kind. */
  const frameOf = (id: string, viewing: boolean) => `.${viewing ? "sf-arrange-view" : "sf-arrange-frame"}[data-component="${CSS.escape(id)}"]`;
  /** The handle under a component that sets its height: its own `height` where it has one, its box's `minHeight` otherwise. */
  const heightHandle = (component: SurfaceComponent, viewing: boolean) => {
    const id = component.id;
    const kind = String(component.component);
    const prop = heightProp(kind, catalog);
    if (!prop) return null;
    const now = typeof component[prop] === "number" ? (component[prop] as number) : undefined;
    const limits = bounds(kind);
    return (
      <ResizeHandle
        className="sf-arrange-resize"
        edge="bottom"
        label={`Resize ${kind} ${id}: taller or shorter`}
        value={now}
        {...(limits?.minimum !== undefined ? { min: limits.minimum } : {})}
        {...(limits?.maximum !== undefined ? { max: limits.maximum } : {})}
        snap={10}
        step={20}
        // A height that was never set starts from what is on screen: the renderer's own height, or the box as it is.
        startFrom={(handle) => clamp(kind, prop === "height" ? drawnHeight(drawnOf(handle)) : (drawnOf(handle)?.getBoundingClientRect().height ?? 120))}
        onChange={(value) => {
          // Drawn at its new height as it moves; the message is sent on release.
          setPreview({ id, prop, value });
          setSizing({ id, text: `${value} px tall` });
        }}
        onChangeEnd={(value, end) => {
          setPreview(undefined);
          setSizing(undefined);
          if (!end.committed) return;
          done(heightMessages(latest.current.surface, id, value, limits, catalog), `Resized "${id}" to ${clamp(kind, value)} pixels tall`);
          if (end.via === "keyboard") focusAgain(`${frameOf(id, viewing)} > .sf-resize-handle[data-edge="bottom"]`);
        }}
        // Back to the height it shipped with, or to the one its renderer chooses: the prop is taken off. A height the page never set has nothing to undo.
        {...(now === undefined
          ? {}
          : {
              onReset: () => {
                const was = options.shipped?.components[id];
                const before = was?.component === component.component ? was[prop] : undefined;
                const { id: _id, component: _kind, [prop]: _height, ...rest } = component;
                if (typeof before === "number") done(heightMessages(latest.current.surface, id, before, limits, catalog), `Put "${id}" back to ${clamp(kind, before)} pixels tall`);
                else done(setComponentMessages(latest.current.surface, id, rest, catalog), `Reset the height of "${id}"`);
                focusAgain(`${frameOf(id, viewing)} > .sf-resize-handle[data-edge="bottom"]`);
              },
            })}
      />
    );
  };
  /** The handle at a component's right edge in a Grid or Row, between it and what is to its right: their shares of the width. */
  const widthHandle = (component: SurfaceComponent, place: { parent: string; index: number }, viewing: boolean) => {
    const container = surface?.components[place.parent];
    if (!container || (container.component !== "Grid" && container.component !== "Row")) return null;
    const shares = gridShares(container);
    // In a grid the line sits after a column; in a row, after a child.
    const at = container.component === "Grid" ? place.index % shares.length : place.index;
    // The line after the last one has nothing on its other side.
    if (at >= shares.length - 1) return null;
    const id = component.id;
    const percent = (next: number[]) => next.map((w) => `${Math.round(w * 100)}%`);
    // The value is this column's share, in percent; the one to its right gives or takes what it gains.
    const sharesFor = (value: number) => slideShares(shares, at, value / 100 - shares[at]!);
    return (
      <ResizeHandle
        className="sf-arrange-resize"
        edge="right"
        label={`Resize ${String(component.component)} ${id} and what is to its right: wider or narrower`}
        value={(shares[at] ?? 0) * 100}
        min={MIN_COLUMN_SHARE * 100}
        max={((shares[at] ?? 0) + (shares[at + 1] ?? 0) - MIN_COLUMN_SHARE) * 100}
        step={4}
        valueText={percent(shares).join(" and ")}
        unitPixels={(handle) => (handle.closest("[data-arrange-container]")?.getBoundingClientRect().width ?? 0) / 100}
        onChange={(value) => {
          const next = sharesFor(value);
          setPreview({ id: place.parent, prop: "widths", value: next });
          setSizing({ id, text: percent(next).join(" · ") });
        }}
        onChangeEnd={(value, end) => {
          setPreview(undefined);
          setSizing(undefined);
          if (!end.committed) return;
          const next = sharesFor(value);
          done(gridWidthsMessages(latest.current.surface, place.parent, next, catalog), `Resized "${place.parent}" to ${percent(next).join(" and ")}`);
          if (end.via === "keyboard") focusAgain(`${frameOf(id, viewing)} > .sf-resize-handle[data-edge="right"]`);
        }}
        // Back to the widths it shipped with, where it still has as many columns; to equal widths otherwise.
        onReset={() => {
          const was = options.shipped?.components[place.parent];
          const before = was?.component === container.component ? gridShares(was) : [];
          if (before.length === shares.length) done(gridWidthsMessages(latest.current.surface, place.parent, before, catalog), `Put the widths in "${place.parent}" back to ${percent(before).join(" and ")}`);
          else done(gridWidthsMessages(latest.current.surface, place.parent, shares.map(() => 1 / shares.length), catalog), `Made the widths in "${place.parent}" equal`);
          focusAgain(`${frameOf(id, viewing)} > .sf-resize-handle[data-edge="right"]`);
        }}
      />
    );
  };

  /** A click inside a frame selects the innermost component under it; a click on a control inside it does too, and still does what it does. */
  const selectOnClick = (id: string) => (event: ReactMouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(".sf-arrange-frame, .sf-arrange-root") !== event.currentTarget) return;
    if ((event.target as HTMLElement).closest(".sf-resize-handle")) return;
    if (selected !== id) select(id);
  };

  /** The step a container's gap or padding is drawn with: the one being dragged, the one it has, or its default. */
  const stepOf = (component: SurfaceComponent | undefined, prop: "gap" | "padding"): SpaceStep => {
    if (!component) return 4;
    if (preview?.id === component.id && preview.prop === prop) return preview.value as SpaceStep;
    return spaceStep(component[prop]) ?? spaceDefault(String(component.component), prop);
  };
  /**
   * A handle that sets a container's `gap` or `padding`, from one step of the spacing scale to the next: a drag
   * snaps step to step, an arrow key moves one step, Enter takes the prop off (back to the default). Shown and
   * named with the step's pixels and token ("16 px · space-4"); sent, as one A2UI message, on release.
   */
  const spaceHandle = (container: SurfaceComponent, prop: "gap" | "padding", edge: "right" | "bottom", viewing: boolean) => {
    const id = container.id;
    const kind = String(container.component);
    const now = stepOf(container, prop);
    // Where to read the theme's spacing from: the container's frame once it is drawn, the arranging region before.
    const element = typeof document === "undefined" ? null : ((typeof CSS !== "undefined" && typeof CSS.escape === "function" ? document.querySelector(frameOf(id, viewing)) : null) ?? document.querySelector(".sf-arrange-region"));
    const label = spaceLabel(now, element);
    const at = (index: number) => SPACE_STEPS[Math.max(0, Math.min(SPACE_STEPS.length - 1, Math.round(index)))]!;
    const selector = `.sf-arrange-space[data-space="${prop}"][data-for="${CSS.escape(id)}"] > .sf-resize-handle`;
    return (
      // Which container and which prop, for the stylesheet and to put focus back after a change. It draws no box of its own (display: contents), so the handle sits on the frame's edge.
      <span className="sf-arrange-space" data-space={prop} data-for={id} data-edge={edge}>
        <ResizeHandle
          className="sf-arrange-resize"
          edge={edge}
          always
          label={`${prop === "gap" ? "Gap between the children" : "Padding"} of ${kind} ${id}: drag, or use the arrow keys, to step through the spacing scale`}
          value={SPACE_STEPS.indexOf(now)}
          min={0}
          max={SPACE_STEPS.length - 1}
          snap={1}
          step={1}
          valueText={label}
          // A step is the scale's second step on screen (8 px at the usual density), so the whole scale is a short drag.
          unitPixels={(handle) => spacePixels(2, handle)}
          onChange={(index) => {
            const step = at(index);
            setPreview({ id, prop, value: step });
            setSizing({ id, text: `${prop} ${spaceLabel(step, element)}` });
          }}
          onChangeEnd={(index, end) => {
            setPreview(undefined);
            setSizing(undefined);
            if (!end.committed) return;
            const step = at(index);
            done(spaceMessages(latest.current.surface, id, prop, step, catalog), `Set the ${prop} of "${id}" to ${spaceLabel(step, element)}`);
            if (end.via === "keyboard") focusAgain(selector);
          }}
          onReset={() => {
            const { id: _id, component: _kind, [prop]: was, ...rest } = container;
            if (was === undefined) return;
            done(setComponentMessages(latest.current.surface, id, rest, catalog), `Put the ${prop} of "${id}" back to ${spaceLabel(spaceDefault(kind, prop), element)}`);
            focusAgain(selector);
          }}
        />
        <span className="sf-arrange-space-label" aria-hidden="true">
          {label}
        </span>
      </span>
    );
  };
  /** The gap handle a selected container shows: after its first child, across a Row or a Grid of several columns, down a Column. */
  const gapHandle = (place: { parent: string; index: number; count: number }, viewing: boolean) => {
    const container = surface?.components[place.parent];
    if (!container || container.id !== selected || place.index !== 0 || place.count < 2 || !spaceProps(String(container.component), catalog).includes("gap")) return null;
    const across = container.component === "Row" || (container.component === "Grid" && (typeof container.columns === "number" ? container.columns : 2) > 1);
    return spaceHandle(container, "gap", across ? "right" : "bottom", viewing);
  };
  /** The padding handle a selected container shows, at the inside of its left edge. */
  const paddingHandle = (component: SurfaceComponent, viewing: boolean) => (component.id === selected && spaceProps(String(component.component), catalog).includes("padding") ? spaceHandle(component, "padding", "right", viewing) : null);
  /** The variables a frame carries for its handles and insertion line: the gap of what holds it, and its own padding. */
  const frameStyle = (component: SurfaceComponent, place: { parent: string } | undefined): CSSProperties | undefined => {
    const parent = place ? surface?.components[place.parent] : undefined;
    const style: Record<string, string> = {};
    if (parent && spaceProps(String(parent.component), catalog).includes("gap")) style["--sf-arrange-gap"] = spaceVar(stepOf(parent, "gap"));
    if (spaceProps(String(component.component), catalog).includes("padding")) style["--sf-arrange-padding"] = spaceVar(stepOf(component, "padding"));
    return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
  };

  /**
   * While nobody is arranging (with `resizeWhileViewing`): only the handles,
   * on a plain box. The width handle between a Grid's or Row's columns, and
   * the height handle under a component with a `height` of its own (a chart, a
   * table) or one whose height has been set, so a button or a line of text
   * gains no handle until someone sizes it. Moving
   * and removing stay inside Arrange.
   */
  const viewFrame = (component: SurfaceComponent, drawn: ReactNode): ReactNode => {
    const place = placeOfComponent(surface, component.id);
    const prop = heightProp(String(component.component), catalog);
    const sized = prop === "height" || (prop !== undefined && typeof component[prop] === "number");
    const width = place ? widthHandle(component, place, true) : null;
    const height = sized ? heightHandle(component, true) : null;
    if (!width && !height) return drawn;
    return (
      <div className="sf-arrange-view" data-component={component.id} style={frameStyle(component, place)}>
        {drawn}
        {height}
        {width}
      </div>
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
      // The root has no bar, but it can be selected (by a click on it, or by the host) and receive what is dropped.
      return (
        <div
          className="sf-arrange-root"
          data-component={id}
          data-selected={selected === id || undefined}
          data-receiving={receiving === id || undefined}
          style={frameStyle(component, undefined)}
          onClick={selectOnClick(id)}
        >
          {drawn}
          {inside}
          {paddingHandle(component, false)}
        </div>
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
        data-selected={selected === id || undefined}
        data-receiving={receiving === id || undefined}
        style={frameStyle(component, place)}
        onClick={selectOnClick(id)}
      >
        <div
          className="sf-arrange-bar"
          onPointerDown={(event) => startDrag(event, id, `${kind} ${id}`)}
          // Reaching a component's controls by keyboard selects it, so its gap and padding handles come next in order.
          onFocus={() => {
            if (selected !== id) select(id);
          }}
        >
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
        {heightHandle(component, false)}
        {widthHandle(component, place, false)}
        {gapHandle(place, false)}
        {paddingHandle(component, false)}
        {/* Where a dragged component will land: a line in the gap on that side, not a mark on this frame. */}
        {dropAt?.id === id && dropAt.side !== "inside" && dragId && <div className="sf-arrange-insert" data-side={dropAt.side} data-across={across || undefined} aria-hidden="true" />}
      </div>
    );
  };

  /** The surface with the size being dragged applied to it, so it is drawn as it will be. The surface itself when nothing is being sized. */
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
    /** The component selected: the host's `selected`, or the last one a person clicked or reached by keyboard. */
    selected,
    /** Selects a component, as a click on its frame does. An empty id selects nothing. */
    select,
    /**
     * What to pass to `SurfaceView` as `frame`: Arrange's frames while
     * arranging, the size handles alone while viewing with
     * `resizeWhileViewing`, and nothing otherwise.
     */
    surfaceFrame: arranging ? frame : options.resizeWhileViewing ? viewFrame : undefined,
    shown,
    step,
    /** What is being dragged, to draw by the pointer (`ArrangeGhost`). */
    ghost,
    /** Props for the element around the surface: one layer of controls at a time, and no text selected while dragging. */
    region: {
      className: arranging ? `sf-arrange-region ${CONTROLS_QUIET}` : "sf-arrange-region",
      "data-arranging": arranging || undefined,
      "data-dragging": ghost ? true : undefined,
      "data-resizing": sizing ? true : undefined,
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
        Drag a component by its bar to move it, to either side of one to put the two side by side, or onto the end of a container; a line shows where it will go and the container that
        takes it is outlined. Drag the handle under it to change its height, or at its right edge to change widths. Select a Row, Column, Grid or Card by clicking it to show handles
        in its gap and padding, which step through the spacing scale. Arrow keys do the same on the bar and the handles; Escape stops a drag.
      </p>
      {status?.text && <p role={status.error ? "alert" : "status"}>{status.text}</p>}
    </div>
  );
}
