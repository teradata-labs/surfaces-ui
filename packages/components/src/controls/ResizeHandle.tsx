import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { type ResizeBounds, type ResizeEdge, defaultResizeStep, dragResize, keyResize } from "./resize.js";

export interface ResizeHandleProps {
  /** Which edge of its parent it sits on: "right" sizes a width (dragged left and right), "left" a width that grows leftwards (a panel docked on the right), "bottom" a height (dragged up and down). The parent must be positioned. */
  edge: ResizeEdge;
  /** The size it stands for, in any unit (pixels, a share, a percentage). Undefined when no size is set yet: a drag then starts from `startFrom`. */
  value: number | undefined;
  min?: number;
  max?: number;
  /** Values land on multiples of this while dragging and by key (10 rounds to ten pixels). */
  snap?: number;
  /** How far an arrow key moves it; Shift moves five steps. Defaults to a twentieth of the range, or 10. */
  step?: number;
  /** How many pixels on screen one unit of value is: 1 for pixels, a container's width for a share of it. Read when a drag starts. Defaults to 1. */
  unitPixels?: number | ((handle: HTMLElement) => number);
  /** Where a drag or key starts when `value` is undefined, such as the height drawn now. */
  startFrom?(handle: HTMLElement): number;
  /** Each new value while it is dragged, and after each key. Draw the new size here. */
  onChange?(value: number): void;
  /** When a drag is released or cancelled (Escape, a lost pointer, or the handle going away mid-drag), and after each key: where to keep the size. `committed` is false for a cancelled drag, whose value is where it started. */
  onChangeEnd?(value: number, end: { committed: boolean; via: "pointer" | "keyboard" }): void;
  /** Enter or a double click: back to the size it had before anyone changed it. Without it, Enter does nothing. */
  onReset?(): void;
  /** What it resizes, for assistive technology: "Resize the map and the list". */
  label: string;
  /** The value in words, when a number alone does not say it ("40% and 60%"). */
  valueText?: string;
  /** Shown all the time, rather than when its parent is pointed at or it has focus. */
  always?: boolean;
  /**
   * Whether Tab stops on it (default true). False leaves it to the pointer and to focus given in code: an editor with
   * a handle on every element keeps Tab to one stop each, and offers the handles of the one selected.
   */
  tabbable?: boolean;
  className?: string;
}

/**
 * A handle on the right, left or bottom edge of something, dragged to change its
 * width or height: the one Arrange draws under a component and between a
 * Grid's columns, for any app to place. A focusable `separator` with its
 * value, least and most; dragged with pointer events so a mouse, a pen and a
 * finger all work; moved by the arrow keys (Shift for bigger steps), Home and
 * End; and put back by Enter or a double click. It holds no size of its own:
 * the host keeps `value` and draws the change.
 */
export function ResizeHandle(props: ResizeHandleProps) {
  const { edge, value, min, max, snap, label } = props;
  const bounds: ResizeBounds = { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(snap !== undefined ? { snap } : {}) };
  const latest = useRef(props);
  latest.current = props;
  const [dragging, setDragging] = useState(false);
  // A drag in progress when the handle goes away is given up, back where it started, rather than left listening on the window.
  const giveUp = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => giveUp.current?.(), []);

  const from = (handle: HTMLElement) => value ?? props.startFrom?.(handle) ?? min ?? 0;
  const perUnit = (handle: HTMLElement) => (typeof props.unitPixels === "function" ? props.unitPixels(handle) : (props.unitPixels ?? 1));

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const start = from(handle);
    const unit = perUnit(handle);
    const along = (e: { clientX: number; clientY: number }) => (edge === "bottom" ? e.clientY : edge === "left" ? -e.clientX : e.clientX);
    const origin = along(event);
    let now = start;
    setDragging(true);
    const finish = (committed: boolean, gone = false) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      giveUp.current = undefined;
      if (!gone) setDragging(false);
      if (!committed) latest.current.onChange?.(start);
      latest.current.onChangeEnd?.(committed ? now : start, { committed, via: "pointer" });
    };
    const move = (e: PointerEvent) => {
      e.preventDefault();
      const next = dragResize(start, along(e) - origin, unit, bounds);
      if (next === now) return;
      now = next;
      latest.current.onChange?.(next);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    };
    giveUp.current = () => finish(false, true);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      if (!props.onReset) return;
      event.preventDefault();
      props.onReset();
      return;
    }
    const current = from(event.currentTarget);
    const next = keyResize(event.key, current, edge, props.step ?? defaultResizeStep(bounds), bounds, event.shiftKey);
    if (next === undefined) return;
    event.preventDefault();
    if (next === current && value !== undefined) return;
    props.onChange?.(next);
    props.onChangeEnd?.(next, { committed: true, via: "keyboard" });
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize handle; <hr> cannot be focused or dragged.
    <div
      className={["sf-resize-handle", props.className].filter(Boolean).join(" ")}
      data-edge={edge}
      data-always={props.always || undefined}
      data-dragging={dragging || undefined}
      role="separator"
      tabIndex={props.tabbable === false ? -1 : 0}
      // A handle on a right or left edge is a line between things side by side, so the separator stands upright.
      aria-orientation={edge === "bottom" ? "horizontal" : "vertical"}
      aria-label={label}
      aria-valuenow={value === undefined ? undefined : Math.round(value * 100) / 100}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={props.valueText}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={props.onReset ? () => props.onReset?.() : undefined}
    />
  );
}
