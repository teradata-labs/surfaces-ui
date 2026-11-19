# Tabs

Switches between several children, one visible at a time.

## Props

- `tabs`: array
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Tabs tabs={[{ title: "Chart", child: "chart" }, { title: "Table", child: "table" }]} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "views",
  "component": "Tabs",
  "tabs": [
    {
      "title": "Chart",
      "child": "chart"
    },
    {
      "title": "Table",
      "child": "table"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "views",
  "elements": {
    "views": {
      "type": "Tabs",
      "props": {
        "tabs": [
          {
            "title": "Chart",
            "child": "chart"
          },
          {
            "title": "Table",
            "child": "table"
          }
        ]
      }
    }
  }
}
```
