import type { CertificationBadge } from "./discovery/shared.js";
import type { ConnectionBuilderProps } from "./source/ConnectionBuilder.js";
import type { ItemControlsProps } from "./controls/ItemControls.js";
import type { ResizeHandleProps } from "./controls/ResizeHandle.js";
import type { SegmentedControlProps } from "./controls/SegmentedControl.js";
import type { ComboboxProps } from "./controls/Combobox.js";
import type { ConfirmDialogProps } from "./controls/ConfirmDialog.js";
import type { StatusBadgeProps } from "./controls/StatusBadge.js";
import type { DataTableProps } from "./table/DataTable.js";
import type { PaginationProps } from "./table/Pagination.js";
import type { SelectionBarProps } from "./table/SelectionBar.js";
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

export const resizeHandleDoc = describeAppComponent<ResizeHandleProps>()({
  name: "ResizeHandle",
  from: COMPONENTS,
  description:
    "A handle on the right or bottom edge of something, dragged to change its width or height: the same handle Arrange draws between a Grid's columns and under a component, for an app to place between two panes of its own. A focusable separator that says its value and bounds; dragged with pointer events, so a mouse, a pen and a finger all work; moved by the arrow keys (Shift for bigger steps), Home and End; put back by Enter or a double click. It holds no size of its own: the host keeps `value`, draws each change from `onChange` and keeps the size on `onChangeEnd`. Its parent must be positioned, since it sits on that parent's edge.",
  props: {
    type: "object",
    properties: {
      edge: { type: "string", enum: ["right", "bottom"], description: '"right" sizes a width, dragged left and right; "bottom" a height, dragged up and down.' },
      value: { type: "number", description: "The size it stands for, in any unit: pixels, a share, a percentage. Left out when no size is set yet." },
      min: { type: "number", description: "The least it can be." },
      max: { type: "number", description: "The most it can be." },
      snap: { type: "number", description: "Values land on multiples of this (10 rounds to ten pixels)." },
      step: { type: "number", description: "How far an arrow key moves it; Shift moves five steps. A twentieth of the range by default." },
      unitPixels: { type: "number", description: "How many pixels on screen one unit is: 1 for pixels, a pane's width for a share of it. A function of the handle is read when a drag starts." },
      label: { type: "string", description: 'What it resizes, for assistive technology: "Resize the map and the list".' },
      valueText: { type: "string", description: 'The value in words, when a number alone does not say it: "40% and 60%".' },
      always: { type: "boolean", description: "Shown all the time, rather than when its parent is pointed at or it has focus (it always shows on touch)." },
    },
    required: ["edge", "label"],
  },
  parts: [
    { prop: "onReset", label: "Reset", description: "Enter or a double click puts the size back. On the page: back to half and half.", on: true },
    { prop: "startFrom", label: "Start from what is drawn", description: "Where a drag starts when no `value` is set, such as the height drawn now." },
  ],
  callbacks: [
    { prop: "onChange", description: "Each new value while it is dragged, and after each key." },
    { prop: "onChangeEnd", description: "When a drag ends (committed, or cancelled by Escape back where it started) and after each key: where to keep the size." },
  ],
  example: { edge: "right", value: 0.5, min: 0.25, max: 0.75, step: 0.05, label: "Resize the map and the list", valueText: "50% and 50%" },
});

export const segmentedControlDoc = describeAppComponent<SegmentedControlProps>()({
  name: "SegmentedControl",
  from: COMPONENTS,
  description:
    "A few equal choices of which exactly one holds, as one bar: build or view, chart or table, light or dark. It is the bar `ReportBuilder` switches modes with. A radio group, so it is one tab stop and the arrow keys move the choice; the chosen segment is one thumb that slides between the options. It holds no choice of its own: the host keeps `value` and sets it from `onChange`. Use it to switch what is shown in place, for two to eight short options; for actions use buttons, and for many or long options a select.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: 'What is being chosen, for assistive technology: "Mode", "Preview mode".' },
      options: {
        type: "array",
        description: "The choices, in order. They share the width equally.",
        items: {
          type: "object",
          properties: {
            value: { type: "string", description: "What `onChange` reports." },
            label: { type: "string", description: "The words on the segment." },
            disabled: { type: "boolean", description: "Greyed and still reachable, for a choice that makes no sense right now." },
          },
          required: ["value", "label"],
        },
      },
      value: { type: "string", description: "The chosen option's value." },
      fit: { type: "string", enum: ["content", "fill"], description: '"content" is as wide as its options need; "fill" takes its parent\'s width.' },
      name: { type: "string", description: "The radio group's name, when a form reads it. Made up otherwise." },
    },
    required: ["label", "options", "value"],
  },
  parts: [],
  callbacks: [{ prop: "onChange", description: "The value of the option a person chose." }],
  example: {
    label: "Preview mode",
    value: "page",
    fit: "content",
    options: [
      { value: "page", label: "As the page" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  },
});

