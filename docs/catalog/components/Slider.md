# Slider

A number chosen along a range, with its value shown in words. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.

## Props

- `label`: value or binding
- `value`: object — A value read from the data model at this path.
- `min`: number
- `max`: number
- `step` (optional): number
- `help` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Slider
  label="Confidence"
  value={{ "@path": "/confidence" }}
  min={0}
  max={100}
  step={5}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "confidence",
  "component": "Slider",
  "label": "Confidence",
  "value": {
    "@path": "/confidence"
  },
  "min": 0,
  "max": 100,
  "step": 5
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "confidence",
  "elements": {
    "confidence": {
      "type": "Slider",
      "props": {
        "label": "Confidence",
        "value": {
          "$state": "/confidence"
        },
        "min": 0,
        "max": 100,
        "step": 5
      }
    }
  }
}
```
