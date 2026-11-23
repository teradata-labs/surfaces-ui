/*
 * The arithmetic of a resize handle, kept apart from the component so it can
 * be tested without a pointer or a layout: where a value lands for a drag of
 * so many pixels, and for each key.
 */

/** Which edge of what it sizes a handle sits on: a right or left edge sizes a width, a bottom edge a height. */
export type ResizeEdge = "right" | "left" | "bottom";

/** Bounds and steps for a resize handle's value. */
export interface ResizeBounds {
  min?: number;
  max?: number;
  /** Values land on multiples of this (10 rounds to ten pixels). None by default. */
  snap?: number;
}

/** A value kept within `min` and `max`, and on a multiple of `snap` that is still within them. */
export function clampResize(value: number, { min, max, snap }: ResizeBounds): number {
  let next = Number.isFinite(value) ? value : (min ?? 0);
  if (snap && snap > 0) next = Math.round(next / snap) * snap;
  if (min !== undefined && next < min) next = snap && snap > 0 ? Math.ceil(min / snap) * snap : min;
  if (max !== undefined && next > max) next = snap && snap > 0 ? Math.floor(max / snap) * snap : max;
  // A snap that leaves no multiple between the bounds gives the bound itself.
  if (min !== undefined && next < min) next = min;
  return next;
}

/** The value after a drag of `pixels` along the handle's axis, from `start`, where one unit of value is `unitPixels` on screen. */
export function dragResize(start: number, pixels: number, unitPixels: number, bounds: ResizeBounds): number {
  const per = unitPixels > 0 && Number.isFinite(unitPixels) ? unitPixels : 1;
  return clampResize(start + pixels / per, bounds);
}

/**
 * The value a key gives, or undefined for a key the handle does not take. A
 * handle on a right edge moves with Left and Right, one on a bottom edge with
 * Up and Down; one on a left edge (a panel docked on the right) grows with
 * Left, the way its edge moves. Shift takes five steps at once; Home and End
 * go to `min` and `max` where there are some.
 */
export function keyResize(key: string, value: number, edge: ResizeEdge, step: number, bounds: ResizeBounds, shift = false): number | undefined {
  const by = step * (shift ? 5 : 1);
  const [less, more] = edge === "right" ? ["ArrowLeft", "ArrowRight"] : edge === "left" ? ["ArrowRight", "ArrowLeft"] : ["ArrowUp", "ArrowDown"];
  if (key === less) return clampResize(value - by, bounds);
  if (key === more) return clampResize(value + by, bounds);
  if (key === "Home" && bounds.min !== undefined) return clampResize(bounds.min, bounds);
  if (key === "End" && bounds.max !== undefined) return clampResize(bounds.max, bounds);
  return undefined;
}

/** A step for the arrow keys when none is given: a twentieth of the range, or ten without one. */
export function defaultResizeStep({ min, max }: ResizeBounds): number {
  return min !== undefined && max !== undefined && max > min ? (max - min) / 20 : 10;
}
