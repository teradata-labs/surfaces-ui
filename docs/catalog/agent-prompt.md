# Building UI with the Surfaces analytics catalog

You describe UI as A2UI 1.0 messages, one JSON object per message. The client draws them with its own components; you never write HTML or code.

## Messages

1. `createSurface` — start a surface, once: `{ surfaceId, catalogId: "urn:surfaces:catalog:analytics:v1" }`, optionally with `sendDataModel`, `metadata` (below), and the surface's first `components` and `dataModel`. Sending it again for a surface that exists is an error.
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
Places children side by side. Wraps on narrow screens. Children share the width equally unless `widths` gives each its share.
- `children`: array of string | { componentId: string, path: string }
- `widths` (optional): array of number — The share of the width each child takes, one per child: [2, 1] makes the first twice as wide as the second. Used when it has one entry per child.
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"stats","component":"Row","children":["revenue","orders"]}`

### Column
Stacks children top to bottom. Use it as the root of most surfaces.
- `children`: array of string | { componentId: string, path: string }
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"root","component":"Column","children":["title","stats","chart"]}`

### Grid
Lays children out in columns that wrap onto new rows. Use it for dashboards: a row of numbers, then charts side by side. Columns are equal unless `widths` gives each its share, as when a person resizes them by hand.
- `children`: array of string | { componentId: string, path: string }
- `columns` (optional): integer — Columns per row. Defaults to 2. Narrow screens use one.
- `widths` (optional): array of number — The share of the width each column takes, one per column: [2, 1] makes the first twice as wide as the second. Used when it has one entry per column; otherwise columns are equal.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"tiles","component":"Grid","columns":3,"children":["revenue","orders","average"]}`

### Card
A bordered container for one child, to group related content.
- `child`: string — ID of a child component.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"panel","component":"Card","child":"chart"}`

### Divider
A thin line between sections.
- `axis` (optional): "horizontal" | "vertical"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"rule","component":"Divider"}`

### Workspace
Several children side by side as panels a person can arrange: drag a panel by its heading to another column or to an edge for a column of its own, resize with the dividers, and hide or show panels from a rail. `layout.columns` says where the panels are: a list of columns from left to right, each a list of panel ids from top to bottom, so search on the left and a map on the right is `[["search"], ["map"]]`. To rearrange, send the component again with a new `layout`; how a person left it comes back to you in the surface's controls as `layout`. Panels not placed are added to the last column. Each panel shows on a rail as an icon, with its name in a tooltip and, when a person turns names on, a short name under it: keep titles to a few words, and give `short` and `icon` so the rail reads well. Use it when a person will work across several views at once; use Grid or Row for a fixed arrangement.
- `label` (optional): string — What the workspace is, for assistive technology.
- `panels`: array of { id: string, title: string, short?: string, icon?: "surface" | "agent" | "components" | "table" | "code" | "data" | "history" | "save" | "search" | "map" | "chart" | "grid" | "settings" | "note" | "folder", child: string }
- `layout` (optional): { columns: array of array of string, columnWidths?: array of number, rowHeights?: array of array of number, hidden?: array of string, collapsed?: array of string, places?: { [name]: { column: integer, row: integer, sole?: boolean } } }
- `rail` (optional): "left" | "right" | "none" — Where the rail of panel toggles sits. Defaults to right.
- `railLabels` (optional): boolean — Whether the rail shows a short name under each icon. Left out, the rail is icons only and each name shows in a tooltip; a person can turn names on.
- `height` (optional): integer — How tall the workspace is, in pixels. Panels scroll inside it. Defaults to 520.
Example: `{"id":"explore","component":"Workspace","label":"Explore the catalog","panels":[{"id":"search","title":"Table search","short":"Search","icon":"search","child":"search"},{"id":"map","title":"Relationship map","short":"Map","icon":"map","child":"map"}],"layout":{"columns":[["search"],["map"]],"columnWidths":[0.4,0.6]},"height":520}`

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

### Stat
One headline number with a label, and optionally how it changed.
- `label`: string | binding | call
- `value`: string | binding | call | number | binding | call
- `delta` (optional): string | binding | call — Change text, e.g. "+5.4% vs last quarter".
- `tone` (optional): "neutral" | "positive" | "negative" | "warning" — Colour of the change text.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"revenue","component":"Stat","label":"Revenue","value":{"@path":"/revenue"},"delta":"+5.4% vs last quarter","tone":"positive"}`

### KeyValue
A short list of labelled facts.
- `items`: array of { label: string | binding | call, value: string | binding | call | number | binding | call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"facts","component":"KeyValue","items":[{"label":"Source","value":"lake"},{"label":"Rows","value":{"@path":"/rows"}}]}`

### Metric
One headline number worked out by the database from a query: a total, an average, a count. Use it for dashboard figures; use Stat only for a number you already have.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `percentile` (optional): number
- `label`: string | binding | call
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"revenue","component":"Metric","sourceId":"lake","sql":"SELECT * FROM orders","column":"amount","aggregate":"sum","label":"Revenue","format":"currency"}`

### Badge
A small status label.
- `text`: string | binding | call
- `tone` (optional): "neutral" | "positive" | "negative" | "warning"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"status","component":"Badge","text":"Up to date","tone":"positive"}`

### Progress
Progress toward a total.
- `value`: number | binding | call
- `max` (optional): number | binding | call
- `label` (optional): string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"load","component":"Progress","value":42,"max":100,"label":"Rows loaded"}`

