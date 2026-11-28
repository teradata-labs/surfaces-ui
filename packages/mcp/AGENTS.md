# `packages/mcp`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/mcp` | MCP Apps. `registerSurfacesApps(server, { dataSource, appHtml })` adds the tools and the `ui://surfaces/app.html` page; `mcpDataSource` carries DataSource calls as tool calls from inside the page. `@surfaces-ui/mcp/node` has `readAppHtml` and `installMcpServer`. The `surfaces-mcp` binary is a stdio server over `surfaces.config.ts` (any configured source, Teradata included; it reads the git-ignored `.env.local` beside the config as the dev server does), and `surfaces-mcp install --dir <repo>` adds it to a repo's `.mcp.json`. **MCP servers as agent connectors:** `mcpConnector({ id, name, transport })` connects to any MCP server and gives one `AgentConnector` and its tools as `RunnableTool`s named `<id>__<tool>`; a tool not marked `readOnlyHint` asks a person first and runs only the arguments they allowed, a tool kept for an app page (`visibility` without `model`) is left out, and a server that cannot be reached is a connector marked unavailable with the reason. `httpTransport(url, { token })` and `stdioTransport(command, args, { env })` (`@surfaces-ui/mcp/node`, passing on only the environment variables named) open the connection. The repo's `surfaces.config.ts` reads servers from an optional `surfaces.mcp.json` (`SURFACES_MCP_CONFIG`), which names environment variables and never holds a value; their connectors start off. Run live over stdio against this repo's own server. |

## MCP Apps

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { registerSurfacesApps } from "@surfaces-ui/mcp";
import { readAppHtml } from "@surfaces-ui/mcp/node";

registerSurfacesApps(server, { dataSource, appHtml: readAppHtml });
```

- Tools for the model: `show_data_grid`, `show_chart`, `show_pivot_table`, `show_query_result`, `open_sql_editor`, `show_schema_explorer`, `render_surface`, `show_dashboard`, plus `list_tables` (with `search` and `database`; names only past 30 tables), `describe_table`, `search_data` (when a `discovery` backend is passed) and `get_component_docs` (no UI). Given `pipelines`: `show_pipeline` (draws `PipelineView`) and `propose_dataset` (draws `DatasetReview`), both filled in on the server so the model never copies a definition into a surface, plus the pipeline data tools. They return names, types and descriptions, never rows. Run live over stdio against Teradata (list, describe and a grid).
- A view is shown only after its SQL has run once on the server; a failure goes back to the model as a tool error it can correct. `render_surface` returns every catalog violation the same way.
- The app page fetches data through one tool, `surfaces_rpc`, which is hidden from the model, read-only and capped per request. Rows stay on the server except for the window on screen. Pipelines go through a second hidden tool, `surfaces_pipeline_rpc` (`mcpPipelines` on the page side), kept apart because it can change things, and only on a person's action in the page: a run they press (marked `manual`, "a person, in the MCP app", never a full refresh, which the page does not offer, `PipelineView` `fullRefresh={false}`) or a save they approved (the backend still checks approver, digest and version). The page's decision goes back to the conversation as the person's message; what they do along the way goes as model context (`updateModelContext`), not as a request.
- The MCP SDK is the split v2 packages (`@modelcontextprotocol/server`, `/client`, `/core`), which `@modelcontextprotocol/ext-apps` requires. Do not add the older `@modelcontextprotocol/sdk`.
- To install into another repo: `npx surfaces-mcp install --dir <repo>`, with a `surfaces.config.ts` there.
- The app page follows the host's theme: its light or dark mode, and the colours it shares in `hostContext.styles.variables` (the nearest preset, with the host's accent and corner radius, `themeFromHostStyles` in `@surfaces-ui/tokens`). The playground's hosts send the page's own theme with `hostStyleVariables`.
- Not verified in a desktop host (Claude Desktop and others): it has been run only through the docs app's in-page host and the stdio smoke test.
