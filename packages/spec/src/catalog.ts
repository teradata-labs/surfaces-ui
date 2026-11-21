import { z } from "zod";
import { A2UI_EARLIER_VERSIONS, A2UI_VERSION, accessibility, condition, metadata } from "./dynamic.js";
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

type Issue = z.core.$ZodIssue;

/**
 * A value that fits none of a union's forms is reported as the problems of the form it came closest to, so
 * `{ event: { nme: "x" } }` says the event has no `name` and not just that the action is invalid. The closest
 * form is the one whose first problem lies deepest: it took the value's outer shape. When no form is closer than
 * the rest (or the value is another kind of thing altogether), the union's own message says what was expected.
 */
function flatten(issue: Issue): Issue[] {
  if (issue.code !== "invalid_union" || !issue.errors?.length) return [issue];
  const rank = (branch: Issue[]) => {
    const wrongKind = branch.some((one) => one.path.length === 0 && one.code === "invalid_type");
    return wrongKind ? -1 : Math.min(...branch.map((one) => one.path.length));
  };
  const ranked = issue.errors.filter((branch) => branch.length > 0).map((branch) => ({ branch, rank: rank(branch) }));
  const best = Math.max(...ranked.map((one) => one.rank));
  const closest = ranked.filter((one) => one.rank === best);
  if (best < 1 || closest.length !== 1) return [issue];
  return closest[0]!.branch.flatMap((one) => flatten({ ...one, path: [...issue.path, ...one.path] }));
}

const issues = (error: z.ZodError, prefix = ""): ValidationIssue[] =>
  error.issues.flatMap(flatten).map((issue) => ({ path: `${prefix}/${issue.path.join("/")}`.replace(/\/$/, "") || "/", message: issue.message }));

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

const minHeight = z.number().int().min(24).max(1600).optional().describe("The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.");

/**
 * Every component can be given room. One whose own props size it (a chart's
 * or a grid's `height`) keeps that; every other one takes `minHeight`, which
 * the surface applies to the component's box, so anything a person can drag
 * taller in an editor, an agent can make taller too.
 */
export function withMinHeight<K extends string>(components: Record<K, ComponentDefinition>): Record<K, ComponentDefinition> {
  return Object.fromEntries(
    Object.entries<ComponentDefinition>(components).map(([name, definition]) => [name, "height" in definition.props || "minHeight" in definition.props ? definition : { ...definition, props: { ...definition.props, minHeight } }]),
  ) as Record<K, ComponentDefinition>;
}

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
        // Any component can wait for a value in the data model, so a form shows only the fields a choice calls for.
        visibleWhen: condition.optional(),
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

/**
 * A catalog built on another: everything the base draws, plus the host's own components and functions, under an
 * id of its own. This is how an app adds its components to the analytics catalog and still has one catalog that
 * checks every surface. Each added component is given `minHeight` like the base's, so it can be sized by hand.
 * A name the base already has is refused: a surface must mean the same thing under either catalog.
 */
export function extendCatalog<const B extends Catalog, const I extends Pick<CatalogInput, "id" | "title" | "description" | "components"> & { functions?: CatalogInput["functions"] }>(
  base: B,
  input: I,
): NamedCatalog<(keyof B["components"] & string) | (keyof I["components"] & string)> {
  const taken = Object.keys(input.components).filter((name) => Object.hasOwn(base.components, name));
  if (taken.length > 0) throw new Error(`The catalog ${base.id} already has ${taken.join(", ")}. Give ${taken.length === 1 ? "it another name" : "them other names"}.`);
  if (input.id === base.id) throw new Error("A catalog built on another needs an id of its own.");
  return defineCatalog({
    id: input.id,
    title: input.title,
    description: input.description,
    components: { ...base.components, ...withMinHeight(input.components) },
    functions: { ...base.functions, ...input.functions },
  }) as NamedCatalog<(keyof B["components"] & string) | (keyof I["components"] & string)>;
}
