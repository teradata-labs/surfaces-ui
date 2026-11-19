# QueryPlan

How the database intends to run a query, without running it: the steps as a tree and the engine's own plan text. Use it to explain why a query is slow.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.QueryPlan
  sourceId="lake"
  sql="SELECT region, SUM(amount) FROM orders GROUP BY region"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "plan",
  "component": "QueryPlan",
  "sourceId": "lake",
  "sql": "SELECT region, SUM(amount) FROM orders GROUP BY region"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "plan",
  "elements": {
    "plan": {
      "type": "QueryPlan",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT region, SUM(amount) FROM orders GROUP BY region"
      }
    }
  }
}
```
