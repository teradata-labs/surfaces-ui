# `packages/components/src/grid`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `DataGrid` | Any tabular result, of any size; columns drag to reorder, resize, hide; keyboard cell navigation; column and cell menus | `sourceId`, `sql`, `filters`, `sorts`, `columns` (`order`, `hidden`, `widths`), `onColumnsChange`, `onCellFilter`, `onUseSql`, `formats`, `mode` (`scroll` or `pages`), `footer` (`false` for a small look at a few rows: no count, timing or Run again, the count still announced), `timeTravel`, `notBefore`, `onInfo` (includes `cancel`), `onRowClick` (helpers: `arrangeColumns`, `moveColumn`), `emptyMessage`, `errorMessage` |

## Rules

- A grid does not count rows when the answer is already known (a kept result, or a first block that is not full). Do not add a count call that runs on every load.
- Hidden columns in a grid are still fetched; hiding is a display choice. Column order, widths and hidden columns are plain data (`GridColumns`) so a host, a saved page or an agent can set them.
- `DataGrid` keeps a bounded cache of row blocks. Do not read "all rows" out of it; ask the backend (count, aggregate, export) instead.
