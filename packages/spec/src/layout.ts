import { FIXED_SIZE, type LayoutSize, SPACE_STEPS, type SpaceStep } from "./basics.js";

/*
 * The layout props of the basic containers, read the way their renderers and Arrange read them: `gap` and
 * `padding` (a Row, Column and Grid's gap, a Row, Column and Card's padding) as steps of the theme's spacing scale,
 * and a Row's `sizes`. Anything that is not one of these is treated as absent, so the component is drawn as it was
 * before the prop existed.
 */

/** The step a `gap` or `padding` value names, or undefined for a value that is not one. */
export function spaceStep(value: unknown): SpaceStep | undefined {
  return SPACE_STEPS.find((step) => step === value);
}

/** The CSS a step stands for: `var(--sf-space-<step>)`, or 0 for "none". */
export function spaceVar(step: SpaceStep): string {
  return step === "none" ? "0px" : `var(--sf-space-${step})`;
}

/** A step's name as a designer reads it beside its pixels: "space-4", or "none". */
export function spaceName(step: SpaceStep): string {
  return step === "none" ? "none" : `space-${step}`;
}

/** The step one further along the scale (`by` 1) or one back (-1), staying on the scale. */
export function nextSpaceStep(step: SpaceStep, by: number): SpaceStep {
  const at = SPACE_STEPS.indexOf(step);
  return SPACE_STEPS[Math.max(0, Math.min(SPACE_STEPS.length - 1, at + by))]!;
}

/** One child's size when it is a valid one, else undefined. */
function layoutSize(value: unknown): LayoutSize | undefined {
  if (value === "hug" || value === "fill") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const fixed = (value as { fixed?: unknown }).fixed;
    if (Object.keys(value).length === 1 && typeof fixed === "number" && fixed >= FIXED_SIZE.min && fixed <= FIXED_SIZE.max) return { fixed };
  }
  return undefined;
}

/**
 * A Row's `sizes`, when it has exactly one valid entry per child; undefined otherwise, and the Row then falls back
 * to `widths` (when that has one share per child) or to equal widths. So `sizes` wins over `widths` when both fit.
 */
export function rowSizes(sizes: unknown, count: number): LayoutSize[] | undefined {
  if (!Array.isArray(sizes) || sizes.length !== count || count === 0) return undefined;
  const read = sizes.map(layoutSize);
  return read.every((size): size is LayoutSize => size !== undefined) ? read : undefined;
}
