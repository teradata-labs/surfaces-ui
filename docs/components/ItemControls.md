# ItemControls

`import { ItemControls } from "@surfaces-ui/components";`

The controls of one item (a tile, a framed component) as a row of icons: quiet until the item is pointed at or focused, each named at once in a tooltip, one tab stop with arrows between them. Build the shared actions with `standardControls(name, actions)` so their order, wording and icons are the same everywhere.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | Names the group: "Refund rate by category controls". |
| `show` | "hover" \| "always" |  | Shown on hover and focus (and always on touch), or always. |
| `quietable` | boolean |  | Whether an outer layer of controls can hide these. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `controls` (required): **Controls.** The actions, from `standardControls`. On the page: change, wider, narrower, earlier, later, duplicate and remove.

## Example

```tsx
<ItemControls label="Revenue by month controls" show="always" controls={controls} />
```
