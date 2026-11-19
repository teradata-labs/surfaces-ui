# ThemeSwitch

Changes how the whole page looks, at once: a built-in theme, light or dark, the accent colour, corner radius, font, density or chart colours. Leave out what should stay as it is. The person sees what changed and can undo it. To style only your own surface, put the same fields in `createSurface.theme` instead.

## Props

- `preset` (optional): "Ink" | "Aurora" | "Sand" | "Berry" | "Harbor" | "Moss" | "Mono" | "High contrast"
- `mode` (optional): "system" | "light" | "dark"
- `accent` (optional): string — A hex colour for buttons, links and selection.
- `radius` (optional): number
- `font` (optional): "system" | "rounded" | "serif" | "mono"
- `density` (optional): "comfortable" | "compact"
- `seriesOrder` (optional): "Classic" | "Aurora" | "Sand" | "Ink" | "Berry" | "Moss" — A tested order of chart colours.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ThemeSwitch preset="Aurora" mode="dark" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "look",
  "component": "ThemeSwitch",
  "preset": "Aurora",
  "mode": "dark"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "look",
  "elements": {
    "look": {
      "type": "ThemeSwitch",
      "props": {
        "preset": "Aurora",
        "mode": "dark"
      }
    }
  }
}
```
