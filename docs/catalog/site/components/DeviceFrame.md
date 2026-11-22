# DeviceFrame

The same content on a desktop window and a phone, side by side, to show a product. The child is drawn once in each, and stays live. With too little room only the last device stands.

## Props

- `child`: string — ID of a child component.
- `devices` (optional): array of ("desktop" | "phone") — Which, in order. Defaults to both.
- `title` (optional): string — The desktop window's title.
- `label` (optional): string — What the screens show, for assistive technology.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.DeviceFrame title="Playground" label="a dashboard">
  {/* screen is not in the surface */}
</Ui.DeviceFrame>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "devices",
  "component": "DeviceFrame",
  "title": "Playground",
  "label": "a dashboard",
  "child": "screen"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "devices",
  "elements": {
    "devices": {
      "type": "DeviceFrame",
      "props": {
        "title": "Playground",
        "label": "a dashboard"
      },
      "children": [
        "screen"
      ]
    }
  }
}
```
