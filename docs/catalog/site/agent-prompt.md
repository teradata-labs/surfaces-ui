# Building UI with the Surfaces site catalog

You describe UI as A2UI 1.0 messages, one JSON object per message. The client draws them with its own components; you never write HTML or code.

## Messages

1. `createSurface` — start a surface, once: `{ surfaceId, catalogId: "urn:surfaces:catalog:site:v1" }`, optionally with `sendDataModel`, `metadata` (below), and the surface's first `components` and `dataModel`. Sending it again for a surface that exists is an error.
2. `updateComponents` — add or replace components. Components are a flat list; parents name children by `id`. Exactly one component must have `id: "root"`.
3. `updateDataModel` — set data at a path (`/a/b`). `value` is required; `null` removes what is there. Omit `path` to replace everything.
4. `deleteSurface` — remove a surface.

Every message has `"version": "1.0"`.

## Rules

- Use only the components and props listed below. Unknown components or props are rejected.
- Any prop that accepts a binding can be a literal or `{ "@path": "/data/path" }`. Put values that change in the data model and bind to them.
- Inside a repeated child (`children: { componentId, path }`), relative paths such as `{ "@path": "name" }` read from the current item.
- In the props below, `binding` is `{ "@path": "/data/path" }` and `call` is a function call, `{ "@call": "name", "args": { … } }`, which works out a value.
- A control's `action` is one of two things: `{ "event": { "name": "…", "context": { … } } }` sends an event back to you, and `{ "functionCall": { "@call": "name", "args": { … } } }` runs a function that acts (see Functions). A bare `{ "@call": … }` is not an action.
- Any component takes `visibleWhen: { "path": "/source/kind", "equals": "Table" }` (or `"in": [ … ]`; with neither, anything there will do) and is drawn only while the data model holds that. Use it to show a field only once the choice that needs it is made.
- A component is replaced whole by `updateComponents`. Anything you leave out of it, its `@metadata` included, is gone.
- `@metadata: { extensions: { name: value } }` on a component, and `metadata` on `createSurface`, carry data that is never drawn. Prefix a name with whose it is (`acme_ticket`). Keep one you find on a component when you send that component again.
- SQL must be a single read-only SELECT. Never put user-typed text into SQL; sorting, filtering and paging are done by the components.
- For charts over large tables, give each measure an `aggregate`.
- Buttons send an `event` back to you with the `context` you declare. Wait for it; do not assume it happened.
- Values that must be checked and sent together belong in a `Form`: it marks what is required, shows each problem beside its field, and sends nothing while any is wrong. Inside a `Form` a field waits on another with its own `visibleWhen: { "field": "kind", "equals": "Table" }`. Loose inputs check themselves (`required`, `min`, `max`, `pattern`); a Button waits for them only when it names their ids in `requires`, and then sends nothing until each is in order.

## Getting the reply you need

- In `createSurface`, the `surfaces_expects` extension declares what you need back: an event name mapped to a JSON Schema for that event's context, e.g. `"metadata": { "extensions": { "surfaces_expects": { "approve": { "type": "object", "properties": { "budget": { "type": "number", "minimum": 1 } }, "required": ["budget"] } } } }`. An event that does not match is not sent; you are told why instead.
- The `surfaces_theme` extension, in the same place, styles this surface alone: `{ "preset": "Ink", "mode": "dark" }`.
- `sendDataModel: true` sends the whole data model (everything the person typed) with each event.
- Every turn tells you each surface as it stands: its data model, how the person left controls (sorts, filters, columns, in the same props you set), and problems with what you drew. Fix problems with new messages; keep a person's control changes unless asked to change them.

## Functions

- `formatString`, args `{ value: string }` → string: Builds text from a template. "${path}" is replaced by the data model value at that path. "${path|not chosen yet}" gives the words to use while there is no value there (nothing, or empty text), so a summary of a form never reads as a gap.
- `formatNumber`, args `{ value: any, decimals?: number, grouping?: boolean }` → string: Formats a number with grouping and a fixed number of decimals.
- `formatCurrency`, args `{ value: any, currency: string }` → string: Formats a number as money in the given ISO 4217 currency.
- `formatDate`, args `{ value: any, format?: "date" | "time" | "datetime" }` → string: Formats a date or time. "format" is "date", "time" or "datetime".
- `openUrl`, args `{ url: string }` → void: Opens a web link in a new tab. Only http and https links are allowed. It acts, so it is run from a control's `action`: `{"functionCall":{"@call":"openUrl","args":{"url":"…"}}}`.

## Components

