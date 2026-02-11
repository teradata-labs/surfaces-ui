# SurfacesUI Server

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

## Directory Structure

```
server/
├── src/                    # Server source code
│   ├── main.py            # Main server entry point
│   ├── tools/             # MCP tools implementations
│   └── resources/         # MCP resources (UI apps)
│
├── tests/                 # Test scripts
│   ├── test_http.py       # HTTP server tests
│   ├── test_webapp_api.py # Mock API for web app testing
│   ├── test_complete.py   # Integration test suite
│   └── test_with_creds.py # Real database tests
│
├── scripts/               # Utility scripts
│   ├── test_mcp_stdio.sh  # Quick MCP stdio test
│   └── test_browser.sh    # Open in browser for manual testing
│
├── docs/                  # Documentation
│   ├── WEB_APP_INTEGRATION.md  # Web app integration guide
│   ├── EDITOR_VERSIONS_COMPARISON.md
│   ├── TEST_RESULTS.md
│   └── MANUAL_TEST_GUIDE.md
│
└── README.md              # This file
```

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

## Testing

### Run Tests

```bash
# Test HTTP server
python tests/test_http.py

# Run integration tests
python tests/test_complete.py

# Test with real database
python tests/test_with_creds.py

# Test web app with mock API
python tests/test_webapp_api.py &  # Terminal 1
python tests/test_http.py          # Terminal 2
```

See [tests/README.md](tests/README.md) for detailed test documentation.

### Manual Testing

```bash
# Start HTTP server
python tests/test_http.py

# Open in browser
./scripts/test_browser.sh
```

See [docs/MANUAL_TEST_GUIDE.md](docs/MANUAL_TEST_GUIDE.md) for step-by-step manual testing instructions.

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "/path/to/venv/bin/python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/surfaces-ui/server",
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

Access via HTTP server (default: http://localhost:3000):

- **SQL Editor**: `/sql-editor` - MCP Apps version (requires MCP backend)
- **SQL Editor (Standalone)**: `/sql-editor-standalone` - Testing version (mock data)
- **SQL Editor (Web App)**: `/sql-editor-webapp` - Web app version (REST API)

See [docs/EDITOR_VERSIONS_COMPARISON.md](docs/EDITOR_VERSIONS_COMPARISON.md) for details on each version.

## Integration

### Using in Web Applications

The SQL Editor can be integrated into any web application using a REST API backend.

See [docs/WEB_APP_INTEGRATION.md](docs/WEB_APP_INTEGRATION.md) for:
- Backend API requirements
- Python/Node.js/Go examples
- Security considerations
- Deployment guide

### Using as React Component

```bash
npm install @surfaces-ui/components
```

See project root README for React component usage.

## Development

### Project Structure

```
surfaces-ui/
├── packages/
│   └── components/        # React component library
│       ├── src/
│       │   ├── apps/      # HTML app entry points
│       │   ├── bridge/    # MCP bridge implementations
│       │   └── components/# UI components
│       └── dist/http/     # Built apps for HTTP serving
│
└── server/                # This directory
    ├── src/               # Server code
    ├── tests/             # Test scripts
    ├── scripts/           # Utility scripts
    └── docs/              # Documentation
```

### Build Workflow

```bash
# 1. Make changes to components
cd packages/components
vim src/components/sql-editor/SQLEditor.tsx

# 2. Build for HTTP serving
pnpm build:http

# 3. Test with HTTP server
cd ../../server
python tests/test_http.py

# 4. Open in browser
open http://localhost:3000/sql-editor-standalone
```

## Documentation

- [tests/README.md](tests/README.md) - Test scripts documentation
- [scripts/README.md](scripts/README.md) - Utility scripts
- [docs/README.md](docs/README.md) - Full documentation index
- [docs/WEB_APP_INTEGRATION.md](docs/WEB_APP_INTEGRATION.md) - Web app integration guide
- [docs/EDITOR_VERSIONS_COMPARISON.md](docs/EDITOR_VERSIONS_COMPARISON.md) - Version comparison
- [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) - Integration test results
- [docs/REAL_DB_TEST_RESULTS.md](docs/REAL_DB_TEST_RESULTS.md) - Real database test results

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Module Not Found

```bash
# Ensure venv is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### vantage-mcp Not Found

```bash
# Check if binary exists
ls -l ~/repos/vantage-mcp/vantage-mcp

# Set correct path in config
export VANTAGE_MCP_BINARY=/path/to/vantage-mcp
```

## License

Apache-2.0
