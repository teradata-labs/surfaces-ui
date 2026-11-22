# Showcase

A picker of named examples above a stage that shows the chosen one. Use it for a few alternatives of the same kind: roles, plans, themes.

## Props

- `label`: string — What the picker chooses between, for assistive technology.
- `examples`: array of { id: string, name: string, line?: string, child: string }
- `selected` (optional): string — The id shown first. A person's choice comes back as `selected`.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Showcase
  label="Who it is for"
  examples={[{ id: "analyst", name: "Analyst", line: "Ask, chart and share.", child: "analyst-view" }, { id: "steward", name: "Data steward", line: "Keeps data right.", child: "steward-view" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "roles-showcase",
  "component": "Showcase",
  "label": "Who it is for",
  "examples": [
    {
      "id": "analyst",
      "name": "Analyst",
      "line": "Ask, chart and share.",
      "child": "analyst-view"
    },
    {
      "id": "steward",
      "name": "Data steward",
      "line": "Keeps data right.",
      "child": "steward-view"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "roles-showcase",
  "elements": {
    "roles-showcase": {
      "type": "Showcase",
      "props": {
        "label": "Who it is for",
        "examples": [
          {
            "id": "analyst",
            "name": "Analyst",
            "line": "Ask, chart and share.",
            "child": "analyst-view"
          },
          {
            "id": "steward",
            "name": "Data steward",
            "line": "Keeps data right.",
            "child": "steward-view"
          }
        ]
      }
    }
  }
}
```
