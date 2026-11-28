# `packages/engine-datafusion`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/engine-datafusion` | Apache DataFusion over a server's HTTP SQL endpoint (ROAPI), reading Arrow. Read-only: no kept results, pipelines, time travel or error positions. Config: `{ id, engine: "datafusion", baseUrl }`. The endpoint cannot bind parameters, so `literal()` writes numbers after checking them and sends text as hexadecimal for the engine to decode; never change it to quote text. |
