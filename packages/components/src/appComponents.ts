import type { CertificationBadge } from "./discovery/shared.js";
import type { ConnectionBuilderProps } from "./source/ConnectionBuilder.js";
import type { ItemControlsProps } from "./controls/ItemControls.js";
import type { ModelLineageProps } from "./explore/ModelLineage.js";
import type { ObjectInfoProps } from "./schema/ObjectInfo.js";
import type { ChecksPanelProps } from "./pipeline/Pipeline.js";
import type { ThemePickerProps } from "./theme/ThemePicker.js";
import type { NavBarProps } from "./workspace/NavBar.js";

/*
 * Components an app places itself, as opposed to the catalog's, which an
 * agent draws. Each is described once here, as data: what it is for, its
 * props that are plain data (as JSON Schema), the props that take code (a
 * backend, a store, a callback the host must write) and an example. The
 * playground draws a page for each from this, and `pnpm docs:gen` writes
 * docs/components. `describeAppComponent<Props>()` checks every prop named
 * here against the component's own props type, so neither can name a prop
 * the component does not have.
 *
 * Nothing here imports React or a component, so a script can read it.
 */

/** One prop that is plain data, as JSON Schema. */
export interface PropSchema {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array";
  description?: string;
  enum?: readonly unknown[];
  items?: PropSchema;
  properties?: Record<string, PropSchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

/** A prop that takes code the host writes: switched on or off on the component's page, where the playground fills it with a working demo. */
export interface AppComponentPart {
  prop: string;
  label: string;
  description: string;
  /** Required by the component, so always on. */
  required?: boolean;
  /** On when the page opens. */
  on?: boolean;
}

export interface AppComponentDoc {
  name: string;
  /** The package it is imported from. */
  from: string;
  description: string;
  /** Its props that are plain data. */
  props: { type: "object"; properties: Record<string, PropSchema>; required?: string[] };
  parts: AppComponentPart[];
  /** Callbacks a host passes to hear what happens. */
  callbacks: { prop: string; description: string }[];
  /** Plain-data props to start from. */
  example: Record<string, unknown>;
}

type Keys<P> = Extract<keyof P, string>;

/** Checks a description against the component's props type `P`: every prop it names must be one of `P`'s. */
export function describeAppComponent<P>() {
  return (doc: {
    name: string;
    from: string;
    description: string;
    props: { type: "object"; properties: Partial<Record<Keys<P>, PropSchema>>; required?: Keys<P>[] };
    parts: (AppComponentPart & { prop: Keys<P> })[];
    callbacks: { prop: Keys<P>; description: string }[];
    example: Partial<Record<Keys<P>, unknown>>;
  }): AppComponentDoc => doc as AppComponentDoc;
}

const COMPONENTS = "@surfaces-ui/components";
const PRESET_HIDE = ["mode", "presets", "accent", "charts", "radius", "font", "density"] as const;

export const themePickerDoc = describeAppComponent<ThemePickerProps>()({
  name: "ThemePicker",
  from: COMPONENTS,
  description:
    "Lets a person choose how everything looks: a preset, light or dark, the accent, chart colours, corner radius, font and density. It changes the theme held by the `ThemeProvider` above it, which keeps the choice. Hide the controls a product does not want to offer.",
  props: {
    type: "object",
    properties: {
      hide: { type: "array", description: "Controls to leave out.", items: { type: "string", enum: PRESET_HIDE } },
    },
  },
  parts: [{ prop: "presets", label: "Your own presets", description: "Themes offered as one-click choices in place of the built-in presets." }],
  callbacks: [],
  example: { hide: [] },
});

export const connectionBuilderDoc = describeAppComponent<ConnectionBuilderProps>()({
  name: "ConnectionBuilder",
  from: COMPONENTS,
  description:
    "Sets up Parquet, Delta or Iceberg data on S3, GCS, Azure, https or disk, and writes the configuration for the server with the names of the environment variables to set. It holds the name of a secret, never a credential.",
  props: {
    type: "object",
    properties: {
      value: {
        type: "object",
        description: "The connection being set up.",
        properties: {
          sourceId: { type: "string", description: "The source's id." },
          storage: { type: "string", enum: ["s3", "gcs", "azure", "http", "local"], description: "Where the files are." },
          scope: { type: "string", description: "The bucket or prefix the connection covers, e.g. s3://acme-lake/sales." },
          credentials: { type: "string", enum: ["secret", "ambient", "public"], description: "A named secret, the machine's own role, or public data with none." },
          secret: { type: "string", description: "The name of the server-side secret, e.g. LAKE." },
          region: { type: "string" },
          endpoint: { type: "string", description: "For S3-compatible stores such as MinIO." },
        },
      },
    },
    required: ["value"],
  },
  parts: [],
  callbacks: [{ prop: "onChange", description: "Every change to the connection, as the whole draft. Required: the host holds the draft." }],
  example: { value: { sourceId: "lake", storage: "s3", scope: "s3://acme-lake/sales", credentials: "secret", secret: "LAKE", region: "eu-west-1", endpoint: "", tables: [{ name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" }], catalogUri: "", catalogWarehouse: "" } },
});

export const modelLineageDoc = describeAppComponent<ModelLineageProps>()({
  name: "ModelLineage",
  from: COMPONENTS,
  description:
    "Where a semantic model's rows come from when a pipeline builds them: the dataset, when it was last built, the latest run's checks, whether its key was checked and what it reads. One line over an explorer or a report, or a panel. Display only: it queries nothing.",
  props: {
    type: "object",
    properties: {
      model: {
        type: "object",
        description: "A model whose rows are a pipeline's dataset (`dataset`); anything else draws nothing.",
        properties: {
          sourceId: { type: "string" },
          sql: { type: "string" },
          grain: { type: "string" },
          primaryKey: { type: "array", items: { type: "string" } },
          dataset: { type: "object", properties: { pipelineId: { type: "string" }, dataset: { type: "string" } } },
        },
      },
      compact: { type: "boolean", description: "One line, for above an explorer or a report." },
    },
    required: ["model"],
  },
  parts: [{ prop: "pipelines", label: "Pipelines backend", description: "Where the dataset's definition and runs come from. Without it (or a PipelinesProvider) only the dataset's name is shown.", on: true }],
  callbacks: [
    { prop: "onUseDataset", description: "Offered when the model's grain or key differs from the dataset's." },
    { prop: "onOpenDataset", description: "Opens the dataset in the host's pipeline view." },
  ],
  example: { compact: false },
});

export const checksPanelDoc = describeAppComponent<ChecksPanelProps>()({
  name: "ChecksPanel",
  from: COMPONENTS,
  description: "A dataset's checks (unique, not null, relationships, accepted values, row count) with their latest results, failures first. Display only: the counts come from the engine.",
  props: {
    type: "object",
    properties: {
      checks: {
        type: "array",
        description: "Each check with its latest outcome.",
        items: { type: "object", properties: { name: { type: "string" }, description: { type: "string", description: "The check in words." }, severity: { type: "string", enum: ["fail", "warn"] }, failedRecords: { type: "integer", description: "Rows that break it; absent when not run since it was added." }, summary: { type: "string" } }, required: ["name", "description", "severity"] },
      },
    },
    required: ["checks"],
  },
  parts: [],
  callbacks: [{ prop: "onOpenFailing", description: "Look at what breaks a check. Nothing runs unless the host runs it." }],
  example: {
    checks: [
      { name: "order_id_unique", description: "order_id never repeats", severity: "fail", failedRecords: 0, fromKey: true },
      { name: "status_values", description: "status is one of placed, shipped, returned", severity: "warn", failedRecords: 12, summary: "12 rows have another status." },
    ],
  },
});

export const objectInfoDoc = describeAppComponent<ObjectInfoProps>()({
  name: "ObjectInfo",
  from: COMPONENTS,
  description: "What the backend knows about a database, schema or table: its kind, format, size, columns and keys. Names only, never values.",
  props: {
    type: "object",
    properties: {
      sourceId: { type: "string", description: "The source to ask." },
      catalog: { type: "string", description: "A catalog (database)." },
      schema: { type: "string" },
      table: { type: "string", description: "With a table, it describes the table; without, the schema or catalog." },
    },
    required: ["sourceId"],
  },
  parts: [{ prop: "dataSource", label: "Its own data source", description: "Left out, the one from `DataSourceProvider`." }],
  callbacks: [{ prop: "onClose", description: "Shows a close button." }],
  example: {},
});

export const certificationBadgeDoc = describeAppComponent<Parameters<typeof CertificationBadge>[0]>()({
  name: "CertificationBadge",
  from: COMPONENTS,
  description: "Marks certified or deprecated data wherever an object is shown, with a symbol and words as well as colour. Who certified it, when and why show on hover and focus.",
  props: {
    type: "object",
    properties: {
      certification: {
        type: "object",
        description: "The verdict a person recorded with `setCertification`; none draws nothing.",
        properties: {
          status: { type: "integer", enum: [1, 2], description: "1 certified, 2 deprecated." },
          setBy: { type: "string" },
          setAt: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
  parts: [],
  callbacks: [],
  example: { certification: { status: 1, setBy: "Ada Lovelace", setAt: "2026-11-01T10:00:00Z", note: "Reconciled with finance." } },
});

export const itemControlsDoc = describeAppComponent<ItemControlsProps>()({
  name: "ItemControls",
  from: COMPONENTS,
  description:
    "The controls of one item (a tile, a framed component) as a row of icons: quiet until the item is pointed at or focused, each named at once in a tooltip, one tab stop with arrows between them. Build the shared actions with `standardControls(name, actions)` so their order, wording and icons are the same everywhere.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: 'Names the group: "Refund rate by category controls".' },
      show: { type: "string", enum: ["hover", "always"], description: "Shown on hover and focus (and always on touch), or always." },
      quietable: { type: "boolean", description: "Whether an outer layer of controls can hide these." },
    },
    required: ["label"],
  },
  parts: [{ prop: "controls", label: "Controls", description: "The actions, from `standardControls`. On the page: change, wider, narrower, earlier, later, duplicate and remove.", required: true }],
  callbacks: [],
  example: { label: "Revenue by month controls", show: "always" },
});

export const navBarDoc = describeAppComponent<NavBarProps>()({
  name: "NavBar",
  from: COMPONENTS,
  description:
    "Navigation across the top of a site, after Apple's: the sections on a glass bar that stays at the top, and beneath it the current section's name and its pages. Content scrolls under both and an edge appears once it does. On a narrow screen the sections fold into a menu that covers the screen as a dialog. It takes the same groups as `SideNav`, so a site can move between the two.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: 'What the navigation is for, for assistive technology: "Surfaces UI".' },
      groups: {
        type: "array",
        description: "The sections, each with its pages. A section goes to its first page.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "The section's name in the bar." },
            items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, href: { type: "string" } }, required: ["id", "label"] } },
          },
          required: ["items"],
        },
      },
      current: { type: "string", description: "The id of the page being shown." },
    },
    required: ["label", "groups"],
  },
  parts: [
    { prop: "brand", label: "Brand", description: "A name or mark at the bar's start.", on: true },
    { prop: "actions", label: "Actions", description: "A status or a picker at the bar's end; it moves into the menu on a narrow screen." },
  ],
  callbacks: [{ prop: "onSelect", description: "The id of the page a person chose." }],
  example: {
    label: "Acme analytics",
    current: "revenue",
    groups: [
      { label: "Reports", items: [{ id: "revenue", label: "Revenue" }, { id: "refunds", label: "Refunds" }, { id: "stores", label: "Stores" }] },
      { label: "Data", items: [{ id: "tables", label: "Tables" }, { id: "models", label: "Models" }] },
      { label: "Settings", items: [{ id: "people", label: "People" }] },
    ],
  },
});

