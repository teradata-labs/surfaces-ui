# Quote

A pull quote and who said it.

## Props

- `text`: string | binding | call
- `cite` (optional): string | binding | call — Who said it.
- `url` (optional): string — Where it was said.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Quote text="The dashboard was there before I finished my coffee." cite="An analyst" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "quote",
  "component": "Quote",
  "text": "The dashboard was there before I finished my coffee.",
  "cite": "An analyst"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "quote",
  "elements": {
    "quote": {
      "type": "Quote",
      "props": {
        "text": "The dashboard was there before I finished my coffee.",
        "cite": "An analyst"
      }
    }
  }
}
```
