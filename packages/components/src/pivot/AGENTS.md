# `packages/components/src/pivot`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `PivotTable` | A measure across two dimensions, with totals | `sourceId`, `sql`, `rows`, `columns`, `measures`, `totals`, `maxColumns`, `emptyMessage`, `errorMessage` |

## Rules

- Totals in `PivotTable` are separate grouped queries, because averages, medians and distinct counts cannot be added up from cells. Do not sum cells in the browser.