/** Every app component of `@surfaces-ui/components`. */
export const componentsAppComponents: AppComponentDoc[] = [themePickerDoc, connectionBuilderDoc, modelLineageDoc, checksPanelDoc, objectInfoDoc, certificationBadgeDoc, itemControlsDoc, navBarDoc];

/** A component's reference page, as Markdown: what it is for, its props, the parts a host supplies and an example. */
export function appComponentMarkdown(doc: AppComponentDoc): string {
  const required = new Set(doc.props.required ?? []);
  const typeOf = (schema: PropSchema): string => (schema.enum ? schema.enum.map((v) => JSON.stringify(v)).join(" | ") : schema.type === "array" ? `${schema.items ? typeOf(schema.items) : "unknown"}[]` : (schema.type ?? "object"));
  const cell = (text = "") => text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [`# ${doc.name}`, "", `\`import { ${doc.name} } from "${doc.from}";\``, "", doc.description, ""];
  const props = Object.entries(doc.props.properties);
  if (props.length > 0) {
    lines.push("## Props", "", "| Prop | Type | Required | What it is |", "|---|---|---|---|");
    for (const [name, schema] of props) lines.push(`| \`${name}\` | ${cell(typeOf(schema))} | ${required.has(name) ? "yes" : ""} | ${cell(schema.description)} |`);
    lines.push("");
  }
  if (doc.parts.length > 0) {
    lines.push("## Parts the host supplies", "", "Props that take code. Each is optional unless marked; the component leaves out what it needs it for.", "");
    for (const part of doc.parts) lines.push(`- \`${part.prop}\`${part.required ? " (required)" : ""}: **${part.label}.** ${part.description}`);
    lines.push("");
  }
  if (doc.callbacks.length > 0) {
    lines.push("## Callbacks", "");
    for (const callback of doc.callbacks) lines.push(`- \`${callback.prop}\`: ${callback.description}`);
    lines.push("");
  }
  lines.push("## Example", "", "```tsx", appComponentCode(doc, doc.example, doc.parts.filter((p) => p.required || p.on).map((p) => p.prop)), "```", "");
  return lines.join("\n");
}

/** The JSX for a component with these plain props and these parts switched on: what a page shows as its code. */
export function appComponentCode(doc: AppComponentDoc, props: Record<string, unknown>, parts: string[]): string {
  const attribute = (name: string, value: unknown) =>
    value === true ? name : typeof value === "string" ? `${name}=${JSON.stringify(value)}` : `${name}={${JSON.stringify(value)}}`;
  const attributes = [
    ...Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0))
      .map(([name, value]) => attribute(name, value)),
    ...doc.parts.filter((part) => parts.includes(part.prop)).map((part) => `${part.prop}={${part.prop}}`),
    ...doc.callbacks.map((callback) => `${callback.prop}={…}`),
  ];
  const oneLine = `<${doc.name} ${attributes.join(" ")} />`;
  return oneLine.length <= 100 ? oneLine : [`<${doc.name}`, ...attributes.map((a) => `  ${a}`), "/>"].join("\n");
}
