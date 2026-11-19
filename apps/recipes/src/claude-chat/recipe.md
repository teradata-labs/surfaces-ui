# Chat with Claude over your own data

Run Claude on your server as the chat's agent. It sees your tables through a `list_tables` tool, draws charts, tables and numbers from the catalog, and those components run their SQL through your read-only data source. The browser talks only to your server, so the API key never reaches it.

How it fits together:

- `anthropicAgent` from `@surfaces-ui/agent-anthropic` turns Claude into an `AgentBackend`. Claude draws by calling `render_surface` with A2UI messages; `checkSurface` checks each one against the catalog, and anything with problems goes back to Claude to fix in the same turn instead of being drawn.
- The system prompt is `catalogPrompt(analyticsCatalog)`, which describes every component Claude may use, plus a few lines about your data.
- `createSurfacesServer` serves that agent as `AgentService` next to the query and catalog services. In the browser, `connectAgent` and `connectDataSource` reach them.

Defaults worth knowing: `anthropicAgent` uses the model `claude-sonnet-5-5` with effort `"high"`, and turns on server-side refusal fallbacks (when the model declines, the API re-runs the request on a fallback model in the same call). Pass `fallbacks: false` to turn them off; you must on Bedrock, Vertex or Foundry, which do not offer them. The system prompt is cached, since the catalog prompt is long and does not change.

The agent and its one tool. `list_tables` gives names, types and descriptions only, never row values:

{{file: agent.ts}}

The server. `new Anthropic()` reads `ANTHROPIC_API_KEY` from the server's environment. `agent` is given as a function, so it gets the server's own data source for its tools:

{{file: server.ts}}

Run it with a TypeScript runner, for example `ANTHROPIC_API_KEY=... npx tsx server.ts`. With `seeds: true` it serves the six sample industry models (`retail`, `healthcare` and the rest). To serve your own data, build the options from your `surfaces.config.ts` with `loadConfig`, `openSources` and `serverOptions` instead.

In the browser, `Chat` draws the thread and any component Claude asks for. `browserStorage()` keeps the conversation across reloads, and `user` says who is asking, from your own sign-in. Import `@surfaces-ui/components/styles.css` once in your app's entry file.

{{file: App.tsx}}

The test starts the real server on a free port with an Anthropic client whose transport replays recorded server-sent events: Claude calls `list_tables`, then `render_surface`, then finishes. It checks that the surface arrives over Connect and that the request Claude received carried the catalog prompt and both tools. It needs no API key, no engine and no network:

{{file: claude-chat.test.ts}}

Not verified here: a turn against the live Anthropic API, and the browser page running against this server (the test drives `connectAgent` from Node). The test server has no sources, so `list_tables` answers that none are configured.
