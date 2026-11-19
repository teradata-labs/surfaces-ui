# Metric

One headline number worked out by the database from a query: a total, an average, a count. Use it for dashboard figures; use Stat only for a number you already have.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `percentile` (optional): number
- `label`: value or binding
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Metric
  sourceId="lake"
  sql="SELECT * FROM orders"
  column="amount"
  aggregate="sum"
  label="Revenue"
  format="currency"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "revenue",
  "component": "Metric",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "column": "amount",
  "aggregate": "sum",
  "label": "Revenue",
  "format": "currency"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "revenue",
  "elements": {
    "revenue": {
      "type": "Metric",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "column": "amount",
        "aggregate": "sum",
        "label": "Revenue",
        "format": "currency"
      }
    }
  }
}
```
