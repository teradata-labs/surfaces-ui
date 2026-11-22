# DataTable

`import { DataTable } from "@surfaces-ui/components";`

The rows an app holds, as a table: people, invitations, jobs, keys. Headings ask the host to sort; check boxes say which rows are chosen (with `SelectionBar` for what to do with them); each row can carry its everyday actions as `ItemControls` and a menu on a right click. It sorts, filters and pages nothing itself: the host asks its own server and hands over one page, with `Pagination` beneath. Columns marked `medium` or `wide` give way as the table, not the window, narrows. For the rows of a query use `DataGrid`, which asks the engine.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | What the rows are, for assistive technology: "People". |
| `columns` | object[] | yes | The columns, in order. A column's `cell` function draws it; without one the row's value under `id` is shown as text. |
| `rows` | object[] | yes | One page of rows, already sorted and filtered by the host, shown in the order given. |
| `rowHeader` | string |  | The column that names each row, drawn as its header. Defaults to the first. |
| `sort` | object |  | How the host has sorted the rows. |
| `allSelected` | boolean |  | Every row that matches is chosen, past this page too (see `SelectionBar`). |
| `controlsShow` | "always" \| "hover" |  | Whether a row's controls are always shown (the default) or on hover and focus. |
| `loading` | boolean |  | The rows are being fetched. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `rowKey` (required): **Row key.** A function giving each row a value that tells it apart: an id.
- `rowName`: **Row name.** A function giving the row's name, for its check box and controls: "Select Ana Admin". Defaults to the first column's text.
- `selected`: **Selection.** The keys of the rows ticked, with `onSelectedChange`: adds a check box to each row and the heading.
- `selectable`: **Who can be chosen.** A function saying whether a row can be ticked: one that cannot shows no box.
- `rowControls`: **Row controls.** A function giving a row's everyday actions, drawn with `ItemControls`.
- `rowMenu`: **Row menu.** A function giving a row's menu, opened by a right click, a long press or the Menu key.
- `rowState`: **Row state.** A function giving a word put on the row as `data-state` for the host's own styling: "off".
- `empty`: **When empty.** What to show in place of rows when there are none.

## Callbacks

- `onSortChange`: The column and direction a person asked to sort by. Fetch the rows in that order and pass them back.
- `onSelectedChange`: The keys now ticked.

## Example

```tsx
<DataTable
  label="People"
  rowHeader="name"
  sort={{"column":"name","desc":false}}
  columns={[{"id":"name","label":"Name","sortable":true},{"id":"email","label":"Email","sortable":true,"show":"medium"},{"id":"status","label":"Status"},{"id":"signedIn","label":"Last signed in","show":"wide"},{"id":"owns","label":"Owns","sortable":true,"align":"end","show":"wide"}]}
  rows={[{"id":"u1","name":"Ana Admin","email":"ana@example.com","status":"On","owns":4,"signedIn":"Today"},{"id":"u2","name":"Ben Brook","email":"ben@example.com","status":"Turned off","owns":0,"signedIn":"3 May"},{"id":"u3","name":"Cleo Chen","email":"cleo@example.com","status":"On","owns":12,"signedIn":"Yesterday"},{"id":"u4","name":"Dev Diaz","email":"dev@example.com","status":"On","owns":1,"signedIn":"Never"}]}
  rowKey={rowKey}
  selected={selected}
  rowControls={rowControls}
  onSortChange={…}
  onSelectedChange={…}
/>
```
