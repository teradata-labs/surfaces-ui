# SegmentedControl

`import { SegmentedControl } from "@surfaces-ui/components";`

A few equal choices of which exactly one holds, as one bar: build or view, chart or table, light or dark. It is the bar `ReportBuilder` switches modes with. A radio group, so it is one tab stop and the arrow keys move the choice; the chosen segment is one thumb that slides between the options. It holds no choice of its own: the host keeps `value` and sets it from `onChange`. Use it to switch what is shown in place, for two to eight short options; for actions use buttons, and for many or long options a select.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | What is being chosen, for assistive technology: "Mode", "Preview mode". |
| `options` | object[] | yes | The choices, in order. They share the width equally. |
| `value` | string | yes | The chosen option's value. |
| `fit` | "content" \| "fill" |  | "content" is as wide as its options need; "fill" takes its parent's width. |
| `name` | string |  | The radio group's name, when a form reads it. Made up otherwise. |

## Callbacks

- `onChange`: The value of the option a person chose.

## Example

```tsx
<SegmentedControl
  label="Preview mode"
  value="page"
  fit="content"
  options={[{"value":"page","label":"As the page"},{"value":"light","label":"Light"},{"value":"dark","label":"Dark"}]}
  onChange={…}
/>
```
