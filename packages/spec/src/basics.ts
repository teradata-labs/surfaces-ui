import { THEME_REQUEST_FIELDS } from "@surfaces-ui/tokens";
import { z } from "zod";
import { type ComponentDefinition, type EventDefinition, defineCatalog, withMinHeight } from "./catalog.js";
import { action, childId, childList, dataBinding, dynamicString } from "./dynamic.js";

const FIELD = z.strictObject({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).describe("The key the value is sent and stored under."),
  label: z.string(),
  type: z.enum(["text", "longtext", "number", "integer", "boolean", "date", "datetime", "choice"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).max(50).optional().describe("For choice."),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().max(200).optional().describe("A regular expression the whole text must match."),
  help: z.string().optional(),
  placeholder: z.string().optional(),
  visibleWhen: z
    .strictObject({
      field: z.string().describe("The name of another field of this form."),
      equals: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Asked only while that field's value is this."),
      in: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1).max(50).optional().describe("Asked only while that field's value is one of these."),
    })
    .refine((value) => value.equals === undefined || value.in === undefined, { message: "Give `equals` or `in`, not both." })
    .optional()
    .describe("Asks for this field only while another field of the form holds a value (with neither `equals` nor `in`, any value). A field that is not asked for is not drawn, not required, and sent as null."),
});
/** A form's fields: a field that waits on another must name one the form has, and not itself. */
const FIELDS = z
  .array(FIELD)
  .min(1)
  .max(40)
  .superRefine((fields, context) => {
    const names = new Set(fields.map((field) => field.name));
    fields.forEach((field, index) => {
      const other = field.visibleWhen?.field;
      if (other === undefined) return;
      if (other === field.name) context.addIssue({ code: "custom", path: [index, "visibleWhen", "field"], message: "A field cannot wait on itself." });
      else if (!names.has(other)) context.addIssue({ code: "custom", path: [index, "visibleWhen", "field"], message: `This form has no field "${other}". Its fields are: ${[...names].join(", ")}.` });
    });
  });

/**
 * The steps of the theme's spacing scale a layout can use for its gap and padding: each is `--sf-space-<step>`,
 * and "none" is no space at all. There is no other value, so a page stays on the theme's spacing.
 */
export const SPACE_STEPS = ["none", 1, 2, 3, 4, 6, 8] as const;
export type SpaceStep = (typeof SPACE_STEPS)[number];
const SPACE_STEP = z.union([z.literal("none"), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8)]);
const LAYOUT_GAP = SPACE_STEP.optional().describe("The space between children, as a step of the theme's spacing scale (`--sf-space-<step>`), or \"none\". Defaults to 4.");
const LAYOUT_PADDING = SPACE_STEP.optional();
const LAYOUT_PADDING_NOTE = (fallback: string) => `The space inside the edge, around the children, as a step of the theme's spacing scale (\`--sf-space-<step>\`), or "none". Defaults to ${fallback === "none" ? '"none"' : fallback}.`;
/** The least and most pixels a Row's child can be fixed to. */
export const FIXED_SIZE = { min: 24, max: 1600 } as const;
/** How one child of a Row is sized: its content's width, a share of the space left, or a fixed width in pixels. */
export const LAYOUT_SIZE = z.union([
  z.literal("hug"),
  z.literal("fill"),
  z.strictObject({ fixed: z.number().min(FIXED_SIZE.min).max(FIXED_SIZE.max).describe(`A width in pixels, ${FIXED_SIZE.min} to ${FIXED_SIZE.max}.`) }),
]);
export type LayoutSize = z.infer<typeof LAYOUT_SIZE>;
const LAYOUT_SIZES = z.array(LAYOUT_SIZE).min(1).max(12).optional();

const INPUT_NOTE = "The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.";

const str = (about: string) => z.string().describe(about);

