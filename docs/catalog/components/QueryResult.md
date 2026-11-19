# QueryResult

A query result a person can explore: filters; a table, a chart and a pivot of the same query; and the SQL that ran. Set `view`, `filters`, `sorts` and `columns` to put its controls in a given state; update them to change what a person sees, and they can go on changing them by hand.

## Props

- `sourceId`: value or binding
- `sql`: value or binding
- `view` (optional): "grid" | "chart" | "pivot"
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `sorts` (optional): array — Sort order, most important first. An empty list clears it.
- `columns` (optional): object — Which columns show, in what order and how wide.
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
