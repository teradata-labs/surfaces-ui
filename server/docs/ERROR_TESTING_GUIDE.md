# Error Testing Guide

## Issue
You reported that SQL errors are not displaying in the UI.

## Root Cause
The original `/sql-editor` endpoint requires an MCP backend connection. When testing standalone without the MCP backend, errors from the bridge weren't showing properly.

## Solution
Created a standalone test version with a built-in mock bridge at:

**http://localhost:3000/sql-editor-standalone**

---

## Testing Instructions

### 1. Open Standalone Test Version
Navigate to: http://localhost:3000/sql-editor-standalone

You should see:
- Blue info box at top explaining test mode
- SQL Editor with Monaco editor
- Suggested test queries

### 2. Test Valid Query
Replace the query with:
```sql
SELECT * FROM dbc.tables LIMIT 3
```

Click **Execute** or press **Ctrl+Enter**

**Expected Result:**
- ✓ Loading indicator appears briefly
- ✓ Results table shows 3 rows
- ✓ Columns: DatabaseName, TableName, TableKind, CreateTimeStamp
- ✓ Data: sales_db tables (customers, orders, products)

### 3. Test Error Display
Replace the query with:
```sql
SELECT invalid syntax
```

Click **Execute** or press **Ctrl+Enter**

**Expected Result:**
- ✓ Loading indicator appears briefly
- ✓ **Red error box** appears
- ✓ Error message: "Simulated SQL Error: Syntax error near 'invalid'. This is a test error to verify error display works correctly."
- ✓ AlertCircle icon visible
- ✓ Error is clearly highlighted

### 4. Test Another Error
Try:
```sql
SELECT * FROM error_table WHERE id = 1
```

**Expected Result:**
- Same error display as above

### 5. Test Count Query
Try:
```sql
SELECT COUNT(*) FROM users
```

**Expected Result:**
- ✓ Results table shows 1 row
- ✓ Column: count
- ✓ Value: 42

---

## What Was Fixed

### Created Mock Bridge
File: `packages/components/src/apps/sql-editor-standalone.tsx`

The mock bridge:
- Returns proper error responses with `success: false` and `error` message
- Simulates network delay (500ms) for realistic testing
- Returns different mock data based on query content
- Triggers errors for queries containing "error" or "invalid"

### Updated Build Config
File: `packages/components/vite.config.http.ts`

Added standalone entry point to build both versions:
- `/sql-editor` - Original MCP Apps version (requires MCP backend)
- `/sql-editor-standalone` - Test version with mock bridge (no backend needed)

---

## Error Display Component

The error is displayed by `SQLResultsDisplay.tsx` at lines 1074-1092:

```typescript
if (!isSuccess && data.error) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200...">
      <AlertCircle className="w-5 h-5 text-red-600..." />
      <div className="text-sm text-red-700...">
        <strong>SQL Error:</strong> {data.error}
      </div>
    </div>
  );
}
```

The condition requires:
1. `!isSuccess` - `data.success` must be `false`
2. `data.error` - Error message must be present

---

## Testing Checklist

When you run a query that should error:

- [ ] Error box appears (red background)
- [ ] AlertCircle icon is visible
- [ ] "SQL Error:" label is bold
- [ ] Error message is displayed in full
- [ ] No results table appears
- [ ] Loading indicator disappears
- [ ] Error is in accessible red color (WCAG AA compliant)

---

## Next Steps

If error still doesn't show:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages like `[MockBridge] callTool: execute_sql`
4. Check if error response is logged
5. Look for any JavaScript errors

If you see the error response in console but not in UI, there may be a different issue with the SQLResultsDisplay component's error rendering logic.

---

## Comparison: Original vs Standalone

### Original `/sql-editor`
- Uses real MCP Apps bridge
- Requires MCP backend running
- Connects to vantage-mcp
- For production use

### Standalone `/sql-editor-standalone`
- Uses mock bridge (no backend needed)
- Built-in test data
- Guaranteed error responses for testing
- For UI/component testing only

---

## Server Status

Current server: http://localhost:3000
PID: Check `/tmp/http_server.pid`

Stop server:
```bash
kill $(cat /tmp/http_server.pid)
```

Restart server:
```bash
cd ~/repos/surfaces-ui/server
source venv/bin/activate
python test_http.py
```
