# PivotTable

A pivot table over a SQL query: row values down the side, column values across the top, summarised measures in the cells, with totals. The database does the grouping. Use it to compare a measure across two dimensions.

## Props

- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `rows`: array of (string | { column: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", label?: string }) — Columns whose values become the rows.
- `columns` (optional): array of (string | { column: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", label?: string }) — Columns whose values become the columns. Choose ones with few distinct values.
- `measures`: array of { column?: string, aggregate: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile", percentile?: number, label?: string }
- `totals` (optional): boolean
- `height` (optional): integer
- `label` (optional): string — Accessible name for the table.
- `emptyMessage` (optional): string | binding | call — What the people using the page read when the query answers with no rows, in place of the component's own empty text. Say what is missing and what to try: "No orders this week yet."
- `errorMessage` (optional): string | binding | call — What the people using the page read when the query fails, in place of the database's error text, which is kept for developers. Say what went wrong in their terms and what to do.

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