### Text
A heading, paragraph or caption.
- `text`: string | binding | call
- `variant` (optional): "h1" | "h2" | "h3" | "h4" | "h5" | "body" | "caption"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"title","component":"Text","text":"Revenue this quarter","variant":"h2"}`

### Row
Places children side by side. Wraps on narrow screens unless `wrap` is false. Children share the width equally unless `widths` gives each its share, or `sizes` says how each is sized (content width, fill, or fixed pixels); `sizes` wins over `widths` when both have one entry per child. `gap` and `padding` are steps of the theme's spacing scale.
- `children`: array of string | { componentId: string, path: string }
- `widths` (optional): array of number — The share of the width each child takes, one per child: [2, 1] makes the first twice as wide as the second. Used when it has one entry per child and `sizes` is not used.
- `sizes` (optional): array of ("hug" | "fill" | { fixed: number }) — How each child is sized, one per child: "hug" keeps its content's width and does not grow, "fill" grows to share the space left, { fixed: 240 } is that many pixels wide. Used when it has one entry per child, in place of `widths`. Narrow screens stack the children unless `wrap` is false.
- `wrap` (optional): boolean — Whether children move onto a new line when they do not fit, and stack on narrow screens. Defaults to true; false keeps them on one line, each shrinking to fit.
- `gap` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space between children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `padding` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space inside the edge, around the children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to "none".
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"stats","component":"Row","children":["revenue","orders"]}`

### Column
Stacks children top to bottom. Use it as the root of most surfaces. `gap` and `padding` are steps of the theme's spacing scale.
- `children`: array of string | { componentId: string, path: string }
- `gap` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space between children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `padding` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space inside the edge, around the children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to "none".
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"root","component":"Column","children":["title","stats","chart"]}`

### Grid
Lays children out in columns that wrap onto new rows. Use it for dashboards: a row of numbers, then charts side by side. Columns are equal unless `widths` gives each its share, as when a person resizes them by hand. Children in a row are stretched to the tallest one; set `align: "start"` when the row mixes content of different heights, such as a chart beside a form, so each keeps its own height. `gap` is a step of the theme's spacing scale, between rows and columns alike.
- `children`: array of string | { componentId: string, path: string }
- `columns` (optional): integer — Columns per row. Defaults to 2. Narrow screens use one.
- `widths` (optional): array of number — The share of the width each column takes, one per column: [2, 1] makes the first twice as wide as the second. Used when it has one entry per column; otherwise columns are equal.
- `align` (optional): "start" | "center" | "end" | "stretch" — Where each child sits in the height of its row. Defaults to stretch: every child as tall as the tallest. Use start for mixed content, so each keeps its own height.
- `gap` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space between children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"tiles","component":"Grid","columns":3,"children":["revenue","orders","average"]}`

### Card
A bordered container for one child, to group related content. `padding` is a step of the theme's spacing scale.
- `child`: string — ID of a child component.
- `padding` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space inside the edge, around the children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"panel","component":"Card","child":"chart"}`

### Divider
A thin line between sections.
- `axis` (optional): "horizontal" | "vertical"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"rule","component":"Divider"}`

### SideNav
Navigation down the side of a surface: groups of items, with the current one marked. A person can fold it away: it then keeps only a slim strip for its menu button, which slides it back in over the surface (never over anything outside it). In a narrow surface or on a narrow screen it is always folded. An item with `href` is a link (http and https only); one without sends the event with its `id`. Bind `current` to a data path to mark the item for what is showing.
- `label` (optional): string — What the navigation is for, for assistive technology.
- `groups`: array of { label?: string, items: array of object }
- `current` (optional): string | binding | call — The id of the item for what is showing.
- `pinned` (optional): boolean — Whether it starts open beside the content. Defaults to true.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **select**: When an item without a link is chosen. Adds `id` (the item's id).
Example: `{"id":"nav","component":"SideNav","label":"Sections","groups":[{"label":"Sales","items":[{"id":"overview","label":"Overview"},{"id":"orders","label":"Orders"}]}],"current":"overview","action":{"event":{"name":"navigate"}}}`

### Tabs
Switches between several children, one visible at a time.
- `tabs`: array of { title: string | binding | call, child: string }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"views","component":"Tabs","tabs":[{"title":"Chart","child":"chart"},{"title":"Table","child":"table"}]}`

### Button
A control that sends an event back to the agent or opens a link. Its label is a child Text. To open a link, the action is a function call in place of an event: `"action": {"functionCall": {"@call": "openUrl", "args": {"url": "https://example.com/start"}}}`.
- `child`: string — ID of a child component.
- `variant` (optional): "default" | "primary" | "borderless"
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `requires` (optional): array of string — Ids of inputs (TextField, NumberField, ChoicePicker, CheckBox, DateTimeInput) this button waits for. While any of them is missing or wrong the button is marked unavailable; a press then sends nothing, has each say what is wrong beside it and moves to the first. An input that is not shown (`visibleWhen`) is not waited for.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **press**: When pressed. Carries only the context declared in the action.
Example: `{"id":"refresh","component":"Button","child":"refresh-label","variant":"primary","action":{"event":{"name":"refresh","context":{"region":{"@path":"/region"}}}}}`

### TextField
A labelled text box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `multiline` (optional): boolean
- `placeholder` (optional): string
- `help` (optional): string | binding | call — A sentence under the field: what to enter, or why it is asked.
- `maxLength` (optional): integer
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `pattern` (optional): string — A regular expression the whole text must match; a value that does not is said so beside the field.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"note","component":"TextField","label":"Note","value":{"@path":"/review/note"},"multiline":true}`

