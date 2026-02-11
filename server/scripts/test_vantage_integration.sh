#!/bin/bash
# Test MCP server with vantage-mcp stdio integration

cd "$(dirname "$0")"
source venv/bin/activate

VANTAGE_BINARY="$HOME/repos/vantage-mcp/vantage-mcp"

if [ ! -f "$VANTAGE_BINARY" ]; then
    echo "✗ vantage-mcp binary not found at $VANTAGE_BINARY"
    exit 1
fi

echo "Testing MCP server with vantage-mcp stdio backend..."
echo "Note: This will fail without TD credentials, but tests the connection"
echo ""

# Send MCP requests
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 1
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"execute_sql","arguments":{"query":"SELECT 1 as test_col"}}}'
  sleep 3
} | HTTP_PORT=3007 MOCK_MODE=false VANTAGE_MCP_MODE=stdio VANTAGE_MCP_BINARY="$VANTAGE_BINARY" python -m src.main 2>&1