/** What the basic components add to their events. */
const EVENTS: Record<string, Record<string, EventDefinition>> = {
  Button: { press: { description: "When pressed. Carries only the context declared in the action." } },
  SideNav: { select: { description: "When an item without a link is chosen.", context: { id: str("the item's id") } } },
  Form: {
    submit: {
      description: "After the values pass every check and, when the page has a forms backend, after it stored them.",
      context: {
        formId: str("the form"),
        values: z.record(z.string(), z.unknown()).describe("the values as stored"),
        submissionId: str("the backend's id, or empty with no backend"),
      },
    },
  },
};

const definitions = {
    Text: {
      description: "A heading, paragraph or caption.",
      props: { text: dynamicString, variant: z.enum(["h1", "h2", "h3", "h4", "h5", "body", "caption"]).optional() },
      example: { id: "title", component: "Text", text: "Revenue this quarter", variant: "h2" },
    },
    Row: {
      description:
        "Places children side by side. Wraps on narrow screens unless `wrap` is false. Children share the width equally unless `widths` gives each its share, or `sizes` says how each is sized (content width, fill, or fixed pixels); `sizes` wins over `widths` when both have one entry per child. `gap` and `padding` are steps of the theme's spacing scale.",
      props: {
        children: childList,
        widths: z
          .array(z.number().positive())
          .min(1)
          .max(12)
          .optional()
          .describe("The share of the width each child takes, one per child: [2, 1] makes the first twice as wide as the second. Used when it has one entry per child and `sizes` is not used."),
        sizes: LAYOUT_SIZES.describe(
          "How each child is sized, one per child: \"hug\" keeps its content's width and does not grow, \"fill\" grows to share the space left, { fixed: 240 } is that many pixels wide. Used when it has one entry per child, in place of `widths`. Narrow screens stack the children unless `wrap` is false.",
        ),
        wrap: z.boolean().optional().describe("Whether children move onto a new line when they do not fit, and stack on narrow screens. Defaults to true; false keeps them on one line, each shrinking to fit."),
        gap: LAYOUT_GAP,
        padding: LAYOUT_PADDING.describe(LAYOUT_PADDING_NOTE("none")),
        justify: z.enum(["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"]).optional(),
        align: z.enum(["start", "center", "end", "stretch"]).optional(),
      },
      example: { id: "stats", component: "Row", children: ["revenue", "orders"] },
    },
    Column: {
      description: "Stacks children top to bottom. Use it as the root of most surfaces. `gap` and `padding` are steps of the theme's spacing scale.",
      props: {
        children: childList,
        gap: LAYOUT_GAP,
        padding: LAYOUT_PADDING.describe(LAYOUT_PADDING_NOTE("none")),
        justify: z.enum(["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"]).optional(),
        align: z.enum(["start", "center", "end", "stretch"]).optional(),
      },
      example: { id: "root", component: "Column", children: ["title", "stats", "chart"] },
    },
    Grid: {
      description:
        "Lays children out in columns that wrap onto new rows. Use it for dashboards: a row of numbers, then charts side by side. Columns are equal unless `widths` gives each its share, as when a person resizes them by hand. Children in a row are stretched to the tallest one; set `align: \"start\"` when the row mixes content of different heights, such as a chart beside a form, so each keeps its own height. `gap` is a step of the theme's spacing scale, between rows and columns alike.",
      props: {
        children: childList,
        columns: z.number().int().min(1).max(6).optional().describe("Columns per row. Defaults to 2. Narrow screens use one."),
        widths: z
          .array(z.number().positive())
          .min(1)
          .max(6)
          .optional()
          .describe("The share of the width each column takes, one per column: [2, 1] makes the first twice as wide as the second. Used when it has one entry per column; otherwise columns are equal."),
        align: z
          .enum(["start", "center", "end", "stretch"])
          .optional()
          .describe("Where each child sits in the height of its row. Defaults to stretch: every child as tall as the tallest. Use start for mixed content, so each keeps its own height."),
        gap: LAYOUT_GAP,
      },
      example: { id: "tiles", component: "Grid", columns: 3, children: ["revenue", "orders", "average"] },
    },
    Card: {
      description: "A bordered container for one child, to group related content. `padding` is a step of the theme's spacing scale.",
      props: { child: childId, padding: LAYOUT_PADDING.describe(LAYOUT_PADDING_NOTE("4")) },
      example: { id: "panel", component: "Card", child: "chart" },
    },
    Divider: {
      description: "A thin line between sections.",
      props: { axis: z.enum(["horizontal", "vertical"]).optional() },
      example: { id: "rule", component: "Divider" },
    },
    SideNav: {
      description:
        "Navigation down the side of a surface: groups of items, with the current one marked. A person can fold it away: it then keeps only a slim strip for its menu button, which slides it back in over the surface (never over anything outside it). In a narrow surface or on a narrow screen it is always folded. " +
        "An item with `href` is a link (http and https only); one without sends the event with its `id`. Bind `current` to a data path to mark the item for what is showing.",
      props: {
        label: z.string().optional().describe("What the navigation is for, for assistive technology."),
        groups: z
          .array(z.strictObject({ label: z.string().optional(), items: z.array(z.strictObject({ id: z.string(), label: z.string(), href: z.string().optional() })).min(1).max(30) }))
          .min(1)
          .max(12),
        current: dynamicString.optional().describe("The id of the item for what is showing."),
        pinned: z.boolean().optional().describe("Whether it starts open beside the content. Defaults to true."),
        action: action.optional(),
      },
      example: {
        id: "nav",
        component: "SideNav",
        label: "Sections",
        groups: [{ label: "Sales", items: [{ id: "overview", label: "Overview" }, { id: "orders", label: "Orders" }] }],
        current: "overview",
        action: { event: { name: "navigate" } },
      },
    },
    Tabs: {
      description: "Switches between several children, one visible at a time.",
      props: { tabs: z.array(z.strictObject({ title: dynamicString, child: childId })).min(1) },
      example: { id: "views", component: "Tabs", tabs: [{ title: "Chart", child: "chart" }, { title: "Table", child: "table" }] },
    },
    Button: {
      description:
        'A control that sends an event back to the agent or opens a link. Its label is a child Text. To open a link, the action is a function call in place of an event: `"action": {"functionCall": {"@call": "openUrl", "args": {"url": "https://example.com/start"}}}`.',
      props: {
        child: childId,
        variant: z.enum(["default", "primary", "borderless"]).optional(),
        action,
        requires: z
          .array(z.string())
          .max(40)
          .optional()
          .describe(
            "Ids of inputs (TextField, NumberField, ChoicePicker, CheckBox, DateTimeInput) this button waits for. While any of them is missing or wrong the button is marked unavailable; a press then sends nothing, has each say what is wrong beside it and moves to the first. An input that is not shown (`visibleWhen`) is not waited for.",
          ),
      },
      example: {
        id: "refresh",
        component: "Button",
        child: "refresh-label",
        variant: "primary",
        action: { event: { name: "refresh", context: { region: { "@path": "/region" } } } },
      },
    },
    TextField: {
      description: `A labelled text box. ${INPUT_NOTE}`,
      props: {
        label: dynamicString,
        value: dataBinding,
        multiline: z.boolean().optional(),
        placeholder: z.string().optional(),
        help: dynamicString.optional().describe("A sentence under the field: what to enter, or why it is asked."),
        maxLength: z.number().int().positive().optional(),
        required: z.boolean().optional().describe("Marked as required, and said to be missing once the person leaves it empty."),
        pattern: z.string().max(200).optional().describe("A regular expression the whole text must match; a value that does not is said so beside the field."),
      },
      example: { id: "note", component: "TextField", label: "Note", value: { "@path": "/review/note" }, multiline: true },
    },
    NumberField: {
      description: `A labelled number box. ${INPUT_NOTE}`,
      props: {
        label: dynamicString,
        value: dataBinding,
        min: z.number().optional().describe("A number below it is said so beside the field."),
        max: z.number().optional().describe("A number above it is said so beside the field."),
        step: z.number().positive().optional(),
        help: dynamicString.optional(),
        required: z.boolean().optional().describe("Marked as required, and said to be missing once the person leaves it empty."),
      },
      example: { id: "threshold", component: "NumberField", label: "Alert above", value: { "@path": "/threshold" }, min: 0, step: 50 },
    },
    ChoicePicker: {
      description: `Pick one of a few options: radio buttons for four or fewer, a list for more. ${INPUT_NOTE}`,
      props: { label: dynamicString, value: dataBinding, options: z.array(z.string()).min(1).max(50), help: dynamicString.optional(), required: z.boolean().optional().describe("Marked as required, and said to be missing once the person leaves it empty.") },
      example: { id: "region", component: "ChoicePicker", label: "Region", value: { "@path": "/region" }, options: ["Europe", "Americas", "Asia"] },
    },
    CheckBox: {
      description: `A yes-or-no box. ${INPUT_NOTE}`,
      props: { label: dynamicString, value: dataBinding, help: dynamicString.optional(), required: z.boolean().optional().describe("Marked as required, and said to be missing once the person leaves it empty.") },
      example: { id: "include-returns", component: "CheckBox", label: "Include returns", value: { "@path": "/includeReturns" } },
    },
    DateTimeInput: {
      description: `A date, or a date and time (kept in UTC). ${INPUT_NOTE}`,
      props: { label: dynamicString, value: dataBinding, mode: z.enum(["date", "datetime"]).optional(), help: dynamicString.optional(), required: z.boolean().optional().describe("Marked as required, and said to be missing once the person leaves it empty.") },
      example: { id: "from", component: "DateTimeInput", label: "From", value: { "@path": "/from" }, mode: "date" },
    },
    Slider: {
      description: `A number chosen along a range, with its value shown in words. ${INPUT_NOTE}`,
      props: { label: dynamicString, value: dataBinding, min: z.number(), max: z.number(), step: z.number().positive().optional(), help: dynamicString.optional() },
      example: { id: "confidence", component: "Slider", label: "Confidence", value: { "@path": "/confidence" }, min: 0, max: 100, step: 5 },
    },
    Form: {
      description:
        "A form that checks what a person enters and submits it. Give the fields and their rules; the form draws a labelled input for each, shows errors beside them and sends nothing while any is wrong. A field with `visibleWhen: { field, equals }` is asked for only once another field holds that value. When the page has a forms backend, values go to the form with this `formId` there (the backend decides where they are stored; you never name a table); either way your event receives them. Use it instead of loose inputs and a Button whenever values must be checked or kept.",
      props: {
        formId: z.string().min(1),
        title: dynamicString.optional(),
        description: dynamicString.optional(),
        fields: FIELDS,
        values: dataBinding.optional().describe("Where the entered values live in the data model, to prefill them or show them elsewhere."),
        submitLabel: z.string().optional(),
        action: action.optional(),
      },
      example: {
        id: "case-review",
        component: "Form",
        formId: "case-review",
        title: "Review this alert",
        fields: [
          { name: "decision", label: "Decision", type: "choice", options: ["Fraud", "Not fraud", "Needs more information"], required: true },
          { name: "amount_at_risk", label: "Amount at risk", type: "number", min: 0 },
          { name: "note", label: "Note", type: "longtext", maxLength: 500 },
        ],
        values: { "@path": "/review" },
        submitLabel: "Save decision",
        action: { event: { name: "case_reviewed" } },
      },
    },
    Markdown: {
      description: "Formatted text: headings, lists, tables, links and code. Use it for explanations longer than a line.",
      props: { text: dynamicString },
      example: { id: "notes", component: "Markdown", text: "Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat" },
    },
    Image: {
      description:
        "A picture. `src` is a name the page knows (for example one it gave you), never a web address you choose: the page decides whether and where it loads, and when it does not know the name the `alt` text is shown in its place. " +
        "Always describe what it shows in `alt`, which is required (an empty string only for decoration). Give `caption` for a line beneath it. `fit` and `maxHeight` keep it from taking over a layout.",
      props: {
        src: dynamicString.describe("The name of the image, as the page gave it to you. Not loaded as written."),
        alt: dynamicString.describe("What the image shows, for anyone who cannot see it."),
        caption: dynamicString.optional(),
        width: z.number().int().min(24).max(1600).optional().describe("The most it is wide, in pixels. It never grows past its container."),
        height: z.number().int().min(24).max(1600).optional().describe("A fixed height in pixels; the image then fills that box by `fit`."),
        fit: z.enum(["contain", "cover"]).optional().describe("How a fixed height is filled: the whole image (\"contain\", the default) or edge to edge, cropped (\"cover\")."),
        maxHeight: z.number().int().min(24).max(1600).optional().describe("The most it is tall, in pixels."),
      },
      example: { id: "photo", component: "Image", src: "attachment-1", alt: "A bar chart of monthly revenue, rising through the year", caption: "Revenue by month", fit: "contain", maxHeight: 320 },
    },
    Link: {
      description: 'A link to a web page. Only http and https addresses are shown as links; in a site, a path on the site ("/pricing") is too, and opens in place.',
      props: { text: dynamicString, url: dynamicString },
      example: { id: "docs", component: "Link", text: "Metric definitions", url: "https://example.com/metrics" },
    },
    ThemeSwitch: {
      description:
        "Changes how the whole page looks, at once: a built-in theme, light or dark, the accent colour, corner radius, font, density or chart colours. Leave out what should stay as it is. The person sees what changed and can undo it. To style only your own surface, put the same fields in `createSurface.theme` instead.",
      props: {
        preset: z.enum(THEME_REQUEST_FIELDS.presets as [string, ...string[]]).optional(),
        mode: z.enum(THEME_REQUEST_FIELDS.modes).optional(),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("A hex colour for buttons, links and selection."),
        radius: z.number().min(THEME_REQUEST_FIELDS.radius[0]).max(THEME_REQUEST_FIELDS.radius[1]).optional(),
        font: z.enum(THEME_REQUEST_FIELDS.fonts).optional(),
        density: z.enum(THEME_REQUEST_FIELDS.densities).optional(),
        seriesOrder: z.enum(THEME_REQUEST_FIELDS.seriesOrders as [string, ...string[]]).optional().describe("A tested order of chart colours."),
      },
      example: { id: "look", component: "ThemeSwitch", preset: "Aurora", mode: "dark" },
    },
} satisfies Record<string, ComponentDefinition>;

/**
 * The components every catalog shares: layout, text, links, buttons, inputs and forms, navigation and the theme
 * switch, after A2UI's basic catalog. The analytics catalog lists them in its own order, and the site catalog is
 * built on them, so a Button or a Form means the same thing under either.
 */
export const basicComponents = Object.fromEntries(
  Object.entries<ComponentDefinition>(definitions).map(([name, definition]) => [name, EVENTS[name] ? { ...definition, events: EVENTS[name] } : definition]),
) as Record<keyof typeof definitions, ComponentDefinition>;

/** The basic components alone, as a catalog: for a surface that needs no data, and as the base other catalogs extend. */
export const basicsCatalog = defineCatalog({
  id: "urn:surfaces:catalog:basics:v1",
  title: "Surfaces basics",
  description: "Layout, text, links, buttons, inputs and forms, navigation and the theme switch: the components every Surfaces catalog shares.",
  components: withMinHeight(basicComponents),
});
