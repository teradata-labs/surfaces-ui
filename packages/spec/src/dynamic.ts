import { z } from "zod";

/** The A2UI protocol version these messages follow. Everything the library writes is this version. */
export const A2UI_VERSION = "1.0";

/** Earlier versions that are still read: a message in one of these is turned into the current form (`upgradeMessage`). */
export const A2UI_EARLIER_VERSIONS: readonly string[] = ["v0.9", "v0.9.1"];

/** A reference to a value in the surface's data model. Absolute ("/a/b") or relative to the current item ("name"). */
export const dataBinding = z.strictObject({ "@path": z.string() }).describe("A value read from the data model at this path.");

export const functionCall = z
  .strictObject({
    "@call": z.string(),
    args: z.record(z.string(), z.unknown()).optional(),
    catalogId: z.string().optional(),
  })
  .describe("A call to one of the catalog's functions.");

export const dynamicString = z.union([z.string(), dataBinding, functionCall]);
export const dynamicNumber = z.union([z.number(), dataBinding, functionCall]);
export const dynamicBoolean = z.union([z.boolean(), dataBinding, functionCall]);
export const dynamicValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), dataBinding, functionCall]);

/** A binding to a place in the data model, as the protocol writes it. */
export const binding = (path: string): { "@path": string } => ({ "@path": path });

/** An extension name: a Unicode identifier (UAX #31), as A2UI requires. `a2ui_` is kept for official extensions. */
const EXTENSION_NAME = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;
/** The most metadata one component, surface or action may carry, as JSON text. */
export const METADATA_LIMIT = 16_384;

/**
 * A2UI's `Extensions`: metadata that is never drawn, by name. Anyone but A2UI itself prefixes a name with its
 * product (`surfaces_locked`, `ontology_source`). A value is any JSON; nothing in it is resolved, checked or run.
 */
export const extensions = z.record(z.string().regex(EXTENSION_NAME, "An extension name must be an identifier."), z.unknown());

/** The metadata of a component (`@metadata`), a surface or an action (`metadata`): an `extensions` map and nothing else. */
export const metadata = z
  .strictObject({ extensions: extensions.optional() })
  .refine((value) => JSON.stringify(value).length <= METADATA_LIMIT, `Metadata is limited to ${METADATA_LIMIT} characters of JSON.`);

export type Metadata = z.infer<typeof metadata>;

/** What assistive technology is told about a component (`@accessibility`). */
export const accessibility = z.strictObject({
  label: dynamicString.optional(),
  description: dynamicString.optional(),
  live: z.enum(["off", "polite", "assertive"]).optional(),
  hidden: dynamicBoolean.optional(),
});

/** The ID of another component in the same surface. */
export const childId = z.string().describe("ID of a child component.");

/** Children: a list of component IDs, or one component repeated for each item of a data model list. */
export const childList = z.union([z.array(z.string()), z.strictObject({ componentId: z.string(), path: z.string() })]);

/** What happens when a control is used: an event sent back to the agent, or a local function. */
export const action = z.union([
  z.strictObject({ event: z.strictObject({ name: z.string(), userMessage: dynamicString.optional(), context: z.record(z.string(), dynamicValue).optional() }) }),
  z.strictObject({ functionCall }),
]);

export type Action = z.infer<typeof action>;
export type ChildList = z.infer<typeof childList>;

/** Reads a value from a JSON document by pointer ("/a/0/b"). */
export function getPath(data: unknown, pointer: string): unknown {
  if (pointer === "" || pointer === "/") return data;
  let current = data;
  for (const raw of pointer.replace(/^\//, "").split("/")) {
    if (current == null || typeof current !== "object") return undefined;
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Returns a copy of `data` with the value at `pointer` replaced, or removed when `value` is undefined. */
export function setPath(data: unknown, pointer: string, value: unknown): unknown {
  if (pointer === "" || pointer === "/") return value;
  const keys = pointer
    .replace(/^\//, "")
    .split("/")
    .map((k) => k.replace(/~1/g, "/").replace(/~0/g, "~"));
  const write = (node: unknown, depth: number): unknown => {
    const key = keys[depth]!;
    // Never write through the prototype chain.
    if (key === "__proto__" || key === "constructor" || key === "prototype") return node;
    const last = depth === keys.length - 1;
    const base: Record<string, unknown> | unknown[] = Array.isArray(node)
      ? [...node]
      : node !== null && typeof node === "object"
        ? { ...(node as Record<string, unknown>) }
        : /^\d+$/.test(key)
          ? []
          : {};
    const slot = base as Record<string, unknown>;
    if (last) {
      if (value === undefined) {
        if (Array.isArray(base)) base.splice(Number(key), 1);
        else delete slot[key];
      } else slot[key] = value;
    } else {
      slot[key] = write(slot[key], depth + 1);
    }
    return base;
  };
  return write(data, 0);
}

/** Resolves a relative path against the current scope. */
export function absolutePath(path: string, scope: string): string {
  if (path.startsWith("/")) return path;
  if (path === "" || path === ".") return scope || "/";
  return `${scope === "/" ? "" : scope}/${path}`;
}

export type FunctionImpl = (args: Record<string, unknown>, context: ResolveContext) => unknown;

export interface ResolveContext {
  data: unknown;
  /** Data model path that relative paths resolve against. */
  scope: string;
  functions: Record<string, FunctionImpl>;
}

/** True for `{ "@path": … }` and nothing else beside it. */
export const isBinding = (value: unknown): value is { "@path": string } => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "@path" && typeof (value as { "@path": unknown })["@path"] === "string";
};
/** True for `{ "@call": … }`. */
export const isCall = (value: unknown): value is { "@call": string; args?: Record<string, unknown> } =>
  value !== null && typeof value === "object" && !Array.isArray(value) && typeof (value as { "@call"?: unknown })["@call"] === "string";

/**
 * Replaces data bindings and function calls with their values, anywhere in
 * a props tree. Plain values pass through.
 */
export function resolve(value: unknown, context: ResolveContext, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth > 32) return value;
  if (Array.isArray(value)) return value.map((item) => resolve(item, context, depth + 1));
  if (isBinding(value)) return getPath(context.data, absolutePath(value["@path"], context.scope));
  if (isCall(value)) {
    const implementation = Object.hasOwn(context.functions, value["@call"]) ? context.functions[value["@call"]] : undefined;
    if (!implementation) return undefined;
    const args = Object.fromEntries(Object.entries(value.args ?? {}).map(([k, v]) => [k, resolve(v, context, depth + 1)]));
    return implementation(args, context);
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, context, depth + 1)]));
}
