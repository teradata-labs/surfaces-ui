# BulletGraph

One measure against a target and named bands (poor, fair, good), as a bar from zero. Use it instead of a gauge or a traffic light when a number needs judging against a goal.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `column` (optional): string
- `aggregate`: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance" | "percentile"
- `label`: value or binding
- `target` (optional): number
- `ranges`: array — Where each band ends, lowest first. The last end is the end of the scale.
- `format` (optional): "number" | "compact" | "currency" | "percent"
- `currency` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.BulletGraph
  sourceId="lake"
  sql="SELECT * FROM orders"
  column="amount"
  aggregate="sum"
  label="Revenue"
  format="currency"
  target={2000000}
  ranges={[{ to: 1000000, label: "Poor" }, { to: 1800000, label: "Fair" }, { to: 3000000, label: "Good" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "goal",
  "component": "BulletGraph",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "column": "amount",
  "aggregate": "sum",
  "label": "Revenue",
  "format": "currency",
  "target": 2000000,
  "ranges": [
    {
      "to": 1000000,
      "label": "Poor"
    },
    {
      "to": 1800000,
      "label": "Fair"
    },
    {
      "to": 3000000,
      "label": "Good"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "goal",
  "elements": {
    "goal": {
      "type": "BulletGraph",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "column": "amount",
        "aggregate": "sum",
        "label": "Revenue",
        "format": "currency",
        "target": 2000000,
        "ranges": [
          {
            "to": 1000000,
            "label": "Poor"
          },
          {
            "to": 1800000,
            "label": "Fair"
          },
          {
            "to": 3000000,
            "label": "Good"
          }
        ]
      }
    }
  }
}
```
