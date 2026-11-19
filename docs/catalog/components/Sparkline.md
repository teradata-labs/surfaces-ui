# Sparkline

A word-sized trend line beside its latest value, worked out by the database: no axes, grid or legend. Use it in a table of figures or beside a Metric to show direction; use Chart when the values themselves must be read.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `x`: string — The date or time column the line runs along.
- `grain`: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year"
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `label`: value or binding
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `points` (optional): integer
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
