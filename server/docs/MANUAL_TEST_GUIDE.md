# Manual Testing Guide - SQL Editor Component

## Server Status: ✅ RUNNING

**URL:** http://localhost:3000/sql-editor

The HTTP server is currently running and serving the SQL Editor component.

---

## How to Test

### 1. Open SQL Editor in Browser

Open your web browser and navigate to:
```
http://localhost:3000/sql-editor
```

### 2. What You Should See

✅ **SQL Editor Interface** with:
- Monaco Editor (VS Code-style editor)
- SQL syntax highlighting
- Line numbers
- Execute button
- Results panel

✅ **Monaco Editor Features:**
- Syntax highlighting for SQL
- IntelliSense / autocomplete (try typing `SELECT` and press Ctrl+Space)
- Multi-cursor editing (hold Cmd/Ctrl and click)
- Find/replace (Cmd/Ctrl + F)
- Keyboard shortcut: Ctrl+Enter to execute query

### 3. Test Query Execution (Mock Mode)

The server is running in **mock mode**, so queries return sample data without hitting a real database.

Try these queries:

**Query 1: Simple SELECT**
```sql
SELECT * FROM dbc.tables LIMIT 3
```
Expected: Returns 3 rows of mock table data (sales_db tables)

**Query 2: Count Query**
```sql
SELECT COUNT(*) FROM users
```
Expected: Returns count = 42

**Query 3: General SELECT**
```sql
SELECT id, name, value FROM items
```
Expected: Returns 5 rows of mock item data

### 4. Visual Checks

#### Monaco Editor Loading
- [ ] Editor has dark theme background
- [ ] SQL keywords are colored (SELECT, FROM, WHERE)
- [ ] Line numbers visible on left
- [ ] Can type and edit code
- [ ] Autocomplete appears when typing
- [ ] Bottom-right shows "Ctrl+Enter to execute" hint

#### UI Components
- [ ] Title bar shows "SQL Editor"
- [ ] Execute button is visible and clickable
- [ ] Results table displays below editor
- [ ] Results show column headers
- [ ] Results show data rows
- [ ] Loading states appear during execution

#### Responsiveness
- [ ] Editor resizes with window
- [ ] Scrolling works in editor
- [ ] Scrolling works in results table

### 5. Browser Console Check

Open browser DevTools (F12) and check Console tab:
- [ ] No errors about missing assets
- [ ] No 404 errors for JavaScript/CSS files
- [ ] Monaco Editor workers load correctly

Look for messages like:
```
✓ Monaco Editor loaded
✓ Assets loaded from /assets/
```

### 6. Network Tab Check

In DevTools Network tab, verify:
- [ ] `sql-editor.html` - 200 OK
- [ ] `sql-editor-*.js` - 200 OK (~1.6MB)
- [ ] `sql-editor-*.css` - 200 OK (~30KB)
- [ ] No failed requests

### 7. Test with Real Database (Optional)

To test with a real Teradata database:

1. Stop the current server:
```bash
kill $(cat /tmp/http_server.pid)
```

2. Start with real credentials:
```bash
cd ~/repos/surfaces-ui/server
source venv/bin/activate
MOCK_MODE=false \
VANTAGE_MCP_MODE=stdio \
VANTAGE_MCP_BINARY=~/repos/vantage-mcp/vantage-mcp \
TD_USER=your_user \
TD_PASSWORD=your_pass \
TD_HOST=your_host \
python -m src.main
```

3. Test with real query:
```sql
SELECT DATABASE, USER, CURRENT_TIMESTAMP
```

---

## Troubleshooting

### Editor Not Loading
- Check browser console for errors
- Verify assets are loading: http://localhost:3000/assets/sql-editor-B_A_GBse.js
- Try hard refresh: Cmd/Ctrl + Shift + R

### Query Not Executing
- Check browser console for errors
- Verify you're in mock mode (mock data should return immediately)
- Check Network tab for failed requests

### Monaco Features Not Working
- Verify JavaScript bundle loaded completely (1.6MB)
- Check for Content Security Policy errors in console
- Try in incognito/private window

### Port Already in Use
```bash
# Kill existing server
lsof -ti:3000 | xargs kill -9
# Restart server
cd ~/repos/surfaces-ui/server && python test_http.py
```

---

## Expected Performance

- **Page Load:** < 2 seconds
- **Monaco Editor Init:** < 1 second
- **Query Execution (mock):** < 100ms
- **Query Execution (real DB):** 1-3 seconds

---

## Server Control

### Check if Running
```bash
lsof -i:3000 | grep LISTEN
```

### View Logs
```bash
tail -f /tmp/http_test_server.log
```

### Stop Server
```bash
kill $(cat /tmp/http_server.pid)
```

### Restart Server
```bash
cd ~/repos/surfaces-ui/server
source venv/bin/activate
python test_http.py
```

---

## Screenshots to Capture

If you're documenting this:
1. SQL Editor with Monaco syntax highlighting
2. Autocomplete dropdown
3. Query execution with results table
4. Multi-cursor editing
5. Find/replace dialog
6. Browser DevTools showing successful asset loading

---

## Current Server Info

- **Process ID:** Check `/tmp/http_server.pid`
- **Port:** 3000
- **Mode:** Mock (no real database)
- **Assets Path:** `packages/components/dist/http/`
- **Logs:** `/tmp/http_test_server.log`
