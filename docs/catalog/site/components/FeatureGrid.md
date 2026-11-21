# FeatureGrid

Cards of a title and a line each, as many to a row as fit. An item with `href` is a link; one without sends `select` with its `id`.

## Props

- `label` (optional): string — What the cards are, for assistive technology.
- `items`: array of { id: string, title: string, line?: string, href?: string }
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a card without a link is chosen. Adds `id` (the item's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.FeatureGrid
  label="Roles"
  items={[{ id: "analyst", title: "Analyst", line: "Ask, chart and share." }, { id: "engineer", title: "Analytics engineer", line: "Model the data once." }]}
  action={{ event: { name: "select" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "role-cards",
  "component": "FeatureGrid",
  "label": "Roles",
  "items": [
    {
      "id": "analyst",
      "title": "Analyst",
      "line": "Ask, chart and share."
    },
    {
      "id": "engineer",
      "title": "Analytics engineer",
      "line": "Model the data once."
    }
  ],
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
  "root": "role-cards",
  "elements": {
    "role-cards": {
      "type": "FeatureGrid",
      "props": {
        "label": "Roles",
        "items": [
          {
            "id": "analyst",
            "title": "Analyst",
            "line": "Ask, chart and share."
          },
          {
            "id": "engineer",
            "title": "Analytics engineer",
            "line": "Model the data once."
          }
        ],
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
