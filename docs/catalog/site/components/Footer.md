# Footer

The end of a page: columns of links and a note (a licence, a copyright). An item with `href` is a link; one without sends `select` with its `id`.

## Props

- `groups`: array of { label?: string, items: array of object }
- `note` (optional): string | binding | call
- `label` (optional): string — What the links are, for assistive technology. Defaults to "Site".
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a link without an address is chosen. Adds `id` (the item's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Footer
  groups={[{ label: "Docs", items: [{ id: "start", label: "Getting started" }, { id: "github", label: "GitHub", href: "https://github.com/teradata-labs/surfaces-ui" }] }]}
  note="Apache-2.0"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "footer",
  "component": "Footer",
  "groups": [
    {
      "label": "Docs",
      "items": [
        {
          "id": "start",
          "label": "Getting started"
        },
        {
          "id": "github",
          "label": "GitHub",
          "href": "https://github.com/teradata-labs/surfaces-ui"
        }
      ]
    }
  ],
  "note": "Apache-2.0"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "footer",
  "elements": {
    "footer": {
      "type": "Footer",
      "props": {
        "groups": [
          {
            "label": "Docs",
            "items": [
              {
                "id": "start",
                "label": "Getting started"
              },
              {
                "id": "github",
                "label": "GitHub",
                "href": "https://github.com/teradata-labs/surfaces-ui"
              }
            ]
          }
        ],
        "note": "Apache-2.0"
      }
    }
  }
}
```