const PEOPLE_EXAMPLE = [
  { id: "u1", name: "Ana Admin", email: "ana@example.com", status: "On", owns: 4, signedIn: "Today" },
  { id: "u2", name: "Ben Brook", email: "ben@example.com", status: "Turned off", owns: 0, signedIn: "3 May" },
  { id: "u3", name: "Cleo Chen", email: "cleo@example.com", status: "On", owns: 12, signedIn: "Yesterday" },
  { id: "u4", name: "Dev Diaz", email: "dev@example.com", status: "On", owns: 1, signedIn: "Never" },
];

export const dataTableDoc = describeAppComponent<DataTableProps<Record<string, unknown>>>()({
  name: "DataTable",
  from: COMPONENTS,
  description:
    "The rows an app holds, as a table: people, invitations, jobs, keys. Headings ask the host to sort; check boxes say which rows are chosen (with `SelectionBar` for what to do with them); each row can carry its everyday actions as `ItemControls` and a menu on a right click. It sorts, filters and pages nothing itself: the host asks its own server and hands over one page, with `Pagination` beneath. Columns marked `medium` or `wide` give way as the table, not the window, narrows. For the rows of a query use `DataGrid`, which asks the engine.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: 'What the rows are, for assistive technology: "People".' },
      columns: {
        type: "array",
        description: "The columns, in order. A column's `cell` function draws it; without one the row's value under `id` is shown as text.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Tells columns apart, and names the sort the table reports." },
            label: { type: "string", description: "The heading." },
            sortable: { type: "boolean", description: "Whether a press on the heading asks the host to sort by it." },
            align: { type: "string", enum: ["start", "end"], description: '"end" for numbers.' },
            show: { type: "string", enum: ["always", "medium", "wide"], description: "From what width of the table the column is shown: always, 36rem, or 52rem." },
          },
          required: ["id", "label"],
        },
      },
      rows: { type: "array", description: "One page of rows, already sorted and filtered by the host, shown in the order given.", items: { type: "object" } },
      rowHeader: { type: "string", description: "The column that names each row, drawn as its header. Defaults to the first." },
      sort: {
        type: "object",
        description: "How the host has sorted the rows.",
        properties: { column: { type: "string" }, desc: { type: "boolean" } },
        required: ["column", "desc"],
      },
      allSelected: { type: "boolean", description: "Every row that matches is chosen, past this page too (see `SelectionBar`)." },
      controlsShow: { type: "string", enum: ["always", "hover"], description: "Whether a row's controls are always shown (the default) or on hover and focus." },
      loading: { type: "boolean", description: "The rows are being fetched." },
    },
    required: ["label", "columns", "rows"],
  },
  parts: [
    { prop: "rowKey", label: "Row key", description: "A function giving each row a value that tells it apart: an id.", required: true },
    { prop: "rowName", label: "Row name", description: 'A function giving the row\'s name, for its check box and controls: "Select Ana Admin". Defaults to the first column\'s text.' },
    { prop: "selected", label: "Selection", description: "The keys of the rows ticked, with `onSelectedChange`: adds a check box to each row and the heading.", on: true },
    { prop: "selectable", label: "Who can be chosen", description: "A function saying whether a row can be ticked: one that cannot shows no box." },
    { prop: "rowControls", label: "Row controls", description: "A function giving a row's everyday actions, drawn with `ItemControls`.", on: true },
    { prop: "rowMenu", label: "Row menu", description: "A function giving a row's menu, opened by a right click, a long press or the Menu key." },
    { prop: "rowState", label: "Row state", description: 'A function giving a word put on the row as `data-state` for the host\'s own styling: "off".' },
    { prop: "empty", label: "When empty", description: "What to show in place of rows when there are none." },
  ],
  callbacks: [
    { prop: "onSortChange", description: "The column and direction a person asked to sort by. Fetch the rows in that order and pass them back." },
    { prop: "onSelectedChange", description: "The keys now ticked." },
  ],
  example: {
    label: "People",
    rowHeader: "name",
    sort: { column: "name", desc: false },
    columns: [
      { id: "name", label: "Name", sortable: true },
      { id: "email", label: "Email", sortable: true, show: "medium" },
      { id: "status", label: "Status" },
      { id: "signedIn", label: "Last signed in", show: "wide" },
      { id: "owns", label: "Owns", sortable: true, align: "end", show: "wide" },
    ],
    rows: PEOPLE_EXAMPLE,
  },
});

