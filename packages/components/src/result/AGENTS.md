# `packages/components/src/result`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `QueryResult` | A result with filters, table, chart and pivot views, CSV download, copy SQL, cancel, column formats, the plan and "show SQL" | `sourceId`, `sql`, `timeTravel`, `notBefore`, `exportName`, `onError(message, info)`, `emptyMessage`, `errorMessage` |
