# Workspace

Several children side by side as panels a person can arrange: drag a panel by its heading to another column or to an edge for a column of its own, resize with the dividers, and hide or show panels from a rail. `layout.columns` says where the panels are: a list of columns from left to right, each a list of panel ids from top to bottom, so search on the left and a map on the right is `[["search"], ["map"]]`. To rearrange, send the component again with a new `layout`; how a person left it comes back to you in the surface's controls as `layout`. Panels not placed are added to the last column. Each panel shows on a rail as an icon, with its name in a tooltip and, when a person turns names on, a short name under it: keep titles to a few words, and give `short` and `icon` so the rail reads well. Use it when a person will work across several views at once; use Grid or Row for a fixed arrangement.

## Props

- `label` (optional): string — What the workspace is, for assistive technology.
- `panels`: array of { id: string, title: string, short?: string, icon?: "surface" | "agent" | "components" | "table" | "code" | "data" | "history" | "save" | "search" | "map" | "chart" | "grid" | "settings" | "note" | "folder", child: string }
- `layout` (optional): { columns: array of array of string, columnWidths?: array of number, rowHeights?: array of array of number, hidden?: array of string, collapsed?: array of string, places?: { [name]: { column: integer, row: integer, sole?: boolean } } }
- `rail` (optional): "left" | "right" | "none" — Where the rail of panel toggles sits. Defaults to right.
- `railLabels` (optional): boolean — Whether the rail shows a short name under each icon. Left out, the rail is icons only and each name shows in a tooltip; a person can turn names on.
- `height` (optional): integer — How tall the workspace is, in pixels. Panels scroll inside it. Defaults to 520.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Workspace
  label="Explore the catalog"
  panels={[{ id: "search", title: "Table search", short: "Search", icon: "search", child: "search" }, { id: "map", title: "Relationship map", short: "Map", icon: "map", child: "map" }]}
  layout={{ columns: [["search"], ["map"]], columnWidths: [0.4, 0.6] }}
  height={520}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "explore",
  "component": "Workspace",
  "label": "Explore the catalog",
  "panels": [
    {
      "id": "search",
      "title": "Table search",
      "short": "Search",
      "icon": "search",
      "child": "search"
    },
    {
      "id": "map",
      "title": "Relationship map",
      "short": "Map",
      "icon": "map",
      "child": "map"
    }
  ],
  "layout": {
    "columns": [
      [
        "search"
      ],
      [
        "map"
      ]
    ],
    "columnWidths": [
      0.4,
      0.6
    ]
  },
  "height": 520
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "explore",
  "elements": {
    "explore": {
      "type": "Workspace",
      "props": {
        "label": "Explore the catalog",
        "panels": [
          {
            "id": "search",
            "title": "Table search",
            "short": "Search",
            "icon": "search",
            "child": "search"
          },
          {
            "id": "map",
            "title": "Relationship map",
            "short": "Map",
            "icon": "map",
            "child": "map"
          }
        ],
        "layout": {
          "columns": [
            [
              "search"
            ],
            [
              "map"
            ]
          ],
          "columnWidths": [
            0.4,
            0.6
          ]
        },
        "height": 520
      }
    }
  }
}
```
