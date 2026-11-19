import { isBinding } from "./dynamic.js";
import type { Metadata } from "./dynamic.js";
import type { JsonRenderSpec } from "./jsonrender.js";
import type { SurfaceComponent } from "./surface.js";

/**
 * One surface, three ways to write it. A2UI is the list of components an agent sends; json-render is the same tree
 * as `{ root, elements, state }`; markup is the same tree as JSX (`<Ui.Row><Ui.Metric … /></Ui.Row>`), which
 * `analyticsMarkup` in `@surfaces-ui/spec/react` draws. All three carry exactly the catalog's props, so a component's
 * page can show each and a test can prove they are the same surface.
 */

/** `{ "@path" }` (A2UI) becomes `{ $state }` (json-render), at any depth. */
function toState(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toState);
  if (isBinding(value)) return { $state: value["@path"] };
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toState(v)]));
  return value;
}

/** The ids a component holds, in order: its `children`, or its one `child`. */
export function childIds(component: SurfaceComponent): string[] {
  if (Array.isArray(component.children)) return component.children.filter((c): c is string => typeof c === "string");
  return typeof component.child === "string" ? [component.child] : [];
}

/** Everything a component says about itself, without its id, its kind or the components it holds. */
function ownProps(component: SurfaceComponent): Record<string, unknown> {
  const { id: _id, component: _kind, children: _children, child: _child, ...rest } = component;
  return rest;
}

const isMetadata = (value: unknown): value is Metadata => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The components as a json-render spec. The root element is keyed `root`, as `fromJsonRender` names it, so
 * `fromJsonRender(toJsonRender(components))` gives the same components back.
 */
export function toJsonRender(components: SurfaceComponent[], options: { root?: string; data?: unknown; metadata?: Metadata } = {}): JsonRenderSpec {
  const root = options.root ?? "root";
  const elements: JsonRenderSpec["elements"] = {};
  for (const component of components) {
    // A component's metadata is the element's: it is not a prop, and nothing in it is a binding.
    const { "@metadata": held, ...own } = ownProps(component);
    const props = toState(own) as Record<string, unknown>;
    const children = childIds(component);
    elements[component.id] = {
      type: component.component,
      ...(Object.keys(props).length ? { props } : {}),
      ...(children.length ? { children } : {}),
      ...(isMetadata(held) ? { metadata: held } : {}),
    };
  }
  const state = options.data !== null && typeof options.data === "object" && Object.keys(options.data).length ? (options.data as Record<string, unknown>) : undefined;
  return { root, elements, ...(state ? { state } : {}), ...(options.metadata ? { metadata: options.metadata } : {}) };
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A prop value as JSX writes it: a plain string in quotes, anything else as an expression. */
function attribute(name: string, value: unknown): string {
  // An envelope key (`@metadata`) is not a JSX attribute name, so it is spread.
  if (!IDENTIFIER.test(name)) return `{...{ ${JSON.stringify(name)}: ${expression(value)} }}`;
  if (value === true) return name;
  if (typeof value === "string" && !/["\n{}<>&]/.test(value)) return `${name}="${value}"`;
  return `${name}={${expression(value)}}`;
}

/** A value as a JavaScript expression, with object keys unquoted where they can be. */
function expression(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(expression).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => `${IDENTIFIER.test(k) ? k : JSON.stringify(k)}: ${expression(v)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return JSON.stringify(value);
}

export interface MarkupOptions {
  /** The root component's id. Default `root`. */
  root?: string;
  /** What the markup object is called in the code. Default `Ui`. */
  name?: string;
  /** How wide a line may grow before each prop goes on a line of its own. Default 88. */
  width?: number;
}

/**
 * The components as JSX for `analyticsMarkup`: each component an element named after it, props as attributes, and
 * the components it holds nested inside. An id is written only where it is not the one the markup would make up
 * (the component's kind in lower case, numbered when repeated), so the code stays short and still reads back the same.
 */
export function toMarkup(components: SurfaceComponent[], options: MarkupOptions = {}): string {
  const byId = new Map(components.map((c) => [c.id, c]));
  const ui = options.name ?? "Ui";
  const width = options.width ?? 88;
  const seen = new Map<string, number>();
  const madeUp = (kind: string) => {
    const n = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, n);
    return n === 1 ? kind.toLowerCase() : `${kind.toLowerCase()}-${n}`;
  };
  const write = (id: string, depth: number, isRoot: boolean): string => {
    const component = byId.get(id);
    const pad = "  ".repeat(depth);
    if (!component) return `${pad}{/* ${id} is not in the surface */}`;
    const tag = `${ui}.${component.component}`;
    const expected = isRoot ? (options.root ?? "root") : madeUp(component.component);
    const attrs = [...(component.id === expected ? [] : [attribute("id", component.id)]), ...Object.entries(ownProps(component)).map(([k, v]) => attribute(k, v))];
    const inline = `${pad}<${tag}${attrs.map((a) => ` ${a}`).join("")}`;
    const open = inline.length <= width ? inline : `${pad}<${tag}\n${attrs.map((a) => `${pad}  ${a}`).join("\n")}\n${pad}`;
    const kids = childIds(component);
    if (kids.length === 0) return `${open}${open.endsWith("\n" + pad) ? "" : " "}/>`;
    const inner = kids.map((kid) => write(kid, depth + 1, false)).join("\n");
    return `${open}>\n${inner}\n${pad}</${tag}>`;
  };
  return write(options.root ?? "root", 0, true);
}
