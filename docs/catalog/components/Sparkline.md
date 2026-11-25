# Sparkline

A word-sized trend line beside its latest value, worked out by the database: no axes, grid or legend. Use it in a table of figures or beside a Metric to show direction; use Chart when the values themselves must be read.

## Props

- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters. A filter on a column a view's rows lack (a total with no region column, under a filter by region) is left out for that view, which is drawn without it and says so in a note.
- `x`: string — The date or time column the line runs along.
- `grain`: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year"
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `label`: string | binding | call
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `points` (optional): integer
- `emptyMessage` (optional): string | binding | call — What the people using the page read when the query answers with no rows, in place of the component's own empty text. Say what is missing and what to try: "No orders this week yet."
- `errorMessage` (optional): string | binding | call — What the people using the page read when the query fails, in place of the database's error text, which is kept for developers. Say what went wrong in their terms and what to do.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Sparkline
  sourceId="lake"
  sql="SELECT * FROM orders"
  x="ordered_at"
  grain="month"
  column="amount"
  aggregate="sum"
  label="Revenue"
  format="currency"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "trend",
  "component": "Sparkline",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "x": "ordered_at",
  "grain": "month",
  "column": "amount",
  "aggregate": "sum",
  "label": "Revenue",
  "format": "currency"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "trend",
  "elements": {
    "trend": {
      "type": "Sparkline",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "x": "ordered_at",
        "grain": "month",
        "column": "amount",
        "aggregate": "sum",
        "label": "Revenue",
        "format": "currency"
      }
    }
  }
}
```
