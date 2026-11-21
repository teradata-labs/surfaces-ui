# AskData

A question box that answers from the catalog and cites the tables it used.

## Props

- `sourceId` (optional): string | binding | call
- `contextPackId` (optional): string
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.AskData sourceId="lake" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "ask",
  "component": "AskData",
  "sourceId": "lake"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "ask",
  "elements": {
    "ask": {
      "type": "AskData",
      "props": {
        "sourceId": "lake"
      }
    }
  }
}
```
