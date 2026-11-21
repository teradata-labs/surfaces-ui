# DataSearch

A search box over tables and columns, by name or meaning. The event is sent with `table` when a person opens a result. Give `opened` a data path and opening a table also writes its name there, inside the surface; bind another component's `table` to the same path and it follows, with no agent. The event is still sent.

## Props

- `sourceId` (optional): string | binding | call
- `opened` (optional): binding — Where the opened table's name is written in this surface's data model.
- `height` (optional): integer — How tall the search is, in pixels. The results scroll inside it. Left out, the list is as long as its results.
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }

## Events

Sent through the component's `action`; the event name is the one in the action.

- **open**: When a result is opened. Adds `table` (table name), `column` (column name, or empty).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.DataSearch sourceId="lake" opened={{ "@path": "/table" }} height={420} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "find",
  "component": "DataSearch",
  "sourceId": "lake",
  "opened": {
    "@path": "/table"
  },
  "height": 420
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "find",
  "elements": {
    "find": {
      "type": "DataSearch",
      "props": {
        "sourceId": "lake",
        "opened": {
          "$state": "/table"
        },
        "height": 420
      }
    }
  }
}
```
