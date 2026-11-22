# Popover

`import { Popover } from "@surfaces-ui/components";`

A button that opens a small panel of controls beneath it: a view's width, zoom and data state behind one View button on a crowded toolbar. The button carries its label and, optionally, a short summary of what is set now. The panel is a non-modal dialog opened by a disclosure button (`aria-expanded`, `aria-controls`): opening moves focus to its first control, Tab moves through it and on past it (which closes it), Escape closes it and puts focus back on the button, and a press or focus anywhere else closes it. It sits below the button, lined up with its start or end edge, moves along to stay inside the window and goes above the button only when there is no room below. It holds its own open state unless the host passes `open`. For a list of actions use `useContextMenu`; for a question that must be answered first, `ConfirmDialog`.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | What the button says, and the panel's name for assistive technology: "View". |
| `summary` | string |  | A few words after the label saying what is set now: "Fit · 100% · Real data". Part of the button's name. |
| `align` | "start" \| "end" |  | Line the panel up with the button's start edge (the default) or its end edge. |
| `open` | boolean |  | Open, when the host holds it. Leave out to let the popover hold it. |
| `defaultOpen` | boolean |  | Open at first, when the popover holds it. Being open when first drawn takes no focus from the page. |
| `disabled` | boolean |  |  |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `children` (required): **The panel's controls.** What the panel holds: selects, a `SegmentedControl`, check boxes. On the page: width, zoom and data state.

## Callbacks

- `onOpenChange`: Every change asked for: the button, Escape, a press or focus outside. Set `open` from it when the host holds it.

## Example

```tsx
<Popover
  label="View"
  summary="Fit · 100% · Real data"
  align="end"
  children={children}
  onOpenChange={…}
/>
```
