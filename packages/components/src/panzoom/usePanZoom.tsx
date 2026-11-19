import { type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Where the plane sits in the viewport: a screen point is `world * k + (x, y)`. */
export interface PanZoomView {
  x: number;
  y: number;
  k: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PanZoomLimits {
  /** Smallest zoom. Defaults to 0.2. */
  min?: number;
  /** Largest zoom. Defaults to 2.5. */
  max?: number;
}

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 2.5;
/** How much one press of zoom in or out changes the zoom. */
export const ZOOM_STEP = 1.25;
/** How far one arrow key moves the plane, in screen px. */
export const PAN_STEP = 48;
/** Space kept around the content when fitting it to the view, in screen px. */
export const FIT_PADDING = 16;

export const IDENTITY: PanZoomView = { x: 0, y: 0, k: 1 };

export function clampZoom(k: number, limits: PanZoomLimits = {}): number {
  const min = limits.min ?? ZOOM_MIN;
  const max = limits.max ?? ZOOM_MAX;
  if (!Number.isFinite(k)) return 1;
  return Math.min(max, Math.max(min, k));
}

/** The point on the plane under a point in the viewport. */
export function toWorld(view: PanZoomView, point: { x: number; y: number }): { x: number; y: number } {
  return { x: (point.x - view.x) / view.k, y: (point.y - view.y) / view.k };
}

/** Zooms by `factor`, keeping the plane point under `at` (a viewport point) where it is. */
export function zoomAt(view: PanZoomView, factor: number, at: { x: number; y: number }, limits?: PanZoomLimits): PanZoomView {
  const k = clampZoom(view.k * factor, limits);
  const ratio = k / view.k;
  return { k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

/**
 * Keeps some of the content on screen: the plane may move until only
 * `keep` px of it is left showing on any side, never right out of view.
 */
export function clampPan(view: PanZoomView, content: Size, viewport: Size, keep = 48): PanZoomView {
  if (viewport.width <= 0 || viewport.height <= 0) return view;
  const w = content.width * view.k;
  const h = content.height * view.k;
  const keepX = Math.min(keep, w);
  const keepY = Math.min(keep, h);
  return {
    k: view.k,
    x: Math.min(viewport.width - keepX, Math.max(keepX - w, view.x)),
    y: Math.min(viewport.height - keepY, Math.max(keepY - h, view.y)),
  };
}

/**
 * The view that shows all of the content, centred, never larger than life
 * size (a small diagram is not blown up). Content of no size gives the
 * identity view.
 */
export function fitView(content: Size, viewport: Size, limits?: PanZoomLimits, padding = FIT_PADDING): PanZoomView {
  if (content.width <= 0 || content.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return IDENTITY;
  const room = { width: Math.max(1, viewport.width - padding * 2), height: Math.max(1, viewport.height - padding * 2) };
  const k = clampZoom(Math.min(1, room.width / content.width, room.height / content.height), limits);
  return { k, x: (viewport.width - content.width * k) / 2, y: (viewport.height - content.height * k) / 2 };
}

/** How much a wheel event zooms: one notch of a mouse is about one button press; a pinch on a trackpad is gentler. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-Math.max(-100, Math.min(100, pixels)) * 0.0022);
}

/** Pans so `box` (a rectangle in viewport px) is fully in view, with a margin. Unchanged if it already is. */
export function revealBox(view: PanZoomView, box: { left: number; top: number; width: number; height: number }, viewport: Size, margin = FIT_PADDING): PanZoomView {
  const shift = (start: number, length: number, room: number) => {
    if (length + margin * 2 > room) return margin - start;
    if (start < margin) return margin - start;
    if (start + length > room - margin) return room - margin - (start + length);
    return 0;
  };
  const dx = shift(box.left, box.width, viewport.width);
  const dy = shift(box.top, box.height, viewport.height);
  return dx === 0 && dy === 0 ? view : { ...view, x: view.x + dx, y: view.y + dy };
}

function focusedByKeyboard(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // Without :focus-visible support, reveal on every focus.
    return true;
  }
}

const IGNORE ="button, a, input, select, textarea, label, [data-pan-ignore]";

export interface PanZoomOptions extends PanZoomLimits {
  /** The size of everything drawn on the plane, in plane px. */
  content: Size;
}

export interface PanZoom {
  view: PanZoomView;
  /** The viewport's measured size; zero until it has been laid out. */
  viewport: Size;
  /** Attach to the element that clips the plane. */
  viewportRef: (element: HTMLDivElement | null) => void;
  /** Spread on the viewport: pointer, keyboard and focus handling. */
  viewportProps: {
    tabIndex: number;
    "data-panning"?: "";
    onPointerDown(event: PointerEvent<HTMLElement>): void;
    onPointerMove(event: PointerEvent<HTMLElement>): void;
    onPointerUp(event: PointerEvent<HTMLElement>): void;
    onPointerCancel(event: PointerEvent<HTMLElement>): void;
    onKeyDown(event: KeyboardEvent<HTMLElement>): void;
    onFocus(event: FocusEvent<HTMLElement>): void;
  };
  /** Style for the plane: its transform. */
  planeStyle: CSSProperties;
  /** True while a button or key is changing the view, so the plane may move smoothly. */
  animate: boolean;
  /** Turns a pointer position into a point on the plane. */
  pointToWorld(event: { clientX: number; clientY: number }): { x: number; y: number };
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  reset(): void;
  min: number;
  max: number;
}

/**
 * Pan and zoom for a diagram. The viewport clips a plane that is moved and
 * scaled with a CSS transform.
 *
 * - Drag the empty canvas, or scroll inside it, to pan.
 * - Ctrl/⌘ + wheel, or pinch (a trackpad or two fingers), zooms about the pointer.
 * - With the canvas focused: `+` and `-` zoom, `0` fits, arrows pan.
 *
 * The view fits the content when it is first drawn, and keeps fitting it as
 * the content arrives, until a person pans, zooms or presses on the canvas.
 */
export function usePanZoom(options: PanZoomOptions): PanZoom {
  const limits = { min: options.min ?? ZOOM_MIN, max: options.max ?? ZOOM_MAX };
  const [view, setViewState] = useState<PanZoomView>(IDENTITY);
  const [animate, setAnimate] = useState(false);
  const [panning, setPanning] = useState(false);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const content = useRef(options.content);
  content.current = options.content;
  const limitsRef = useRef(limits);
  limitsRef.current = limits;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  // Fitting follows the content until a person takes over.
  const auto = useRef(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: number; x: number; y: number; view: PanZoomView } | undefined>(undefined);
  const pinch = useRef<{ distance: number; view: PanZoomView; mid: { x: number; y: number } } | undefined>(undefined);

  const setView = useCallback((next: PanZoomView, smooth = false) => {
    const clamped = clampPan({ ...next, k: clampZoom(next.k, limitsRef.current) }, content.current, viewportRef.current);
    setAnimate(smooth);
    viewRef.current = clamped;
    setViewState(clamped);
  }, []);

  // The viewport's size, kept current as its container changes.
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setViewport((previous) => (previous.width === element.clientWidth && previous.height === element.clientHeight ? previous : { width: element.clientWidth, height: element.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  // Fit on first draw, and again as content or the viewport changes, until a person takes over.
  const { width: cw, height: ch } = options.content;
  useLayoutEffect(() => {
    if (!auto.current || viewport.width <= 0 || cw <= 0 || ch <= 0) return;
    const fitted = fitView({ width: cw, height: ch }, viewport, limitsRef.current);
    viewRef.current = fitted;
    setViewState(fitted);
    setAnimate(false);
  }, [cw, ch, viewport]);

  const local = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const box = element?.getBoundingClientRect();
      return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
    },
    [element],
  );

  const centre = () => ({ x: viewportRef.current.width / 2, y: viewportRef.current.height / 2 });
  const takeOver = () => {
    auto.current = false;
  };
  const zoomBy = (factor: number, at = centre(), smooth = true) => {
    takeOver();
    setView(zoomAt(viewRef.current, factor, at, limitsRef.current), smooth);
  };
  const panBy = (dx: number, dy: number, smooth = false) => {
    takeOver();
    setView({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy }, smooth);
  };
  const fit = () => {
    auto.current = true;
    const fitted = fitView(content.current, viewportRef.current, limitsRef.current);
    setView(fitted, true);
  };
  const reset = () => {
    takeOver();
    setView(IDENTITY, true);
  };

  // Wheel events must be able to cancel scrolling, which React's listener cannot.
  useEffect(() => {
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const at = local(event);
      if (event.ctrlKey || event.metaKey) {
        // Ctrl/⌘ + wheel, and a trackpad pinch (which the browser reports as Ctrl + wheel).
        event.preventDefault();
        auto.current = false;
        setView(zoomAt(viewRef.current, wheelFactor(event.deltaY, event.deltaMode), at, limitsRef.current));
        return;
      }
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportRef.current.height : 1;
      const [dx, dy] = event.shiftKey && event.deltaX === 0 ? [event.deltaY * scale, 0] : [event.deltaX * scale, event.deltaY * scale];
      const before = viewRef.current;
      const next = clampPan({ ...before, x: before.x - dx, y: before.y - dy }, content.current, viewportRef.current);
      // At an edge the page scrolls on instead, so a diagram never traps the wheel.
      if (next.x === before.x && next.y === before.y) return;
      event.preventDefault();
      auto.current = false;
      setView(next);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element, local, setView]);

  const viewportProps: PanZoom["viewportProps"] = {
    tabIndex: 0,
    "data-panning": panning ? "" : undefined,
    onPointerDown(event) {
      const at = local(event);
      // Any press on the canvas, even on a card, means the person is arranging things: stop fitting.
      takeOver();
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const onControl = (event.target as HTMLElement).closest?.(IGNORE);
      if (onControl && pointers.current.size === 0) return;
      pointers.current.set(event.pointerId, at);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        drag.current = undefined;
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, view: viewRef.current, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      } else if (pointers.current.size === 1) {
        drag.current = { id: event.pointerId, x: at.x, y: at.y, view: viewRef.current };
        setPanning(true);
      }
    },
    onPointerMove(event) {
      if (!pointers.current.has(event.pointerId)) return;
      const at = local(event);
      pointers.current.set(event.pointerId, at);
      const p = pinch.current;
      if (p && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoomed = zoomAt(p.view, Math.hypot(a.x - b.x, a.y - b.y) / p.distance, p.mid, limitsRef.current);
        setView({ ...zoomed, x: zoomed.x + mid.x - p.mid.x, y: zoomed.y + mid.y - p.mid.y });
        return;
      }
      const d = drag.current;
      if (d && d.id === event.pointerId) setView({ ...d.view, x: d.view.x + at.x - d.x, y: d.view.y + at.y - d.y });
    },
    onPointerUp(event) {
      if (!pointers.current.delete(event.pointerId)) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      pinch.current = undefined;
      // Lifting one finger of a pinch carries on as a drag with the other.
      const [rest] = [...pointers.current.entries()];
      drag.current = rest ? { id: rest[0], x: rest[1].x, y: rest[1].y, view: viewRef.current } : undefined;
      if (!rest) setPanning(false);
    },
    onPointerCancel(event) {
      viewportProps.onPointerUp(event);
    },
    onKeyDown(event) {
      // Only when the canvas itself has focus: keys on cards and nodes keep their own meaning.
      if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
      const keys: Record<string, () => void> = {
        "+": () => zoomBy(ZOOM_STEP),
        "=": () => zoomBy(ZOOM_STEP),
        "-": () => zoomBy(1 / ZOOM_STEP),
        _: () => zoomBy(1 / ZOOM_STEP),
        "0": fit,
        ArrowLeft: () => panBy(PAN_STEP, 0, true),
        ArrowRight: () => panBy(-PAN_STEP, 0, true),
        ArrowUp: () => panBy(0, PAN_STEP, true),
        ArrowDown: () => panBy(0, -PAN_STEP, true),
      };
      const run = keys[event.key];
      if (!run) return;
      event.preventDefault();
      run();
    },
    onFocus(event) {
      // A control focused off screen (Tab, or arrow keys between nodes) is panned into view.
      if (!element || event.target === event.currentTarget) return;
      // A click focuses what is already under the pointer; only keyboard focus needs revealing.
      if (!focusedByKeyboard(event.target as HTMLElement)) return;
      const box = element.getBoundingClientRect();
      const target = (event.target as HTMLElement).getBoundingClientRect();
      const next = revealBox(viewRef.current, { left: target.left - box.left, top: target.top - box.top, width: target.width, height: target.height }, viewportRef.current);
      if (next !== viewRef.current) setView(next, true);
      // The browser may also have scrolled the clipped viewport to show it; the transform does that job.
      element.scrollLeft = 0;
      element.scrollTop = 0;
    },
  };

  return {
    view,
    viewport,
    viewportRef: setElement,
    viewportProps,
    planeStyle: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" },
    animate,
    pointToWorld: (event) => toWorld(viewRef.current, local(event)),
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    fit,
    reset,
    min: limits.min,
    max: limits.max,
  };
}

/** Zoom in, zoom out, fit and reset buttons, with the zoom level. Every button has a key on the canvas too. */
export function PanZoomControls({ panZoom, label = "Zoom" }: { panZoom: PanZoom; label?: string }) {
  const percent = Math.round(panZoom.view.k * 100);
  return (
    <div className="sf-panzoom-controls" role="group" aria-label={label}>
      <button type="button" className="sf-button" aria-label="Zoom out" title="Zoom out (−)" aria-keyshortcuts="-" disabled={panZoom.view.k <= panZoom.min + 1e-6} onClick={panZoom.zoomOut}>
        −
      </button>
      <output className="sf-panzoom-level" aria-live="polite" aria-label={`Zoom ${percent}%`}>
        {percent}%
      </output>
      <button type="button" className="sf-button" aria-label="Zoom in" title="Zoom in (+)" aria-keyshortcuts="+" disabled={panZoom.view.k >= panZoom.max - 1e-6} onClick={panZoom.zoomIn}>
        +
      </button>
      <button type="button" className="sf-button" title="Fit to view (0)" aria-keyshortcuts="0" onClick={panZoom.fit}>
        Fit to view
      </button>
      <button type="button" className="sf-button" title="Reset to 100%" aria-label="Reset zoom to 100%" onClick={panZoom.reset}>
        100%
      </button>
    </div>
  );
}