### NumberField
A labelled number box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `min` (optional): number — A number below it is said so beside the field.
- `max` (optional): number — A number above it is said so beside the field.
- `step` (optional): number
- `help` (optional): string | binding | call
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"threshold","component":"NumberField","label":"Alert above","value":{"@path":"/threshold"},"min":0,"step":50}`

### ChoicePicker
Pick one of a few options: radio buttons for four or fewer, a list for more. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `options`: array of string
- `help` (optional): string | binding | call
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"region","component":"ChoicePicker","label":"Region","value":{"@path":"/region"},"options":["Europe","Americas","Asia"]}`

### CheckBox
A yes-or-no box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `help` (optional): string | binding | call
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"include-returns","component":"CheckBox","label":"Include returns","value":{"@path":"/includeReturns"}}`

### DateTimeInput
A date, or a date and time (kept in UTC). The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `mode` (optional): "date" | "datetime"
- `help` (optional): string | binding | call
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"from","component":"DateTimeInput","label":"From","value":{"@path":"/from"},"mode":"date"}`

### Slider
A number chosen along a range, with its value shown in words. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.
- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `min`: number
- `max`: number
- `step` (optional): number
- `help` (optional): string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"confidence","component":"Slider","label":"Confidence","value":{"@path":"/confidence"},"min":0,"max":100,"step":5}`

### Form
A form that checks what a person enters and submits it. Give the fields and their rules; the form draws a labelled input for each, shows errors beside them and sends nothing while any is wrong. A field with `visibleWhen: { field, equals }` is asked for only once another field holds that value. When the page has a forms backend, values go to the form with this `formId` there (the backend decides where they are stored; you never name a table); either way your event receives them. Use it instead of loose inputs and a Button whenever values must be checked or kept.
- `formId`: string
- `title` (optional): string | binding | call
- `description` (optional): string | binding | call
- `fields`: array of { name: string, label: string, type: "text" | "longtext" | "number" | "integer" | "boolean" | "date" | "datetime" | "choice", required?: boolean, options?: array of string, min?: number, max?: number, step?: number, maxLength?: integer, pattern?: string, help?: string, placeholder?: string, visibleWhen?: { field: string, equals?: any, in?: array } }
- `values` (optional): binding — Where the entered values live in the data model, to prefill them or show them elsewhere.
- `submitLabel` (optional): string
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **submit**: After the values pass every check and, when the page has a forms backend, after it stored them. Adds `formId` (the form), `values` (the values as stored), `submissionId` (the backend's id, or empty with no backend).
Example: `{"id":"case-review","component":"Form","formId":"case-review","title":"Review this alert","fields":[{"name":"decision","label":"Decision","type":"choice","options":["Fraud","Not fraud","Needs more information"],"required":true},{"name":"amount_at_risk","label":"Amount at risk","type":"number","min":0},{"name":"note","label":"Note","type":"longtext","maxLength":500}],"values":{"@path":"/review"},"submitLabel":"Save decision","action":{"event":{"name":"case_reviewed"}}}`

### Markdown
Formatted text: headings, lists, tables, links and code. Use it for explanations longer than a line.
- `text`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"notes","component":"Markdown","text":"Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat"}`

