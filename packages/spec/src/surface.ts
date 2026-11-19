import { A2UI_VERSION, type Metadata, setPath } from "./dynamic.js";
import { SURFACES_EXPECTS, SURFACES_THEME, isEarlierVersion, upgradeComponent, upgradeMessage } from "./upgrade.js";

/** One component as it arrives in an `updateComponents` message. */
export interface SurfaceComponent {
  id: string;
  component: string;
  [prop: string]: unknown;
}

export interface Surface {
  surfaceId: string;
  /** The surface's catalog. Empty when `createSurface` named none. */
  catalogId: string;
  /**
   * The protocol version its components are written in. A surface kept before this was recorded has none and is
   * read as v0.9 (`upgradeSurface`).
   */
  a2ui?: string;
  /** What `createSurface` carried in `metadata`: extensions by name, never drawn. */
  metadata?: Metadata;
  /** A theme request for this surface alone: the `surfaces_theme` extension. */
  theme?: Record<string, unknown>;
  /** When true, every action from this surface carries its whole data model (`SurfaceAction.dataModel`). */
  sendDataModel?: boolean;
  /**
   * The replies the agent expects, by event name: JSON Schema (draft 2020-12)
   * each event's context must match. An event that does not match is not sent. The `surfaces_expects` extension.
   */
  expects?: Record<string, Record<string, unknown>>;
  components: Record<string, SurfaceComponent>;
  /** The surface's data model. */
  data: unknown;
}

export type Surfaces = Record<string, Surface>;

/** What `createSurface` holds. */
export interface CreateSurface {
  surfaceId: string;
  /** The catalog its components come from, unless one names its own with `@catalogId`. */
  catalogId?: string;
  sendDataModel?: boolean;
  /** The components, when they are sent with the surface and not in a later `updateComponents`. */
  components?: SurfaceComponent[];
  /** The data model to start from. */
  dataModel?: unknown;
  /** Extensions for the surface: this library's are `surfaces_theme` and `surfaces_expects`. */
  metadata?: Metadata;
}

/** An agent-to-renderer A2UI message. */
export type SurfaceMessage =
  | { version: string; createSurface: CreateSurface }
  | { version: string; updateComponents: { surfaceId: string; components: SurfaceComponent[] } }
  /** `value: null` removes what is at `path`. */
  | { version: string; updateDataModel: { surfaceId: string; path?: string; value: unknown } }
  | { version: string; deleteSurface: { surfaceId: string } };

/** What to put in `createSurface.metadata` for a theme request and reply contracts; undefined when there is neither. */
export function surfaceMetadata(options: { theme?: Record<string, unknown>; expects?: Record<string, Record<string, unknown>>; extensions?: Record<string, unknown> }): Metadata | undefined {
  const extensions = {
    ...options.extensions,
    ...(options.theme && Object.keys(options.theme).length > 0 ? { [SURFACES_THEME]: options.theme } : {}),
    ...(options.expects && Object.keys(options.expects).length > 0 ? { [SURFACES_EXPECTS]: options.expects } : {}),
  };
  return Object.keys(extensions).length > 0 ? { extensions } : undefined;
}

const record = (value: unknown): Record<string, unknown> | undefined => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined);

/** The theme request a surface's metadata carries, if any. */
export const metadataTheme = (metadata: Metadata | undefined): Record<string, unknown> | undefined => record(metadata?.extensions?.[SURFACES_THEME]);

/** The reply contracts a surface's metadata carries, if any. */
export const metadataExpects = (metadata: Metadata | undefined): Record<string, Record<string, unknown>> | undefined =>
  record(metadata?.extensions?.[SURFACES_EXPECTS]) as Record<string, Record<string, unknown>> | undefined;

/**
 * A surface kept before the move to A2UI v1.0, in the current form. One that says it is current comes back as it
 * is, so this is safe on every surface taken from storage.
 */
