# Badge

A small status label.

## Props

- `text`: string | binding | call
- `tone` (optional): "neutral" | "positive" | "negative" | "warning"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Badge text="Up to date" tone="positive" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "status",
  "component": "Badge",
  "text": "Up to date",
  "tone": "positive"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "status",
  "elements": {
    "status": {
      "type": "Badge",
      "props": {
        "text": "Up to date",
        "tone": "positive"
      }
    }
  }
}
```
