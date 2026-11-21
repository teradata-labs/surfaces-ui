# Markdown

Formatted text: headings, lists, tables, links and code. Use it for explanations longer than a line.

## Props

- `text`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Markdown text={"Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat"} />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "notes",
  "component": "Markdown",
  "text": "Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "notes",
  "elements": {
    "notes": {
      "type": "Markdown",
      "props": {
        "text": "Revenue is **up 5%**.\n\n- Europe leads\n- Returns are flat"
      }
    }
  }
}
```
