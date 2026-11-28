# `packages/components/src/source`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `SourceList` | The sources a backend offers, how each connects, and a per-table connection test | `onSelect` |
| `ConnectionBuilder` | Setting up Parquet, Delta or Iceberg data on S3, GCS, Azure, https or disk; writes config and names the environment variables | `value`, `onChange` (helper: `connectionPlan`) |
