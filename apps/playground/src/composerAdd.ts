import { A2UI_VERSION, type Surface, type SurfaceComponent, type SurfaceMessage, analyticsCatalog } from "@surfaces-ui/spec";

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const words = (id: string) => id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The A2UI messages that add one catalog component, with `props`, to the end
 * of a surface's root. The new component gets an id the surface does not use
 * yet. A layout component's example names children that do not exist, so each
 * becomes a caption to replace. With no surface yet, the messages create one
 * with a `Column` root. A root that cannot hold children is reported, not
 * replaced.
 */
export function addComponentMessages(surface: Surface | undefined, surfaceId: string, name: string, props: Record<string, unknown>): { messages: SurfaceMessage[]; id: string } | { error: string } {
  if (!analyticsCatalog.components[name]) return { error: `"${name}" is not in the catalog.` };
  const taken = new Set(Object.keys(surface?.components ?? {}));
  const base = kebab(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);

  // Children named by the example, renamed under the new id so they cannot clash.
  const placeholders: SurfaceComponent[] = [];
  const rename = (child: unknown) => {
    if (typeof child !== "string") return child;
    let next = `${id}-${child}`;
    for (let n = 2; taken.has(next); n++) next = `${id}-${child}-${n}`;
    taken.add(next);
    placeholders.push({ id: next, component: "Text", text: name === "Button" ? "Button" : `${words(child)}: replace with a component`, ...(name === "Button" ? {} : { variant: "caption" }) });
    return next;
  };
  const added: SurfaceComponent = { ...props, id, component: name };
  if (Array.isArray(added.children)) added.children = added.children.map(rename);
  if (typeof added.child === "string") added.child = rename(added.child);
  if (Array.isArray(added.tabs)) added.tabs = added.tabs.map((tab) => (tab && typeof tab === "object" ? { ...tab, child: rename((tab as { child?: unknown }).child) } : tab));
  if (Array.isArray(added.panels)) added.panels = added.panels.map((panel) => (panel && typeof panel === "object" ? { ...panel, child: rename((panel as { child?: unknown }).child) } : panel));

  const messages: SurfaceMessage[] = [];
  const root = surface?.components.root;
  let newRoot: SurfaceComponent;
  if (!surface) {
    messages.push({ version: A2UI_VERSION, createSurface: { surfaceId, catalogId: analyticsCatalog.id } });
    newRoot = { id: "root", component: "Column", children: [id] };
  } else if (!root) {
    newRoot = { id: "root", component: "Column", children: [id] };
  } else if (Array.isArray(root.children)) {
    newRoot = { ...root, children: [...root.children, id] };
  } else {
    return { error: `The root is a ${String(root.component)}, which holds no list of children. Make the root a Column first.` };
  }
  messages.push({ version: A2UI_VERSION, updateComponents: { surfaceId: surface?.surfaceId ?? surfaceId, components: [newRoot, added, ...placeholders] } });
  return { messages, id };
}

export {
  MIN_COLUMN_SHARE,
  type OutlineItem,
  besideMessages,
  gridShares,
  gridWidthsMessages,
  heightMessages,
  heightProp,
  moveComponentMessages,
  placeOfComponent,
  removeComponentMessages,
  setComponentMessages,
  slideShares,
  stepComponentMessages,
  surfaceOutline,
} from "@surfaces-ui/spec";
