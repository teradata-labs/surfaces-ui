# Callout

A note set apart from the text around it: a note, a tip or a warning. Its kind is its heading, so it is never told by colour alone. The text is Markdown.

## Props

- `tone` (optional): "note" | "tip" | "warning"
- `title` (optional): string | binding | call
- `text`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Callout
  tone="warning"
  text="A full refresh **rebuilds every table**. Run it outside working hours."
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "careful",
  "component": "Callout",
  "tone": "warning",
  "text": "A full refresh **rebuilds every table**. Run it outside working hours."
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "careful",
  "elements": {
    "careful": {
      "type": "Callout",
      "props": {
        "tone": "warning",
        "text": "A full refresh **rebuilds every table**. Run it outside working hours."
      }
    }
  }
}
```
