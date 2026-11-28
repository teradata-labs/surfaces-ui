# `packages/dev-server`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

A source can be a database reached through its own MCP server (`engine: "mcp"`, `McpSourceConfig` in `config.ts`); the rules for it are in [packages/engine-mcp/AGENTS.md](../engine-mcp/AGENTS.md), and `src/mcp-source.test.ts` runs the whole stack through one when `SURFACES_TEST_MCP_POSTGRES` or `SURFACES_TEST_MCP_DUCKDB` is set.

| Path | What it is |
|---|---|
| `packages/dev-server` | Connect server implementing the services over engines; `surfaces.config.ts` loader; `surfaces-dev` CLI and the headless `surfaces-pipelines` CLI; `filePipelineStore` and `fileRunStore`. Keeps query results (`storedResults`) so views of one query do not run it again, and reports where in the SQL an error is. |
