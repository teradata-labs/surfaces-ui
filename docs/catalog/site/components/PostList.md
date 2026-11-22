# PostList

Posts as cards, in the order given (newest first is usual). Says so when there are none. An item without `href` sends `open` with its `id`.

## Props

- `label` (optional): string
- `posts`: array of { id: string, title: string, date?: string, excerpt?: string, tags?: array of string, href?: string }
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **open**: When a post without a link is opened. Adds `id` (the post's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PostList
  label="Essays"
  posts={[{ id: "charts", title: "Charts that tell the truth", date: "2026-11-01", tags: ["design"] }, { id: "models", title: "One meaning for a metric", date: "2026-10-12", tags: ["modelling"] }]}
  action={{ event: { name: "open" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "posts",
  "component": "PostList",
  "label": "Essays",
  "posts": [
    {
      "id": "charts",
      "title": "Charts that tell the truth",
      "date": "2026-11-01",
      "tags": [
        "design"
      ]
    },
    {
      "id": "models",
      "title": "One meaning for a metric",
      "date": "2026-10-12",
      "tags": [
        "modelling"
      ]
    }
  ],
  "action": {
    "event": {
      "name": "open"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "posts",
  "elements": {
    "posts": {
      "type": "PostList",
      "props": {
        "label": "Essays",
        "posts": [
          {
            "id": "charts",
            "title": "Charts that tell the truth",
            "date": "2026-11-01",
            "tags": [
              "design"
            ]
          },
          {
            "id": "models",
            "title": "One meaning for a metric",
            "date": "2026-10-12",
            "tags": [
              "modelling"
            ]
          }
        ],
        "action": {
          "event": {
            "name": "open"
          }
        }
      }
    }
  }
}
```
