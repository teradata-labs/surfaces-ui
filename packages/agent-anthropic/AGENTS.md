# `packages/agent-anthropic`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/agent-anthropic` | `anthropicAgent({ client, system })`: `toolCallingAgent` over Claude's Messages API with the official SDK (a peer dependency). Defaults: `claude-sonnet-5-5`, effort "high", streaming, cached system prompt, eager tool input streaming, server-side refusal fallbacks on (`fallbacks: false` off). Claude's content blocks are sent back unchanged; a refusal or a tool call cut off by `max_tokens` stops the turn. Tested against recorded streams, and run live once through the dev server (Opus 5.5 built a chart and a sparkline over the retail seed in the composer, passing the catalog); tool steps and approvals have not been run live. |
