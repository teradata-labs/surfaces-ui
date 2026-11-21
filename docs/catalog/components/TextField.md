# TextField

A labelled text box. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.

## Props

- `label`: string | binding | call
- `value`: binding — A value read from the data model at this path.
- `multiline` (optional): boolean
- `placeholder` (optional): string
- `help` (optional): string | binding | call — A sentence under the field: what to enter, or why it is asked.
- `maxLength` (optional): integer
- `required` (optional): boolean — Marked as required, and said to be missing once the person leaves it empty.
- `pattern` (optional): string — A regular expression the whole text must match; a value that does not is said so beside the field.
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
