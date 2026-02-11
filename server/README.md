# Teradata MCP UI Server

FastMCP server that provides:
- **MCP Protocol** (stdio): Tools and resources for Claude Desktop
- **HTTP Server**: Serves UI apps with full Monaco Editor support

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Build UI Apps

```bash
cd ../packages/components
pnpm build:http
```

### 3. Start Server

```bash
# From server/ directory
source venv/bin/activate
python -m src.main
```

The server will start:
- **MCP server** (stdio): For Claude Desktop communication
- **HTTP server**: http://localhost:3000 (for serving UI apps)

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `HTTP_PORT` | HTTP server port | `3000` |
| `MOCK_MODE` | Use mock data | `true` |
| `VANTAGE_MCP_MODE` | vantage-mcp connection mode (`stdio` or `http`) | `stdio` |
| `VANTAGE_MCP_BINARY` | Path to vantage-mcp binary (stdio mode) | (empty) |
| `VANTAGE_MCP_ADDR` | vantage-mcp HTTP address (http mode) | (empty) |
| `TD_USER` | Teradata username | (empty) |
| `TD_PASSWORD` | Teradata password | (empty) |
| `TD_HOST` | Teradata host | (empty) |

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "/path/to/venv/bin/python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/teradata-mcp-ui/server",
      "env": {
        "MOCK_MODE": "false",
        "VANTAGE_MCP_MODE": "stdio",
        "VANTAGE_MCP_BINARY": "/path/to/vantage-mcp",
        "HTTP_PORT": "3000",
        "TD_USER": "your-username",
        "TD_PASSWORD": "your-password",
        "TD_HOST": "vantage.example.com"
      }
    }
  }
}
```

## Testing HTTP Server

```bash
# Test SQL Editor page
curl http://localhost:3000/sql-editor

# Test assets
curl -I http://localhost:3000/assets/sql-editor-*.js
```

## Architecture

```
┌─────────────────┐
│ Claude Desktop  │
└────────┬────────┘
         │ stdio
         │
┌────────▼─────────────────────────────────┐
│  FastMCP Server (main.py)                │
│  ┌──────────────┬────────────────────┐   │
│  │ MCP Protocol │   HTTP Server      │   │
│  │  (stdio)     │   (port 3000)      │   │
│  └──────┬───────┴────────┬───────────┘   │
└─────────┼────────────────┼───────────────┘
          │                │
          │                │ serve UI apps
          │                ▼
          │         ┌─────────────────┐
          │         │ dist/http/      │
          │         │ - sql-editor.html
          │         │ - assets/*.js   │
          │         │ - assets/*.css  │
          │         └─────────────────┘
          │
          ▼ tools/call
   ┌──────────────────┐
   │  vantage-mcp     │
   │  (Go binary)     │
   └──────────────────┘
```

## UI Apps Available

- **SQL Editor**: http://localhost:3000/sql-editor
  - Monaco Editor with SQL syntax highlighting
  - Query execution and visualization
  - Full VS Code editing features

## Development

```bash
# Watch mode for UI development
cd ../packages/components
pnpm dev

# Build for HTTP serving
pnpm build:http

# Restart server to pick up changes
cd ../server
source venv/bin/activate
python -m src.main
```
