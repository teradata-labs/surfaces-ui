import { spaceStep } from "../layout.js";

/**
 * The attributes a container's renderer gives its element for `gap` and `padding`: `data-gap` and `data-padding`
 * with the step ("none", "1" … "8"), which the stylesheet turns into `--sf-space-<step>`. A prop that is absent or
 * not a step gives no attribute, so the element is exactly what it was before these props existed. `takes` says
 * which of the two the component has.
 */
export function spaceAttributes(props: Record<string, unknown>, takes: { gap?: boolean; padding?: boolean }): Record<string, string> {
  const out: Record<string, string> = {};
  const gap = takes.gap ? spaceStep(props.gap) : undefined;
  const padding = takes.padding ? spaceStep(props.padding) : undefined;
  if (gap !== undefined) out["data-gap"] = String(gap);
  if (padding !== undefined) out["data-padding"] = String(padding);
  return out;
}
