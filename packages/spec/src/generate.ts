import { z } from "zod";
import { type Catalog, eventJsonSchema } from "./catalog.js";
import { A2UI_VERSION } from "./dynamic.js";
import { toJsonRender, toMarkup } from "./markup.js";
import type { SurfaceComponent } from "./surface.js";

const jsonSchema = (schema: z.ZodType) => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  return rest;
};

/** The catalog as an A2UI catalog document (JSON Schema), for clients and agents that negotiate catalogs. */
export function catalogJson(catalog: Catalog): Record<string, unknown> {
  const names = Object.keys(catalog.components);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: catalog.id,
    protocolVersion: A2UI_VERSION,
    title: catalog.title,
    description: catalog.description,
    catalogId: catalog.id,
    components: Object.fromEntries(
      names.map((name) => {
        const definition = catalog.components[name]!;
        return [name, { description: definition.description, ...jsonSchema(catalog.schema(name)!), ...(definition.events
          ? { "x-events": Object.fromEntries(Object.entries(definition.events).map(([trigger, event]) => [trigger, { description: event.description, context: eventJsonSchema(event) }])) }
          : {}) }];
      }),
    ),
    functions: Object.fromEntries(
      Object.entries(catalog.functions).map(([name, fn]) => [
        name,
        {
          description: fn.description,
          type: "object",
          properties: { "@call": { const: name }, args: jsonSchema(z.object(fn.args)) },
          required: ["@call", "args"],
          returnType: fn.returnType,
        },
      ]),
    ),
    $defs: {
      anyComponent: { oneOf: names.map((name) => ({ $ref: `#/components/${name}` })) },
      anyFunction: { oneOf: Object.keys(catalog.functions).map((name) => ({ $ref: `#/functions/${name}` })) },
    },
  };
}

function propLines(catalog: Catalog, name: string): string[] {
  const schema = jsonSchema(catalog.schema(name)!) as { properties?: Record<string, Record<string, unknown>>; required?: string[] };
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {})
    .filter(([prop]) => prop !== "id" && prop !== "component" && !prop.startsWith("@"))
    .map(([prop, shape]) => {
      const kind = Array.isArray(shape.enum)
        ? (shape.enum as unknown[]).map((v) => JSON.stringify(v)).join(" | ")
        : typeof shape.type === "string"
          ? shape.type
          : "value or binding";
      return `- \`${prop}\`${required.has(prop) ? "" : " (optional)"}: ${kind}${typeof shape.description === "string" ? ` — ${shape.description}` : ""}`;
    });
}

function eventLines(catalog: Catalog, name: string): string[] {
  const events = catalog.components[name]?.events;
  if (!events) return [];
  return Object.entries(events).map(([trigger, event]) => {
    const context = Object.entries(event.context ?? {}).map(([key, type]) => `\`${key}\` (${type.description ?? "a value"})`);
    return `- **${trigger}**: ${event.description}${context.length ? ` Adds ${context.join(", ")}.` : ""}`;
  });
}

/** Reference documentation for each component, as Markdown keyed by component name. */
export function catalogDocs(catalog: Catalog): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalog.components).map(([name, definition]) => [
      name,
      [
        `# ${name}`,
        "",
        definition.description,
        "",
        "## Props",
        "",
        ...propLines(catalog, name),
        "",
        ...(definition.events ? ["## Events", "", "Sent through the component's `action`; the event name is the one in the action.", "", ...eventLines(catalog, name), ""] : []),
        "## Example",
        "",
        "The same component written three ways. Each draws the same surface.",
        "",
        "As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:",
        "",
        "```tsx",
        toMarkup([definition.example as SurfaceComponent], { root: String(definition.example.id) }),
        "```",
        "",
        "As an agent sends it (one component of an A2UI `updateComponents` message):",
        "",
        "```json",
        JSON.stringify(definition.example, null, 2),
        "```",
        "",
        "As a json-render spec, which `fromJsonRender` converts:",
        "",
        "```json",
        JSON.stringify(toJsonRender([definition.example as SurfaceComponent], { root: String(definition.example.id) }), null, 2),
        "```",
        "",
      ].join("\n"),
    ]),
  );
}

/**
 * Instructions that teach an agent to produce UI with this catalog. Generated
 * from the catalog, so it cannot drift from what the renderer accepts.
 */
