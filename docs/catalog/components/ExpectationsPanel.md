# ExpectationsPanel

Data quality rules for a pipeline with how many records passed and failed each, worst first. Counts come from the engine.

## Props

- `expectations`: array
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ExpectationsPanel
  expectations={[{ name: "valid_amount", dataset: "orders_clean", constraint: "amount >= 0", action: "drop", passedRecords: 960, failedRecords: 40 }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "quality",
  "component": "ExpectationsPanel",
  "expectations": [
    {
      "name": "valid_amount",
      "dataset": "orders_clean",
      "constraint": "amount >= 0",
      "action": "drop",
      "passedRecords": 960,
      "failedRecords": 40
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "quality",
  "elements": {
    "quality": {
      "type": "ExpectationsPanel",
      "props": {
        "expectations": [
          {
            "name": "valid_amount",
            "dataset": "orders_clean",
            "constraint": "amount >= 0",
            "action": "drop",
            "passedRecords": 960,
            "failedRecords": 40
          }
        ]
      }
    }
  }
}
```
