# `fixtures`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `fixtures/lake` | Sample Parquet, Delta (3 versions) and Iceberg (3 snapshots) tables. Rebuild with `scripts/make-fixtures.py`. |

This note sits in `fixtures`, not in `fixtures/lake`, on purpose: `lake` is data that the DuckDB engine lists as files (`listFiles`), and a test compares that listing, so nothing but data goes in it.