export function catalogPrompt(catalog: Catalog): string {
  const sample = [
    { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: catalog.id } },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: "main",
        components: [
          { id: "root", component: "Column", children: ["title"] },
          { id: "title", component: "Text", text: { "@path": "/title" }, variant: "h2" },
        ],
      },
    },
    { version: A2UI_VERSION, updateDataModel: { surfaceId: "main", path: "/title", value: "Hello" } },
  ];
  return [
    `# Building UI with the ${catalog.title} catalog`,
    "",
    `You describe UI as A2UI ${A2UI_VERSION} messages, one JSON object per message. The client draws them with its own components; you never write HTML or code.`,
    "",
    "## Messages",
    "",
    `1. \`createSurface\` — start a surface, once: \`{ surfaceId, catalogId: "${catalog.id}" }\`, optionally with \`sendDataModel\`, \`metadata\` (below), and the surface's first \`components\` and \`dataModel\`. Sending it again for a surface that exists is an error.`,
    "2. `updateComponents` — add or replace components. Components are a flat list; parents name children by `id`. Exactly one component must have `id: \"root\"`.",
    "3. `updateDataModel` — set data at a path (`/a/b`). `value` is required; `null` removes what is there. Omit `path` to replace everything.",
    "4. `deleteSurface` — remove a surface.",
    "",
    `Every message has \`"version": "${A2UI_VERSION}"\`.`,
    "",
    "## Rules",
    "",
    "- Use only the components and props listed below. Unknown components or props are rejected.",
    "- Any prop that accepts a binding can be a literal or `{ \"@path\": \"/data/path\" }`. Put values that change in the data model and bind to them.",
    "- Inside a repeated child (`children: { componentId, path }`), relative paths such as `{ \"@path\": \"name\" }` read from the current item.",
    "- A function is called with `{ \"@call\": \"name\", \"args\": { … } }`.",
    "- A component is replaced whole by `updateComponents`. Anything you leave out of it, its `@metadata` included, is gone.",
    "- `@metadata: { extensions: { name: value } }` on a component, and `metadata` on `createSurface`, carry data that is never drawn. Prefix a name with whose it is (`acme_ticket`). Keep one you find on a component when you send that component again.",
    "- SQL must be a single read-only SELECT. Never put user-typed text into SQL; sorting, filtering and paging are done by the components.",
    "- For charts over large tables, give each measure an `aggregate`.",
    "- Buttons send an `event` back to you with the `context` you declare. Wait for it; do not assume it happened.",
    "",
    "## Getting the reply you need",
    "",
    "- In `createSurface`, the `surfaces_expects` extension declares what you need back: an event name mapped to a JSON Schema for that event's context, e.g. `\"metadata\": { \"extensions\": { \"surfaces_expects\": { \"approve\": { \"type\": \"object\", \"properties\": { \"budget\": { \"type\": \"number\", \"minimum\": 1 } }, \"required\": [\"budget\"] } } } }`. An event that does not match is not sent; you are told why instead.",
    "- The `surfaces_theme` extension, in the same place, styles this surface alone: `{ \"preset\": \"Ink\", \"mode\": \"dark\" }`.",
    "- `sendDataModel: true` sends the whole data model (everything the person typed) with each event.",
    "- Every turn tells you each surface as it stands: its data model, how the person left controls (sorts, filters, columns, in the same props you set), and problems with what you drew. Fix problems with new messages; keep a person's control changes unless asked to change them.",
    "",
    "## Functions",
    "",
    ...Object.entries(catalog.functions).map(([name, fn]) => `- \`${name}(${Object.keys(fn.args).join(", ")})\` → ${fn.returnType}: ${fn.description}`),
    "",
    "## Components",
    "",
    ...Object.entries(catalog.components).flatMap(([name, definition]) => [
      `### ${name}`,
      definition.description,
      ...propLines(catalog, name),
      ...(definition.events ? ["Sends:", ...eventLines(catalog, name)] : []),
      `Example: \`${JSON.stringify(definition.example)}\``,
      "",
    ]),
    "## A complete example",
    "",
    "```json",
    ...sample.map((message) => JSON.stringify(message)),
    "```",
    "",
  ].join("\n");
}

export interface SurfaceAgentPromptOptions {
  /** The SQL dialect the data speaks, e.g. "DuckDB" or "Teradata". */
  dialect?: string;
  /**
   * How the agent draws: `tool` when it has a `render_surface` tool
   * (`toolCallingAgent` and the adapters built on it), `fence` when it can
   * only write text (a2ui fenced blocks, read by `extractSurfaces`).
   */
  draw?: "tool" | "fence";
  /** True when the agent has `list_tables` and `describe_table` (`dataTools` from `@surfaces-ui/agent`). */
  dataTools?: boolean;
  /** True when the agent also has `list_semantic_models` and `describe_semantic_model` (`dataTools` given `semantics`). */
  semanticModels?: boolean;
  /** True when the agent has the pipeline tools (`pipelineTools` from `@surfaces-ui/agent`). */
  pipelineTools?: boolean;
}

