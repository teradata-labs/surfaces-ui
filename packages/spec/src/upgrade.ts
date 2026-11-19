import { A2UI_EARLIER_VERSIONS, A2UI_VERSION } from "./dynamic.js";

/**
 * Reading what was written for A2UI v0.9. The library writes v1.0 only; anything older (a message from an agent
 * that has not moved, a page or a conversation saved before the move) is turned into v1.0 here, on the way in.
 *
 * What changed between the two, and so what this rewrites:
 * - a binding is `{ "@path": … }`, not `{ path: … }`, and a function call `{ "@call": … }`, not `{ call: … }`
 *   (a call's `returnType` is gone);
 * - a component's `accessibility` and `checks` are `@accessibility` and `@checks`;
 * - `createSurface` has no `theme`; it and this library's `expects` travel as extensions in its `metadata`;
 * - `updateDataModel` must carry `value`, and `null` removes what is at the path.
 *
 * A repeated child (`children: { componentId, path }`) and the `path` of `updateDataModel` keep their names: they
 * are not bindings. The rewrite walks the shape for that reason and is never a find-and-replace.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value);

/** The names this library gives its own extensions. */
export const SURFACES_THEME = "surfaces_theme";
export const SURFACES_EXPECTS = "surfaces_expects";

/**
 * A value from a v0.9 component, with its bindings and function calls in v1.0 form. It rewrites exactly what v0.9
 * read as one: an object whose only key is `path`, and an object with a text `call`.
 */
export function upgradeValue(value: unknown, depth = 0): unknown {
  if (depth > 32 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => upgradeValue(item, depth + 1));
  const record = value as Json;
  const keys = Object.keys(record);
  if (keys.length === 1 && keys[0] === "path" && typeof record.path === "string") return { "@path": record.path };
  if (typeof record.call === "string" && !("@call" in record)) {
    return { "@call": record.call, ...(isObject(record.args) ? { args: upgradeValue(record.args, depth + 1) } : {}) };
  }
  return Object.fromEntries(keys.map((key) => [key, upgradeValue(record[key], depth + 1)]));
}

/** A v0.9 component in v1.0 form. */
export function upgradeComponent<C extends { id: string; component: string }>(component: C): C {
  const out: Json = {};
  for (const [key, value] of Object.entries(component)) {
    if (key === "id" || key === "component") out[key] = value;
    else if (key === "accessibility" && !("@accessibility" in component)) out["@accessibility"] = upgradeValue(value);
    else if (key === "checks" && !("@checks" in component)) out["@checks"] = upgradeValue(value);
    // Envelope keys of v1.0 that are already there are left as they are: metadata is never rewritten.
    else if (key.startsWith("@")) out[key] = value;
    else out[key] = upgradeValue(value);
  }
  return out as C;
}

/** True when a message says it is in a version this library still reads but no longer writes. */
export const isEarlierVersion = (message: unknown): boolean => isObject(message) && typeof message.version === "string" && A2UI_EARLIER_VERSIONS.includes(message.version);

function withExtensions(metadata: unknown, added: Json): Json | undefined {
  const present = isObject(metadata) && isObject(metadata.extensions) ? metadata.extensions : {};
  const extensions = { ...added, ...present };
  return Object.keys(extensions).length > 0 ? { ...(isObject(metadata) ? metadata : {}), extensions } : undefined;
}

/**
 * A message in the current version. One already in it, or one that is not a message this library knows, comes back
 * as it was, so this is safe to call on anything.
 */
export function upgradeMessage<M>(message: M): M {
  if (!isEarlierVersion(message)) return message;
  const record = message as unknown as Json;
  if (isObject(record.createSurface)) {
    const { theme, expects, metadata, ...rest } = record.createSurface;
    const next = withExtensions(metadata, {
      ...(isObject(theme) && Object.keys(theme).length > 0 ? { [SURFACES_THEME]: theme } : {}),
      ...(isObject(expects) && Object.keys(expects).length > 0 ? { [SURFACES_EXPECTS]: expects } : {}),
    });
    return { ...record, version: A2UI_VERSION, createSurface: { ...rest, ...(next ? { metadata: next } : {}) } } as unknown as M;
  }
  if (isObject(record.updateComponents)) {
    const components = record.updateComponents.components;
    return {
      ...record,
      version: A2UI_VERSION,
      updateComponents: {
        ...record.updateComponents,
        components: Array.isArray(components) ? components.map((c) => (isObject(c) && typeof c.id === "string" && typeof c.component === "string" ? upgradeComponent(c as { id: string; component: string }) : c)) : components,
      },
    } as unknown as M;
  }
  if (isObject(record.updateDataModel)) {
    // v0.9 removed a value by leaving `value` out; v1.0 asks for null.
    return { ...record, version: A2UI_VERSION, updateDataModel: { ...record.updateDataModel, value: record.updateDataModel.value === undefined ? null : record.updateDataModel.value } } as unknown as M;
  }
  return { ...record, version: A2UI_VERSION } as unknown as M;
}

/** Messages in the current version, in order. */
export function upgradeMessages<M>(messages: readonly M[]): M[] {
  return messages.map(upgradeMessage);
}
