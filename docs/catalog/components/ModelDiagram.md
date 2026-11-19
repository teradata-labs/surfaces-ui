# ModelDiagram

A relationship diagram: tables as cards with their columns and lines between the columns that join. A person can drag columns together to add joins. Use it to show or agree how tables relate. The event is sent with `sql`, `tables` and `joins` when they press Use as query.

## Props

- `sourceId`: value or binding
- `tables`: array — Tables to show.
- `joins` (optional): array
- `rowsFrom` (optional): boolean — The first table's rows are the result's rows: it is marked, the rest are laid out as its detail, and each join says whether it adds one row or can repeat rows. Use it to show which tables can be joined without double counting.
- `suggest` (optional): boolean — False to leave out joins the backend would guess from column names; the joins you send and those the source declares are still shown. Default true.
- `height` (optional): integer
- `action` (optional): value or binding

## Events

Sent through the component's `action`; the event name is the one in the action.

- **use**: When a person presses Use as query. Adds `sql` (the generated SELECT), `tables` (the tables), `joins` (the joins kept).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ModelDiagram
  sourceId="lake"
  tables={["orders", "customers"]}
  joins={[{ left: "orders", right: "customers", keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }], inferred: true }]}
  action={{ event: { name: "use_model" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "model",
  "component": "ModelDiagram",
  "sourceId": "lake",
  "tables": [
    "orders",
    "customers"
  ],
  "joins": [
    {
      "left": "orders",
      "right": "customers",
      "keys": [
        {
          "leftColumn": "customer_id",
          "rightColumn": "customer_id"
        }
      ],
      "inferred": true
    }
  ],
  "action": {
    "event": {
      "name": "use_model"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "model",
  "elements": {
    "model": {
      "type": "ModelDiagram",
      "props": {
        "sourceId": "lake",
        "tables": [
          "orders",
          "customers"
        ],
        "joins": [
          {
            "left": "orders",
            "right": "customers",
            "keys": [
              {
                "leftColumn": "customer_id",
                "rightColumn": "customer_id"
              }
            ],
            "inferred": true
          }
        ],
        "action": {
          "event": {
            "name": "use_model"
          }
        }
      }
    }
  }
}
```