export function upgradeSurface(surface: Surface): Surface {
  if (surface.a2ui === A2UI_VERSION) return surface;
  return { ...surface, a2ui: A2UI_VERSION, components: Object.fromEntries(Object.entries(surface.components).map(([id, component]) => [id, upgradeComponent(component)])) };
}

/** A client-to-server action, sent when a person uses a control. */
export interface SurfaceAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  /** ISO 8601. */
  timestamp: string;
  context: Record<string, unknown>;
  /** What the person did, in words, when the action's event declared `userMessage`. */
  userMessage?: string;
  /** Extensions the renderer sends back with the action. */
  metadata?: Metadata;
  /** The surface's data model, including what a person typed, when the surface was created with `sendDataModel`. */
  dataModel?: unknown;
}

export class SurfaceError extends Error {
  constructor(
    readonly code: "UNKNOWN_SURFACE" | "INVALID_MESSAGE" | "SURFACE_EXISTS",
    message: string,
    readonly surfaceId = "",
  ) {
    super(message);
    this.name = "SurfaceError";
  }
}

/**
 * Applies one message to the set of surfaces and returns the new set. Pure:
 * the input is never changed, so it works as a reducer and streams apply in
 * order as they arrive.
 */
export function applyMessage(surfaces: Surfaces, incoming: SurfaceMessage): Surfaces {
  const message = upgradeMessage(incoming);
  if ("createSurface" in message) {
    const { surfaceId, catalogId, sendDataModel, components, dataModel, metadata } = message.createSurface;
    // A surface is made once. Making it again would silently throw away what it holds. A v0.9 message still
    // starts the surface over, as it did when it was written, so a kept stream replays to what it drew.
    if (Object.hasOwn(surfaces, surfaceId) && !isEarlierVersion(incoming)) throw new SurfaceError("SURFACE_EXISTS", `A surface "${surfaceId}" already exists. Change it with updateComponents and updateDataModel, or send deleteSurface first.`, surfaceId);
    const theme = metadataTheme(metadata);
    const expects = metadataExpects(metadata);
    return {
      ...surfaces,
      [surfaceId]: {
        surfaceId,
        catalogId: catalogId ?? "",
        a2ui: A2UI_VERSION,
        ...(metadata ? { metadata } : {}),
        ...(theme ? { theme } : {}),
        ...(sendDataModel ? { sendDataModel } : {}),
        ...(expects && Object.keys(expects).length > 0 ? { expects } : {}),
        components: Object.fromEntries((components ?? []).map((component) => [component.id, component])),
        data: dataModel ?? {},
      },
    };
  }
  if ("deleteSurface" in message) {
    const { [message.deleteSurface.surfaceId]: _removed, ...rest } = surfaces;
    return rest;
  }
  const body = "updateComponents" in message ? message.updateComponents : "updateDataModel" in message ? message.updateDataModel : undefined;
  if (!body) throw new SurfaceError("INVALID_MESSAGE", "The message is not a recognised A2UI message.");
  const held = Object.hasOwn(surfaces, body.surfaceId) ? surfaces[body.surfaceId] : undefined;
  if (!held) throw new SurfaceError("UNKNOWN_SURFACE", `No surface "${body.surfaceId}" exists. Send createSurface first.`, body.surfaceId);
  const surface = upgradeSurface(held);

  if ("updateComponents" in message) {
    const components = { ...surface.components };
    // A component is replaced whole, its `@metadata` included: one sent without it has none.
    for (const component of message.updateComponents.components) components[component.id] = component;
    return { ...surfaces, [surface.surfaceId]: { ...surface, components } };
  }
  const { path, value } = message.updateDataModel;
  // null removes what is at the path; setPath removes on undefined.
  return { ...surfaces, [surface.surfaceId]: { ...surface, data: setPath(surface.data, path ?? "/", value === null ? undefined : value) ?? {} } };
}

/** Applies messages in order. */
export function applyMessages(surfaces: Surfaces, messages: SurfaceMessage[]): Surfaces {
  return messages.reduce(applyMessage, surfaces);
}
