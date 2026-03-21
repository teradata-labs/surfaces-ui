# @surfacesui/mcp-adapter

Framework-agnostic adapter for embedding surfaces-ui apps into **any MCP server** (Node.js, Go, Python, Rust, etc.). Ships pre-built HTML bundles for the SQL Editor and NL UI Generator, and exposes them via standard MCP resources.

## Why This Package

You have an existing MCP server and you want to add rich UI surfaces to it. This package:

- Ships the pre-built HTML app bundles (no separate build step required)
- Provides helpers to list and serve those bundles as MCP resources
- Is **framework-agnostic** — zero dependency on `@modelcontextprotocol/sdk` so it works with any server implementation

For a complete standalone server you can run directly, see [`@surfacesui/server`](../server/README.md).

## Installation

```bash
npm install @surfacesui/mcp-adapter
# or
pnpm add @surfacesui/mcp-adapter
```

## Quick Start: Node.js with `@modelcontextprotocol/sdk`

```ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getSurfacesResources, readSurfacesResource } from '@surfacesui/mcp-adapter';

const server = new Server(
  { name: 'my-mcp-server', version: '1.0.0' },
  {
    capabilities: {
      resources: {},
      // Required: declare support for the MCP Apps UI extension
      extensions: {
        'io.modelcontextprotocol/ui': {
          mimeTypes: ['text/html;profile=mcp-app'],
        },
      },
    },
  }
);

// List all surfaces-ui apps as MCP resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: getSurfacesResources(),
}));

// Serve HTML bundle content when a resource is read
server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [readSurfacesResource(request.params.uri)],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Exposing Apps via Tools

The primary pattern is a **tool that returns a resource URI**. The MCP host (e.g. Claude Desktop) renders the referenced HTML app inline.

```ts
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'open_sql_editor',
      description: 'Open an interactive SQL editor',
      inputSchema: {
        type: 'object',
        properties: {
          initialQuery: { type: 'string', description: 'SQL query to pre-fill' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'open_sql_editor') {
    const { initialQuery } = request.params.arguments ?? {};

    // Build URI — query params are forwarded to the app on load
    const uri = initialQuery
      ? `surfaces-ui/apps/sql-editor-cdn?sql=${encodeURIComponent(initialQuery as string)}`
      : 'surfaces-ui/apps/sql-editor-cdn';

    return {
      _meta: { ui: { resourceUri: uri } },
      content: [{ type: 'text', text: 'Opening SQL editor…' }],
    };
  }
});
```

## Available Apps

| App ID | Description | Supported Query Params |
|--------|-------------|----------------------|
| `sql-editor-cdn` | Interactive SQL editor with syntax highlighting and results table | `sql` — pre-fill the editor with a SQL query |
| `json-render-cdn` | Natural language → UI generator | `prompt` — pre-fill the NL prompt |

**URI format**: `surfaces-ui/apps/{appId}` or `surfaces-ui/apps/{appId}?param=value`

## API Reference

### `getSurfacesResources()`

Returns the list of all registered apps as MCP resource descriptors.

```ts
import { getSurfacesResources } from '@surfacesui/mcp-adapter';

const resources = getSurfacesResources();
// [
//   {
//     uri: 'surfaces-ui/apps/sql-editor-cdn',
//     name: 'SQL Editor',
//     description: 'Interactive SQL editor...',
//     mimeType: 'text/html;profile=mcp-app',
//   },
//   {
//     uri: 'surfaces-ui/apps/json-render-cdn',
//     name: 'NL UI Generator',
//     description: 'Natural language-driven UI...',
//     mimeType: 'text/html;profile=mcp-app',
//   },
// ]
```

### `readSurfacesResource(uri)`

Reads and returns the HTML bundle for a given resource URI. Throws if the URI is not a surfaces-ui URI or the bundle is missing.

```ts
import { readSurfacesResource } from '@surfacesui/mcp-adapter';

