---
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
"@surfaces-ui/chat": minor
---

One resize handle, for Arrange and for apps.

- `ResizeHandle` (`@surfaces-ui/components`): a handle on the right or bottom edge of a positioned parent that sizes a width or a height. A focusable `separator` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`; dragged with pointer events, so a mouse, a pen and a finger all work; arrows (Shift for five steps), Home and End move it, Enter or a double click resets it, Escape gives up a drag, and so does the handle going away mid-drag. Props: `edge`, `value`, `min`, `max`, `snap`, `step`, `unitPixels`, `startFrom`, `onChange`, `onChangeEnd`, `onReset`, `label`, `valueText`, `always`. Its maths are plain functions: `clampResize`, `dragResize`, `keyResize`, `defaultResizeStep`. Described as an app component, with a demo in the playground.
- Arrange draws its height and width handles with `ResizeHandle`. Each press target is now at least `--sf-target-min` across, and Enter or a double click puts a size back (the widths and height the page shipped with when `useArrange` is given `shipped`; equal widths and the height the component chooses otherwise).
- `useArrange({ resizeWhileViewing: true })` keeps the width handles between a `Grid`'s or `Row`'s columns, and the height handle under a component with a height of its own (a chart or a table, say) or one whose height is set, while nobody is arranging. A drag sends the same messages Arrange sends, as one step. Pass the new `arrange.surfaceFrame` to `SurfaceView` as `frame`; `arrange.shown(surface)` is the surface itself when nothing is being sized, so it can be drawn always.
- `PageStudio` takes `resizeWhileViewing` beside `arrange`.
