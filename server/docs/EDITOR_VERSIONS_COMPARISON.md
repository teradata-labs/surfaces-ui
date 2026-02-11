# SQL Editor Versions Comparison

## Two Versions Available

### 1. MCP Apps Version (`/sql-editor`)
**File:** `src/apps/sql-editor.tsx`
**URL:** http://localhost:3000/sql-editor

### 2. Standalone Test Version (`/sql-editor-standalone`)
**File:** `src/apps/sql-editor-standalone.tsx`
**URL:** http://localhost:3000/sql-editor-standalone

---

## Key Differences

### Backend Connection

| Feature | MCP Version | Standalone Version |
|---------|-------------|-------------------|
| **Backend** | Real MCP Apps Bridge | Mock Bridge (built-in) |
| **Data Source** | vantage-mcp → Teradata Database | Hardcoded mock data |
| **Communication** | MCP protocol via ext-apps | In-memory (no network) |
| **Requires Server** | Yes - MCP backend running | No - works standalone |

### MCP Version Backend Flow
```
User runs query
    ↓
Monaco Editor
    ↓
McpAppsBridge (from @modelcontextprotocol/ext-apps)
    ↓
MCP Protocol (JSON-RPC)
    ↓
Claude Desktop / MCP Host
    ↓
surfaces-ui Python server
    ↓
vantage-mcp subprocess (stdio)
    ↓
Teradata Database
    ↓
Results back through chain
```

### Standalone Version Flow
```
User runs query
    ↓
Monaco Editor
    ↓
MockBridge (in-memory)
    ↓
if query.includes('error'): return mock error
else: return mock data
    ↓
Results displayed immediately
```

---

## When to Use Each

### Use MCP Version (`/sql-editor`)

✅ **Production use cases:**
- Deploying to Claude Desktop
- Real database queries
- Integration with MCP ecosystem
- Multi-tool workflows

✅ **Requirements:**
- MCP backend server running
- vantage-mcp configured
- Teradata credentials
- Network access to database

✅ **Features:**
- Real query execution
- Actual database results
- Error messages from database
- Full SQL support
- Streaming results (if implemented)

### Use Standalone Version (`/sql-editor-standalone`)

✅ **Development/Testing use cases:**
- UI/UX testing
- Component development
- Error state testing
- Visual QA
- Demo/presentation mode
- No backend needed

✅ **Requirements:**
- Just HTTP server
- No database needed
- No credentials needed

✅ **Features:**
- Instant feedback (no network delay)
- Predictable test data
- Controlled error scenarios
- Safe for demos

---

## Technical Differences

### Bridge Implementation

#### MCP Version (`sql-editor.tsx`)
```typescript
import { McpAppsBridge } from '../bridge/McpAppsBridge';

// Real bridge using @modelcontextprotocol/ext-apps
const bridge = new McpAppsBridge();

// Connects to actual MCP host (Claude Desktop)
bridge.connect();

// Real tool calls via MCP protocol
await bridge.callTool('execute_sql', { query, connection_id });
```

#### Standalone Version (`sql-editor-standalone.tsx`)
```typescript
class MockBridge {
  async callTool(name: string, args: Record<string, unknown>) {
    // No network - just return mock data
    if (query.includes('error')) {
      return { success: false, error: 'Mock error' };
    }
    return { success: true, data: mockData };
  }
}

const mockBridge = new MockBridge();
```

### Data Format

Both versions return the same data format:
```typescript
{
  success: boolean;
  columns: string[];
  data: Array<Record<string, unknown>>;
  row_count: number;
  error?: string;
}
```

This ensures the UI component (`SQLEditor`) works identically with both bridges.

---

## Mock Bridge Behavior

The standalone version has hardcoded responses:

### 1. Error Queries
Any query containing "error" or "invalid":
```sql
SELECT invalid syntax
SELECT * FROM error_table
```
**Returns:**
```json
{
  "success": false,
  "error": "Simulated SQL Error: Syntax error near 'invalid'..."
}
```

