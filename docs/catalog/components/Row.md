# Row

Places children side by side. Wraps on narrow screens. Children share the width equally unless `widths` gives each its share.

## Props

- `children`: value or binding
- `widths` (optional): array — The share of the width each child takes, one per child: [2, 1] makes the first twice as wide as the second. Used when it has one entry per child.
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Row>
  {/* revenue is not in the surface */}
  {/* orders is not in the surface */}
</Ui.Row>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "stats",
  "component": "Row",
  "children": [
    "revenue",
    "orders"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "stats",
  "elements": {
    "stats": {
      "type": "Row",
      "children": [
        "revenue",
        "orders"
      ]
    }
  }
}
```