### Link
A link to a web page. Only http and https addresses are shown as links; in a site, a path on the site ("/pricing") is too, and opens in place.
- `text`: string | binding | call
- `url`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"docs","component":"Link","text":"Metric definitions","url":"https://example.com/metrics"}`

### ThemeSwitch
Changes how the whole page looks, at once: a built-in theme, light or dark, the accent colour, corner radius, font, density or chart colours. Leave out what should stay as it is. The person sees what changed and can undo it. To style only your own surface, put the same fields in `createSurface.theme` instead.
- `preset` (optional): "Ink" | "Aurora" | "Sand" | "Berry" | "Harbor" | "Moss" | "Mono" | "High contrast"
- `mode` (optional): "system" | "light" | "dark"
- `accent` (optional): string — A hex colour for buttons, links and selection.
- `radius` (optional): number
- `font` (optional): "system" | "rounded" | "serif" | "mono"
- `density` (optional): "comfortable" | "compact"
- `seriesOrder` (optional): "Classic" | "Aurora" | "Sand" | "Ink" | "Berry" | "Moss" — A tested order of chart colours.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"look","component":"ThemeSwitch","preset":"Aurora","mode":"dark"}`

### Hero
The opening of a page: a large title that scales with the room it has, a lead of one or two sentences, and its actions (Buttons or Links; the first is the primary one) as its children. Use one per page, first; put a Media, DeviceFrame or PromptReveal after it to show the product.
- `title`: string | binding | call
- `lead` (optional): string | binding | call
- `eyebrow` (optional): string | binding | call — A short line above the title: a product name, a release.
- `children` (optional): array of string | { componentId: string, path: string } — The actions: Buttons or Links, the primary one first. One to three.
- `align` (optional): "center" | "start"
- `level` (optional): 1 | 2 | 3 | 4 — The title's heading level. Defaults to 1; use 2 when the host's page already has a title.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"hero","component":"Hero","title":"Surfaces UI","lead":"Components for data work that people and agents build together.","children":["start","browse"]}`

### Section
A part of a page under its own heading, with room around it: one message per section. Its children follow the heading.
- `heading`: string | binding | call
- `eyebrow` (optional): string | binding | call
- `lead` (optional): string | binding | call — A sentence under the heading.
- `children`: array of string | { componentId: string, path: string }
- `level` (optional): 1 | 2 | 3 | 4 — The heading's level. Defaults to 2.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"roles","component":"Section","heading":"Showcase","lead":"Setups for the people who work with data.","children":["role-cards"]}`

### FeatureGrid
Cards of a title and a line each, as many to a row as fit. An item with `href` is a link; one without sends `select` with its `id`.
- `label` (optional): string — What the cards are, for assistive technology.
- `items`: array of { id: string, title: string, line?: string, href?: string }
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **select**: When a card without a link is chosen. Adds `id` (the item's id).
Example: `{"id":"role-cards","component":"FeatureGrid","label":"Roles","items":[{"id":"analyst","title":"Analyst","line":"Ask, chart and share."},{"id":"engineer","title":"Analytics engineer","line":"Model the data once."}],"action":{"event":{"name":"select"}}}`

### DeviceFrame
The same content on a desktop window and a phone, side by side, to show a product. The child is drawn once in each, and stays live. With too little room only the last device stands.
- `child`: string — ID of a child component.
- `devices` (optional): array of ("desktop" | "phone") — Which, in order. Defaults to both.
- `title` (optional): string — The desktop window's title.
- `label` (optional): string — What the screens show, for assistive technology.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"devices","component":"DeviceFrame","title":"Playground","label":"a dashboard","child":"screen"}`

### PromptReveal
A prompt typed out, then its answer shown, and again: for showing what an agent does. It has a Pause button, stops once a person reaches into the answer, and shows the answer finished to anyone who asks for less motion.
- `prompt`: string | binding | call
- `child`: string — The answer: often a DeviceFrame.
- `loop` (optional): boolean — Starts again after a pause. Defaults to true.
- `label` (optional): string — What the answer is, for the status line.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"demo","component":"PromptReveal","prompt":"Build me a dashboard of this quarter's revenue.","child":"devices"}`

### Showcase
A picker of named examples above a stage that shows the chosen one. Use it for a few alternatives of the same kind: roles, plans, themes.
- `label`: string — What the picker chooses between, for assistive technology.
- `examples`: array of { id: string, name: string, line?: string, child: string }
- `selected` (optional): string — The id shown first. A person's choice comes back as `selected`.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"roles-showcase","component":"Showcase","label":"Who it is for","examples":[{"id":"analyst","name":"Analyst","line":"Ask, chart and share.","child":"analyst-view"},{"id":"steward","name":"Data steward","line":"Keeps data right.","child":"steward-view"}]}`

