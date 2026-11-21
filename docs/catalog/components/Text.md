# Text

A heading, paragraph or caption.

## Props

- `text`: string | binding | call
- `variant` (optional): "h1" | "h2" | "h3" | "h4" | "h5" | "body" | "caption"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Text text="Revenue this quarter" variant="h2" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "title",
  "component": "Text",
  "text": "Revenue this quarter",
  "variant": "h2"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "title",
  "elements": {
    "title": {
      "type": "Text",
      "props": {
        "text": "Revenue this quarter",
        "variant": "h2"
      }
    }
  }
}
```
