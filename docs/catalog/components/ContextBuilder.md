# ContextBuilder

Lets a person assemble the tables, columns and notes an agent should work from, and preview exactly what the agent will receive.

## Props

- `name` (optional): string
- `tables` (optional): array
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ContextBuilder
  name="Sales analysis"
  tables={[{ sourceId: "lake", table: "orders" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "context",
  "component": "ContextBuilder",
  "name": "Sales analysis",
  "tables": [
    {
      "sourceId": "lake",
      "table": "orders"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "context",
  "elements": {
    "context": {
      "type": "ContextBuilder",
      "props": {
        "name": "Sales analysis",
        "tables": [
          {
            "sourceId": "lake",
            "table": "orders"
          }
        ]
      }
    }
  }
}
```
