# Utility Scripts

## Overview

Helper scripts for testing and development.

## Available Scripts

### `test_mcp_stdio.sh`
Test MCP stdio protocol with mock data.

**Usage:**
```bash
./scripts/test_mcp_stdio.sh
```

**What it does:**
- Sends JSON-RPC requests via stdin
- Tests initialize, tools/list, tools/call, resources/list
- Uses mock mode (no database)

---

### `test_vantage_integration.sh`
Test MCP server with vantage-mcp backend.

**Usage:**
```bash
./scripts/test_vantage_integration.sh
```

**Requirements:**
- vantage-mcp binary at `~/repos/vantage-mcp/vantage-mcp`
- TD_* environment variables (optional)

---

### `test_browser.sh`
Launch SQL Editor in browser for manual testing.

**Usage:**
```bash
./scripts/test_browser.sh
```

**What it does:**
- Verifies HTTP server is running
- Tests endpoints
- Opens browser
- Shows manual testing checklist

---

## Script Permissions

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

---

## Adding New Scripts

When creating new utility scripts:

1. Add to this directory
2. Make executable: `chmod +x scripts/your-script.sh`
3. Add documentation here
4. Use consistent naming: `action_target.sh`

Examples:
- `test_*.sh` - Testing utilities
- `start_*.sh` - Server startup scripts
- `build_*.sh` - Build utilities
- `deploy_*.sh` - Deployment scripts
