# External Integrations

**Analysis Date:** 2026-02-15

## APIs & External Services

**Teradata Vantage (SQL Execution):**
- Service: Teradata Vantage database cluster
- What it's used for: SQL query execution, data retrieval
- SDK/Client: vantage-mcp (external binary/service, not in this repo)
- Auth: `TD_USER`, `TD_PASSWORD`, `TD_HOST` (environment variables in `server/.env`)
- Protocol: Either HTTP via httpx or stdio JSON-RPC subprocess
- Implementation file: `server/src/tools/sql.py` (`execute_sql_tool`, `StdioMcpClient`)

**MCP Host (Claude, other MCP clients):**
- Service: Model Context Protocol host environment
- What it's used for: Tool invocation, resource serving, render data push
- SDK/Client: `@modelcontextprotocol/ext-apps` (npm package)
- Auth: None (postMessage-based, same-origin or configurable)
- Protocol: JSON-RPC via postMessage in browser; stdio JSON-RPC on backend
- Implementation files:
  - Frontend: `packages/components/src/bridge/McpBridge.ts`, `McpAppsBridge.ts`
  - Backend: `server/src/main.py` (stdio_server from mcp package)

## Data Storage

**Databases:**
- Teradata Vantage (remote)
  - Type: Columnar OLAP database
  - Connection: Via TD_USER/TD_PASSWORD to TD_HOST
  - Client: vantage-mcp binary (external)
  - No direct ORM - SQL executed as raw strings via vantage-mcp

**File Storage:**
- Local filesystem only
  - `server/` serves built HTML apps from `packages/components/dist/apps/` directory
  - No cloud storage integration

**Caching:**
- None - all queries execute fresh against Vantage
- Components may cache render data in React state

## Authentication & Identity

**Auth Provider:**
- Custom - No centralized auth provider
- Teradata uses database credentials (username/password)
- Credentials passed via environment variables, not token-based
- MCP host authenticates via postMessage origin validation (configurable in bridge)

**Implementation:**
- Backend passes `TD_USER`, `TD_PASSWORD`, `TD_LOGMECH` to vantage-mcp subprocess
- Frontend uses optional `targetOrigin` config in `McpBridgeConfig` for postMessage origin check
- No JWT, OAuth, or session management

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logs:**
- Backend logs to stderr via Python logging
- Frontend console logs for debugging (no external service)
- Log level controlled by `LOG_LEVEL` env var (default: info)
- No centralized logging aggregation

## CI/CD & Deployment

**Hosting:**
- No built-in hosting - Components are library/apps served via:
  - npm/pnpm for React component library
  - Python FastMCP server (user-deployed)
  - Static HTML bundles via HTTP server in FastMCP

**Deployment:**
- Frontend: Published as npm package (`@surfacesui/components`)
- Backend: Deployed as Python package or standalone FastMCP server
- Apps: Build single-file HTML bundles, serve via HTTP from `packages/components/dist/apps/`

**CI Pipeline:**
- None detected in this repo
- `.github/workflows/` directory exists but no workflow files present

## Environment Configuration

**Required env vars (server/):**
- `TD_USER` - Teradata username
- `TD_PASSWORD` - Teradata password
- `TD_HOST` - Teradata host (e.g., host.clearscape.teradata.com)
- `VANTAGE_MCP_MODE` - "stdio" or "http" (default: stdio)
- `VANTAGE_MCP_BINARY` - Path to vantage-mcp binary (stdio mode only)

**Optional env vars:**
- `TD_LOGMECH` - Teradata logon mechanism (default: TD2)
- `VANTAGE_MCP_ADDR` - HTTP endpoint for vantage-mcp (http mode only)
- `HTTP_PORT` - Port for serving HTML apps (default: 3000)
- `MOCK_MODE` - Return mock data instead of querying (default: true for safety)
- `HTTP_ONLY` - Run HTTP-only without MCP stdio (default: false)
- `LOG_LEVEL` - Python logging level (default: info)

**Secrets location:**
- `.env` file in `server/` directory (template: `.env.example`)
- Never committed to git (in `.gitignore`)
- Credentials passed as environment variables to vantage-mcp subprocess

## Webhooks & Callbacks

**Incoming:**
- None - No incoming webhooks

**Outgoing:**
- None - No outgoing webhooks
- MCP host can push render data via postMessage (e.g., theme changes, toolInput updates)
- Components listen via `onDataPush` hook on McpBridge

## Communication Patterns

**Frontend → Backend:**
- postMessage to MCP host (not direct HTTP)
- Components use `useMcpBridge().callTool()` to invoke tools
- MCP host translates to JSON-RPC `tools/call` to FastMCP server
- Example: SQL Editor calls `execute_sql` tool with query and connection_id

**Backend → Frontend:**
- postMessage from MCP host to component iframe
- Message types: `tool_result`, `stream_chunk`, `stream_end`, `render_data`, `error`
- Streaming support via `stream: true` param, chunked via `stream_chunk` messages

**Backend → Vantage MCP:**
- Stdio mode: JSON-RPC via subprocess stdin/stdout
  - Client: `StdioMcpClient` spawns vantage-mcp binary
  - Calls `teradata_execute_sql` tool with `sql` argument
- HTTP mode: POST to `VANTAGE_MCP_ADDR/execute` with `{ query, connection_id }`
  - Client: httpx.AsyncClient for proxying

## Response Format Normalization

**Vantage MCP → SurfacesUI:**
Input format (from vantage-mcp):
```json
{
  "columns": ["col1", "col2"],
  "rows": [["val1", "val2"]]
}
```

Output format (surfacesui expected):
```json
{
  "success": true,
  "columns": ["col1", "col2"],
  "data": [{"col1": "val1", "col2": "val2"}],
  "row_count": 1
}
```

Transformation in `server/src/tools/sql.py` (`_normalize_result` function).

## Mock Mode

**Purpose:** Development/testing without live Teradata connection

**Behavior:**
- Enabled by default (`MOCK_MODE=true`)
- Returns realistic mock data based on query pattern
- SELECT statements return sample tables
- DDL/DML statements return success with rows_affected
- Does not connect to vantage-mcp

**Sample queries mocked:**
- `SELECT COUNT(*)` → `[{"count": 42}]`
- `SELECT FROM dbc.tables` → List of sample tables
- Generic SELECT → Sample 5-row dataset with id, name, value, category, date
- INSERT/UPDATE/DELETE/CREATE/DROP → Success message with rows_affected

---

*Integration audit: 2026-02-15*