### DataGrid
A table over a SQL query, for any number of rows. Sorting and paging run in the database. Use it to show rows; use Chart to show a trend or comparison.
- `sourceId`: string | binding | call — The data source to query.
- `sql`: string | binding | call — A single read-only SELECT statement.
- `mode` (optional): "scroll" | "pages"
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `columns` (optional): { order?: array of string, hidden?: array of string, widths?: { [name]: number } } — Which columns show, in what order and how wide.
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.
Example: `{"id":"table","component":"DataGrid","sourceId":"lake","sql":"SELECT * FROM orders","height":360}`

### Chart
A chart over a SQL query. Give each measure an aggregate so the database summarises the data; without one the chart plots a random sample of rows. Each entry in y is a series; give series their own type and axis for a compound chart. Choose the form from the comparison: bars for amounts across categories (they are sorted largest first and start at zero), a line with xGrain for change over time, xBins for a distribution, scatter for two measures. Avoid a pie beyond five slices, more than five lines, and a second y scale (use two charts on the same x instead); the chart shows advice when its shape is hard to read.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `type`: "bar" | "line" | "area" | "scatter" | "pie"
- `x`: string — Column for the x axis, or the slices of a pie.
- `xGrain` (optional): "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year" — Group a date or time x column into buckets of this size. Use it for every time series.
- `xBins` (optional): integer — Group a numeric x column into about this many bins, for a histogram.
- `y`: array of { column?: string, aggregate?: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile", percentile?: number, expression?: string, terms?: { [name]: object }, label?: string, type?: "bar" | "line" | "area" | "scatter", axis?: "left" | "right", slot?: integer } — One entry per series.
- `splitBy` (optional): string — Column whose values become separate series.
- `stacked` (optional): boolean
- `select` (optional): binding — Makes the chart a filter: the path of a shared filter list (the one its `filters` and a FilterBar use). A click on a bar filters the page to that x value, a click on it again clears it, and this chart ignores filters on its own x column so the bars a person clicks stay. Only for a category x (no xGrain or xBins).
- `sort` (optional): "value" | "x" — Order of bars. Bars over categories are sorted largest first unless you say "x". Dates, bins and numbers keep their own order.
- `legend` (optional): "top" | "bottom" | "right" | "none" — Leave out: up to four lines are labelled at their ends, and one series needs no legend.
- `xTitle` (optional): string
- `yTitle` (optional): string
- `yRightTitle` (optional): string
- `yFormat` (optional): "number" | "compact" | "currency" | "percent" — How the left axis writes its numbers: "percent" for a rate (6%, not 0.06), "currency" for money. Labels only.
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `label` (optional): string — Accessible description of what the chart shows.
Sends:
- **select**: When a person clicks a bar or point. Adds `column` (the x column), `value` (the clicked x value), `series` (the series clicked).
Example: `{"id":"chart","component":"Chart","sourceId":"lake","sql":"SELECT * FROM orders","type":"bar","x":"region","y":[{"column":"amount","aggregate":"sum","label":"Revenue"}],"yTitle":"Revenue","label":"Revenue by region, largest first"}`

### PivotTable
A pivot table over a SQL query: row values down the side, column values across the top, summarised measures in the cells, with totals. The database does the grouping. Use it to compare a measure across two dimensions.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `rows`: array of (string | { column: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", label?: string }) — Columns whose values become the rows.
- `columns` (optional): array of (string | { column: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", label?: string }) — Columns whose values become the columns. Choose ones with few distinct values.
- `measures`: array of { column?: string, aggregate: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile", percentile?: number, label?: string }
- `totals` (optional): boolean
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.
Example: `{"id":"pivot","component":"PivotTable","sourceId":"lake","sql":"SELECT * FROM orders","rows":["region"],"columns":[{"column":"ordered_at","grain":"quarter"}],"measures":[{"column":"amount","aggregate":"sum","label":"Revenue"}]}`

### QueryResult
A query result a person can explore: filters; a table, a chart and a pivot of the same query; and the SQL that ran. Set `view`, `filters`, `sorts` and `columns` to put its controls in a given state; update them to change what a person sees, and they can go on changing them by hand.
- `sourceId`: string | binding | call
- `sql`: string | binding | call
- `view` (optional): "grid" | "chart" | "pivot"
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `columns` (optional): { order?: array of string, hidden?: array of string, widths?: { [name]: number } } — Which columns show, in what order and how wide.
- `height` (optional): integer
Example: `{"id":"explore","component":"QueryResult","sourceId":"lake","sql":"SELECT * FROM orders"}`

### Message
One turn of a conversation, for a page that is laid out as a chat: who spoke, what they said (Markdown), and when. Put the turns in a Column, oldest first. `side: "end"` sets the person's own turns apart from everyone else's; the speaker is always written, so the side is never the only sign. Offer replies with Chips after the last turn, and take a typed one with a TextField and a Button. It shows a conversation; it does not run one.
- `speaker`: string | binding | call — Who spoke: a name or a role.
- `text`: string | binding | call — What they said, as Markdown.
- `side` (optional): "start" | "end" — "end" for the person's own turns. Defaults to "start".
- `time` (optional): string | binding | call — When, as it should read: "10:42" or "Yesterday".
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"turn-1","component":"Message","speaker":"Assistant","text":"Which table holds the articles?","time":"10:42"}`

### RowList
One component drawn once for each row of a SQL query: a feed of posts, a list of cards, rows that each carry their own buttons. `child` is the component drawn per row, usually a Card. Inside it, and in everything it holds, a relative path reads the row's column of that name (`{ "@path": "author" }`; `formatString` with `${author}` too), and a Button's event carries the row's key the same way (`"context": { "post_id": { "@path": "post_id" } }`), so you learn which row was acted on. Absolute paths still read the surface's data model. The database sorts, filters and pages; a person asks for more rows, up to 200. An input inside a row must bind an absolute path. For plain rows in columns use DataGrid.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement. One row of it is one item.
- `child`: string — ID of the component drawn for each row.
- `label`: string — What the items are, for assistive technology: "Posts".
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `pageSize` (optional): integer — Rows fetched at a time. Defaults to 20.
- `rowKey` (optional): string — A column that tells rows apart, such as the key.
- `layout` (optional): "list" | "grid" — "list" stacks the rows; "grid" lays them out as cards, as many across as fit.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"feed","component":"RowList","sourceId":"lake","sql":"SELECT * FROM orders","child":"order-card","label":"Orders","sorts":[{"column":"ordered_at","desc":true}],"rowKey":"order_id","pageSize":10}`

### Markdown
Formatted text: headings, lists, tables, links and code. Use it for explanations longer than a line.
- `text`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"notes","component":"Markdown","text":"Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat"}`

### CodeBlock
Code with a copy button. For SQL a person should be able to run, use SqlProposal instead.
- `code`: string | binding | call
- `language` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"snippet","component":"CodeBlock","language":"sql","code":"SELECT region, SUM(amount) FROM orders GROUP BY region"}`

### Table
A small table of values you already have (at most 100 rows). For query results use DataGrid, which pages in the database.
- `columns`: array of string
- `rows`: array of array
- `caption` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"top","component":"Table","columns":["Region","Revenue"],"rows":[["Europe",1200],["Asia Pacific",950]],"caption":"Top regions"}`

### Link
A link to a web page. Only http and https addresses are shown as links.
- `text`: string | binding | call
- `url`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"docs","component":"Link","text":"Metric definitions","url":"https://example.com/metrics"}`

### Checklist
A list of steps showing which are done.
- `items`: array of { label: string | binding | call, done?: boolean }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"plan","component":"Checklist","items":[{"label":"Find the tables","done":true},{"label":"Check the join"}]}`

### Chips
Short choices a person can pick with one press, such as follow-up questions or tables to look at. The chosen chip is sent back in the event context as `value`. An item is its text, or `{ label, value }` when what is sent differs from what is shown. Give `selected` a data path and a press also writes the chip's value there, inside the surface; bind another component's prop to the same path and it follows at once, with no agent: chips of table names whose values are SELECT statements switch a QueryResult whose `sql` is bound to that path. Set the path in the data model to the value that starts selected.
- `items`: array of (string | { label: string, value: string })
- `selected` (optional): binding — Where the pressed chip's value is written in this surface's data model. The chip holding the value there is shown as pressed.
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **choose**: When a chip is pressed. Adds `value` (the chip's value: its text, unless the item sets a value).
Example: `{"id":"next","component":"Chips","items":["Break down by region","Show last year"],"action":{"event":{"name":"choose"}}}`

### DecisionCard
Asks a person to choose between options before you continue. Mark the option you recommend. The chosen option's id is sent back in the event context as `choice`.
- `title`: string | binding | call
- `detail` (optional): string | binding | call
- `options`: array of { id: string, label: string, description?: string, recommended?: boolean }
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **choose**: When an option is chosen. Adds `choice` (the option's id), `label` (the option's label).
Example: `{"id":"grain","component":"DecisionCard","title":"Which revenue should I use?","detail":"The two tables disagree for March.","options":[{"id":"ledger","label":"Finance ledger","description":"Certified, updated nightly.","recommended":true},{"id":"orders","label":"Orders table","description":"Live, but includes returns."}],"action":{"event":{"name":"decide"}}}`

### Sparkline
A word-sized trend line beside its latest value, worked out by the database: no axes, grid or legend. Use it in a table of figures or beside a Metric to show direction; use Chart when the values themselves must be read.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `x`: string — The date or time column the line runs along.
- `grain`: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year"
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `label`: string | binding | call
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `points` (optional): integer
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"trend","component":"Sparkline","sourceId":"lake","sql":"SELECT * FROM orders","x":"ordered_at","grain":"month","column":"amount","aggregate":"sum","label":"Revenue","format":"currency"}`

### BulletGraph
One measure against a target and named bands (poor, fair, good), as a bar from zero. Use it instead of a gauge or a traffic light when a number needs judging against a goal.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `label`: string | binding | call
- `target` (optional): number
- `ranges`: array of { to: number, label: string } — Where each band ends, lowest first. The last end is the end of the scale.
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"goal","component":"BulletGraph","sourceId":"lake","sql":"SELECT * FROM orders","column":"amount","aggregate":"sum","label":"Revenue","format":"currency","target":2000000,"ranges":[{"to":1000000,"label":"Poor"},{"to":1800000,"label":"Fair"},{"to":3000000,"label":"Good"}]}`

### StepFlow
Where multi-step work stands: onboarding, connecting a source, a cleaning or transformation run. Give a step the status `waiting` when the work has stopped for the person, and say in `detail` what you need from them.
- `label`: string | binding | call
- `steps`: array of { id: string, title: string, detail?: string, status: "done" | "current" | "waiting" | "pending" | "failed" | "skipped" }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"flow","component":"StepFlow","label":"Connect the sales lake","steps":[{"id":"find","title":"Find the tables","status":"done"},{"id":"secret","title":"Add the credential on the server","detail":"Set LAKE_KEY_ID and LAKE_SECRET, then tell me.","status":"waiting"},{"id":"test","title":"Test the connection","status":"pending"}]}`

### PlanReview
A plan a person must approve before you act: cleaning steps, transformations, a connection to set up. List every step with what it changes; mark anything that removes or overwrites data or widens access as `risk: "high"` (it starts unticked). The event context carries `approved`, the ticked `stepIds` and any `note`. Do only the approved steps.
- `title`: string | binding | call
- `summary` (optional): string | binding | call
- `proposedBy` (optional): string — Your name, so the person knows who wrote the plan.
- `steps`: array of { id: string, title: string, detail?: string, sql?: string, kind?: string, affects?: string, risk?: "low" | "medium" | "high", required?: boolean }
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **decide**: When the plan is approved or rejected. Adds `approved` (whether the plan was approved), `stepIds` (the steps left ticked), `note` (the person's note, if any).
Example: `{"id":"clean","component":"PlanReview","title":"Clean the orders table","summary":"Three fixes before it feeds the revenue dashboard.","proposedBy":"Analyst agent","steps":[{"id":"trim","title":"Trim spaces from region","kind":"Clean","affects":"412 of 58,000 rows","sql":"SELECT TRIM(region) AS region FROM orders"},{"id":"dedupe","title":"Remove repeated order IDs","kind":"Clean","affects":"37 rows removed","risk":"high"}],"action":{"event":{"name":"plan_decided"}}}`

### ActionReceipt
What happened after a person approved something: the outcome, who approved it and why, what ran, what changed, and whether it can be undone. Send one after every approved action that changed something, including a failed one. Give `undo` only when undoing is really possible, with `until` when it stops being; leave it out and the receipt says it cannot be undone. The `undo` event is a request: confirm it with the person before acting.
- `title`: string | binding | call
- `outcome`: "done" | "partial" | "failed"
- `summary` (optional): string | binding | call
- `ranAt` (optional): string — ISO time it ran.
- `ranBy` (optional): string — What ran it: you, a pipeline, a service.
- `approvedBy` (optional): array of { by: string, at?: string, reason?: string }
- `sql` (optional): string — What ran, for the record. Never run from the receipt.
- `changes` (optional): array of { label: string, before?: string, after: string }
- `undo` (optional): { label: string, description?: string, until?: string }
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **undo**: When a person asks to undo what ran. Ask again before undoing; this is a request, not an approval.
Example: `{"id":"receipt","component":"ActionReceipt","title":"Rebuilt orders_clean","outcome":"done","summary":"58,000 rows replaced with 57,963 after removing repeated order IDs.","ranAt":"2026-11-13T10:04:00Z","ranBy":"sales pipeline","approvedBy":[{"by":"Ada","at":"2026-11-13T10:02:00Z","reason":"Counts checked against finance"}],"changes":[{"label":"Rows","before":"58,000","after":"57,963"}],"undo":{"label":"Restore the previous version","description":"Restores the table as it was at 10:03. Rows added since then are lost.","until":"2026-11-20T10:04:00Z"},"action":{"event":{"name":"undo_requested"}}}`

### PiiReview
A review of a table's columns for personal data before it is shared, charted or sent to a model. Flag a column with the kind of data you suspect and how you know (`basis`); the person chooses the treatment and confirms. The event context carries `table`, `columns` (name, category, action) and `confirmed`. Never treat your own flags as the decision.
- `table`: string
- `purpose` (optional): string | binding | call
- `columns`: array of { name: string, type?: string, category?: "name" | "email" | "phone" | "address" | "government_id" | "financial" | "date_of_birth" | "network" | "location" | "credential" | "health" | "demographic", basis?: "name" | "values" | "person", action?: "keep" | "mask" | "hash" | "generalize" | "drop" }
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **decide**: When the review is confirmed. Adds `table` (table name), `columns` (each column's category and treatment), `confirmed` (true when the person confirmed they may decide this).
Example: `{"id":"pii","component":"PiiReview","table":"customers","purpose":"Before sharing with the marketing workspace.","columns":[{"name":"customer_id","type":"BIGINT"},{"name":"email","type":"VARCHAR","category":"email","basis":"name"},{"name":"birth_date","type":"DATE","category":"date_of_birth","basis":"name"}],"action":{"event":{"name":"pii_decided"}}}`

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

### SqlProposal
SQL you propose, shown for review. It never runs on its own: a person presses Run, and the result appears beneath it. The event, if given, is sent with `sql` when they do.
- `sourceId`: string | binding | call
- `sql`: string | binding | call
- `title` (optional): string
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **run**: When a person presses Run. Adds `sql` (the SQL as run).
Example: `{"id":"proposal","component":"SqlProposal","sourceId":"lake","title":"Revenue by region","sql":"SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region"}`

### SqlEditor
An editor for a person to write or change SQL. The event is sent with `sql` when they run it.
- `sql` (optional): string | binding | call
- `dialect` (optional): "standard" | "duckdb" | "teradata" | "postgres"
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **run**: When a person runs the SQL. Adds `sql` (the SQL as written).
Example: `{"id":"editor","component":"SqlEditor","sql":"SELECT * FROM orders","action":{"event":{"name":"run"}}}`

### ObjectBrowser
A tree of the source's catalogs, schemas, tables and columns, with the tables each one joins. Use it when a person needs to look around. The event is sent with `table` (and `column`) when they pick something. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.
- `sourceId`: string | binding | call
- `height` (optional): integer
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **select**: When a table, column or join is picked. Adds `table` (table name), `column` (column name, or empty).
Example: `{"id":"browse","component":"ObjectBrowser","sourceId":"lake","height":360}`

### ReportBuilder
A report built from pills: the dashboard pattern. `fields` are the report's pills (attributes, metrics, derived metrics), defined once so a metric means the same in every view. `tiles` are the views, each a set of shelves (`rows`, `split`, `values`, by pill id) drawn as a chart, a table, or headline numbers when there is nothing to break down by. Every tile follows `filters`, and a click on a bar filters the whole report. In build mode a person makes a view on the shelves and keeps it as a tile, edits pills, retitles, resizes and reorders; in view mode it is the dashboard alone with its filter bar. To write a report yourself, send `fields` and `tiles`; to leave it to the person, send only `sql` and pills are generated from its columns. What they change comes back as this component's controls, so read those first. Give `action` to show a box where they ask in words. Use it for anything with several views over one table or join; use separate Chart and Metric components only when the views read different queries.
- `model` (optional): string — The name of a semantic model (list them with list_semantic_models). Its dimensions, measures and metrics become the pills, marked as the model's, so a metric means what the model defines; its source and query are used when `sourceId` and `sql` are left out. Prefer it to writing `fields` whenever a model covers the data. A person can add a field they make to the model.
- `sourceId` (optional): string | binding | call — Where the query runs. Left out with `model`, the model's.
- `sql` (optional): string | binding | call — A single read-only SELECT statement, wide enough for every view: a table, or a join. Left out with `model`, the model's.
- `title` (optional): string
- `fields` (optional): array of { id: string, kind: "attribute" | "metric" | "derived", label: string, column?: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", aggregate?: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median", expression?: string, format?: "number" | "compact" | "currency" | "percent", description?: string, by?: string, model?: string } — The report's pills. Left out, they are generated from the query's columns.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } — Filters every tile follows.
- `tiles` (optional): array of { id: string, title?: string, rows: array of string, split?: string, values: array of string, view?: "chart" | "table", chart?: { type?: "bar" | "line" | "area", swap?: boolean, measures?: object }, span?: 1 | 2 | 3 }
- `draft` (optional): { rows: array of string, split?: string, values: array of string, view?: "chart" | "table", chart?: { type?: "bar" | "line" | "area", swap?: boolean, measures?: { [name]: object } } } — What is on the builder's shelves: a view you propose, for the person to add.
- `mode` (optional): "build" | "view" — Leave out to let the person switch. "view" shows the dashboard alone.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **ask**: When a person asks for a field, a view or a whole report in words. Answer by updating this component's `fields`, `tiles`, `filters` and `draft`. Adds `text` (what they asked for).
Example: `{"id":"report","component":"ReportBuilder","sourceId":"lake","sql":"SELECT * FROM orders","title":"Orders","fields":[{"id":"region","kind":"attribute","label":"Region","column":"region"},{"id":"ordered_at","kind":"attribute","label":"Month","column":"ordered_at","grain":"month"},{"id":"amount","kind":"metric","label":"Revenue","column":"amount","aggregate":"sum","format":"currency"},{"id":"orders","kind":"metric","label":"Orders","aggregate":"count"},{"id":"per_order","kind":"derived","label":"Revenue per order","expression":"amount / orders","format":"currency"}],"tiles":[{"id":"headline","rows":[],"values":["amount","orders","per_order"],"span":3},{"id":"by-region","rows":["region"],"values":["amount"]},{"id":"over-time","rows":["ordered_at"],"values":["per_order"],"span":2}]}`

### SemanticModelEditor
A semantic model, to create, read and change: what one row is (the grain) and the columns that make it unique, where the rows come from (tables and joins, or a written query), and its dimensions (ways to break rows down), measures (a column summarised) and metrics (arithmetic over measures), each with who defined it. Every Explorer and ReportBuilder given this `model` takes its fields from it, so a change here changes every report on it. To propose a change, send `proposed` with the fields to add or replace (in the pill form: an attribute is a dimension, a metric a measure, a derived metric a metric), the names to remove and any change to the rows, and `proposedBy` with your name; read the model with describe_semantic_model first. To propose a new model, send `create` with its label and source and `proposed` with its rows and fields; read the tables with describe_table first and join from the table whose rows the model counts to tables that add one row of detail each. Either way it is shown as a draft, marked part by part and checked as it is made, and a person can change the joins, the grain, the key and every field before saving; nothing is kept until they save. What the person changes comes back as `proposed` in this component's controls. Give `action` to receive the `save` event, and the `ask` event with `text` when the person asks for something in words.
- `model`: string — The semantic model to show, or with `create` the name of the one to make.
- `create` (optional): { label: string, description?: string, sourceId: string } — Propose a new model named `model`. Its rows and fields go in `proposed`. When a model of that name exists, the proposal is shown as a change to it instead.
- `proposed` (optional): { add?: array of { id: string, kind: "attribute" | "metric" | "derived", label: string, column?: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", aggregate?: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median", expression?: string, format?: "number" | "compact" | "currency" | "percent", description?: string, by?: string, model?: string }, remove?: array of string, rows?: { grain?: string, primaryKey?: array of string, tables?: array of string, joins?: array of object, sql?: string, dataset?: { pipeline: string, dataset: string } } } — A change you propose, or a new model's rows and fields. Shown as a draft for a person to read, change and save, or drop.
- `proposedBy` (optional): string — Who proposed it: your name. Shown above the changes.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **save**: When a person saves the draft as the model's next version, or a new model as version 1. Every report on the model now uses it. Adds `model` (the model's name), `version` (the version saved), `changes` (each changed field's name and whether it was added, changed or removed; a part of the rows appears as (grain), (primaryKey), (joins), (sql) or (dataset)).
- **ask**: When a person asks for a change, or for a new model, in words. Answer by updating this component's `proposed` (and `create`). Adds `text` (what they asked for).
Example: `{"id":"model","component":"SemanticModelEditor","model":"sales_lines","proposed":{"add":[{"id":"cost_share","kind":"derived","label":"Cost share","expression":"cost / revenue","format":"percent","description":"Cost as a share of revenue."}],"remove":["brand"]},"proposedBy":"the analytics agent","action":{"event":{"name":"model.saved"}}}`

### Explorer
Exploring a query with pills, as a person would in a BI tool but with nothing defined in advance. Each field is a pill: an attribute to break down by, a metric (a column summarised) or a derived metric (arithmetic over metrics: a rate, a margin). Leave `fields` out and pills are generated from the query's columns; send `fields` to add your own metrics and calculations, which a person can then edit. `rows`, `split` and `values` are what is on the shelves, by pill id, and draw a chart and the numbers behind it, worked out by the database. A person drags, presses and edits; what they did comes back as this component's controls, so read those before changing it. Give `action` to show a box where they ask in words, sent as the event with `text`. Use it when someone wants to look around a table or a join themselves; use Chart when you already know the view.
- `model` (optional): string — The name of a semantic model (list them with list_semantic_models). Its dimensions, measures and metrics become the pills, marked as the model's, so a metric means what the model defines; its source and query are used when `sourceId` and `sql` are left out. Prefer it to writing `fields` whenever a model covers the data. A person can add a field they make to the model.
- `sourceId` (optional): string | binding | call — Where the query runs. Left out with `model`, the model's.
- `sql` (optional): string | binding | call — A single read-only SELECT statement: a table, or a join. Every pill is a column of it or a calculation over them. Left out with `model`, the model's.
- `fields` (optional): array of { id: string, kind: "attribute" | "metric" | "derived", label: string, column?: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", aggregate?: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median", expression?: string, format?: "number" | "compact" | "currency" | "percent", description?: string, by?: string, model?: string } — The pills. Left out, they are generated from the query's columns.
- `rows` (optional): array of string — Attributes to break down by, by pill id. The first is the x axis.
- `split` (optional): string — An attribute whose values become separate series.
- `values` (optional): array of string — Metrics and derived metrics to show, by pill id.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array }
- `view` (optional): "chart" | "table"
- `chart` (optional): { type?: "bar" | "line" | "area", swap?: boolean, measures?: { [name]: { type?: "bar" | "line" | "area", axis?: "left" | "right" } } } — How the chart is drawn. Left out, it is chosen from what is on the shelves.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **ask**: When a person asks for a field or a view in words. Answer by updating this component's `fields`, `rows`, `split` and `values`. Adds `text` (what they asked for).
Example: `{"id":"explore","component":"Explorer","sourceId":"lake","sql":"SELECT * FROM orders","fields":[{"id":"region","kind":"attribute","label":"Region","column":"region"},{"id":"amount","kind":"metric","label":"Revenue","column":"amount","aggregate":"sum","format":"currency"},{"id":"orders","kind":"metric","label":"Orders","aggregate":"count"},{"id":"per_order","kind":"derived","label":"Revenue per order","expression":"amount / orders","format":"currency"}],"rows":["region"],"values":["per_order"]}`

### FilterBar
Filters for a whole page: active filters as removable chips and a form to add one, with each column's values offered from the database and quick date ranges that stay relative. It writes the list to `filters`, a path in the surface's data model; give every Chart, Metric, Sparkline, DataGrid and PivotTable on the page `filters: { "@path": "/filters" }` with the same path and they all follow it. The views should read the same columns as `sql`, since a filter on a column a view does not have fails. Put the starting filters in the data model with updateDataModel. The event, if given, is sent with `filters` on every change.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement whose columns can be filtered.
- `filters`: binding — Where the filter list is kept in the surface's data model, e.g. { path: "/filters" }.
- `columns` (optional): array of string — Offer only these columns.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **change**: When a person adds or removes a filter. Adds `filters` (the whole filter list, as the `filters` prop takes it).
Example: `{"id":"filters","component":"FilterBar","sourceId":"lake","sql":"SELECT * FROM orders","filters":{"@path":"/filters"},"columns":["region","status","ordered_at"]}`

### FileBrowser
A tree of folders and files: a source's storage (only the places it may read) and, with `local`, folders the person opens from their own computer, which their browser reads and nothing uploads. It shows names, sizes, dates and which table reads a file, never what a file holds. Use it when the data a person means is still files: to find what to bring in, or to see what a table reads. The event is sent with `path`, `name`, `place` and `format` when they open a file. You cannot read a local file; ask the person to load it.
- `sourceId` (optional): string | binding | call — List this source's storage. Leave out to offer only folders on the person's computer.
- `local` (optional): boolean — Offer "Open a folder on this computer".
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **open**: When a person opens a file (Enter or a double click). Adds `path` (the file's path in its place), `name` (the file's name), `place` (the source id, or local:<folder> for a folder on their computer), `format` (parquet, csv, json, delta or iceberg, or empty).
Example: `{"id":"files","component":"FileBrowser","sourceId":"lake","local":true,"height":360,"action":{"event":{"name":"open_file"}}}`

### ModelDiagram
A relationship diagram: tables as cards with their columns and lines between the columns that join. A person can drag columns together to add joins. Use it to show or agree how tables relate. The event is sent with `sql`, `tables` and `joins` when they press Use as query.
- `sourceId`: string | binding | call
- `tables`: array of string — Tables to show.
- `joins` (optional): array of { left: string, right: string, keys: array of object, inferred?: boolean, declared?: boolean, type?: "inner" | "left" | "right" | "full" }
- `rowsFrom` (optional): boolean — The first table's rows are the result's rows: it is marked, the rest are laid out as its detail, and each join says whether it adds one row or can repeat rows. Use it to show which tables can be joined without double counting.
- `suggest` (optional): boolean — False to leave out joins the backend would guess from column names; the joins you send and those the source declares are still shown. Default true.
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **use**: When a person presses Use as query. Adds `sql` (the generated SELECT), `tables` (the tables), `joins` (the joins kept).
Example: `{"id":"model","component":"ModelDiagram","sourceId":"lake","tables":["orders","customers"],"joins":[{"left":"orders","right":"customers","keys":[{"leftColumn":"customer_id","rightColumn":"customer_id"}],"inferred":true}],"action":{"event":{"name":"use_model"}}}`

### DataSearch
A search box over tables and columns, by name or meaning. The event is sent with `table` when a person opens a result. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.
- `sourceId` (optional): string | binding | call
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `height` (optional): integer — How tall the search is, in pixels. The results scroll inside it. Left out, the list is as long as its results.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **open**: When a result is opened. Adds `table` (table name), `column` (column name, or empty).
Example: `{"id":"find","component":"DataSearch","sourceId":"lake","opened":{"@path":"/table"},"height":420}`

### ObjectDetail
Everything known about one table: description, certification, columns with statistics and related tables. Bind `table` to a path (`{ "@path": "/table" }`) to show whichever table a search or graph in the same surface opened. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.
- `sourceId`: string | binding | call
- `table`: string | binding | call
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **open**: When a related table is opened. Adds `table` (table name).
Example: `{"id":"about","component":"ObjectDetail","sourceId":"lake","table":"orders"}`

### RelationshipGraph
A small map of one table and the tables it joins with or resembles. For several tables and their columns, use ModelDiagram. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.
- `sourceId`: string | binding | call
- `table`: string | binding | call
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **open**: When a related table is opened. Adds `table` (table name).
Example: `{"id":"around","component":"RelationshipGraph","sourceId":"lake","table":"orders"}`

### NodeGraph
Things and the links between them, drawn as a graph with the same things listed beside it: concepts in a glossary, tables in a model, systems and what they feed. You give the nodes and links; it reads no data. `group` is what kind of thing a node is (each group takes a colour and is named in the legend); `level` is how far along it is (drawn as how full the node is). Give `selected` a data path to mark the open node and to write the node a person opens there. Past 300 nodes it shows what is around the open node and says how many it left out. For tables and their joins use ModelDiagram; for a pipeline use PipelineGraph.
- `label`: string — What the graph shows, for assistive technology.
- `nodes`: array of { id: string, label: string, description?: string, group?: string, level?: "full" | "half" | "outline" }
- `links`: array of { source: string, target: string, label?: string }
- `selected` (optional): string | binding — The open node's id, or a data path that holds it and is written when a person opens a node.
- `groups` (optional): array of string — The order groups take colours and appear in the legend.
- `levels` (optional): { full?: string, half?: string, outline?: string } — What each level means, in words.
- `noun` (optional): string — What a node is called: "term" gives "7 terms".
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **select**: When a node is opened, on the graph or in the list beside it. Adds `node` (the node's id).
Example: `{"id":"concepts","component":"NodeGraph","label":"Terms and how they are linked","noun":"term","nodes":[{"id":"order","label":"Order","level":"full"},{"id":"customer","label":"Customer","level":"half"},{"id":"store","label":"Store","level":"outline"}],"links":[{"source":"order","target":"customer","label":"placed by"},{"source":"order","target":"store","label":"taken at"}],"levels":{"full":"Certified","half":"Partly certified","outline":"Not certified"},"selected":{"@path":"/term"},"height":360}`

### AskData
A question box that answers from the catalog and cites the tables it used.
- `sourceId` (optional): string | binding | call
- `contextPackId` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"ask","component":"AskData","sourceId":"lake"}`

### ContextBuilder
Lets a person assemble the tables, columns and notes an agent should work from, and preview exactly what the agent will receive.
- `name` (optional): string
- `tables` (optional): array of { sourceId: string, table: string }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"context","component":"ContextBuilder","name":"Sales analysis","tables":[{"sourceId":"lake","table":"orders"}]}`

### QueryPlan
How the database intends to run a query, without running it: the steps as a tree and the engine's own plan text. Use it to explain why a query is slow.
- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"plan","component":"QueryPlan","sourceId":"lake","sql":"SELECT region, SUM(amount) FROM orders GROUP BY region"}`

### SourceList
The data sources available, how each connects (by secret name only) and a button to test that its tables can be reached.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"sources","component":"SourceList"}`

