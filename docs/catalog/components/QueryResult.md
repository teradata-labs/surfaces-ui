# QueryResult

A query result a person can explore: filters; a table, a chart and a pivot of the same query; and the SQL that ran. Set `view`, `filters`, `sorts` and `columns` to put its controls in a given state; update them to change what a person sees, and they can go on changing them by hand.

## Props

- `sourceId`: string | binding | call
- `sql`: string | binding | call
- `view` (optional): "grid" | "chart" | "pivot"
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `columns` (optional): { order?: array of string, hidden?: array of string, widths?: { [name]: number } } — Which columns show, in what order and how wide.
- `height` (optional): integer

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.QueryResult sourceId="lake" sql="SELECT * FROM orders" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "explore",
  "component": "QueryResult",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "explore",
  "elements": {
    "explore": {
      "type": "QueryResult",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders"
      }
    }
  }
}
```
