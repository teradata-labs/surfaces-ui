# FilterBar

Filters for a whole page: active filters as removable chips and a form to add one, with each column's values offered from the database and quick date ranges that stay relative. It writes the list to `filters`, a path in the surface's data model; give every Chart, Metric, Sparkline, DataGrid and PivotTable on the page `filters: { "@path": "/filters" }` with the same path and they all follow it. The views should read the same columns as `sql`, since a filter on a column a view does not have fails. Put the starting filters in the data model with updateDataModel. The event, if given, is sent with `filters` on every change.

## Props

- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement whose columns can be filtered.
- `filters`: binding — Where the filter list is kept in the surface's data model, e.g. { path: "/filters" }.
- `columns` (optional): array of string — Offer only these columns.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **change**: When a person adds or removes a filter. Adds `filters` (the whole filter list, as the `filters` prop takes it).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.FilterBar
  sourceId="lake"
  sql="SELECT * FROM orders"
  filters={{ "@path": "/filters" }}
  columns={["region", "status", "ordered_at"]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "filters",
  "component": "FilterBar",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "filters": {
    "@path": "/filters"
  },
  "columns": [
    "region",
    "status",
    "ordered_at"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "filters",
  "elements": {
    "filters": {
      "type": "FilterBar",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "filters": {
          "$state": "/filters"
        },
        "columns": [
          "region",
          "status",
          "ordered_at"
        ]
      }
    }
  }
}
```