### PipelineGraph
A pipeline as a graph of sources, tables, views and sinks with the flows between them and each one's latest status. You supply the nodes and edges as the pipeline engine reported them. The event is sent with `id` and `name` when a node is chosen.
- `nodes`: array of { id: string, name: string, kind: "source" | "table" | "view" | "streamingTable" | "materializedView" | "temporaryView" | "sink", status?: "idle" | "starting" | "running" | "completed" | "failed" | "cancelled" | "skipped", layer?: "bronze" | "silver" | "gold", rowsWritten?: number, expectationsFailed?: number, checksFailed?: number }
- `edges`: array of { from: string, to: string, flowName?: string, mode?: "streaming" | "batch" }
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
Sends:
- **select**: When a node is chosen. Adds `id` (node id), `name` (node name).
Example: `{"id":"pipeline","component":"PipelineGraph","nodes":[{"id":"files","name":"landing files","kind":"source"},{"id":"raw","name":"orders_raw","kind":"streamingTable","layer":"bronze","status":"completed","rowsWritten":12000},{"id":"daily","name":"daily_revenue","kind":"materializedView","layer":"gold","status":"running"}],"edges":[{"from":"files","to":"raw","mode":"streaming"},{"from":"raw","to":"daily"}]}`

### PipelineView
A pipeline the backend runs, live: its datasets and how they feed one another, its runs, and for each dataset its query, grain, key, columns, row rules and checks with the latest results, with buttons to run, check or rebuild it. Give `action` to hear when a person's run starts and ends (`started`, `finished`). Use PipelineGraph instead when you only have a description of a pipeline to draw.
- `pipelineId`: string | binding | call
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **started**: When a person starts a run here. Adds `event` (started), `runId` (the run), `state` (running, or how it already ended).
- **finished**: When a run a person started here ends. Adds `event` (finished), `runId` (the run), `state` (completed, failed or cancelled), `built` (datasets built), `failed` (datasets that failed), `failedChecks` (checks that failed, as dataset.check).
Example: `{"id":"sales-pipeline","component":"PipelineView","pipelineId":"sales"}`

