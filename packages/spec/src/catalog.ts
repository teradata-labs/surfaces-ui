import { z } from "zod";
import { A2UI_EARLIER_VERSIONS, A2UI_VERSION, accessibility, metadata } from "./dynamic.js";
import { SURFACES_EXPECTS, upgradeMessage } from "./upgrade.js";
import { type FunctionDefinition, standardFunctions } from "./functions.js";

export interface ComponentDefinition {
  /** When an agent should use it. Written for the agent. */
  description: string;
  /** Props beyond `id` and `component`. */
  props: z.ZodRawShape;
  /** A complete, valid instance, used in docs, the agent prompt and tests. */
  example: Record<string, unknown>;
  /**
   * What the component sends back through its `action`, keyed by what a
   * person does ("submit", "choose"). `context` names each value the
   * component adds to the event context, with what it holds. The event's
   * name is whatever the agent put in the action.
   */
  events?: Record<string, EventDefinition>;
}

export interface EventDefinition {
  /** When it is sent. */
  description: string;
  /**
   * Values the component adds to the event context, each typed and
   * described (`.describe()`). Published as JSON Schema, checked before an
   * event is sent.
   */
  context?: Record<string, z.ZodType>;
}

/**
 * What a component's event adds to the context, as a schema. Keys the
 * agent's own action declares are allowed alongside.
 */
export function eventContextSchema(event: EventDefinition): z.ZodType {
  return z.looseObject(event.context ?? {});
}

/** The JSON Schema (draft 2020-12) of what an event adds to the context. */
export function eventJsonSchema(event: EventDefinition): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(eventContextSchema(event), { unrepresentable: "any" }) as Record<string, unknown>;
  return schema;
}

/**
 * A reply contract an agent declares in createSurface (`expects`): JSON
 * Schema that an event's context must match. Returns the schema as zod, or
 * the reason it cannot be used.
 */
