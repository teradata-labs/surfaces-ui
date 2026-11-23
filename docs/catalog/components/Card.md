# Card

A bordered container for one child, to group related content. `padding` is a step of the theme's spacing scale.

## Props

- `child`: string — ID of a child component.
- `padding` (optional): "none" | 1 | 2 | 3 | 4 | 6 | 8 — The space inside the edge, around the children, as a step of the theme's spacing scale (`--sf-space-<step>`), or "none". Defaults to 4.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Card>
  {/* chart is not in the surface */}
</Ui.Card>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "panel",
  "component": "Card",
  "child": "chart"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "panel",
  "elements": {
    "panel": {
      "type": "Card",
      "children": [
        "chart"
      ]
    }
  }
}
```
