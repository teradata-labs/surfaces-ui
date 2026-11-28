# `packages/engine-service`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/engine-service` | The server's Query, Catalog and Source handlers over `Engine`s, usable in Node or a browser (`createEngineServices` returns routes and an in-process `dataSource`). The dev server and DuckDB-wasm both use it. When a filtered view fails on an unknown column, it reads the base query's columns, drops the filters on missing ones, runs the view again and says so in a notice, which data components show under the view (`DataNotes`); run on DuckDB (wasm), not yet on Teradata or DataFusion. |
