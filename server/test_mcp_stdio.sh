#!/bin/bash
# Test MCP server via stdio

cd "$(dirname "$0")"
source venv/bin/activate

# Send multiple JSON-RPC requests
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute_sql","arguments":{"query":"SELECT * FROM dbc.tables LIMIT 3"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}'
  sleep 0.5
} | HTTP_PORT=3006 MOCK_MODE=true python -m src.main 2>&1
