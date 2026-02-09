# Teradata MCP UI

**Version:** 0.1.0

React component library served via MCP Apps protocol for interactive UI in MCP-compliant clients.

## Overview

This project provides:

- **packages/components** - React component library (TypeScript + Tailwind)
- **server/** - FastMCP Python server that serves HTML apps as MCP resources

Components communicate through the MCP Bridge pattern, not direct REST calls. This enables the same components to work across Claude Desktop, VS Code MCP clients, and custom applications.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 10.0.0
- Python >= 3.11 (for MCP server)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd teradata-mcp-ui

# Install JavaScript dependencies
pnpm install

# Install Python dependencies
cd server
pip install -r requirements.txt
cd ..
```

### Build

```bash
# Build the component library
pnpm build

# Build HTML app bundles for MCP serving
pnpm --filter @teradata-mcp-ui/components build:apps
```

### Development

```bash
# Start development mode (watches for changes)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm --filter @teradata-mcp-ui/components test:coverage
```

## Using with Claude Desktop

Claude Desktop supports MCP servers. Configure the teradata-mcp-ui server in your Claude Desktop settings.

### 1. Build the components

```bash
cd teradata-mcp-ui
pnpm install
pnpm build
pnpm --filter @teradata-mcp-ui/components build:apps
```

### 2. Configure Claude Desktop

Edit your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/teradata-mcp-ui/server",
      "env": {
        "MOCK_MODE": "true"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop. The MCP server will be available, providing:

- **Tools:** `execute_sql` - Execute SQL queries
- **Resources:** UI apps accessible via `ui://sql-editor`, `ui://file-browser`, etc.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MOCK_MODE` | Use mock data instead of real database | `true` |
| `VANTAGE_MCP_MODE` | Communication mode: `stdio` or `http` | `stdio` |
| `VANTAGE_MCP_BINARY` | Path to vantage-mcp binary (stdio mode) | (empty) |
| `VANTAGE_MCP_ADDR` | HTTP address for vantage-mcp (http mode) | (empty) |
| `TD_USER` | Teradata username (passed to vantage-mcp) | (empty) |
| `TD_PASSWORD` | Teradata password (passed to vantage-mcp) | (empty) |
| `TD_HOST` | Teradata host (passed to vantage-mcp) | (empty) |

## Connecting to vantage-mcp

The teradata-mcp-ui server can connect to vantage-mcp (the Go-based MCP tools server) in two modes:

### Mode 1: stdio (Recommended)

In stdio mode, teradata-mcp-ui spawns vantage-mcp as a subprocess and communicates via JSON-RPC over stdin/stdout. This is the native MCP communication method and requires no HTTP wrapper.

**Claude Desktop Configuration:**

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/teradata-mcp-ui/server",
      "env": {
        "MOCK_MODE": "false",
        "VANTAGE_MCP_MODE": "stdio",
        "VANTAGE_MCP_BINARY": "/path/to/vantage-mcp",
        "TD_USER": "your-username",
        "TD_PASSWORD": "your-password",
        "TD_HOST": "vantage.example.com"
      }
    }
  }
}
```

**How it works:**
1. teradata-mcp-ui receives a `tools/call` request for `execute_sql`
2. It spawns vantage-mcp as a subprocess (if not already running)
3. Sends MCP `initialize` request to establish the session
4. Forwards the tool call via JSON-RPC: `{"method": "tools/call", "params": {"name": "teradata_execute_sql", ...}}`
5. Returns the result to the MCP client

**Advantages:**
- Native MCP protocol - no HTTP wrapper needed
- Single process management by Claude Desktop
- Environment variables passed directly to subprocess
- Connection reused across multiple tool calls

### Mode 2: HTTP

In HTTP mode, teradata-mcp-ui proxies requests to an HTTP endpoint. This requires running vantage-mcp with an HTTP wrapper or gateway.

**Claude Desktop Configuration:**

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/teradata-mcp-ui/server",
      "env": {
        "MOCK_MODE": "false",
        "VANTAGE_MCP_MODE": "http",
        "VANTAGE_MCP_ADDR": "http://localhost:8080"
      }
    }
  }
}
```

**How it works:**
1. teradata-mcp-ui receives a `tools/call` request for `execute_sql`
2. Makes an HTTP POST to `{VANTAGE_MCP_ADDR}/execute`
3. Returns the response to the MCP client

**When to use HTTP mode:**
- vantage-mcp is running as a persistent service
- Multiple MCP clients share the same vantage-mcp instance
- You have an HTTP gateway in front of vantage-mcp

### Mode Comparison

| Feature | stdio Mode | HTTP Mode |
|---------|-----------|-----------|
| Setup complexity | Low | Medium (requires HTTP wrapper) |
| Process management | Automatic | Manual |
| Connection sharing | Per-client | Shared |
| Environment passing | Direct | Via wrapper config |
| Recommended for | Development, single-user | Production, multi-user |

## Using with Loom

[Loom](https://github.com/teradata-labs/loom) is an LLM agent framework. The teradata-mcp-ui components can be used with loom agents by configuring vantage-mcp as an MCP tool provider.

### Option 1: teradata-mcp-ui with stdio mode (UI + Tools)

Use teradata-mcp-ui as the main server, which spawns vantage-mcp internally for tool execution:

```yaml
# looms.yaml or agent.yaml
tools:
  - name: teradata-ui
    type: mcp
    config:
      command: python
      args: ["-m", "src.main"]
      cwd: /path/to/teradata-mcp-ui/server
      env:
        MOCK_MODE: "false"
        VANTAGE_MCP_MODE: "stdio"
        VANTAGE_MCP_BINARY: "/path/to/vantage-mcp"
        TD_USER: "your-username"
        TD_PASSWORD: "your-password"
        TD_HOST: "vantage.example.com"
```

This provides both UI resources (`ui://sql-editor`, etc.) and tools (`execute_sql`).

### Option 2: vantage-mcp directly (Tools Only)

For tools-only access without UI resources, use vantage-mcp directly:

```yaml
# looms.yaml or agent.yaml
tools:
  - name: teradata
    type: mcp
    config:
      command: /path/to/vantage-mcp
      env:
        TD_USER: "your-username"
        TD_PASSWORD: "your-password"
        TD_HOST: "vantage.example.com"
```

This provides only the `teradata_execute_sql` tool with no UI resources.

### Option 3: Both servers (Separate UI and Tools)

Run both servers for maximum flexibility:

```yaml
# looms.yaml or agent.yaml
tools:
  # UI resources server
  - name: teradata-ui
    type: mcp
    config:
      command: python
      args: ["-m", "src.main"]
      cwd: /path/to/teradata-mcp-ui/server
      env:
        MOCK_MODE: "true"  # UI server doesn't need backend access

  # Tools server
  - name: teradata-tools
    type: mcp
    config:
      command: /path/to/vantage-mcp
      env:
        TD_USER: "your-username"
        TD_PASSWORD: "your-password"
        TD_HOST: "vantage.example.com"
```

This keeps concerns separated: teradata-ui handles resources, vantage-mcp handles tools.

## Integrating into Your MCP Server

The component library builds to standalone HTML files that can be served as MCP UI resources from any MCP server implementation.

### Build the HTML Apps

First, build the HTML app bundles:

```bash
cd teradata-mcp-ui
pnpm install
pnpm build
pnpm --filter @teradata-mcp-ui/components build:apps
```

This creates HTML files in `packages/components/dist/apps/`:
- `sql-editor.html`
- `file-browser.html`
- `data-browser.html`
- `chat-panel.html`

### Node.js MCP Server

Using the `@modelcontextprotocol/sdk` package:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join } from "path";

// Path to built HTML apps
const APPS_DIR = "/path/to/teradata-mcp-ui/packages/components/dist/apps";

// UI app registry
const UI_APPS = {
  "sql-editor": {
    name: "SQL Editor",
    description: "Interactive SQL editor with query execution",
    mimeType: "text/html",
  },
  "data-browser": {
    name: "Data Browser",
    description: "Browse database tables and schemas",
    mimeType: "text/html",
  },
};

const server = new Server(
  { name: "my-mcp-server", version: "1.0.0" },
  { capabilities: { resources: {} } }
);

// List available UI resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.entries(UI_APPS).map(([id, app]) => ({
      uri: `ui://${id}`,
      name: app.name,
      description: app.description,
      mimeType: app.mimeType,
    })),
  };
});

// Read UI resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith("ui://")) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const appId = uri.replace("ui://", "");
  const appFile = join(APPS_DIR, `${appId}.html`);

  try {
    const content = readFileSync(appFile, "utf-8");
    return {
      contents: [{
        uri,
        mimeType: "text/html",
        text: content,
      }],
    };
  } catch (error) {
    throw new Error(`App not found: ${appId}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### FastMCP (Python)

Using the `mcp` package:

```python
import asyncio
from pathlib import Path
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Resource, TextContent

# Path to built HTML apps
APPS_DIR = Path("/path/to/teradata-mcp-ui/packages/components/dist/apps")

# UI app registry
UI_APPS = {
    "sql-editor": {
        "name": "SQL Editor",
        "description": "Interactive SQL editor with query execution",
        "mimeType": "text/html",
    },
    "data-browser": {
        "name": "Data Browser",
        "description": "Browse database tables and schemas",
        "mimeType": "text/html",
    },
}

server = Server("my-mcp-server")


@server.list_resources()
async def list_resources() -> list[Resource]:
    """List available UI resources."""
    return [
        Resource(
            uri=f"ui://{app_id}",
            name=app["name"],
            description=app["description"],
            mimeType=app["mimeType"],
        )
        for app_id, app in UI_APPS.items()
    ]


@server.read_resource()
async def read_resource(uri: str) -> str:
    """Read UI resource content."""
    if not uri.startswith("ui://"):
        raise ValueError(f"Unknown resource: {uri}")

    app_id = uri.replace("ui://", "")
    app_file = APPS_DIR / f"{app_id}.html"

    if not app_file.exists():
        raise ValueError(f"App not found: {app_id}")

    return app_file.read_text()


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
```

### Go MCP Server

For Go servers (like vantage-mcp), use the resource registry pattern:

```go
package main

import (
    "embed"
    "encoding/json"
    "fmt"
    "io"
    "os"
)

//go:embed apps/*.html
var appsFS embed.FS

// UIApp represents a UI application resource
type UIApp struct {
    Name        string `json:"name"`
    Description string `json:"description"`
    MimeType    string `json:"mimeType"`
}

// UI app registry
var uiApps = map[string]UIApp{
    "sql-editor": {
        Name:        "SQL Editor",
        Description: "Interactive SQL editor with query execution",
        MimeType:    "text/html",
    },
    "data-browser": {
        Name:        "Data Browser",
        Description: "Browse database tables and schemas",
        MimeType:    "text/html",
    },
}

// Resource represents an MCP resource
type Resource struct {
    URI         string `json:"uri"`
    Name        string `json:"name"`
    Description string `json:"description,omitempty"`
    MimeType    string `json:"mimeType,omitempty"`
}

// ListResources returns available UI resources
func ListResources() []Resource {
    resources := make([]Resource, 0, len(uiApps))
    for id, app := range uiApps {
        resources = append(resources, Resource{
            URI:         fmt.Sprintf("ui://%s", id),
            Name:        app.Name,
            Description: app.Description,
            MimeType:    app.MimeType,
        })
    }
    return resources
}

// ReadResource reads a UI resource by URI
func ReadResource(uri string) (string, error) {
    if len(uri) < 5 || uri[:5] != "ui://" {
        return "", fmt.Errorf("unknown resource: %s", uri)
    }

    appID := uri[5:]
    if _, ok := uiApps[appID]; !ok {
        return "", fmt.Errorf("app not found: %s", appID)
    }

    // Read from embedded filesystem
    content, err := appsFS.ReadFile(fmt.Sprintf("apps/%s.html", appID))
    if err != nil {
        return "", fmt.Errorf("failed to read app: %w", err)
    }

    return string(content), nil
}

// HandleResourcesList handles the resources/list MCP method
func HandleResourcesList() map[string]interface{} {
    return map[string]interface{}{
        "resources": ListResources(),
    }
}

// HandleResourcesRead handles the resources/read MCP method
func HandleResourcesRead(uri string) (map[string]interface{}, error) {
    content, err := ReadResource(uri)
    if err != nil {
        return nil, err
    }

    return map[string]interface{}{
        "contents": []map[string]interface{}{
            {
                "uri":      uri,
                "mimeType": "text/html",
                "text":     content,
            },
        },
    }, nil
}
```

To embed the HTML files in your Go binary, copy them to an `apps/` directory in your project:

```bash
# Copy built apps to your Go project
mkdir -p /path/to/your-mcp-server/apps
cp /path/to/teradata-mcp-ui/packages/components/dist/apps/*.html \
   /path/to/your-mcp-server/apps/
```

### Copying Built Assets

For any server implementation, you can copy the built HTML files:

```bash
# Create destination directory
mkdir -p /path/to/your-server/assets/ui

# Copy all HTML app bundles
cp teradata-mcp-ui/packages/components/dist/apps/*.html \
   /path/to/your-server/assets/ui/

# Or use npm/pnpm to install as a dependency (if published)
# npm install @teradata-mcp-ui/components
# Then reference: node_modules/@teradata-mcp-ui/components/dist/apps/
```

## Components

### SQLEditor

Interactive SQL editor with query execution and result visualization.

```tsx
import { SQLEditor, McpBridgeProvider } from '@teradata-mcp-ui/components';

function App() {
  return (
    <McpBridgeProvider>
      <SQLEditor
        initialCode="SELECT * FROM users LIMIT 10"
        onExecutionComplete={(result) => console.log(result)}
      />
    </McpBridgeProvider>
  );
}
```

**Props:**
- `initialCode` - Pre-populated SQL code
- `title` - Editor title
- `onCodeChange` - Callback when code changes
- `onExecutionComplete` - Callback with query results
- `autoExecute` - Execute on mount
- `connectionId` - Database connection identifier
- `readOnly` - Disable editing

### MCP Bridge Hooks

All components use MCP Bridge hooks for data fetching:

```tsx
import { useMcpTool } from '@teradata-mcp-ui/components';

function QueryComponent() {
  const { data, loading, error, refetch } = useMcpTool(
    'execute_sql',
    { query: 'SELECT 1', connection_id: 'default' },
    { enabled: false }
  );

  return (
    <button onClick={() => refetch()}>
      {loading ? 'Executing...' : 'Run Query'}
    </button>
  );
}
```

## Project Structure

```
teradata-mcp-ui/
├── packages/
│   └── components/           # React component library
│       ├── src/
│       │   ├── bridge/       # MCP Bridge provider and hooks
│       │   ├── components/   # UI components (SQLEditor, etc.)
│       │   ├── primitives/   # Base UI primitives (Button, Card, etc.)
│       │   ├── theme/        # Theme provider and tokens
│       │   └── lib/          # Utilities
│       └── dist/             # Built library and HTML apps
├── server/                   # FastMCP Python server
│   └── src/
│       ├── main.py           # Server entry point
│       ├── tools/            # MCP tools (sql.py)
│       └── resources/        # MCP resources (ui.py)
└── .claude/
    └── agents/               # Quality review agents
```

## Available MCP Resources

The server exposes these UI resources:

| URI | Description |
|-----|-------------|
| `ui://sql-editor` | Interactive SQL editor |
| `ui://file-browser` | File browser |
| `ui://data-browser` | Database schema browser |
| `ui://chat-panel` | AI chat interface |

## Quality Standards

- **Test coverage:** 80% minimum required
- **Accessibility:** axe-core 0 violations
- **Bundle size:** <500KB gzipped per HTML app
- **Component size:** <400 lines (atomic design)

Run the quality checks:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm --filter @teradata-mcp-ui/components test:coverage
```

## License

Apache-2.0
