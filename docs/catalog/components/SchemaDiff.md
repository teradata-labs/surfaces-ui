# SchemaDiff

How incoming data differs from the table it loads into: new, missing and retyped columns.

## Props

- `changes`: array
- `rescuedCount` (optional): number
- `mode` (optional): string — How new columns are treated, e.g. addNewColumns, rescue, failOnNewColumns.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SchemaDiff
  mode="rescue"
  rescuedCount={12}
  changes={[{ column: "coupon_code", change: "added", after: "string" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "drift",
  "component": "SchemaDiff",
  "mode": "rescue",
  "rescuedCount": 12,
  "changes": [
    {
      "column": "coupon_code",
      "change": "added",
      "after": "string"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "drift",
  "elements": {
    "drift": {
      "type": "SchemaDiff",
      "props": {
        "mode": "rescue",
        "rescuedCount": 12,
        "changes": [
          {
            "column": "coupon_code",
            "change": "added",
            "after": "string"
          }
        ]
      }
    }
  }
}
```
