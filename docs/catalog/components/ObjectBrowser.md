# ObjectBrowser

A tree of the source's catalogs, schemas, tables and columns, with the tables each one joins. Use it when a person needs to look around. The event is sent with `table` (and `column`) when they pick something. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.

## Props

- `sourceId`: string | binding | call
- `height` (optional): integer
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a table, column or join is picked. Adds `table` (table name), `column` (column name, or empty).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ObjectBrowser sourceId="lake" height={360} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "browse",
  "component": "ObjectBrowser",
  "sourceId": "lake",
  "height": 360
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "browse",
  "elements": {
    "browse": {
      "type": "ObjectBrowser",
      "props": {
        "sourceId": "lake",
        "height": 360
      }
    }
  }
}
```
