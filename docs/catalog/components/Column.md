# Column

Stacks children top to bottom. Use it as the root of most surfaces.

## Props

- `children`: value or binding
- `justify` (optional): "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch"
- `align` (optional): "start" | "center" | "end" | "stretch"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Column>
  {/* title is not in the surface */}
  {/* stats is not in the surface */}
  {/* chart is not in the surface */}
</Ui.Column>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "root",
  "component": "Column",
  "children": [
    "title",
    "stats",
    "chart"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "root",
  "elements": {
    "root": {
      "type": "Column",
      "children": [
        "title",
        "stats",
        "chart"
      ]
    }
  }
}
```
