# PiiReview

A review of a table's columns for personal data before it is shared, charted or sent to a model. Flag a column with the kind of data you suspect and how you know (`basis`); the person chooses the treatment and confirms. The event context carries `table`, `columns` (name, category, action) and `confirmed`. Never treat your own flags as the decision.

## Props

- `table`: string
- `purpose` (optional): value or binding
- `columns`: array
- `action`: value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **decide**: When the review is confirmed. Adds `table` (table name), `columns` (each column's category and treatment), `confirmed` (true when the person confirmed they may decide this).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PiiReview
  table="customers"
  purpose="Before sharing with the marketing workspace."
  columns={[{ name: "customer_id", type: "BIGINT" }, { name: "email", type: "VARCHAR", category: "email", basis: "name" }, { name: "birth_date", type: "DATE", category: "date_of_birth", basis: "name" }]}
  action={{ event: { name: "pii_decided" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "pii",
  "component": "PiiReview",
  "table": "customers",
  "purpose": "Before sharing with the marketing workspace.",
  "columns": [
    {
      "name": "customer_id",
      "type": "BIGINT"
    },
    {
      "name": "email",
      "type": "VARCHAR",
      "category": "email",
      "basis": "name"
    },
    {
      "name": "birth_date",
      "type": "DATE",
      "category": "date_of_birth",
      "basis": "name"
    }
  ],
  "action": {
    "event": {
      "name": "pii_decided"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "pii",
  "elements": {
    "pii": {
      "type": "PiiReview",
      "props": {
        "table": "customers",
        "purpose": "Before sharing with the marketing workspace.",
        "columns": [
          {
            "name": "customer_id",
            "type": "BIGINT"
          },
          {
            "name": "email",
            "type": "VARCHAR",
            "category": "email",
            "basis": "name"
          },
          {
            "name": "birth_date",
            "type": "DATE",
            "category": "date_of_birth",
            "basis": "name"
          }
        ],
        "action": {
          "event": {
            "name": "pii_decided"
          }
        }
      }
    }
  }
}
```
