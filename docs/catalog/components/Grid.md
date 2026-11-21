# Grid

Lays children out in columns that wrap onto new rows. Use it for dashboards: a row of numbers, then charts side by side. Columns are equal unless `widths` gives each its share, as when a person resizes them by hand.

## Props

- `children`: array of string | { componentId: string, path: string }
- `columns` (optional): integer — Columns per row. Defaults to 2. Narrow screens use one.
- `widths` (optional): array of number — The share of the width each column takes, one per column: [2, 1] makes the first twice as wide as the second. Used when it has one entry per column; otherwise columns are equal.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Grid columns={3}>
  {/* revenue is not in the surface */}
  {/* orders is not in the surface */}
  {/* average is not in the surface */}
</Ui.Grid>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "tiles",
  "component": "Grid",
  "columns": 3,
  "children": [
    "revenue",
    "orders",
    "average"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "tiles",
  "elements": {
    "tiles": {
      "type": "Grid",
      "props": {
        "columns": 3
      },
      "children": [
        "revenue",
        "orders",
        "average"
      ]
    }
  }
}
```
