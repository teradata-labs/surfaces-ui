# PivotTable

A pivot table over a SQL query: row values down the side, column values across the top, summarised measures in the cells, with totals. The database does the grouping. Use it to compare a measure across two dimensions.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `rows`: array — Columns whose values become the rows.
- `columns` (optional): array — Columns whose values become the columns. Choose ones with few distinct values.
- `measures`: array
- `totals` (optional): boolean
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PivotTable
  sourceId="lake"
  sql="SELECT * FROM orders"
  rows={["region"]}
  columns={[{ column: "ordered_at", grain: "quarter" }]}
  measures={[{ column: "amount", aggregate: "sum", label: "Revenue" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "pivot",
  "component": "PivotTable",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "rows": [
    "region"
  ],
  "columns": [
    {
      "column": "ordered_at",
      "grain": "quarter"
    }
  ],
  "measures": [
    {
      "column": "amount",
      "aggregate": "sum",
      "label": "Revenue"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "pivot",
  "elements": {
    "pivot": {
      "type": "PivotTable",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "rows": [
          "region"
        ],
        "columns": [
          {
            "column": "ordered_at",
            "grain": "quarter"
          }
        ],
        "measures": [
          {
            "column": "amount",
            "aggregate": "sum",
            "label": "Revenue"
          }
        ]
      }
    }
  }
}
```