const content = readSurfacesResource('surfaces-ui/apps/sql-editor-cdn');
// {
//   uri: 'surfaces-ui/apps/sql-editor-cdn',
//   mimeType: 'text/html;profile=mcp-app',
//   text: '<!DOCTYPE html>...',   // full self-contained HTML
// }
```

### `isSurfacesUri(uri)`

Returns `true` if the URI is a `surfaces-ui/apps/*` URI. Use this to guard your `ReadResource` handler.

```ts
import { isSurfacesUri } from '@surfacesui/mcp-adapter';

isSurfacesUri('surfaces-ui/apps/sql-editor-cdn'); // true
isSurfacesUri('other-server/resource');           // false
```

### `validateBundles()`

Checks that all registered HTML bundles exist on disk. Returns a map of `appId → true | Error`. Useful as a startup health check.

```ts
import { validateBundles } from '@surfacesui/mcp-adapter';

const results = validateBundles();
// { 'sql-editor-cdn': true, 'json-render-cdn': true }
// or { 'sql-editor-cdn': Error('Bundle not found: ...') }
```

### `SURFACES_APPS` registry

The raw app metadata map. Useful if you want to build your own resource handling.

```ts
import { SURFACES_APPS } from '@surfacesui/mcp-adapter';

console.log(SURFACES_APPS['sql-editor-cdn']);
// { name: 'SQL Editor', description: '...', mimeType: 'text/html;profile=mcp-app', filename: 'sql-editor-cdn.html' }
```

## How Data Flows Between Your Server and the App

When the HTML app loads in the MCP host's iframe, it communicates with your server through the **MCP Apps bridge** — there are no direct REST calls. This means any tool you expose on your MCP server is automatically callable from within the UI.

```
┌───────────────────────────────────────────┐
│  MCP Host (Claude Desktop, etc.)          │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  HTML App (sandboxed iframe)        │  │
│  │                                     │  │
│  │  useMcpTool('execute_sql', {...})   │  │
│  │    └─ McpAppsBridge                 │  │
│  │         └─ ext-apps SDK             │  │
│  │              ↕ callServerTool()     │  │
│  └─────────────────────────────────────┘  │
│                    ↕                      │
│       MCP protocol (stdio / SSE)          │
└───────────────────────────────────────────┘
                     ↕
┌───────────────────────────────────────────┐
│  Your MCP Server                          │
│    tools: execute_sql, get_schema, …      │
└───────────────────────────────────────────┘
```

### SQL Editor: Expected Tool Contract

The SQL Editor calls `execute_sql` when the user runs a query. Your server must expose this tool and return results in the following shape:

**Tool input** (sent by the app):
```json
{
  "query": "SELECT * FROM my_table LIMIT 10",
  "connectionId": "optional-connection-identifier"
}
```

**Tool output** (your server must return):
```json
{
  "success": true,
  "columns": ["id", "name", "created_at"],
  "data": [
    { "id": 1, "name": "Alice", "created_at": "2024-01-01" },
    { "id": 2, "name": "Bob",   "created_at": "2024-01-02" }
  ],
  "row_count": 2
}
```

On error:
```json
{
  "success": false,
  "error": "Table 'my_table' does not exist"
}
```

The SQL Editor also optionally calls `get_schema` to populate autocompletion. If you expose this tool, return:

```json
{
  "success": true,
  "data": {
    "tables": [
      {
        "name": "my_table",
        "columns": [
          { "name": "id",         "type": "INTEGER" },
          { "name": "name",       "type": "VARCHAR" },
          { "name": "created_at", "type": "TIMESTAMP" }
        ]
      }
    ]
  }
}
```

### NL UI Generator: Expected Tool Contract

The NL UI Generator calls `generate_ui` with a natural language prompt and expects a `@json-render/react` spec back.

**Tool input**:
```json
{
  "prompt": "Show me a bar chart of sales by region"
}
```

**Tool output**:
```json
{
  "success": true,
  "spec": {
    "type": "BarChart",
    "props": {
      "data": [...],
      "xKey": "region",
      "yKey": "sales"
    }
  }
}
```

### Passing Initial State via Query Params

Query params on the resource URI are read by the app on load. They let you pre-fill state from the tool call without a round-trip:

```ts
// Pre-fill the SQL editor with a query from the tool call
const sql = request.params.arguments?.initialQuery ?? '';
const uri = `surfaces-ui/apps/sql-editor-cdn?sql=${encodeURIComponent(sql)}`;
```

### Tool Response Format (MCP Tool → Host)

When a tool returns a resource URI the host should render, use `_meta.ui.resourceUri`:

```ts
return {
  _meta: {
    ui: {
      resourceUri: 'surfaces-ui/apps/sql-editor-cdn?sql=SELECT%201',
    },
  },
  content: [
    {
      type: 'text',
      text: 'Opening SQL editor with your query.',
    },
  ],
};
```

The `content` text is shown in the conversation; the `_meta.ui.resourceUri` triggers the iframe render.

## Server Capability Requirements

Your server **must** declare the `io.modelcontextprotocol/ui` extension in its capabilities, otherwise MCP hosts will not render HTML app resources:

```ts
capabilities: {
  resources: {},
  extensions: {
    'io.modelcontextprotocol/ui': {
      mimeTypes: ['text/html;profile=mcp-app'],
    },
  },
}
```

## Integrating with Non-Node Servers

The HTML bundles in this package are plain files in `node_modules/@surfacesui/mcp-adapter/apps/`. You can copy them into any server's embedded assets at build time.

### Go (`//go:embed`)

```go
import "embed"

//go:embed node_modules/@surfacesui/mcp-adapter/apps/sql-editor-cdn.html
var sqlEditorHTML []byte

// Serve as an MCP resource:
// URI: surfaces-ui/apps/sql-editor-cdn
// MIME: text/html;profile=mcp-app
// Content: sqlEditorHTML
```

Or use a build script to copy the files before compiling:

```makefile
.PHONY: copy-ui
copy-ui:
    cp node_modules/@surfacesui/mcp-adapter/apps/*.html internal/ui/apps/
```

### Python

```python
from pathlib import Path
import importlib.resources

# Direct file path approach
adapter_apps = Path("node_modules/@surfacesui/mcp-adapter/apps")
sql_editor_html = (adapter_apps / "sql-editor-cdn.html").read_text()
```

## Combining with Your Own Resources

If your server already handles other resources, guard by URI prefix:

```ts
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (isSurfacesUri(uri)) {
    return { contents: [readSurfacesResource(uri)] };
  }

  // Handle your own resources
  return { contents: [await myReadResource(uri)] };
});
```

## Types

```ts
interface SurfacesResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string; // always 'text/html;profile=mcp-app'
}

interface SurfacesResourceContent {
  uri: string;
  mimeType: string;
  text: string; // full HTML content
}

type AppId = 'sql-editor-cdn' | 'json-render-cdn';
```