### DatasetReview
A new or changed pipeline dataset for a person to approve: its query, what it reads, its grain and key, columns and checks, and what changes from the saved version. Give it exactly what `propose_dataset` returned: `pipeline`, `dataset`, `expectedVersion` and `digest`. The person may change the grain, descriptions and checks, names themselves, and approves or rejects. Approving saves it on the server, which checks it again; it builds nothing, so run the pipeline afterwards if they want it built. The `decide` event says what they chose.
- `pipeline`: object — The whole pipeline as it would be, as propose_dataset returned it.
- `dataset`: string — The dataset under review.
- `expectedVersion`: integer
- `digest` (optional): string
- `proposedBy` (optional): string — Your name, so the person knows who proposed it.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Sends:
- **decide**: When the person approves (and the page saved it) or rejects the dataset. Adds `approved` (whether it was approved), `version` (the version saved, when approved and saved), `approvedBy` (who approved it), `digest` (the digest of the pipeline as approved), `note` (the person's note, if any).
Example: `{"id":"review","component":"DatasetReview","pipeline":{"id":"sales","name":"Sales","sourceId":"lake","datasets":[{"name":"orders_clean","sql":"SELECT * FROM orders WHERE status IS NOT NULL","grain":"one row per order","primaryKey":["order_id"]},{"name":"region_revenue","sql":"SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region","inputs":["orders_clean"],"inputsDeclared":true,"grain":"one row per region","primaryKey":["region"],"columns":[{"name":"region","type":"VARCHAR"},{"name":"revenue","type":"DOUBLE","description":"Sum of amount."}],"checks":[{"name":"relationships_region","kind":"CHECK_KIND_RELATIONSHIPS","columns":["region"],"toTable":"orders_clean","toColumn":"region"}]}]},"dataset":"region_revenue","expectedVersion":1,"proposedBy":"Analyst agent","action":{"event":{"name":"dataset_decided"}}}`

### IngestWizard
Steps a person through bringing new files in: where they are, what the engine finds there, and which columns to keep, rename and retype. It writes configuration to review; it loads nothing.
- `sourceId`: string | binding | call
- `location` (optional): string — Where the files are, to start from.
- `format` (optional): "parquet" | "delta" | "iceberg" | "csv" | "json"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"ingest","component":"IngestWizard","sourceId":"lake","format":"parquet","location":"s3://acme-lake/landing/orders/*.parquet"}`

### RunHistory
The runs of a pipeline, newest first: how each ended, how long it took, what it refreshed and why it failed.
- `runs`: array of { id: string, state: "idle" | "starting" | "running" | "completed" | "failed" | "cancelled" | "skipped", startTime: string, endTime?: string, trigger?: string, refreshKind?: "default" | "refresh" | "fullRefresh", datasets?: array of string, errorMessage?: string }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"runs","component":"RunHistory","runs":[{"id":"update-42","state":"completed","startTime":"2026-11-12T02:00:00Z","endTime":"2026-11-12T02:01:05Z","trigger":"schedule"}]}`

