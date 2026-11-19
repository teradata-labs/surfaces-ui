# Explorer

Exploring a query with pills, as a person would in a BI tool but with nothing defined in advance. Each field is a pill: an attribute to break down by, a metric (a column summarised) or a derived metric (arithmetic over metrics: a rate, a margin). Leave `fields` out and pills are generated from the query's columns; send `fields` to add your own metrics and calculations, which a person can then edit. `rows`, `split` and `values` are what is on the shelves, by pill id, and draw a chart and the numbers behind it, worked out by the database. A person drags, presses and edits; what they did comes back as this component's controls, so read those before changing it. Give `action` to show a box where they ask in words, sent as the event with `text`. Use it when someone wants to look around a table or a join themselves; use Chart when you already know the view.

## Props

- `model` (optional): string — The name of a semantic model (list them with list_semantic_models). Its dimensions, measures and metrics become the pills, marked as the model's, so a metric means what the model defines; its source and query are used when `sourceId` and `sql` are left out. Prefer it to writing `fields` whenever a model covers the data. A person can add a field they make to the model.
- `sourceId` (optional): value or binding — Where the query runs. Left out with `model`, the model's.
- `sql` (optional): value or binding — A single read-only SELECT statement: a table, or a join. Every pill is a column of it or a calculation over them. Left out with `model`, the model's.
- `fields` (optional): array — The pills. Left out, they are generated from the query's columns.
- `rows` (optional): array — Attributes to break down by, by pill id. The first is the x axis.
- `split` (optional): string — An attribute whose values become separate series.
- `values` (optional): array — Metrics and derived metrics to show, by pill id.
- `filters` (optional): array
- `view` (optional): "chart" | "table"
- `chart` (optional): object — How the chart is drawn. Left out, it is chosen from what is on the shelves.
- `action` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **ask**: When a person asks for a field or a view in words. Answer by updating this component's `fields`, `rows`, `split` and `values`. Adds `text` (what they asked for).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Explorer
  sourceId="lake"
  sql="SELECT * FROM orders"
  fields={[{ id: "region", kind: "attribute", label: "Region", column: "region" }, { id: "amount", kind: "metric", label: "Revenue", column: "amount", aggregate: "sum", format: "currency" }, { id: "orders", kind: "metric", label: "Orders", aggregate: "count" }, { id: "per_order", kind: "derived", label: "Revenue per order", expression: "amount / orders", format: "currency" }]}
  rows={["region"]}
  values={["per_order"]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "explore",
  "component": "Explorer",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "fields": [
    {
      "id": "region",
      "kind": "attribute",
      "label": "Region",
      "column": "region"
    },
    {
      "id": "amount",
      "kind": "metric",
      "label": "Revenue",
      "column": "amount",
      "aggregate": "sum",
      "format": "currency"
    },
    {
      "id": "orders",
      "kind": "metric",
      "label": "Orders",
      "aggregate": "count"
    },
    {
      "id": "per_order",
      "kind": "derived",
      "label": "Revenue per order",
      "expression": "amount / orders",
      "format": "currency"
    }
  ],
  "rows": [
    "region"
  ],
  "values": [
    "per_order"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "explore",
  "elements": {
    "explore": {
      "type": "Explorer",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "fields": [
          {
            "id": "region",
            "kind": "attribute",
            "label": "Region",
            "column": "region"
          },
          {
            "id": "amount",
            "kind": "metric",
            "label": "Revenue",
            "column": "amount",
            "aggregate": "sum",
            "format": "currency"
          },
          {
            "id": "orders",
            "kind": "metric",
            "label": "Orders",
            "aggregate": "count"
          },
          {
            "id": "per_order",
            "kind": "derived",
            "label": "Revenue per order",
            "expression": "amount / orders",
            "format": "currency"
          }
        ],
        "rows": [
          "region"
        ],
        "values": [
          "per_order"
        ]
      }
    }
  }
}
```
