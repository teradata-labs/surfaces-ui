# FileBrowser

A tree of folders and files: a source's storage (only the places it may read) and, with `local`, folders the person opens from their own computer, which their browser reads and nothing uploads. It shows names, sizes, dates and which table reads a file, never what a file holds. Use it when the data a person means is still files: to find what to bring in, or to see what a table reads. The event is sent with `path`, `name`, `place` and `format` when they open a file. You cannot read a local file; ask the person to load it.

## Props

- `sourceId` (optional): string | binding | call — List this source's storage. Leave out to offer only folders on the person's computer.
- `local` (optional): boolean — Offer "Open a folder on this computer".
- `height` (optional): integer
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }

## Events

Sent through the component's `action`; the event name is the one in the action.

- **open**: When a person opens a file (Enter or a double click). Adds `path` (the file's path in its place), `name` (the file's name), `place` (the source id, or local:<folder> for a folder on their computer), `format` (parquet, csv, json, delta or iceberg, or empty).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.FileBrowser
  sourceId="lake"
  local
  height={360}
  action={{ event: { name: "open_file" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "files",
  "component": "FileBrowser",
  "sourceId": "lake",
  "local": true,
  "height": 360,
  "action": {
    "event": {
      "name": "open_file"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "files",
  "elements": {
    "files": {
      "type": "FileBrowser",
      "props": {
        "sourceId": "lake",
        "local": true,
        "height": 360,
        "action": {
          "event": {
            "name": "open_file"
          }
        }
      }
    }
  }
}
```
