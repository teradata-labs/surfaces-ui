import { analyticsCatalog } from "./analytics.js";
import type { SpaceStep } from "./basics.js";
import type { Catalog } from "./catalog.js";
import { A2UI_VERSION } from "./dynamic.js";
import { isLocked } from "./personal.js";
import type { Surface, SurfaceComponent, SurfaceMessage } from "./surface.js";

/*
 * Arranging a surface: moving a component, putting two side by side, and
 * sizing heights and column widths. Each function reads the surface as it
 * stands and returns the A2UI messages that make the change, so a person's
 * arrangement and an agent's are the same JSON: the order of `children`,
 * `widths` on a Grid or Row, and `height` or `minHeight`.
 */

/** One line of a surface's outline: a component, how deep it sits, and what holds it. */
export interface OutlineItem {
  id: string;
  component: string;
  depth: number;
  /** The component that names this one as a child; absent for the root. */
  parent?: string;
}

/** The ids a component names as children: a `children` list, a single `child`, and the `child` of each tab, panel or example. */
function childIds(component: SurfaceComponent): string[] {
  const ids: string[] = [];
  if (Array.isArray(component.children)) ids.push(...component.children.filter((c): c is string => typeof c === "string"));
  // A template: one component repeated over a list in the data model.
  else if (component.children && typeof component.children === "object" && typeof (component.children as { componentId?: unknown }).componentId === "string") ids.push((component.children as { componentId: string }).componentId);
  if (typeof component.child === "string") ids.push(component.child);
  // Tabs, a workspace's panels and a showcase's examples each name one child.
  for (const list of [component.tabs, component.panels, component.examples]) {
    if (Array.isArray(list)) for (const entry of list) if (entry && typeof entry === "object" && typeof (entry as { child?: unknown }).child === "string") ids.push((entry as { child: string }).child);
  }
  return ids;
}

/** A surface's components in the order they are drawn, from the root down. Components nothing reaches are left out. */
export function surfaceOutline(surface: Surface | undefined): OutlineItem[] {
  const out: OutlineItem[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number, parent?: string) => {
    const component = surface?.components[id];
    if (!component || seen.has(id)) return;
    seen.add(id);
    out.push({ id, component: String(component.component), depth, ...(parent ? { parent } : {}) });
    for (const child of childIds(component)) walk(child, depth + 1, id);
  };
  walk("root", 0);
  return out;
}

/**
 * The A2UI messages that take one component off a surface: whatever lists it
 * as a child is sent again without it. A2UI has no delete, so the component
 * itself stays in the surface's store, unreached and undrawn. The root, and
 * the only thing inside a container that needs exactly one child, cannot be
 * removed this way, nor can a component marked `surfaces_locked`; the reason
 * is returned.
 */
export function removeComponentMessages(surface: Surface | undefined, id: string): { messages: SurfaceMessage[] } | { error: string } {
  if (!surface?.components[id]) return { error: `There is no component "${id}" on the surface.` };
  if (id === "root") return { error: "The root holds everything else, so it cannot be removed. Start a new surface instead." };
  // A part the page's author marked as staying (`surfaces_locked`) can be moved and sized, never taken off.
  if (isLocked(surface.components[id])) return { error: `"${id}" is part of this page and stays on it. It can still be moved and sized.` };
  const changed: SurfaceComponent[] = [];
  for (const parent of Object.values(surface.components)) {
    if (!childIds(parent).includes(id)) continue;
    if (parent.child === id) return { error: `"${id}" is the only thing inside "${parent.id}" (a ${String(parent.component)}). Remove "${parent.id}" instead.` };
    const next: SurfaceComponent = { ...parent };
    if (Array.isArray(next.children)) next.children = next.children.filter((c) => c !== id);
    for (const key of ["tabs", "panels", "examples"] as const) {
      const list = next[key];
      if (!Array.isArray(list)) continue;
      const kept = list.filter((entry) => !(entry && typeof entry === "object" && (entry as { child?: unknown }).child === id));
      if (kept.length === 0) return { error: `"${id}" is the last ${{ tabs: "tab", panels: "panel", examples: "example" }[key]} of "${parent.id}". Remove "${parent.id}" instead.` };
      next[key] = kept;
    }
    changed.push(next);
  }
  if (changed.length === 0) return { error: `Nothing on the surface holds "${id}", so it is not drawn already.` };
  return { messages: [{ version: A2UI_VERSION, updateComponents: { surfaceId: surface.surfaceId, components: changed } }] };
}

