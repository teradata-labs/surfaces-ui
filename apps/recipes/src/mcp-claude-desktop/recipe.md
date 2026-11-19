# Show live views in Claude Desktop (MCP Apps)

Give an MCP host such as Claude Desktop tools that show live tables, charts, pivots, an SQL editor and agent-drawn surfaces over your data. The model calls a tool; the host shows the Surfaces app page, which fetches only the rows on screen. Queries stay on your machine and run read-only.

How it works:

- `registerSurfacesApps(server, { dataSource, appHtml })` adds the tools and the `ui://surfaces/app.html` page to any MCP server. `readAppHtml` from `@surfaces-ui/mcp/node` reads the page built into the package.
- Tools for the model: `show_data_grid`, `show_chart`, `show_pivot_table`, `show_query_result`, `open_sql_editor`, `show_schema_explorer`, `render_surface` and `show_dashboard`, plus `list_tables` and `get_component_docs`, which show nothing.
- A view is shown only after its SQL has run once on the server. A query that fails comes back to the model as a tool error it can correct, and `render_surface` returns every catalog problem the same way.
- The page fetches data through one more tool, `surfaces_rpc`, which the model does not see. It is read-only and capped per request.

The server. `buildServer` is the part the test checks; `main` runs it over stdio with the sample data:

{{file: server.ts}}

You may not need to write this file. The `surfaces-mcp` binary in `@surfaces-ui/mcp` is the same server, reading `surfaces.config.ts` in the folder it starts in (or serving the sample models when there is none). To add it to a repository's `.mcp.json` for Claude Code:

```bash
npx surfaces-mcp install --dir path/to/your/repo
```

For Claude Desktop, add an entry to its `claude_desktop_config.json` (Settings, then Developer, then Edit config) and restart it. This is an example written by hand, not generated or tested; change the paths to yours:

```json
{
  "mcpServers": {
    "surfaces": {
      "command": "npx",
      "args": ["-y", "@surfaces-ui/mcp", "--config", "/absolute/path/to/surfaces.config.ts"]
    }
  }
}
```

Both the install command and this entry run `@surfaces-ui/mcp` through `npx`, so the package must be installable from your registry; until it is, point `command` at `node` and `args` at the built `cli.js`. Claude Desktop does not start the server in your project folder, so give the config file as an absolute path. The server writes nothing a person should read to stdout, which carries the protocol; messages go to stderr, which Claude Desktop keeps in its MCP logs.

The test connects an MCP client to `buildServer` over an in-memory transport, with `memoryDataSource` and a stub page in place of the built one. It lists the tools, reads the tables and shows a grid:

{{file: mcp.test.ts}}

Not verified inside Claude Desktop or any other desktop host. The tools and the page have run only through the playground's in-page host and a stdio smoke test, so how a given host sizes, sandboxes and refreshes the page is unknown.
