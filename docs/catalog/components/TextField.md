# TextField

A labelled text box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.

## Props

- `label`: value or binding
- `value`: object — A value read from the data model at this path.
- `multiline` (optional): boolean
- `placeholder` (optional): string
- `help` (optional): value or binding
- `maxLength` (optional): integer
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.TextField label="Note" value={{ "@path": "/review/note" }} multiline />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "note",
  "component": "TextField",
  "label": "Note",
  "value": {
    "@path": "/review/note"
  },
  "multiline": true
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "note",
  "elements": {
    "note": {
      "type": "TextField",
      "props": {
        "label": "Note",
        "value": {
          "$state": "/review/note"
        },
        "multiline": true
      }
    }
  }
}
```
