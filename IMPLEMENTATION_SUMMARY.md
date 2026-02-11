# Implementation Summary: Optional UI Server Auto-Start

## What Was Implemented

Added optional auto-start capability to vantage-mcp that spawns the surfaces-ui HTTP server as a subprocess.

## Changes Made

### 1. vantage-mcp Repository

**New File: `internal/uiserver/uiserver.go`**
- `Manager` struct to manage UI server lifecycle
- `Start()` - Spawns Python HTTP server subprocess
- `Stop()` - Gracefully shuts down subprocess
- Logging integration - captures UI server output

**Modified: `internal/mcp/config/config.go`**
- Added `UIServerMode` - Enable/disable auto-start
- Added `UIServerPath` - Path to surfaces-ui/server directory
- Added `UIServerPort` - HTTP port (default: 3000)
- Environment variables: `UI_SERVER_MODE`, `UI_SERVER_PATH`, `UI_SERVER_PORT`

**Modified: `cmd/vantage-mcp/main.go`**
- Import `uiserver` package
- Create UI Manager after MCP server
- Start UI server if mode is "auto" or "enabled"
- Graceful shutdown with 3-second timeout

**New Documentation:**
- `docs/UI_SERVER_AUTO_START.md` - Usage guide with examples
- `docs/UI_SERVER_FLEXIBILITY.md` - Framework flexibility guide

### 2. surfaces-ui Repository

**Updated: `ARCHITECTURE_DECISION.md`**
- Comprehensive architecture analysis
- Comparison of options (embedded vs separate vs third repo)
- Recommendation: Separate servers with auto-start
- Scaling dimensions analysis

**New: `IMPLEMENTATION_SUMMARY.md`** (this file)

## Architecture

### Before (Manual Start)
```
User must start TWO processes manually:
1. vantage-mcp (MCP server)
2. python -m src.main (UI server)
```

### After (Auto-Start)
```
User starts ONE process:
1. vantage-mcp

vantage-mcp automatically:
- Spawns UI server subprocess
- Manages lifecycle
- Captures logs
- Cleans up on shutdown
```

### Flow Diagram

```
┌─────────────────┐
│ Claude Desktop  │
└────────┬────────┘
         │ spawns
         ▼
┌───────────────────────────────────────┐
│ vantage-mcp (Go) - PID 1000           │
│  ├─ MCP Protocol (stdio)              │
│  │   └─ Tools: execute_sql            │
│  │   └─ Resources: ui://sql-editor    │
│  │                                     │
│  └─ UI Manager (if enabled)           │
│      │                                 │
│      ▼ spawns subprocess               │
│  ┌──────────────────────────────────┐ │
│  │ surfaces-ui (Python) - 1001  │ │
│  │  └─ HTTP: localhost:3000         │ │
│  │      └─ Serves: Monaco SQL Editor│ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

## Configuration

### Option 1: Auto-Start (Recommended for Desktop)

```json
{
  "mcpServers": {
    "vantage-mcp": {
      "command": "/path/to/vantage-mcp/bin/vantage-mcp",
      "env": {
        "TD_USER": "user",
        "TD_PASSWORD": "pass",
        "TD_DEFAULT_HOST": "host",
        "UI_SERVER_MODE": "auto",
        "UI_SERVER_PATH": "/path/to/surfaces-ui/server",
        "UI_SERVER_PORT": "3000"
      }
    }
  }
}
```

**User experience**: Configure one server, both start automatically.

### Option 2: Manual (Production/Advanced)

```json
{
  "mcpServers": {
    "vantage-mcp": {
      "command": "/path/to/vantage-mcp/bin/vantage-mcp",
      "env": {
        "TD_USER": "user",
        "TD_PASSWORD": "pass",
        "TD_DEFAULT_HOST": "host"
      }
    }
  }
}
```

Start UI server separately:
```bash
cd /path/to/surfaces-ui/server
python -m src.main
```

## Benefits

### For Desktop Users
- ✅ **Simpler**: One config, one process to start
- ✅ **Automatic**: UI server starts/stops with vantage-mcp
- ✅ **Integrated logs**: All logs in one place
- ✅ **No coordination**: Don't need to manage two processes

### For Production Users
- ✅ **Optional**: Can still deploy separately
- ✅ **Flexible**: Can scale UI servers independently
- ✅ **Backward compatible**: No breaking changes

### For Developers
- ✅ **Separation of concerns**: Each service does one thing
- ✅ **Independent releases**: Update UI without touching backend
- ✅ **Framework agnostic**: Any UI framework works
- ✅ **Technology fit**: Go for DB, Python for web serving

## Testing

### Build vantage-mcp
```bash
cd ~/repos/vantage-mcp
go build -o bin/vantage-mcp ./cmd/vantage-mcp
```

### Test Auto-Start Locally
```bash
export UI_SERVER_MODE=auto
export UI_SERVER_PATH=$HOME/repos/surfacesui/server
export UI_SERVER_PORT=3000
export TD_USER=your_username
export TD_PASSWORD=your_password
export TD_DEFAULT_HOST=your-host.clearscape.teradata.com

