# CodeBlock

Code with a copy button. For SQL a person should be able to run, use SqlProposal instead.

## Props

- `code`: value or binding
- `language` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.CodeBlock
  language="sql"
  code="SELECT region, SUM(amount) FROM orders GROUP BY region"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "snippet",
  "component": "CodeBlock",
  "language": "sql",
  "code": "SELECT region, SUM(amount) FROM orders GROUP BY region"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "snippet",
  "elements": {
    "snippet": {
      "type": "CodeBlock",
      "props": {
        "language": "sql",
        "code": "SELECT region, SUM(amount) FROM orders GROUP BY region"
      }
    }
  }
}
```
