# DataGrid

A table over a SQL query, for any number of rows. Sorting and paging run in the database. Use it to show rows; use Chart to show a trend or comparison.

## Props

- `sourceId`: string | binding | call — The data source to query.
- `sql`: string | binding | call — A single read-only SELECT statement.
- `mode` (optional): "scroll" | "pages"
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `columns` (optional): { order?: array of string, hidden?: array of string, widths?: { [name]: number }, labels?: { [name]: string } } — Which columns show, in what order, how wide, and under what headers.
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.
- `emptyMessage` (optional): string | binding | call — What the people using the page read when the query answers with no rows, in place of the component's own empty text. Say what is missing and what to try: "No orders this week yet."
- `errorMessage` (optional): string | binding | call — What the people using the page read when the query fails, in place of the database's error text, which is kept for developers. Say what went wrong in their terms and what to do.

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
