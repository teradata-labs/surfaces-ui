# Stat

One headline number with a label, and optionally how it changed.

## Props

- `label`: value or binding
- `value`: value or binding
- `delta` (optional): value or binding — Change text, e.g. "+5.4% vs last quarter".
- `tone` (optional): "neutral" | "positive" | "negative" | "warning" — Colour of the change text.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Stat
  label="Revenue"
  value={{ "@path": "/revenue" }}
  delta="+5.4% vs last quarter"
  tone="positive"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "revenue",
  "component": "Stat",
  "label": "Revenue",
  "value": {
    "@path": "/revenue"
  },
  "delta": "+5.4% vs last quarter",
  "tone": "positive"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "revenue",
  "elements": {
    "revenue": {
      "type": "Stat",
      "props": {
        "label": "Revenue",
        "value": {
          "$state": "/revenue"
        },
        "delta": "+5.4% vs last quarter",
        "tone": "positive"
      }
    }
  }
}
```
