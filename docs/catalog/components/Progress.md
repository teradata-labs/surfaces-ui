# Progress

Progress toward a total.

## Props

- `value`: number | binding | call
- `max` (optional): number | binding | call
- `label` (optional): string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Progress value={42} max={100} label="Rows loaded" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "load",
  "component": "Progress",
  "value": 42,
  "max": 100,
  "label": "Rows loaded"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "load",
  "elements": {
    "load": {
      "type": "Progress",
      "props": {
        "value": 42,
        "max": 100,
        "label": "Rows loaded"
      }
    }
  }
}
```
