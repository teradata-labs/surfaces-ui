#!/bin/bash
# Test SQL Editor in browser

echo "Testing SQL Editor Component in Browser"
echo "========================================"
echo ""

# Check if server is running
if ! lsof -i:3000 | grep -q LISTEN; then
    echo "❌ Server is not running on port 3000"
    echo ""
    echo "Start the server with:"
    echo "  cd ~/repos/teradata-mcp-ui/server"
    echo "  python test_http.py"
    exit 1
fi

echo "✅ Server is running on port 3000"
echo ""

# Test endpoints
echo "Testing Endpoints:"
echo "------------------"

# Test HTML
if curl -s http://localhost:3000/sql-editor | grep -q "SQL Editor"; then
    echo "✓ SQL Editor HTML loads"
else
    echo "✗ SQL Editor HTML failed"
fi

# Test JS bundle
JS_SIZE=$(curl -s -I http://localhost:3000/assets/sql-editor-B_A_GBse.js | grep -i content-length | awk '{print $2}' | tr -d '\r')
if [ ! -z "$JS_SIZE" ]; then
    JS_MB=$(echo "scale=2; $JS_SIZE / 1048576" | bc)
    echo "✓ JavaScript bundle loads (${JS_MB}MB)"
else
    echo "✗ JavaScript bundle failed"
fi

# Test CSS bundle
if curl -s -I http://localhost:3000/assets/sql-editor-Dh0nguYx.css | grep -q "200 OK"; then
    echo "✓ CSS bundle loads"
else
    echo "✗ CSS bundle failed"
fi

echo ""
echo "Opening in browser..."
echo "--------------------"
open http://localhost:3000/sql-editor

echo ""
echo "Manual Testing Checklist:"
echo "-------------------------"
echo "□ Monaco Editor loads with dark theme"
echo "□ SQL syntax highlighting works (SELECT, FROM are colored)"
echo "□ Line numbers visible"
echo "□ Type some SQL and verify autocomplete appears"
echo "□ Click Execute button or press Ctrl+Enter"
echo "□ Results table appears with mock data"
echo "□ Try: SELECT * FROM dbc.tables LIMIT 3"
echo "□ Verify 3 rows appear in results"
echo "□ Check browser console (F12) for errors"
echo ""
echo "View test guide: server/MANUAL_TEST_GUIDE.md"
echo ""
echo "Server logs: tail -f /tmp/http_test_server.log"
echo "Stop server: kill $(cat /tmp/http_server.pid 2>/dev/null || echo 'PID_FILE_MISSING')"