/** The A2UI message that gives a component new props, keeping its id and kind. Checked against the catalog first. */
export function setComponentMessages(surface: Surface | undefined, id: string, props: Record<string, unknown>, catalog: Catalog = analyticsCatalog): { messages: SurfaceMessage[] } | { error: string } {
  const current = surface?.components[id];
  if (!surface || !current) return { error: `There is no component "${id}" on the surface.` };
  const next: SurfaceComponent = { ...props, id, component: current.component };
  const message: SurfaceMessage = { version: A2UI_VERSION, updateComponents: { surfaceId: surface.surfaceId, components: [next] } };
  const issues = catalog.validateMessage(message);
  if (issues.length > 0) return { error: `The catalog does not accept that: ${issues.slice(0, 3).map((issue) => `${issue.path} ${issue.message}`).join("; ")}` };
  return { messages: [message] };
}

/** Where a component sits: the container that lists it among its `children`, and its place in that list. */
export function placeOfComponent(surface: Surface | undefined, id: string): { parent: string; index: number; count: number } | undefined {
  for (const parent of Object.values(surface?.components ?? {})) {
    if (!Array.isArray(parent.children)) continue;
    const index = parent.children.indexOf(id);
    if (index !== -1) return { parent: parent.id, index, count: parent.children.length };
  }
  return undefined;
}

/** True when `id` is `ancestor` or sits somewhere inside it. */
function within(surface: Surface, ancestor: string, id: string, seen = new Set<string>()): boolean {
  if (ancestor === id) return true;
  if (seen.has(ancestor)) return false;
  seen.add(ancestor);
  const component = surface.components[ancestor];
  return !!component && childIds(component).some((child) => within(surface, child, id, seen));
}

/**
 * The A2UI messages that move one component: to another place in its
 * container, or into another container, at `index` of that container's
 * children (counted before the move). Only containers that hold a list of
 * children can give or take a component; a component cannot go inside
 * itself. Moving it to where it already is returns no messages.
 */
export function moveComponentMessages(surface: Surface | undefined, id: string, toParent: string, index: number): { messages: SurfaceMessage[] } | { error: string } {
  if (!surface?.components[id]) return { error: `There is no component "${id}" on the surface.` };
  const from = placeOfComponent(surface, id);
  if (!from) return { error: id === "root" ? "The root holds everything else and cannot be moved." : `"${id}" is held by a container with a fixed place for it (a card, a tab, a panel), so it cannot be moved on its own.` };
  const target = surface.components[toParent];
  if (!target || !Array.isArray(target.children)) return { error: `"${toParent}" does not hold a list of components, so nothing can be moved into it.` };
  if (within(surface, id, toParent)) return { error: `"${id}" cannot be moved inside itself.` };
  const source = surface.components[from.parent]!;
  const same = from.parent === toParent;
  const at = Math.max(0, Math.min(index, target.children.length));
  if (same && (at === from.index || at === from.index + 1)) return { messages: [] };
  const without = (source.children as unknown[]).filter((child) => child !== id);
  if (same) {
    const next = [...without];
    next.splice(at > from.index ? at - 1 : at, 0, id);
    return { messages: [{ version: A2UI_VERSION, updateComponents: { surfaceId: surface.surfaceId, components: [{ ...source, children: next }] } }] };
  }
  const next = [...target.children];
  next.splice(at, 0, id);
  return { messages: [{ version: A2UI_VERSION, updateComponents: { surfaceId: surface.surfaceId, components: [{ ...source, children: without }, { ...target, children: next }] } }] };
}

