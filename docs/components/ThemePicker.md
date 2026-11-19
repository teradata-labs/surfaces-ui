# ThemePicker

`import { ThemePicker } from "@surfaces-ui/components";`

Lets a person choose how everything looks: a preset, light or dark, the accent, chart colours, corner radius, font and density. It changes the theme held by the `ThemeProvider` above it, which keeps the choice. Hide the controls a product does not want to offer.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `hide` | "mode" \| "presets" \| "accent" \| "charts" \| "radius" \| "font" \| "density"[] |  | Controls to leave out. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `presets`: **Your own presets.** Themes offered as one-click choices in place of the built-in presets.

## Example

```tsx
<ThemePicker  />
```