./bin/vantage-mcp
```

**Expected output:**
```
INFO vantage_mcp_starting version=0.1.0
INFO ui_server_started pid=12345 path=/path/to/server port=3000
INFO ui_server_output message="HTTP server running on http://localhost:3000"
```

### Test in Claude Desktop
1. Update config (already done above)
2. Restart Claude Desktop (Cmd+Q, reopen)
3. Check logs: `tail -f ~/Library/Logs/Claude/mcp*.log | grep ui_server`
4. Open new conversation
5. Ask: "Open the SQL Editor"
6. Verify Monaco editor loads
7. Execute query: `SELECT DATABASE, USER`

### Verify UI Server Running
```bash
# Should return HTML
curl http://localhost:3000/sql-editor

# Should work in browser
open http://localhost:3000/sql-editor
```

## Framework Flexibility

The auto-start feature works with **any UI framework**:

### Supported Today
- **React** (current implementation)
- **Vue** (build → copy to dist/http/)
- **Angular** (build → copy to dist/http/)
- **Svelte** (build → copy to dist/http/)
- **Plain HTML/JS** (no build needed)

### How It Works
1. **Your UI framework** → Build to static HTML/CSS/JS
2. **Copy to** `dist/http/` directory
3. **Python HTTP server** serves it
4. **vantage-mcp** auto-starts Python server
5. **User** sees your UI in Claude Desktop

### Alternative: Custom Server
Create wrapper script for your own server:
```bash
#!/bin/bash
# start-my-server.sh
cd /path/to/my-node-server
exec node server.js --port ${UI_SERVER_PORT:-3000}
```

Modify vantage-mcp to run it (one-line change in `uiserver.go`).

## Future Enhancements

### Possible Improvements
- [ ] Health check: Verify UI server responds before ready
- [ ] Auto-restart: Restart if UI server crashes
- [ ] Port detection: Auto-find available port
- [ ] Custom commands: Support any server (not just Python)
- [ ] Configuration validation: Check prerequisites before start

### Enhanced Flexibility
Could add support for arbitrary commands:
```json
{
  "UI_SERVER_MODE": "auto",
  "UI_SERVER_COMMAND": "node",
  "UI_SERVER_ARGS": "server.js,--port,3000",
  "UI_SERVER_CWD": "/path/to/node-server"
}
```

This would support Node.js, Go, Nginx, Docker, etc.

## Files Modified

### vantage-mcp
- ✅ `internal/uiserver/uiserver.go` (new)
- ✅ `internal/mcp/config/config.go` (modified)
- ✅ `cmd/vantage-mcp/main.go` (modified)
- ✅ `docs/UI_SERVER_AUTO_START.md` (new)
- ✅ `docs/UI_SERVER_FLEXIBILITY.md` (new)
- ✅ `bin/vantage-mcp` (rebuilt)

### surfaces-ui
- ✅ `ARCHITECTURE_DECISION.md` (new)
- ✅ `IMPLEMENTATION_SUMMARY.md` (new)

### Configuration
- ✅ `~/Library/Application Support/Claude/claude_desktop_config.json` (updated)

## Next Steps

1. **Test in Claude Desktop**
   - Restart Claude Desktop
   - Verify UI server auto-starts
   - Test SQL Editor functionality

2. **Documentation**
   - Update main README with auto-start instructions
   - Add troubleshooting guide

3. **Optional Enhancements**
   - Implement custom command support
   - Add health checks
   - Add auto-restart on crash

## Summary

**What we built:**
- Optional UI server auto-start in vantage-mcp
- Clean separation of concerns (MCP vs UI)
- Framework-agnostic design
- Simple desktop UX, scalable production deployment

**Key principle:**
> Make it feel like one server for desktop users, while keeping the architecture flexible for production scaling.

**Result:**
- ✅ Desktop users: One config, automatic startup
- ✅ Production users: Independent services, horizontal scaling
- ✅ Developers: Framework choice, independent releases
- ✅ Everyone: Better UX without sacrificing scalability
