# Media

An image or a video at a fixed ratio, loaded only near the screen; a video never plays on its own. `src` is a name or an address the page knows: the page decides what may load, and with nothing it allows, the description is shown in its place. Always describe what it shows in `alt` (an empty string only for decoration).

## Props

- `src`: string — A name the page gives an address for, or an address from an origin the page allows.
- `alt`: string
- `kind` (optional): "image" | "video"
- `ratio` (optional): "16:9" | "4:3" | "3:2" | "1:1" | "21:9"
- `caption` (optional): string | binding | call
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Media
  src="dashboard"
  alt="A dashboard of revenue by region, drawn by an agent"
  ratio="16:9"
  caption="Drawn from one sentence."
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "shot",
  "component": "Media",
  "src": "dashboard",
  "alt": "A dashboard of revenue by region, drawn by an agent",
  "ratio": "16:9",
  "caption": "Drawn from one sentence."
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "shot",
  "elements": {
    "shot": {
      "type": "Media",
      "props": {
        "src": "dashboard",
        "alt": "A dashboard of revenue by region, drawn by an agent",
        "ratio": "16:9",
        "caption": "Drawn from one sentence."
      }
    }
  }
}
```
