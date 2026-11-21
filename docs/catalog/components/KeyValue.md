# KeyValue

A short list of labelled facts.

## Props

- `items`: array of { label: string | binding | call, value: string | binding | call | number | binding | call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.KeyValue
  items={[{ label: "Source", value: "lake" }, { label: "Rows", value: { "@path": "/rows" } }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "facts",
  "component": "KeyValue",
  "items": [
    {
      "label": "Source",
      "value": "lake"
    },
    {
      "label": "Rows",
      "value": {
        "@path": "/rows"
      }
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "facts",
  "elements": {
    "facts": {
      "type": "KeyValue",
      "props": {
        "items": [
          {
            "label": "Source",
            "value": "lake"
          },
          {
            "label": "Rows",
            "value": {
              "$state": "/rows"
            }
          }
        ]
      }
    }
  }
}
```
