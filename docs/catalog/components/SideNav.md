# SideNav

Navigation down the side of a surface: groups of items, with the current one marked. A person can fold it away: it then keeps only a slim strip for its menu button, which slides it back in over the surface (never over anything outside it). In a narrow surface or on a narrow screen it is always folded. An item with `href` is a link (http and https only); one without sends the event with its `id`. Bind `current` to a data path to mark the item for what is showing.

## Props

- `label` (optional): string — What the navigation is for, for assistive technology.
- `groups`: array of { label?: string, items: array of object }
- `current` (optional): string | binding | call — The id of the item for what is showing.
- `pinned` (optional): boolean — Whether it starts open beside the content. Defaults to true.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When an item without a link is chosen. Adds `id` (the item's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SideNav
  label="Sections"
  groups={[{ label: "Sales", items: [{ id: "overview", label: "Overview" }, { id: "orders", label: "Orders" }] }]}
  current="overview"
  action={{ event: { name: "navigate" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "nav",
  "component": "SideNav",
  "label": "Sections",
  "groups": [
    {
      "label": "Sales",
      "items": [
        {
          "id": "overview",
          "label": "Overview"
        },
        {
          "id": "orders",
          "label": "Orders"
        }
      ]
    }
  ],
  "current": "overview",
  "action": {
    "event": {
      "name": "navigate"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "nav",
  "elements": {
    "nav": {
      "type": "SideNav",
      "props": {
        "label": "Sections",
        "groups": [
          {
            "label": "Sales",
            "items": [
              {
                "id": "overview",
                "label": "Overview"
              },
              {
                "id": "orders",
                "label": "Orders"
              }
            ]
          }
        ],
        "current": "overview",
        "action": {
          "event": {
            "name": "navigate"
          }
        }
      }
    }
  }
}
```