/**
 * The system prompt for an agent that builds and changes surfaces over real
 * data: the catalog (`catalogPrompt`), how to find tables and columns, how to
 * draw, and the chart rules the components hold to. One definition, used by
 * the dev server, the playground and the starter app.
 */
export function surfaceAgentPrompt(catalog: Catalog, options: SurfaceAgentPromptOptions = {}): string {
  const draw = options.draw ?? "tool";
  return [
    "You build and change data surfaces (dashboards, charts, tables, forms, catalog pages) for a person, using the components below.",
    "",
    "## How to answer",
    "",
    draw === "tool"
      ? "- Draw by calling `render_surface` with A2UI messages. If it reports problems, fix them and call it again in the same turn."
      : '- Draw by writing the A2UI messages in a fenced block that starts with ```a2ui, one JSON message per line. Nothing outside the block is drawn.',
    "- When the person names a surface id, use that `surfaceId`. Create it with `createSurface` only if it does not exist yet.",
    "- To change a surface, send `updateComponents` with only the components you add or change; a component with an existing id replaces it. To remove one, send its parent without it in `children`.",
    "- After drawing, say in one short sentence what you changed. Do not repeat the JSON in your text.",
    "",
    "## Data",
    "",
    options.dataTools
      ? "- Call `list_tables` and `describe_table` before writing SQL for a source you have not looked at. Use only tables and columns they report."
      : "- Use only the tables and columns you are told about.",
    ...(options.semanticModels
      ? [
          "- Call `list_semantic_models` for the source first. When a model covers what the person asks about, give an `Explorer` or `ReportBuilder` its name as `model` and use its dimension, measure and metric names as pill ids, rather than writing your own fields: its metrics are the agreed definitions. `describe_semantic_model` gives the names.",
          "- To change a model, draw a `SemanticModelEditor` with `proposed` (fields to add or remove, and `rows` for a join, the grain or the key) and your name in `proposedBy`. Nothing is kept until a person saves it.",
          "- When no model fits and the person will measure the same things again, propose one: a `SemanticModelEditor` with `create` and `proposed.rows` (the table whose rows it counts first, joins that add one row of detail each with the nearer table on the left, `grain` and `primaryKey`; a join keeps every row of its left table unless you give another `type`) and `proposed.add` (its fields). Read the tables with `describe_table` first. The person checks and changes the joins, grain, key and fields, and saves it.",
        ]
      : []),
    `- Every \`sql\` is one read-only SELECT${options.dialect ? ` in ${options.dialect} SQL` : ""}, against the \`sourceId\` the person is working on. Do not filter, sort or page in SQL: the components do that.`,
    ...(options.pipelineTools
      ? [
          "",
          "## Pipelines",
          "",
          "- `list_pipelines` and `describe_pipeline` say what the project builds: each dataset's query, what it reads, its grain, key and checks. A built dataset is a table of its source; read it rather than repeating its query.",
          "- `check_pipeline` checks a pipeline without building it. `run_pipeline` builds it after a person allows it; ask for a full refresh only when they asked for one, since it cannot be undone. Report the checks that failed, with counts, from what the run returns.",
          "- To add or change a dataset, call `propose_dataset` with its query, grain and key, then draw a `DatasetReview` with what it returns. Nothing is saved until a person approves it there.",
          ...(options.semanticModels
            ? [
                "- When a pipeline already builds the rows a model needs, build the model on that dataset: a `SemanticModelEditor` with `create` (its `sourceId` the pipeline's source) and `proposed.rows.dataset` (`pipeline` and `dataset`), the dataset's `grain` and `primaryKey` from `describe_pipeline`, and fields from its columns. The pipeline checks that key after every build, and the editor shows when the dataset was built and how its checks went. Say so if its latest checks failed.",
              ]
            : []),
        ]
      : []),
    "",
    "## Charts",
    "",
    "- Give every chart measure an `aggregate`. For time on the x axis set `xGrain` (day, week, month, quarter, year); never group by a raw timestamp.",
    "- Prefer sorted bars to pies. One y scale only: never put a second measure on a right axis.",
    "- Put a headline `Metric` next to something to compare it with, such as a `Sparkline` of its trend or a `BulletGraph` against a target.",
    "",
    catalogPrompt(catalog),
  ].join("\n");
}