export const selectionBarDoc = describeAppComponent<SelectionBarProps>()({
  name: "SelectionBar",
  from: COMPONENTS,
  description:
    "What to do with the rows a person chose in a `DataTable`: how many, the actions, and Clear. When the whole page is ticked and more rows match, it offers to take every row that matches, so an action can reach rows on pages never opened; the host then acts on its search and filters, not on a list of keys. An action that takes something away comes last, after a gap. It runs nothing itself: ask first for anything hard to undo with `useConfirm`, and report what happened, and whom it left alone, with `ActionReceipt`. Nothing is drawn with nothing chosen.",
  props: {
    type: "object",
    properties: {
      count: { type: "integer", minimum: 0, description: "How many rows are chosen: those ticked, or all that match when `allMatching`." },
      actions: {
        type: "array",
        description: "What can be done to them, in order; one with `danger` is moved last.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string", description: 'The button\'s words: "Turn off".' },
            danger: { type: "boolean", description: "For an action that takes something away." },
            disabled: { type: "boolean" },
            expanded: { type: "boolean", description: "For an action that opens a form below the bar: whether it is open." },
          },
          required: ["id", "label"],
        },
      },
      label: { type: "string", description: 'Names the bar for assistive technology. Defaults to "With the selected rows".' },
      pageSelected: { type: "boolean", description: "Every row on this page is ticked." },
      total: { type: "integer", minimum: 0, description: "How many rows match in all, across every page." },
      allMatching: { type: "boolean", description: "Every row that matches is chosen, not only those ticked." },
      busy: { type: "boolean", description: "An action is running: every button waits." },
    },
    required: ["count", "actions"],
  },
  parts: [{ prop: "children", label: "Form below", description: "Drawn under the actions: a form an action opened, such as who to hand the rows to." }],
  callbacks: [
    { prop: "onClear", description: "Untick everything." },
    { prop: "onAllMatchingChange", description: "True when a person chooses every row that matches; false to go back to this page. Without it nothing is offered past the page." },
  ],
  example: {
    count: 50,
    total: 126,
    pageSelected: true,
    actions: [
      { id: "turn-off", label: "Turn off", danger: true },
      { id: "turn-on", label: "Turn back on" },
      { id: "sign-out", label: "Sign out everywhere" },
    ],
  },
});

export const paginationDoc = describeAppComponent<PaginationProps>()({
  name: "Pagination",
  from: COMPONENTS,
  description:
    'Which rows are shown, "51–100 of 126", with Previous and Next, under a `DataTable` a host pages on its server. It holds no page of its own: the host keeps `offset` and fetches the page `onChange` asks for. Nothing is drawn when every row fits on one page.',
  props: {
    type: "object",
    properties: {
      offset: { type: "integer", minimum: 0, description: "Where this page starts, counting from 0." },
      pageSize: { type: "integer", minimum: 1, description: "How many rows a page holds." },
      total: { type: "integer", minimum: 0, description: "How many rows there are in all." },
      label: { type: "string", description: 'Names the navigation. Defaults to "Pages".' },
      busy: { type: "boolean", description: "A page is being fetched." },
    },
    required: ["offset", "pageSize", "total"],
  },
  parts: [],
  callbacks: [{ prop: "onChange", description: "The offset of the page a person moved to." }],
  example: { offset: 50, pageSize: 50, total: 126 },
});

