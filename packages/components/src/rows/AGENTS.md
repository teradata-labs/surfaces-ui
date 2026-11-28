# `packages/components/src/rows`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `RowList` | Anything drawn once per row of a query: a feed, a list of cards, rows with their own buttons. The engine sorts, filters and pages; a person asks for more, up to `ROW_LIST_MAX` (200) | `sourceId`, `sql`, `label`, `renderRow(row, index)`, `filters`, `sorts`, `pageSize`, `rowKey`, `layout` (`list` or `grid`), `onContext` (helper: `plainValue`), `emptyMessage`, `errorMessage` |