/** Moves a component one place earlier (`-1`) or later (`1`) among its container's children. */
export function stepComponentMessages(surface: Surface | undefined, id: string, by: -1 | 1): { messages: SurfaceMessage[] } | { error: string } {
  const from = placeOfComponent(surface, id);
  if (!from) return moveComponentMessages(surface, id, "", 0);
  return moveComponentMessages(surface, id, from.parent, by === -1 ? from.index - 1 : from.index + 2);
}

/** The smallest share of a grid's width one column can be resized to. */
export const MIN_COLUMN_SHARE = 0.12;

/**
 * The shares of the width a container's children take, adding up to 1: one
 * per column of a Grid, one per child of a Row. Its `widths` when there is
 * one for each, equal otherwise. Other containers have no shares.
 */
export function gridShares(container: SurfaceComponent | undefined): number[] {
  const count =
    container?.component === "Row"
      ? Array.isArray(container.children) ? container.children.length : 0
      : typeof container?.columns === "number" && container.columns >= 1 ? Math.floor(container.columns) : 2;
  if (count === 0) return [];
  const given = Array.isArray(container?.widths) && container.widths.length === count && container.widths.every((w) => typeof w === "number" && w > 0) ? (container.widths as number[]) : Array.from({ length: count }, () => 1);
  const sum = given.reduce((x, y) => x + y, 0);
  return given.map((w) => w / sum);
}

/** Shares after the line following position `index` moves by `delta` (a share of the whole width); both sides stay at or above the minimum. */
export function slideShares(shares: number[], index: number, delta: number): number[] {
  const a = shares[index];
  const b = shares[index + 1];
  if (a === undefined || b === undefined || a + b < MIN_COLUMN_SHARE * 2) return shares;
  const moved = Math.max(MIN_COLUMN_SHARE - a, Math.min(b - MIN_COLUMN_SHARE, delta));
  const next = [...shares];
  next[index] = a + moved;
  next[index + 1] = b - moved;
  return next;
}

/** The A2UI message that gives a Grid's columns or a Row's children new widths, as shares rounded to three places. */
export function gridWidthsMessages(surface: Surface | undefined, containerId: string, shares: number[], catalog: Catalog = analyticsCatalog): { messages: SurfaceMessage[] } | { error: string } {
  const container = surface?.components[containerId];
  if (!container || (container.component !== "Grid" && container.component !== "Row")) return { error: `"${containerId}" is not a Grid or a Row, so the widths inside it cannot be set.` };
  // A Row's `sizes` would win over the widths a person just dragged, so dragging them gives the children shares instead.
  const { id: _id, component: _component, sizes: _sizes, ...props } = container;
  const widths = shares.map((w) => Math.round(w * 1000) / 1000);
  if (_sizes === undefined && JSON.stringify(widths) === JSON.stringify(gridShares(container).map((w) => Math.round(w * 1000) / 1000))) return { messages: [] };
  return setComponentMessages(surface, containerId, { ...props, widths }, catalog);
}

/** Which of `gap` and `padding` a kind of component takes, by its catalog entry. */
export function spaceProps(kind: string, catalog: Catalog = analyticsCatalog): ("gap" | "padding")[] {
  const props = catalog.components[kind]?.props;
  return props ? (["gap", "padding"] as const).filter((prop) => prop in props) : [];
}

/**
 * The A2UI message that sets a container's `gap` or `padding` to a step of the spacing scale: the same message an
 * agent sends. The step the component already has, or the default it falls back to, sends nothing.
 */
export function spaceMessages(surface: Surface | undefined, id: string, prop: "gap" | "padding", step: SpaceStep, catalog: Catalog = analyticsCatalog): { messages: SurfaceMessage[] } | { error: string } {
  const component = surface?.components[id];
  if (!component) return { error: `There is no "${id}" on this surface.` };
  const kind = String(component.component);
  if (!spaceProps(kind, catalog).includes(prop)) return { error: `A ${kind} has no ${prop}.` };
  if ((component[prop] ?? spaceDefault(kind, prop)) === step) return { messages: [] };
  const { id: _id, component: _component, ...props } = component;
  return setComponentMessages(surface, id, { ...props, [prop]: step }, catalog);
}

