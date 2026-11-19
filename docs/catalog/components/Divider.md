# Divider

A thin line between sections.

## Props

- `axis` (optional): "horizontal" | "vertical"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Divider />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "rule",
  "component": "Divider"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "rule",
  "elements": {
    "rule": {
      "type": "Divider"
    }
  }
}
```
