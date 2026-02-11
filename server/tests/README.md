# Test Scripts

## Overview

Test scripts for validating the MCP server, HTTP server, and integration with vantage-mcp.

## Test Scripts

### HTTP Server Tests

#### `test_http.py`
**Purpose:** Standalone HTTP server for testing UI apps without MCP backend.

**Usage:**
```bash
python tests/test_http.py
```

**What it does:**
- Starts HTTP server on port 3000 (or $HTTP_PORT)
- Serves UI apps from `packages/components/dist/http/`
- No MCP protocol - just static file serving
- Perfect for UI development and testing

**Endpoints:**
- `GET /{app}` - Serve app HTML (e.g., `/sql-editor`)
- `GET /assets/{path}` - Serve JS/CSS/workers

---

#### `test_webapp_api.py`
**Purpose:** Mock REST API server for testing the web app version of SQL Editor.

**Usage:**
```bash
python tests/test_webapp_api.py
```

**What it does:**
- Starts REST API server on port 3001
- Provides `POST /api/sql/execute` endpoint
- Returns mock SQL results
- CORS enabled for browser testing

**Use with:**
- SQL Editor Web App version: http://localhost:3000/sql-editor-webapp
- Requires HTTP server also running on port 3000

---

### Integration Tests

#### `test_complete.py`
**Purpose:** Complete integration test suite for all MCP server modes.

**Usage:**
```bash
cd server
source venv/bin/activate
python tests/test_complete.py
```

**Tests:**
1. Mock mode (no backend)
2. vantage-mcp stdio integration

**Exit codes:**
- 0 = All tests passed
- 1 = Some tests failed

---

#### `test_integration.py`
**Purpose:** Earlier version of integration tests (deprecated, use `test_complete.py`).

**Status:** Deprecated - kept for reference only.

---

#### `test_with_creds.py`
**Purpose:** Test with real Teradata database credentials.

**Usage:**
```bash
cd server
source venv/bin/activate

# Ensure credentials are in environment
export TD_USER=your_user
export TD_PASSWORD=your_password
export TD_HOST=your_host

python tests/test_with_creds.py
```

**What it tests:**
- Real SQL query execution against Teradata
- MCP stdio connection to vantage-mcp
- Database connectivity
- Query result formatting

**Requires:**
- vantage-mcp binary at `~/repos/vantage-mcp/vantage-mcp`
- Valid Teradata credentials
- Network access to Teradata database

---

## Test Utilities

### Scripts (in `../scripts/`)

#### `test_mcp_stdio.sh`
**Purpose:** Quick test of MCP stdio protocol with mock data.

**Usage:**
```bash
cd server
./scripts/test_mcp_stdio.sh
```

**What it does:**
- Sends JSON-RPC requests via stdin
- Tests: initialize, tools/list, tools/call, resources/list
- Uses mock mode (no database needed)

---

#### `test_vantage_integration.sh`
**Purpose:** Test MCP server with vantage-mcp stdio backend.

**Usage:**
```bash
cd server
./scripts/test_vantage_integration.sh
```

**What it tests:**
- MCP initialize with vantage-mcp
- SQL execution via vantage-mcp
- May fail without credentials (expected)

---

#### `test_browser.sh`
**Purpose:** Launch SQL Editor in browser for manual testing.

**Usage:**
```bash
cd server
./scripts/test_browser.sh
```

**What it does:**
- Checks if HTTP server is running
- Tests endpoints
- Opens SQL Editor in browser
- Prints manual testing checklist

---

## Running Tests

### Quick Start

```bash
# From project root
cd server
source venv/bin/activate

# Test HTTP server only
python tests/test_http.py

# Test complete MCP integration
python tests/test_complete.py

# Test with real database
python tests/test_with_creds.py

# Test web app with mock API
python tests/test_webapp_api.py &  # Terminal 1
python tests/test_http.py          # Terminal 2
# Open: http://localhost:3000/sql-editor-webapp
```

### Full Test Suite

```bash
#!/bin/bash
# Run all tests

cd server
source venv/bin/activate

echo "=== HTTP Server Test ==="
python tests/test_http.py &
HTTP_PID=$!
sleep 2
curl -s http://localhost:3000/sql-editor | grep -q "SQL Editor" && echo "✓ PASS" || echo "✗ FAIL"
kill $HTTP_PID

echo "=== MCP Integration Test ==="
python tests/test_complete.py

echo "=== Real Database Test ==="
if [ -n "$TD_USER" ]; then
    python tests/test_with_creds.py
else
    echo "⊘ SKIP (no credentials)"
fi

echo "=== Done ==="
```

---

## Test Environments

### Mock Mode
- No backend required
- Returns hardcoded data
- Perfect for UI testing
- Used by: `test_complete.py`, `test_mcp_stdio.sh`

### stdio Mode with vantage-mcp
- Requires vantage-mcp binary
- Communicates via stdin/stdout
- Can use real or mock database
- Used by: `test_complete.py`, `test_with_creds.py`

### HTTP Mode (Web App)
- Requires REST API server
- Standard HTTP requests
- CORS enabled
- Used by: `test_webapp_api.py`

---

## Troubleshooting

### Port Already in Use
```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9

# Kill processes on port 3001
lsof -ti:3001 | xargs kill -9
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

# Build if needed
cd ~/repos/vantage-mcp
just build
```

### Database Connection Failed
```bash
# Verify credentials
echo $TD_USER
echo $TD_HOST

# Test network connectivity
ping $TD_HOST

# Check vantage-mcp directly
~/repos/vantage-mcp/vantage-mcp
```

---

## CI/CD Integration

These tests can be run in CI pipelines:

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    cd server
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    python tests/test_complete.py
```

---

## Test Coverage

| Component | Test Script | Coverage |
|-----------|-------------|----------|
| HTTP Server | `test_http.py` | ✓ Basic serving |
| MCP stdio | `test_complete.py` | ✓ Protocol, tools, resources |
| vantage-mcp | `test_with_creds.py` | ✓ Integration, real DB |
| Web App API | `test_webapp_api.py` | ✓ REST endpoint |
| UI Components | Browser tests | ⊘ Manual only |

---

## Future Enhancements

- [ ] Automated UI tests with Playwright/Selenium
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Error injection tests
- [ ] Security testing
- [ ] API contract tests
