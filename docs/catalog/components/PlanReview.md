# PlanReview

A plan a person must approve before you act: cleaning steps, transformations, a connection to set up. List every step with what it changes; mark anything that removes or overwrites data or widens access as `risk: "high"` (it starts unticked). The event context carries `approved`, the ticked `stepIds` and any `note`. Do only the approved steps.

## Props

- `title`: string | binding | call
- `summary` (optional): string | binding | call
- `proposedBy` (optional): string — Your name, so the person knows who wrote the plan.
- `steps`: array of { id: string, title: string, detail?: string, sql?: string, kind?: string, affects?: string, risk?: "low" | "medium" | "high", required?: boolean }
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **decide**: When the plan is approved or rejected. Adds `approved` (whether the plan was approved), `stepIds` (the steps left ticked), `note` (the person's note, if any).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PlanReview
  title="Clean the orders table"
  summary="Three fixes before it feeds the revenue dashboard."
  proposedBy="Analyst agent"
  steps={[{ id: "trim", title: "Trim spaces from region", kind: "Clean", affects: "412 of 58,000 rows", sql: "SELECT TRIM(region) AS region FROM orders" }, { id: "dedupe", title: "Remove repeated order IDs", kind: "Clean", affects: "37 rows removed", risk: "high" }]}
  action={{ event: { name: "plan_decided" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "clean",
  "component": "PlanReview",
  "title": "Clean the orders table",
  "summary": "Three fixes before it feeds the revenue dashboard.",
  "proposedBy": "Analyst agent",
  "steps": [
    {
      "id": "trim",
      "title": "Trim spaces from region",
      "kind": "Clean",
      "affects": "412 of 58,000 rows",
      "sql": "SELECT TRIM(region) AS region FROM orders"
    },
    {
      "id": "dedupe",
      "title": "Remove repeated order IDs",
      "kind": "Clean",
      "affects": "37 rows removed",
      "risk": "high"
    }
  ],
  "action": {
    "event": {
      "name": "plan_decided"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "clean",
  "elements": {
    "clean": {
      "type": "PlanReview",
      "props": {
        "title": "Clean the orders table",
        "summary": "Three fixes before it feeds the revenue dashboard.",
        "proposedBy": "Analyst agent",
        "steps": [
          {
            "id": "trim",
            "title": "Trim spaces from region",
            "kind": "Clean",
            "affects": "412 of 58,000 rows",
            "sql": "SELECT TRIM(region) AS region FROM orders"
          },
          {
            "id": "dedupe",
            "title": "Remove repeated order IDs",
            "kind": "Clean",
            "affects": "37 rows removed",
            "risk": "high"
          }
        ],
        "action": {
          "event": {
            "name": "plan_decided"
          }
        }
      }
    }
  }
}
```
