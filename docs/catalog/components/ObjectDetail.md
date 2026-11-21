# ObjectDetail

Everything known about one table: description, certification, columns with statistics and related tables. Bind `table` to a path (`{ "@path": "/table" }`) to show whichever table a search or graph in the same surface opened. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.

## Props

- `sourceId`: string | binding | call
- `table`: string | binding | call
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **open**: When a related table is opened. Adds `table` (table name).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ObjectDetail sourceId="lake" table="orders" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "about",
  "component": "ObjectDetail",
  "sourceId": "lake",
  "table": "orders"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "about",
  "elements": {
    "about": {
      "type": "ObjectDetail",
      "props": {
        "sourceId": "lake",
        "table": "orders"
      }
    }
  }
}
```
