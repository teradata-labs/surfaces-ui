# NumberField

A labelled number box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.

## Props

- `label`: value or binding
- `value`: object — A value read from the data model at this path.
- `min` (optional): number
- `max` (optional): number
- `step` (optional): number
- `help` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.NumberField label="Alert above" value={{ "@path": "/threshold" }} min={0} step={50} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "threshold",
  "component": "NumberField",
  "label": "Alert above",
  "value": {
    "@path": "/threshold"
  },
  "min": 0,
  "step": 50
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "threshold",
  "elements": {
    "threshold": {
      "type": "NumberField",
      "props": {
        "label": "Alert above",
        "value": {
          "$state": "/threshold"
        },
        "min": 0,
        "step": 50
      }
    }
  }
}
```
