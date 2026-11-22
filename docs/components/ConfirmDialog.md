# ConfirmDialog

`import { ConfirmDialog } from "@surfaces-ui/components";`

Asks a person to confirm one action before it runs, as a modal dialog: the page behind cannot be used, focus starts inside (on Cancel for something that takes away) and returns where it was, and Escape or a press outside cancels. Name the button for the action ("Turn off"), never "OK", and say what cannot be undone. From an event handler, `useConfirm()` gives `confirm({ title, body, confirmLabel, danger })`, which resolves true or false. For something that can be undone, prefer doing it and offering Undo with `ActionReceipt`.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `open` | boolean | yes | Whether the dialog is showing. |
| `title` | string | yes | The question: "Turn off 5 accounts?" |
| `confirmLabel` | string |  | The button that goes ahead, named for what it does. Defaults to "Confirm". |
| `cancelLabel` | string |  | Defaults to "Cancel". |
| `danger` | boolean |  | For something that takes away or cannot be undone. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `body`: **What will happen.** A sentence or two on what the action does and what cannot be undone.

## Callbacks

- `onConfirm`: The person went ahead.
- `onCancel`: Cancel, Escape, or a press outside the dialog.

## Example

```tsx
<ConfirmDialog
  title="Turn off 5 accounts?"
  confirmLabel="Turn off"
  danger
  body={body}
  onConfirm={…}
  onCancel={…}
/>
```
