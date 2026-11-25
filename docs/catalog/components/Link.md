# Link

A link to a web page. Only http and https addresses are shown as links; in a site, a path on the site ("/pricing") is too, and opens in place.

## Props

- `text`: string | binding | call
- `url`: string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Link text="Metric definitions" url="https://example.com/metrics" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "docs",
  "component": "Link",
  "text": "Metric definitions",
  "url": "https://example.com/metrics"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "docs",
  "elements": {
    "docs": {
      "type": "Link",
      "props": {
        "text": "Metric definitions",
        "url": "https://example.com/metrics"
      }
    }
  }
}
```
