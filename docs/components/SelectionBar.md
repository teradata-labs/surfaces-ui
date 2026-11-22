# SelectionBar

`import { SelectionBar } from "@surfaces-ui/components";`

What to do with the rows a person chose in a `DataTable`: how many, the actions, and Clear. When the whole page is ticked and more rows match, it offers to take every row that matches, so an action can reach rows on pages never opened; the host then acts on its search and filters, not on a list of keys. An action that takes something away comes last, after a gap. It runs nothing itself: ask first for anything hard to undo with `useConfirm`, and report what happened, and whom it left alone, with `ActionReceipt`. Nothing is drawn with nothing chosen.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `count` | integer | yes | How many rows are chosen: those ticked, or all that match when `allMatching`. |
| `actions` | object[] | yes | What can be done to them, in order; one with `danger` is moved last. |
| `label` | string |  | Names the bar for assistive technology. Defaults to "With the selected rows". |
| `pageSelected` | boolean |  | Every row on this page is ticked. |
| `total` | integer |  | How many rows match in all, across every page. |
| `allMatching` | boolean |  | Every row that matches is chosen, not only those ticked. |
| `busy` | boolean |  | An action is running: every button waits. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `children`: **Form below.** Drawn under the actions: a form an action opened, such as who to hand the rows to.

## Callbacks

- `onClear`: Untick everything.
- `onAllMatchingChange`: True when a person chooses every row that matches; false to go back to this page. Without it nothing is offered past the page.

## Example

```tsx
<SelectionBar
  count={50}
  total={126}
  pageSelected
  actions={[{"id":"turn-off","label":"Turn off","danger":true},{"id":"turn-on","label":"Turn back on"},{"id":"sign-out","label":"Sign out everywhere"}]}
  onClear={…}
  onAllMatchingChange={…}
/>
```
