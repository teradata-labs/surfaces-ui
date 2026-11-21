# SqlEditor

An editor for a person to write or change SQL. The event is sent with `sql` when they run it.

## Props

- `sql` (optional): string | binding | call
- `dialect` (optional): "standard" | "duckdb" | "teradata" | "postgres"
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **run**: When a person runs the SQL. Adds `sql` (the SQL as written).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SqlEditor sql="SELECT * FROM orders" action={{ event: { name: "run" } }} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "editor",
  "component": "SqlEditor",
  "sql": "SELECT * FROM orders",
  "action": {
    "event": {
      "name": "run"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "editor",
  "elements": {
    "editor": {
      "type": "SqlEditor",
      "props": {
        "sql": "SELECT * FROM orders",
        "action": {
          "event": {
            "name": "run"
          }
        }
      }
    }
  }
}
```
