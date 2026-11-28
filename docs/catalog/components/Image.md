# Image

A picture. `src` is a name the page knows (for example one it gave you), never a web address you choose: the page decides whether and where it loads, and when it does not know the name the `alt` text is shown in its place. Always describe what it shows in `alt`, which is required (an empty string only for decoration). Give `caption` for a line beneath it. `fit` and `maxHeight` keep it from taking over a layout.

## Props

- `src`: string | binding | call — The name of the image, as the page gave it to you. Not loaded as written.
- `alt`: string | binding | call — What the image shows, for anyone who cannot see it.
- `caption` (optional): string | binding | call
- `width` (optional): integer — The most it is wide, in pixels. It never grows past its container.
- `height` (optional): integer — A fixed height in pixels; the image then fills that box by `fit`.
- `fit` (optional): "contain" | "cover" — How a fixed height is filled: the whole image ("contain", the default) or edge to edge, cropped ("cover").
- `maxHeight` (optional): integer — The most it is tall, in pixels.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Image
  src="attachment-1"
  alt="A bar chart of monthly revenue, rising through the year"
  caption="Revenue by month"
  fit="contain"
  maxHeight={320}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "photo",
  "component": "Image",
  "src": "attachment-1",
  "alt": "A bar chart of monthly revenue, rising through the year",
  "caption": "Revenue by month",
  "fit": "contain",
  "maxHeight": 320
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "photo",
  "elements": {
    "photo": {
      "type": "Image",
      "props": {
        "src": "attachment-1",
        "alt": "A bar chart of monthly revenue, rising through the year",
        "caption": "Revenue by month",
        "fit": "contain",
        "maxHeight": 320
      }
    }
  }
}
```
