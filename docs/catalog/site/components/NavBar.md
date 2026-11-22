# NavBar

Navigation across the top of a site: sections on a bar that stays in view, the current section's pages in a second bar beneath, folding into a menu on a phone. An item with `href` is a link; one without sends `select` with its `id`. Bind `current` to mark the page showing.

## Props

- `label`: string — The site's name, for assistive technology.
- `brand` (optional): string — The site's name, shown at the bar's start.
- `groups`: array of { label?: string, items: array of object }
- `current` (optional): string | binding | call
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When an item without a link is chosen. Adds `id` (the item's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.NavBar
  label="Surfaces UI"
  brand="Surfaces UI"
  groups={[{ label: "Build", items: [{ id: "playground", label: "Playground" }, { id: "chat", label: "Chat" }] }, { label: "Docs", items: [{ id: "start", label: "Getting started" }] }]}
  current="playground"
  action={{ event: { name: "select" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "site-nav",
  "component": "NavBar",
  "label": "Surfaces UI",
  "brand": "Surfaces UI",
  "groups": [
    {
      "label": "Build",
      "items": [
        {
          "id": "playground",
          "label": "Playground"
        },
        {
          "id": "chat",
          "label": "Chat"
        }
      ]
    },
    {
      "label": "Docs",
      "items": [
        {
          "id": "start",
          "label": "Getting started"
        }
      ]
    }
  ],
  "current": "playground",
  "action": {
    "event": {
      "name": "select"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "site-nav",
  "elements": {
    "site-nav": {
      "type": "NavBar",
      "props": {
        "label": "Surfaces UI",
        "brand": "Surfaces UI",
        "groups": [
          {
            "label": "Build",
            "items": [
              {
                "id": "playground",
                "label": "Playground"
              },
              {
                "id": "chat",
                "label": "Chat"
              }
            ]
          },
          {
            "label": "Docs",
            "items": [
              {
                "id": "start",
                "label": "Getting started"
              }
            ]
          }
        ],
        "current": "playground",
        "action": {
          "event": {
            "name": "select"
          }
        }
      }
    }
  }
}
```