### NavBar
Navigation across the top of a site: sections on a bar that stays in view, the current section's pages in a second bar beneath, folding into a menu on a phone. An item with `href` is a link; one without sends `select` with its `id`. Bind `current` to mark the page showing.
- `label`: string — The site's name, for assistive technology.
- `brand` (optional): string — The site's name, shown at the bar's start.
- `groups`: array of { label?: string, items: array of object }
- `current` (optional): string | binding | call
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **select**: When an item without a link is chosen. Adds `id` (the item's id).
Example: `{"id":"site-nav","component":"NavBar","label":"Surfaces UI","brand":"Surfaces UI","groups":[{"label":"Build","items":[{"id":"playground","label":"Playground"},{"id":"chat","label":"Chat"}]},{"label":"Docs","items":[{"id":"start","label":"Getting started"}]}],"current":"playground","action":{"event":{"name":"select"}}}`

### Footer
The end of a page: columns of links and a note (a licence, a copyright). An item with `href` is a link; one without sends `select` with its `id`.
- `groups`: array of { label?: string, items: array of object }
- `note` (optional): string | binding | call
- `label` (optional): string — What the links are, for assistive technology. Defaults to "Site".
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **select**: When a link without an address is chosen. Adds `id` (the item's id).
Example: `{"id":"footer","component":"Footer","groups":[{"label":"Docs","items":[{"id":"start","label":"Getting started"},{"id":"github","label":"GitHub","href":"https://github.com/teradata-labs/surfaces-ui"}]}],"note":"Apache-2.0"}`

### Media
An image or a video at a fixed ratio, loaded only near the screen; a video never plays on its own. `src` is a name or an address the page knows: the page decides what may load, and with nothing it allows, the description is shown in its place. Always describe what it shows in `alt` (an empty string only for decoration).
- `src`: string — A name the page gives an address for, or an address from an origin the page allows.
- `alt`: string
- `kind` (optional): "image" | "video"
- `ratio` (optional): "16:9" | "4:3" | "3:2" | "1:1" | "21:9"
- `caption` (optional): string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"shot","component":"Media","src":"dashboard","alt":"A dashboard of revenue by region, drawn by an agent","ratio":"16:9","caption":"Drawn from one sentence."}`

### Quote
A pull quote and who said it.
- `text`: string | binding | call
- `cite` (optional): string | binding | call — Who said it.
- `url` (optional): string — Where it was said.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"quote","component":"Quote","text":"The dashboard was there before I finished my coffee.","cite":"An analyst"}`

### Callout
A note set apart from the text around it: a note, a tip or a warning. Its kind is its heading, so it is never told by colour alone. The text is Markdown.
- `tone` (optional): "note" | "tip" | "warning"
- `title` (optional): string | binding | call
- `text`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"careful","component":"Callout","tone":"warning","text":"A full refresh **rebuilds every table**. Run it outside working hours."}`

### PostCard
One post: its title (a link with `href`, otherwise it sends `open` with its `id`), date, a line of it and its tags.
- `title`: string
- `date` (optional): string — An ISO date, 2026-11-21. Shown in the reader's words for it.
- `excerpt` (optional): string
- `tags` (optional): array of string
- `href` (optional): string — An http or https address, or a path on this site. Anything else is not drawn as a link.
- `level` (optional): 1 | 2 | 3 | 4 — The title's heading level. Defaults to 3.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **open**: When a post without a link is opened. Adds `id` (the post's id).
Example: `{"id":"post","component":"PostCard","title":"Charts that tell the truth","date":"2026-11-01","excerpt":"Start bars at zero, and other rules worth keeping.","tags":["design"],"href":"https://example.com/charts"}`

### PostList
Posts as cards, in the order given (newest first is usual). Says so when there are none. An item without `href` sends `open` with its `id`.
- `label` (optional): string
- `posts`: array of { id: string, title: string, date?: string, excerpt?: string, tags?: array of string, href?: string }
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **open**: When a post without a link is opened. Adds `id` (the post's id).
Example: `{"id":"posts","component":"PostList","label":"Essays","posts":[{"id":"charts","title":"Charts that tell the truth","date":"2026-11-01","tags":["design"]},{"id":"models","title":"One meaning for a metric","date":"2026-10-12","tags":["modelling"]}],"action":{"event":{"name":"open"}}}`

## A complete example

```json
{"version":"1.0","createSurface":{"surfaceId":"main","catalogId":"urn:surfaces:catalog:site:v1"}}
{"version":"1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Column","children":["title"]},{"id":"title","component":"Text","text":{"@path":"/title"},"variant":"h2"}]}}
{"version":"1.0","updateDataModel":{"surfaceId":"main","path":"/title","value":"Hello"}}
```
