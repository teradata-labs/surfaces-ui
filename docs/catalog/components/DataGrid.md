# DataGrid

A table over a SQL query, for any number of rows. Sorting and paging run in the database. Use it to show rows; use Chart to show a trend or comparison.

## Props

- `sourceId`: value or binding — The data source to query.
- `sql`: value or binding — A single read-only SELECT statement.
- `mode` (optional): "scroll" | "pages"
- `sorts` (optional): array — Sort order, most important first. An empty list clears it.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `columns` (optional): object — Which columns show, in what order and how wide.
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.DataGrid sourceId="lake" sql="SELECT * FROM orders" height={360} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "table",
  "component": "DataGrid",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "height": 360
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "DataGrid",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "height": 360
      }
    }
  }
}
```