### 2. Table List Query
Query containing "dbc.tables":
```sql
SELECT * FROM dbc.tables LIMIT 3
```
**Returns:**
```json
{
  "success": true,
  "columns": ["DatabaseName", "TableName", "TableKind", "CreateTimeStamp"],
  "data": [
    {"DatabaseName": "sales_db", "TableName": "customers", ...},
    {"DatabaseName": "sales_db", "TableName": "orders", ...},
    {"DatabaseName": "sales_db", "TableName": "products", ...}
  ],
  "row_count": 3
}
```

### 3. Count Query
Query containing "count":
```sql
SELECT COUNT(*) FROM users
```
**Returns:**
```json
{
  "success": true,
  "columns": ["count"],
  "data": [{"count": 42}],
  "row_count": 1
}
```

### 4. Default Query
Any other query:
```sql
SELECT * FROM anything
```
**Returns:** 5 rows of mock item data

---

## Component Compatibility

Both versions use the **exact same** `SQLEditor` component:
- Same Monaco Editor
- Same results display
- Same chart visualizations
- Same toolbar
- Same error handling

The only difference is the **bridge** that provides data.

---

## Context Property

### MCP Version
```tsx
<SQLEditor context="mcp-apps" ... />
```
- Enables polling for `get_last_result`
- Uses `bridge.openLink()` for external URLs
- Expects MCP params from host

### Standalone Version
```tsx
<SQLEditor context="web" ... />
```
- No polling
- Uses `window.open()` for links
- No MCP params expected

---

## File Structure

```
packages/components/src/apps/
├── sql-editor.html              ← MCP version HTML
├── sql-editor.tsx               ← MCP version (real bridge)
├── sql-editor-standalone.html   ← Standalone HTML
└── sql-editor-standalone.tsx    ← Standalone (mock bridge)
```

Both get built to:
```
dist/http/
├── sql-editor.html              ← Production
├── sql-editor-standalone.html   ← Testing
└── assets/
    ├── sql-editor-*.js
    ├── sql-editor-standalone-*.js
    └── tokens-*.css (shared)
```

---

## When Claude Desktop Uses It

When you configure Claude Desktop with the MCP server:

```json
{
  "mcpServers": {
    "teradata-ui": {
      "command": "python",
      "args": ["-m", "src.main"],
      "env": { "HTTP_PORT": "3000" }
    }
  }
}
```

Claude will:
1. Launch the Python MCP server
2. HTTP server starts on port 3000
3. When a tool returns `ui://sql-editor` resource
4. Claude Desktop fetches: `http://localhost:3000/sql-editor` ← **MCP Version**
5. The HTML loads `McpAppsBridge`
6. Bridge connects back to Claude Desktop via ext-apps protocol
7. Real queries execute through the full chain

The standalone version is **never used** in this flow - it's only for local testing.

---

## Summary Table

| Aspect | MCP Version | Standalone Version |
|--------|-------------|-------------------|
| **Purpose** | Production | Testing/Demo |
| **Bridge** | McpAppsBridge | MockBridge |
| **Backend** | Real (vantage-mcp) | Mock (in-memory) |
| **Data** | Live from Teradata | Hardcoded |
| **Errors** | Real DB errors | Simulated errors |
| **Network** | Yes | No |
| **Credentials** | Required | Not needed |
| **Use in Claude** | Yes | No |
| **Development** | Need full stack | Just HTTP server |

---

## Development Workflow

### Testing UI Changes

1. **Edit Component:**
   ```bash
   vim packages/components/src/components/sql-editor/SQLEditor.tsx
   ```

2. **Build:**
   ```bash
   pnpm --filter @surfaces-ui/components build:http
   ```

3. **Test Standalone:**
   Open http://localhost:3000/sql-editor-standalone
   - Quick feedback
   - No backend needed
   - Test error states easily

4. **Test MCP Version:**
   ```bash
   # Start full MCP server
   cd server
   source venv/bin/activate
   python -m src.main
   ```
   - Use with Claude Desktop
   - Test real queries
   - Verify full integration

### Best Practice

Use **standalone** for:
- Component styling
- Error message display
- Loading states
- UI interactions
- Chart configurations

Use **MCP** for:
- Query execution logic
- Database connectivity
- Real error handling
- Performance testing
- End-to-end validation

---

## Future Enhancements

The standalone version could be extended with:
- More complex mock scenarios
- Configurable mock data
- Simulated network delays
- Error rate simulation
- Large dataset testing

But for now, it's a simple test harness for UI development.