export const confirmDialogDoc = describeAppComponent<ConfirmDialogProps>()({
  name: "ConfirmDialog",
  from: COMPONENTS,
  description:
    'Asks a person to confirm one action before it runs, as a modal dialog: the page behind cannot be used, focus starts inside (on Cancel for something that takes away) and returns where it was, and Escape or a press outside cancels. Name the button for the action ("Turn off"), never "OK", and say what cannot be undone. From an event handler, `useConfirm()` gives `confirm({ title, body, confirmLabel, danger })`, which resolves true or false. For something that can be undone, prefer doing it and offering Undo with `ActionReceipt`.',
  props: {
    type: "object",
    properties: {
      open: { type: "boolean", description: "Whether the dialog is showing." },
      title: { type: "string", description: 'The question: "Turn off 5 accounts?"' },
      confirmLabel: { type: "string", description: 'The button that goes ahead, named for what it does. Defaults to "Confirm".' },
      cancelLabel: { type: "string", description: 'Defaults to "Cancel".' },
      danger: { type: "boolean", description: "For something that takes away or cannot be undone." },
    },
    required: ["open", "title"],
  },
  parts: [{ prop: "body", label: "What will happen", description: "A sentence or two on what the action does and what cannot be undone.", on: true }],
  callbacks: [
    { prop: "onConfirm", description: "The person went ahead." },
    { prop: "onCancel", description: "Cancel, Escape, or a press outside the dialog." },
  ],
  example: { open: false, title: "Turn off 5 accounts?", confirmLabel: "Turn off", danger: true },
});

export const statusBadgeDoc = describeAppComponent<StatusBadgeProps>()({
  name: "StatusBadge",
  from: COMPONENTS,
  description:
    "A short status beside the thing it describes: an account on or turned off, a job running or failed, an invitation waiting. Its words carry the meaning; the tone backs them up with a colour and a shape (a ring, a dot, a diamond, a square), so it reads the same without colour. For data that is certified or deprecated use `CertificationBadge`.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: 'The status in a word or two: "Turned off".' },
      tone: { type: "string", enum: ["neutral", "info", "success", "warning", "danger"], description: "How it should strike a person. Defaults to neutral." },
      description: { type: "string", description: 'A sentence more, shown on hover and read after the label: "by Ana on 3 May".' },
    },
    required: ["label"],
  },
  parts: [],
  callbacks: [],
  example: { label: "Turned off", tone: "danger", description: "by Ana on 3 May" },
});

export const comboboxDoc = describeAppComponent<ComboboxProps>()({
  name: "Combobox",
  from: COMPONENTS,
  description:
    "A text box that suggests as a person types: a person to hand work to, a table, a tag. Anything may be typed; a suggestion is a shortcut. The host searches (on its server, for a long list) and passes the matches back as `options`; the box filters nothing. The ARIA 1.2 combobox: Down and Up move through the suggestions with focus kept in the box, Enter chooses (and with none highlighted, leaves Enter to the form), Escape closes the list and then clears the box. How many suggestions there are is announced.",
  props: {
    type: "object",
    properties: {
      label: { type: "string", description: "The field's name, shown above it." },
      value: { type: "string", description: "The text in the box." },
      options: {
        type: "array",
        description: "The suggestions for the text as it is now, best first.",
        items: {
          type: "object",
          properties: {
            value: { type: "string", description: "What choosing it puts in the box: an email, an id." },
            label: { type: "string", description: "The words shown for it: a name." },
            detail: { type: "string", description: "A second line." },
          },
          required: ["value", "label"],
        },
      },
      loading: { type: "boolean", description: "Suggestions are being fetched." },
      type: { type: "string", enum: ["text", "email", "search"], description: "The input's type." },
      placeholder: { type: "string" },
      required: { type: "boolean" },
      disabled: { type: "boolean" },
      name: { type: "string", description: "The input's name, when a form reads it." },
      help: { type: "string", description: "A sentence under the field." },
    },
    required: ["label", "value", "options"],
  },
  parts: [],
  callbacks: [
    { prop: "onChange", description: "Every change to the text, typed or chosen. Search with it." },
    { prop: "onPick", description: "The suggestion a person chose." },
  ],
  example: {
    label: "Hand their work to",
    type: "email",
    value: "",
    placeholder: "Their name or email",
    options: [
      { value: "ana@example.com", label: "Ana Admin", detail: "ana@example.com" },
      { value: "cleo@example.com", label: "Cleo Chen", detail: "cleo@example.com" },
    ],
  },
});

/** Every app component of `@surfaces-ui/components`. */
export const componentsAppComponents: AppComponentDoc[] = [themePickerDoc, connectionBuilderDoc, modelLineageDoc, checksPanelDoc, objectInfoDoc, certificationBadgeDoc, itemControlsDoc, resizeHandleDoc, segmentedControlDoc, dataTableDoc, selectionBarDoc, paginationDoc, confirmDialogDoc, statusBadgeDoc, comboboxDoc, navBarDoc];

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
