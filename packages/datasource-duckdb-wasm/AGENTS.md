# `packages/datasource-duckdb-wasm`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/datasource-duckdb-wasm` | `DataSource` over DuckDB-wasm: one schema per source, `registerParquet`, `registerFile` (a person's Parquet, CSV or JSON, read in the page; `fileFormatOf`, `tableNameOf`), `loadSeed` (from Parquet or generator SQL), `openBrowserDuckDb(bundles)` with bundle URLs from the host's build. Data layer: UI packages never import it. |
