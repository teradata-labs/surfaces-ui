# Chips

Short choices a person can pick with one press, such as follow-up questions or tables to look at. The chosen chip is sent back in the event context as `value`. An item is its text, or `{ label, value }` when what is sent differs from what is shown. Give `selected` a data path and a press also writes the chip's value there, inside the surface; bind another component's prop to the same path and it follows at once, with no agent: chips of table names whose values are SELECT statements switch a QueryResult whose `sql` is bound to that path. Set the path in the data model to the value that starts selected.

## Props

- `items`: array
- `selected` (optional): object — Where the pressed chip's value is written in this surface's data model. The chip holding the value there is shown as pressed.
- `action`: value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **choose**: When a chip is pressed. Adds `value` (the chip's value: its text, unless the item sets a value).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Chips
  items={["Break down by region", "Show last year"]}
  action={{ event: { name: "choose" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "next",
  "component": "Chips",
  "items": [
    "Break down by region",
    "Show last year"
  ],
  "action": {
    "event": {
      "name": "choose"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "next",
  "elements": {
    "next": {
      "type": "Chips",
      "props": {
        "items": [
          "Break down by region",
          "Show last year"
        ],
        "action": {
          "event": {
            "name": "choose"
          }
        }
      }
    }
  }
}
```
