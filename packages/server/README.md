# @surfacesui/server

Standalone Node.js MCP server that exposes the surfaces-ui HTML apps (SQL Editor, NL UI Generator) as resources and tools. Ready to run in seconds — no configuration required.

If you want to embed surfaces-ui apps into **your own** MCP server, use [`@surfacesui/mcp-adapter`](../mcp-adapter/README.md) instead.

## Quick Start

```bash
# Run directly (no install)
npx @surfacesui/server

# Or install globally
npm install -g @surfacesui/server
surfaces-ui-server
```

Connect Claude Desktop (or any MCP host) via stdio and the apps are immediately available.

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "npx",
      "args": ["@surfacesui/server"]
    }
  }
}
```

## What It Exposes

### Resources

The server lists both apps as MCP resources discoverable via `resources/list`:

| URI | Name | Description |
|-----|------|-------------|
| `surfaces-ui/apps/sql-editor-cdn` | SQL Editor | Interactive SQL editor with syntax highlighting and results table |
| `surfaces-ui/apps/json-render-cdn` | NL UI Generator | Natural language-driven UI component generator |

All resources use MIME type `text/html;profile=mcp-app`.

### Tools

#### `open_sql_editor`

Opens the SQL Editor app. Optionally pre-fills the editor with a query.

```
Input:
  initialQuery?: string   — SQL to pre-fill in the editor

Returns:
  Resource URI pointing to the SQL Editor, rendered inline by the host.
```

Example usage in a conversation:
> "Open the SQL editor with `SELECT * FROM orders LIMIT 100`"

#### `generate_ui_component`

Opens the NL UI Generator with a prompt pre-filled.

```
Input:
  prompt: string (required)   — Natural language description of the UI to generate

Returns:
  Resource URI pointing to the NL UI Generator with the prompt pre-loaded.
```

Example usage:
> "Generate a UI component showing a filterable table of customer data"

## Server Capabilities

The server declares:

```json
{
  "resources": {},
  "tools": {},
  "extensions": {
    "io.modelcontextprotocol/ui": {
      "mimeTypes": ["text/html;profile=mcp-app"]
    }
  }
}
```

The `io.modelcontextprotocol/ui` extension tells the host that this server can serve renderable HTML apps.

## Using as a Library

You can also import the server programmatically if you need to extend it:

```ts
import { createServer } from '@surfacesui/server';

const server = await createServer();
// server is a configured @modelcontextprotocol/sdk Server instance
// Add your own handlers before connecting:
server.setRequestHandler(MySchema, myHandler);
await server.connect(transport);
```

## Embedding in Your Own Server

This package is best for getting started quickly or testing the apps. For production use inside an existing MCP server, use `@surfacesui/mcp-adapter` directly — it has no SDK dependency and integrates with any framework:

```ts
import { getSurfacesResources, readSurfacesResource } from '@surfacesui/mcp-adapter';
```

See the [mcp-adapter README](../mcp-adapter/README.md) for the full integration guide, including expected tool contracts for each app and non-Node server examples.
