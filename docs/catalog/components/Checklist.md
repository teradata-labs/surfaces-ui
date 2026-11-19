# Checklist

A list of steps showing which are done.

## Props

- `items`: array
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Checklist
  items={[{ label: "Find the tables", done: true }, { label: "Check the join" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "plan",
  "component": "Checklist",
  "items": [
    {
      "label": "Find the tables",
      "done": true
    },
    {
      "label": "Check the join"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "plan",
  "elements": {
    "plan": {
      "type": "Checklist",
      "props": {
        "items": [
          {
            "label": "Find the tables",
            "done": true
          },
          {
            "label": "Check the join"
          }
        ]
      }
    }
  }
}
```
