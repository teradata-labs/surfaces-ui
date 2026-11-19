# SqlProposal

SQL you propose, shown for review. It never runs on its own: a person presses Run, and the result appears beneath it. The event, if given, is sent with `sql` when they do.

## Props

- `sourceId`: value or binding
- `sql`: value or binding
- `title` (optional): string
- `action` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **run**: When a person presses Run. Adds `sql` (the SQL as run).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SqlProposal
  sourceId="lake"
  title="Revenue by region"
  sql="SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "proposal",
  "component": "SqlProposal",
  "sourceId": "lake",
  "title": "Revenue by region",
  "sql": "SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "proposal",
  "elements": {
    "proposal": {
      "type": "SqlProposal",
      "props": {
        "sourceId": "lake",
        "title": "Revenue by region",
        "sql": "SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region"
      }
    }
  }
}
```
