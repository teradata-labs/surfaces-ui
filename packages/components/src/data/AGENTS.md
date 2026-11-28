# `packages/components/src/data`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `DataSourceProvider` / `useDataSource` | Supplying the backend to everything below it | `dataSource` |
| `useRowWindow` | Building your own windowed view over a query | `(dataSource, query, options)` |

## Rules

- Export with `exportCsv(dataSource, request)`: it streams the whole result from the backend, a batch at a time, so the file is not limited to the grid's window (the backend's row limit still applies and is reported). Never build an export from the rows a grid happens to hold. CSV text that a spreadsheet would run as a formula is defused in `csvField`; keep that.
- Column formats (`formats={{ amount: { kind: "currency" } }}`) change how a value is written, never the value: sorting, filtering and export use the real data.
