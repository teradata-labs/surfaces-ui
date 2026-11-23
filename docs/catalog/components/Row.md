# Row

Places children side by side. Wraps on narrow screens unless `wrap` is false. Children share the width equally unless `widths` gives each its share, or `sizes` says how each is sized (content width, fill, or fixed pixels); `sizes` wins over `widths` when both have one entry per child. `gap` and `padding` are steps of the theme's spacing scale.

## Props

- `children`: array of string | { componentId: string, path: string }
- `widths` (optional): array of number — The share of the width each child takes, one per child: [2, 1] makes the first twice as wide as the second. Used when it has one entry per child and `sizes` is not used.
- `sizes` (optional): array of ("hug" | "fill" | { fixed: number }) — How each child is sized, one per child: "hug" keeps its content's width and does not grow, "fill" grows to share the space left, { fixed: 240 } is that many pixels wide. Used when it has one entry per child, in place of `widths`. Narrow screens stack the children unless `wrap` is false.
- `wrap` (optional): boolean — Whether children move onto a new line when they do not fit, and stack on narrow screens. Defaults to true; false keeps them on one line, each shrinking to fit.
- `gap` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space between children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `padding` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space inside the edge, around the children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to "none".
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