/** The step a container's `gap` or `padding` is drawn with when it is not set: a gap of 4, a Card's padding of 4, no padding otherwise. */
export function spaceDefault(kind: string, prop: "gap" | "padding"): SpaceStep {
  return prop === "gap" || kind === "Card" ? 4 : "none";
}

/** Which prop sizes a component's height: its own `height` when its catalog entry has one, the box's `minHeight` otherwise. */
export function heightProp(kind: string, catalog: Catalog = analyticsCatalog): "height" | "minHeight" | undefined {
  const props = catalog.components[kind]?.props;
  return !props ? undefined : "height" in props ? "height" : "minHeight" in props ? "minHeight" : undefined;
}

/**
 * The A2UI message that makes a component taller or shorter: through its own
 * `height` when it has one, through the `minHeight` of its box otherwise.
 * The value is kept within what the catalog allows and rounded to ten pixels.
 */
export function heightMessages(
  surface: Surface | undefined,
  id: string,
  height: number,
  bounds: { minimum?: number; maximum?: number } | undefined,
  catalog: Catalog = analyticsCatalog,
): { messages: SurfaceMessage[] } | { error: string } {
  const current = surface?.components[id];
  if (!current) return { error: `There is no component "${id}" on the surface.` };
  const prop = heightProp(String(current.component), catalog);
  if (!prop) return { error: `A ${String(current.component)} has no height to set.` };
  const next = Math.max(bounds?.minimum ?? 0, Math.min(bounds?.maximum ?? Number.MAX_SAFE_INTEGER, Math.round(height / 10) * 10));
  if (next === current[prop]) return { messages: [] };
  const { id: _id, component: _component, ...props } = current;
  return setComponentMessages(surface, id, { ...props, [prop]: next }, catalog);
}

/**
 * The A2UI messages that put one component beside another that sits in a
 * stack: the two go into a new two-column Grid where the other one was, the
 * moved one on the side given. Where the other already sits in a Grid or a
 * Row, beside it is simply before or after it.
 */
export function besideMessages(surface: Surface | undefined, id: string, target: string, side: "left" | "right"): { messages: SurfaceMessage[] } | { error: string } {
  if (!surface?.components[id] || !surface.components[target]) return { error: "That component is not on the surface." };
  if (id === target) return { messages: [] };
  const from = placeOfComponent(surface, id);
  const to = placeOfComponent(surface, target);
  if (!from) return { error: `"${id}" is held by a container with a fixed place for it, so it cannot be moved on its own.` };
  if (!to) return { error: `"${target}" is held by a container with a fixed place for it, so nothing can be put beside it.` };
  if (within(surface, id, target)) return { error: `"${id}" cannot be put beside something inside itself.` };
  const parent = surface.components[to.parent]!;
  if (parent.component === "Grid" || parent.component === "Row") return moveComponentMessages(surface, id, to.parent, to.index + (side === "right" ? 1 : 0));
  const taken = new Set(Object.keys(surface.components));
  let gridId = "side-by-side";
  for (let n = 2; taken.has(gridId); n++) gridId = `side-by-side-${n}`;
  const grid: SurfaceComponent = { id: gridId, component: "Grid", columns: 2, children: side === "left" ? [id, target] : [target, id] };
  const source = surface.components[from.parent]!;
  // The target's container, with the grid where the target was; the moved component leaves its own container.
  const targetChildren = (parent.children as unknown[]).filter((child) => child !== id).map((child) => (child === target ? gridId : child));
  const changed: SurfaceComponent[] = [grid, { ...parent, children: targetChildren }];
  if (from.parent !== to.parent) changed.push({ ...source, children: (source.children as unknown[]).filter((child) => child !== id) });
  return { messages: [{ version: A2UI_VERSION, updateComponents: { surfaceId: surface.surfaceId, components: changed } }] };
}
