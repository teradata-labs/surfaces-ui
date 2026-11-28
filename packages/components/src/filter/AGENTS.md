# `packages/components/src/filter`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `FilterBar` | Editing a `Filter[]` list; picks values from a list, date pickers and quick ranges for dates, which stay relative when the host holds them | `fields`, `filters`, `onChange`, `loadValues`, `relative`, `onRelativeChange` |
| `QueryFilters` | A filter bar over a query, in plain filter form (`FilterSpec[]`): finds the columns and their values itself and keeps quick ranges relative; one list shared by every view of a page | `sourceId`, `sql`, `filters`, `onChange`, `columns` |

## Rules

- The values offered in a filter come from the engine (`loadValues`, a grouped count), not from the rows on screen.
- **Page-wide filters are one list in the page's data.** In the catalog a data component's `filters` is a list or a binding (`{ "@path": … }`); a `FilterBar` (drawn with `QueryFilters`) writes its list to that path, and every view bound to it follows. A `Chart` with `select: { path }` is a filter too: a click on a bar sets that column to the value (`toggleValueFilter`), a second click clears it, and the chart reads the list without its own column (`filtersExcept`) so the bars a person clicks stay; this is for a category x only. Views that share a list must read the same columns, since a filter on a column a view lacks fails. The bar reports its list through `reportControls` and its `change` event; `Chart` sends `select` with `column`, `value` and `series`.
- **A relative date is kept relative.** The `since` filter (`{ column, op: "since", values: ["30d"] }`; also `4w`, `3m`, `1y`, `week`, `month`, `quarter`, `year`) is turned into "on or after" when the query is sent (`filtersFromSpec`, `sinceStart`), from the start of a UTC day, so it moves once a day and never goes stale in a saved page. It lives in the plain form only: there is no `since` in the proto, and a filter read back from a query is `gte`. Never write "the last 30 days" as a date.
