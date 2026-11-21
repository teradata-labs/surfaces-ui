# DecisionCard

Asks a person to choose between options before you continue. Mark the option you recommend. The chosen option's id is sent back in the event context as `choice`.

## Props

- `title`: string | binding | call
- `detail` (optional): string | binding | call
- `options`: array of { id: string, label: string, description?: string, recommended?: boolean }
- `action`: { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **choose**: When an option is chosen. Adds `choice` (the option's id), `label` (the option's label).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.DecisionCard
  title="Which revenue should I use?"
  detail="The two tables disagree for March."
  options={[{ id: "ledger", label: "Finance ledger", description: "Certified, updated nightly.", recommended: true }, { id: "orders", label: "Orders table", description: "Live, but includes returns." }]}
  action={{ event: { name: "decide" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "grain",
  "component": "DecisionCard",
  "title": "Which revenue should I use?",
  "detail": "The two tables disagree for March.",
  "options": [
    {
      "id": "ledger",
      "label": "Finance ledger",
      "description": "Certified, updated nightly.",
      "recommended": true
    },
    {
      "id": "orders",
      "label": "Orders table",
      "description": "Live, but includes returns."
    }
  ],
  "action": {
    "event": {
      "name": "decide"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "grain",
  "elements": {
    "grain": {
      "type": "DecisionCard",
      "props": {
        "title": "Which revenue should I use?",
        "detail": "The two tables disagree for March.",
        "options": [
          {
            "id": "ledger",
            "label": "Finance ledger",
            "description": "Certified, updated nightly.",
            "recommended": true
          },
          {
            "id": "orders",
            "label": "Orders table",
            "description": "Live, but includes returns."
          }
        ],
        "action": {
          "event": {
            "name": "decide"
          }
        }
      }
    }
  }
}
```
