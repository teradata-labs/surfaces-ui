# DatasetReview

A new or changed pipeline dataset for a person to approve: its query, what it reads, its grain and key, columns and checks, and what changes from the saved version. Give it exactly what `propose_dataset` returned: `pipeline`, `dataset`, `expectedVersion` and `digest`. The person may change the grain, descriptions and checks, names themselves, and approves or rejects. Approving saves it on the server, which checks it again; it builds nothing, so run the pipeline afterwards if they want it built. The `decide` event says what they chose.

## Props

- `pipeline`: object — The whole pipeline as it would be, as propose_dataset returned it.
- `dataset`: string — The dataset under review.
- `expectedVersion`: integer
- `digest` (optional): string
- `proposedBy` (optional): string — Your name, so the person knows who proposed it.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **decide**: When the person approves (and the page saved it) or rejects the dataset. Adds `approved` (whether it was approved), `version` (the version saved, when approved and saved), `approvedBy` (who approved it), `digest` (the digest of the pipeline as approved), `note` (the person's note, if any).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.DatasetReview
  pipeline={{ id: "sales", name: "Sales", sourceId: "lake", datasets: [{ name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL", grain: "one row per order", primaryKey: ["order_id"] }, { name: "region_revenue", sql: "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region", inputs: ["orders_clean"], inputsDeclared: true, grain: "one row per region", primaryKey: ["region"], columns: [{ name: "region", type: "VARCHAR" }, { name: "revenue", type: "DOUBLE", description: "Sum of amount." }], checks: [{ name: "relationships_region", kind: "CHECK_KIND_RELATIONSHIPS", columns: ["region"], toTable: "orders_clean", toColumn: "region" }] }] }}
  dataset="region_revenue"
  expectedVersion={1}
  proposedBy="Analyst agent"
  action={{ event: { name: "dataset_decided" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "review",
  "component": "DatasetReview",
  "pipeline": {
    "id": "sales",
    "name": "Sales",
    "sourceId": "lake",
    "datasets": [
      {
        "name": "orders_clean",
        "sql": "SELECT * FROM orders WHERE status IS NOT NULL",
        "grain": "one row per order",
        "primaryKey": [
          "order_id"
        ]
      },
      {
        "name": "region_revenue",
        "sql": "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region",
        "inputs": [
          "orders_clean"
        ],
        "inputsDeclared": true,
        "grain": "one row per region",
        "primaryKey": [
          "region"
        ],
        "columns": [
          {
            "name": "region",
            "type": "VARCHAR"
          },
          {
            "name": "revenue",
            "type": "DOUBLE",
            "description": "Sum of amount."
          }
        ],
        "checks": [
          {
            "name": "relationships_region",
            "kind": "CHECK_KIND_RELATIONSHIPS",
            "columns": [
              "region"
            ],
            "toTable": "orders_clean",
            "toColumn": "region"
          }
        ]
      }
    ]
  },
  "dataset": "region_revenue",
  "expectedVersion": 1,
  "proposedBy": "Analyst agent",
  "action": {
    "event": {
      "name": "dataset_decided"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "review",
  "elements": {
    "review": {
      "type": "DatasetReview",
      "props": {
        "pipeline": {
          "id": "sales",
          "name": "Sales",
          "sourceId": "lake",
          "datasets": [
            {
              "name": "orders_clean",
              "sql": "SELECT * FROM orders WHERE status IS NOT NULL",
              "grain": "one row per order",
              "primaryKey": [
                "order_id"
              ]
            },
            {
              "name": "region_revenue",
              "sql": "SELECT region, SUM(amount) AS revenue FROM orders_clean GROUP BY region",
              "inputs": [
                "orders_clean"
              ],
              "inputsDeclared": true,
              "grain": "one row per region",
              "primaryKey": [
                "region"
              ],
              "columns": [
                {
                  "name": "region",
                  "type": "VARCHAR"
                },
                {
                  "name": "revenue",
                  "type": "DOUBLE",
                  "description": "Sum of amount."
                }
              ],
              "checks": [
                {
                  "name": "relationships_region",
                  "kind": "CHECK_KIND_RELATIONSHIPS",
                  "columns": [
                    "region"
                  ],
                  "toTable": "orders_clean",
                  "toColumn": "region"
                }
              ]
            }
          ]
        },
        "dataset": "region_revenue",
        "expectedVersion": 1,
        "proposedBy": "Analyst agent",
        "action": {
          "event": {
            "name": "dataset_decided"
          }
        }
      }
    }
  }
}
```
