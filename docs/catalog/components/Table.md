# Table

A small table of values you already have (at most 100 rows). For query results use DataGrid, which pages in the database.

## Props

- `columns`: array
- `rows`: array
- `caption` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Table
  columns={["Region", "Revenue"]}
  rows={[["Europe", 1200], ["Asia Pacific", 950]]}
  caption="Top regions"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "top",
  "component": "Table",
  "columns": [
    "Region",
    "Revenue"
  ],
  "rows": [
    [
      "Europe",
      1200
    ],
    [
      "Asia Pacific",
      950
    ]
  ],
  "caption": "Top regions"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "top",
  "elements": {
    "top": {
      "type": "Table",
      "props": {
        "columns": [
          "Region",
          "Revenue"
        ],
        "rows": [
          [
            "Europe",
            1200
          ],
          [
            "Asia Pacific",
            950
          ]
        ],
        "caption": "Top regions"
      }
    }
  }
}
```