export function contractSchema(schema: unknown): { schema: z.ZodType } | { error: string } {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { error: "A contract is a JSON Schema object." };
  try {
    return { schema: z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export interface CatalogInput {
  /** Stable identifier agents put in `createSurface.catalogId`. */
  id: string;
  title: string;
  description: string;
  components: Record<string, ComponentDefinition>;
  /** Extra functions. The standard ones are always included. */
  functions?: Record<string, FunctionDefinition>;
}

export interface ValidationIssue {
  /** JSON pointer into the message or component. */
  path: string;
  message: string;
}

export interface Catalog extends Required<CatalogInput> {
  /** The full schema of one component, including `id` and `component`. */
  schema(name: string): z.ZodType | undefined;
  /** Checks one component from an `updateComponents` message. */
  validateComponent(component: unknown): ValidationIssue[];
  /** Checks a whole server-to-client message. */
  validateMessage(message: unknown): ValidationIssue[];
}

/**
 * True for a problem inside one component of a message. Such a message is still applied: the component is
 * reported where it would be drawn, and the rest of the surface stands.
 */
export const isComponentIssue = (issue: ValidationIssue): boolean => /^\/(updateComponents|createSurface)\/components\//.test(issue.path);

const issues = (error: z.ZodError, prefix = ""): ValidationIssue[] =>
  error.issues.map((issue) => ({ path: `${prefix}/${issue.path.join("/")}`.replace(/\/$/, "") || "/", message: issue.message }));

const version = z.literal(A2UI_VERSION);
const surfaceId = z.string().min(1);
/** One schema per message kind, so a problem is reported at the field that caused it. */
const envelopes = {
  createSurface: z.strictObject({
    version,
    createSurface: z.strictObject({
      surfaceId,
      catalogId: z.string().optional(),
      sendDataModel: z.boolean().optional(),
      components: z.array(z.unknown()).optional(),
      dataModel: z.unknown().optional(),
      // Extensions. This library reads `surfaces_theme` and `surfaces_expects` (event name to a JSON Schema the
      // event's context must match); anything else is carried and ignored.
      metadata: metadata.optional(),
    }),
  }),
  updateComponents: z.strictObject({ version, updateComponents: z.strictObject({ surfaceId, components: z.array(z.unknown()).min(1) }) }),
  updateDataModel: z.strictObject({
    version,
    updateDataModel: z
      .strictObject({ surfaceId, path: z.string().optional(), value: z.unknown() })
      .refine((body) => Object.hasOwn(body, "value"), { path: ["value"], message: "Give a value. null removes what is at the path." }),
  }),
  deleteSurface: z.strictObject({ version, deleteSurface: z.strictObject({ surfaceId }) }),
};
type Kind = keyof typeof envelopes;

/** A catalog that also lists its component names, typed, so what is built from it (markup elements) knows them. */
export type NamedCatalog<Name extends string> = Catalog & { names: readonly Name[] };

/**
 * Defines a component catalog once. Everything else is derived from it: the
 * A2UI catalog JSON, validation of agent output, the prompt that teaches an
 * agent to use it, and reference docs.
 */
export function defineCatalog<const I extends CatalogInput>(input: I): NamedCatalog<keyof I["components"] & string> {
  const schemas = new Map<string, z.ZodType>();
  for (const [name, definition] of Object.entries(input.components)) {
    schemas.set(
      name,
      z.strictObject({
        id: z.string().min(1).describe("Unique within the surface. The top component must be \"root\"."),
        component: z.literal(name),
        // The envelope keys of A2UI v1.0. The `@` keeps them apart from a component's own props.
        "@catalogId": z.literal(input.id).optional().describe("The component's catalog. This renderer draws one catalog per surface."),
        "@accessibility": accessibility.optional(),
        "@metadata": metadata.optional().describe("Extensions by name. Never drawn, resolved or run."),
        ...definition.props,
      }),
    );
  }
  const catalog: Catalog = {
    ...input,
    functions: { ...standardFunctions, ...input.functions },
    schema: (name) => schemas.get(name),
    validateComponent(component) {
      const name = (component as { component?: unknown } | null)?.component;
      const schema = typeof name === "string" ? schemas.get(name) : undefined;
      if (!schema) {
        return [{ path: "/component", message: `Unknown component ${JSON.stringify(name)}. Available: ${[...schemas.keys()].join(", ")}.` }];
      }
      const result = schema.safeParse(component);
      return result.success ? [] : issues(result.error);
    },
    validateMessage(incoming) {
      const sent = incoming !== null && typeof incoming === "object" ? (incoming as Record<string, unknown>).version : undefined;
      if (typeof sent === "string" && sent !== A2UI_VERSION && !A2UI_EARLIER_VERSIONS.includes(sent)) {
        return [{ path: "/version", message: `This renderer reads A2UI ${A2UI_VERSION} (and ${A2UI_EARLIER_VERSIONS.join(", ")}), not ${sent}.` }];
      }
      // A message in an earlier version is checked as what it becomes.
      const message = upgradeMessage(incoming);
      const record = message !== null && typeof message === "object" ? (message as Record<string, unknown>) : {};
      const kind = (Object.keys(envelopes) as Kind[]).find((key) => Object.hasOwn(record, key));
      if (!kind) return [{ path: "/", message: `Expected one of ${Object.keys(envelopes).join(", ")}.` }];
      const parsed = envelopes[kind].safeParse(message);
      if (!parsed.success) return issues(parsed.error);
      if (kind === "createSurface") {
        const body = record.createSurface as { catalogId?: string; components?: unknown[]; metadata?: { extensions?: Record<string, unknown> } };
        if (body.catalogId !== undefined && body.catalogId !== input.id) return [{ path: "/createSurface/catalogId", message: `This renderer supports catalog ${input.id}.` }];
        const expects = body.metadata?.extensions?.[SURFACES_EXPECTS];
        const contracts = expects !== null && typeof expects === "object" && !Array.isArray(expects) ? (expects as Record<string, unknown>) : {};
        return [
          ...(expects !== undefined && contracts !== expects ? [{ path: `/createSurface/metadata/extensions/${SURFACES_EXPECTS}`, message: "Expected event names mapped to JSON Schemas." }] : []),
          ...Object.entries(contracts).flatMap(([event, schema]) => {
            const parsed = contractSchema(schema);
            return "error" in parsed ? [{ path: `/createSurface/metadata/extensions/${SURFACES_EXPECTS}/${event}`, message: `Not a usable JSON Schema: ${parsed.error}` }] : [];
          }),
          ...(body.components ?? []).flatMap((component, index) =>
            catalog.validateComponent(component).map((issue) => ({ ...issue, path: `/createSurface/components/${index}${issue.path}` })),
          ),
        ];
      }
      if (kind !== "updateComponents") return [];
      return (record.updateComponents as { components: unknown[] }).components.flatMap((component, index) =>
        catalog.validateComponent(component).map((issue) => ({ ...issue, path: `/updateComponents/components/${index}${issue.path}` })),
      );
    },
  };
  return { ...catalog, names: Object.keys(input.components) as (keyof I["components"] & string)[] };
}
