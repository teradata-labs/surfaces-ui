# ReportBuilder

A report built from pills: the dashboard pattern. `fields` are the report's pills (attributes, metrics, derived metrics), defined once so a metric means the same in every view. `tiles` are the views, each a set of shelves (`rows`, `split`, `values`, by pill id) drawn as a chart, a table, or headline numbers when there is nothing to break down by. Every tile follows `filters`, and a click on a bar filters the whole report. In build mode a person makes a view on the shelves and keeps it as a tile, edits pills, retitles, resizes and reorders; in view mode it is the dashboard alone with its filter bar. To write a report yourself, send `fields` and `tiles`; to leave it to the person, send only `sql` and pills are generated from its columns. What they change comes back as this component's controls, so read those first. Give `action` to show a box where they ask in words. Use it for anything with several views over one table or join; use separate Chart and Metric components only when the views read different queries.

## Props

- `model` (optional): string — The name of a semantic model (list them with list_semantic_models). Its dimensions, measures and metrics become the pills, marked as the model's, so a metric means what the model defines; its source and query are used when `sourceId` and `sql` are left out. Prefer it to writing `fields` whenever a model covers the data. A person can add a field they make to the model.
- `sourceId` (optional): string | binding | call — Where the query runs. Left out with `model`, the model's.
- `sql` (optional): string | binding | call — A single read-only SELECT statement, wide enough for every view: a table, or a join. Left out with `model`, the model's.
- `title` (optional): string
- `fields` (optional): array of { id: string, kind: "attribute" | "metric" | "derived", label: string, column?: string, grain?: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", aggregate?: "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median", expression?: string, format?: "number" | "compact" | "currency" | "percent", description?: string, by?: string, model?: string } — The report's pills. Left out, they are generated from the query's columns.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } — Filters every tile follows.
- `tiles` (optional): array of { id: string, title?: string, rows: array of string, split?: string, values: array of string, view?: "chart" | "table", chart?: { type?: "bar" | "line" | "area", swap?: boolean, measures?: object }, span?: 1 | 2 | 3 }
- `draft` (optional): { rows: array of string, split?: string, values: array of string, view?: "chart" | "table", chart?: { type?: "bar" | "line" | "area", swap?: boolean, measures?: { [name]: object } } } — What is on the builder's shelves: a view you propose, for the person to add.
- `mode` (optional): "build" | "view" — Leave out to let the person switch. "view" shows the dashboard alone.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **ask**: When a person asks for a field, a view or a whole report in words. Answer by updating this component's `fields`, `tiles`, `filters` and `draft`. Adds `text` (what they asked for).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ReportBuilder
  sourceId="lake"
  sql="SELECT * FROM orders"
  title="Orders"
  fields={[{ id: "region", kind: "attribute", label: "Region", column: "region" }, { id: "ordered_at", kind: "attribute", label: "Month", column: "ordered_at", grain: "month" }, { id: "amount", kind: "metric", label: "Revenue", column: "amount", aggregate: "sum", format: "currency" }, { id: "orders", kind: "metric", label: "Orders", aggregate: "count" }, { id: "per_order", kind: "derived", label: "Revenue per order", expression: "amount / orders", format: "currency" }]}
  tiles={[{ id: "headline", rows: [], values: ["amount", "orders", "per_order"], span: 3 }, { id: "by-region", rows: ["region"], values: ["amount"] }, { id: "over-time", rows: ["ordered_at"], values: ["per_order"], span: 2 }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "report",
  "component": "ReportBuilder",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "title": "Orders",
  "fields": [
    {
      "id": "region",
      "kind": "attribute",
      "label": "Region",
      "column": "region"
    },
    {
      "id": "ordered_at",
      "kind": "attribute",
      "label": "Month",
      "column": "ordered_at",
      "grain": "month"
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
  "tiles": [
    {
      "id": "headline",
      "rows": [],
      "values": [
        "amount",
        "orders",
        "per_order"
      ],
      "span": 3
    },
    {
      "id": "by-region",
      "rows": [
        "region"
      ],
      "values": [
        "amount"
      ]
    },
    {
      "id": "over-time",
      "rows": [
        "ordered_at"
      ],
      "values": [
        "per_order"
      ],
      "span": 2
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "report",
  "elements": {
    "report": {
      "type": "ReportBuilder",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "title": "Orders",
        "fields": [
          {
            "id": "region",
            "kind": "attribute",
            "label": "Region",
            "column": "region"
          },
          {
            "id": "ordered_at",
            "kind": "attribute",
            "label": "Month",
            "column": "ordered_at",
            "grain": "month"
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
        "tiles": [
          {
            "id": "headline",
            "rows": [],
            "values": [
              "amount",
              "orders",
              "per_order"
            ],
            "span": 3
          },
          {
            "id": "by-region",
            "rows": [
              "region"
            ],
            "values": [
              "amount"
            ]
          },
          {
            "id": "over-time",
            "rows": [
              "ordered_at"
            ],
            "values": [
              "per_order"
            ],
            "span": 2
          }
        ]
      }
    }
  }
}
```
