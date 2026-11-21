# ResizeHandle

`import { ResizeHandle } from "@surfaces-ui/components";`

A handle on the right or bottom edge of something, dragged to change its width or height: the same handle Arrange draws between a Grid's columns and under a component, for an app to place between two panes of its own. A focusable separator that says its value and bounds; dragged with pointer events, so a mouse, a pen and a finger all work; moved by the arrow keys (Shift for bigger steps), Home and End; put back by Enter or a double click. It holds no size of its own: the host keeps `value`, draws each change from `onChange` and keeps the size on `onChangeEnd`. Its parent must be positioned, since it sits on that parent's edge.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `edge` | "right" \| "bottom" | yes | "right" sizes a width, dragged left and right; "bottom" a height, dragged up and down. |
| `value` | number |  | The size it stands for, in any unit: pixels, a share, a percentage. Left out when no size is set yet. |
| `min` | number |  | The least it can be. |
| `max` | number |  | The most it can be. |
| `snap` | number |  | Values land on multiples of this (10 rounds to ten pixels). |
| `step` | number |  | How far an arrow key moves it; Shift moves five steps. A twentieth of the range by default. |
| `unitPixels` | number |  | How many pixels on screen one unit is: 1 for pixels, a pane's width for a share of it. A function of the handle is read when a drag starts. |
| `label` | string | yes | What it resizes, for assistive technology: "Resize the map and the list". |
| `valueText` | string |  | The value in words, when a number alone does not say it: "40% and 60%". |
| `always` | boolean |  | Shown all the time, rather than when its parent is pointed at or it has focus (it always shows on touch). |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `onReset`: **Reset.** Enter or a double click puts the size back. On the page: back to half and half.
- `startFrom`: **Start from what is drawn.** Where a drag starts when no `value` is set, such as the height drawn now.

## Callbacks

- `onChange`: Each new value while it is dragged, and after each key.
- `onChangeEnd`: When a drag ends (committed, or cancelled by Escape back where it started) and after each key: where to keep the size.

## Example

```tsx
<ResizeHandle
  edge="right"
  value={0.5}
  min={0.25}
  max={0.75}
  step={0.05}
  label="Resize the map and the list"
  valueText="50% and 50%"
  onReset={onReset}
  onChange={…}
  onChangeEnd={…}
/>
```
