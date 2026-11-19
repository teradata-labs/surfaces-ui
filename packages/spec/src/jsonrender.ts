import type { Catalog } from "./catalog.js";
import { A2UI_VERSION, type Metadata } from "./dynamic.js";
import type { SurfaceComponent, SurfaceMessage } from "./surface.js";

/** One element of a json-render spec. */
export interface JsonRenderElement {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  /**
   * Extensions by name, never drawn: A2UI's component `@metadata`. json-render has no metadata key of its own; its
   * validator and renderer ignore this one.
   */
  metadata?: Metadata;
}

/** A json-render style spec: a root key, elements by key, and optional state. */
export interface JsonRenderSpec {
  root: string;
  elements: Record<string, JsonRenderElement>;
  state?: Record<string, unknown>;
  /** Extensions for the whole surface: A2UI's `createSurface.metadata`. */
  metadata?: Metadata;
}

export interface JsonRenderOptions {
  surfaceId?: string;
  /**
   * Maps element types to catalog components, with fixed props to add.
   * Types that already name a catalog component need no entry.
   */
  typeMap?: Record<string, { component: string; props?: Record<string, unknown>; rename?: Record<string, string> }>;
}

/**
 * Element types used by earlier json-render dashboards, mapped onto the analytics catalog. A type that names a
 * catalog component is that component (a `Grid` is the catalog's grid), so a spec written from catalog components
 * reads back unchanged; the one exception is a `Table` given `sql`, which earlier dashboards used for a query result.
 */
export const defaultTypeMap: NonNullable<JsonRenderOptions["typeMap"]> = {
  Box: { component: "Column" },
  Stack: { component: "Column" },
  Heading: { component: "Text", props: { variant: "h2" } },
  Paragraph: { component: "Text", props: { variant: "body" } },
  StatCard: { component: "Stat", rename: { title: "label" } },
};

/** `{ "$state": "/path" }` in json-render is a data binding. */
function bindings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(bindings);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.$state === "string" && Object.keys(record).length === 1) return { "@path": record.$state };
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, bindings(v)]));
  }
  return value;
}

/**
 * Converts a json-render spec into A2UI messages for a catalog, so specs
 * written for json-render keep working. Element keys become component IDs
 * (the root element becomes "root"); `children` become `children` or `child`
 * depending on what the target component accepts.
 */
export function fromJsonRender(spec: JsonRenderSpec, catalog: Catalog, options: JsonRenderOptions = {}): SurfaceMessage[] {
  const surfaceId = options.surfaceId ?? "main";
  const idOf = (key: string) => (key === spec.root ? "root" : key);
  const mapping = (element: JsonRenderSpec["elements"][string]) => {
    if (options.typeMap && Object.hasOwn(options.typeMap, element.type)) return options.typeMap[element.type]!;
    if (element.type === "Table" && element.props && "sql" in element.props) return { component: "DataGrid" };
    if (Object.hasOwn(catalog.components, element.type)) return { component: element.type };
    return Object.hasOwn(defaultTypeMap, element.type) ? defaultTypeMap[element.type]! : { component: element.type };
  };
  const components: SurfaceComponent[] = Object.entries(spec.elements).map(([key, element]) => {
    const mapped: { component: string; props?: Record<string, unknown>; rename?: Record<string, string> } = mapping(element);
    const props = Object.fromEntries(
      Object.entries(bindings(element.props ?? {}) as Record<string, unknown>).map(([name, value]) => [mapped.rename?.[name] ?? name, value]),
    );
    const component: SurfaceComponent = { ...mapped.props, ...props, id: idOf(key), component: mapped.component, ...(element.metadata ? { "@metadata": element.metadata } : {}) };
    const children = (element.children ?? []).map(idOf);
    const accepts = Object.keys(catalog.components[mapped.component]?.props ?? {});
    if (accepts.includes("children")) component.children = children;
    else if (accepts.includes("child") && children[0]) component.child = children[0];
    return component;
  });
  const messages: SurfaceMessage[] = [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: catalog.id, ...(spec.metadata ? { metadata: spec.metadata } : {}) } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components } },
  ];
  if (spec.state) messages.push({ version: A2UI_VERSION, updateDataModel: { surfaceId, path: "/", value: spec.state } });
  return messages;
}
