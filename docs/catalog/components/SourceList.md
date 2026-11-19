# SourceList

The data sources available, how each connects (by secret name only) and a button to test that its tables can be reached.

## Props

- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SourceList />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "sources",
  "component": "SourceList"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "sources",
  "elements": {
    "sources": {
      "type": "SourceList"
    }
  }
}
```