### ExpectationsPanel
Data quality rules for a pipeline with how many records passed and failed each, worst first. Counts come from the engine.
- `expectations`: array of { name: string, dataset: string, constraint: string, action: "warn" | "drop" | "fail", passedRecords: number, failedRecords: number }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"quality","component":"ExpectationsPanel","expectations":[{"name":"valid_amount","dataset":"orders_clean","constraint":"amount >= 0","action":"drop","passedRecords":960,"failedRecords":40}]}`

### SchemaDiff
How incoming data differs from the table it loads into: new, missing and retyped columns.
- `changes`: array of { column: string, change: "added" | "removed" | "typeChanged", before?: string, after?: string }
- `rescuedCount` (optional): number
- `mode` (optional): string — How new columns are treated, e.g. addNewColumns, rescue, failOnNewColumns.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"drift","component":"SchemaDiff","mode":"rescue","rescuedCount":12,"changes":[{"column":"coupon_code","change":"added","after":"string"}]}`

### StreamMetrics
How a streaming query is keeping up: input and processing rates, batch size and duration, with recent trends. Give the progress reports oldest first, as reported.
- `progress`: array of { timestamp: string, numInputRows: number, inputRowsPerSecond: number, processedRowsPerSecond: number, batchDurationMs: number, stateRows?: number }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.
Example: `{"id":"stream","component":"StreamMetrics","progress":[{"timestamp":"2026-11-12T10:00:00Z","numInputRows":500,"inputRowsPerSecond":50,"processedRowsPerSecond":80,"batchDurationMs":900}]}`

## A complete example

```json
{"version":"1.0","createSurface":{"surfaceId":"main","catalogId":"urn:surfaces:catalog:analytics:v1"}}
{"version":"1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Column","children":["title"]},{"id":"title","component":"Text","text":{"@path":"/title"},"variant":"h2"}]}}
{"version":"1.0","updateDataModel":{"surfaceId":"main","path":"/title","value":"Hello"}}
```
