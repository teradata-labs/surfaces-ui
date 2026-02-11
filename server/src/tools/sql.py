"""SQL execution tool for the MCP server."""

import asyncio
import json
import logging
import os
import sys
from typing import Optional

import httpx
from mcp.types import Tool

logger = logging.getLogger(__name__)

# Singleton stdio client to maintain connection across calls
_stdio_client: Optional["StdioMcpClient"] = None


def get_sql_tool_definition() -> Tool:
    """Get the SQL tool definition for MCP with UI metadata."""
    return Tool(
        name="execute_sql",
        description="Execute SQL queries against Teradata Vantage. Returns results as JSON with columns and data arrays. Opens an interactive SQL editor UI.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The SQL query to execute",
                },
                "connection_id": {
                    "type": "string",
                    "description": "Optional connection identifier for multi-tenant scenarios",
                },
            },
            "required": ["query"],
        },
    )


class StdioMcpClient:
    """MCP client that communicates with vantage-mcp via stdio JSON-RPC."""

    def __init__(self, binary_path: str, env: Optional[dict] = None):
        self.binary_path = binary_path
        self.env = env or {}
        self.process: Optional[asyncio.subprocess.Process] = None
        self._request_id = 0
        self._lock = asyncio.Lock()
        self._initialized = False

    async def start(self) -> None:
        """Start the vantage-mcp subprocess."""
        if self.process is not None:
            return

        # Merge environment with current environment
        full_env = os.environ.copy()
        full_env.update(self.env)

        self.process = await asyncio.create_subprocess_exec(
            self.binary_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=full_env,
        )
        logger.info(f"Started vantage-mcp process (PID: {self.process.pid})")

    async def stop(self) -> None:
        """Stop the vantage-mcp subprocess."""
        if self.process is not None:
            self.process.terminate()
            await self.process.wait()
            self.process = None
            self._initialized = False
            logger.info("Stopped vantage-mcp process")

    async def _send_request(self, method: str, params: dict) -> dict:
        """Send a JSON-RPC request and wait for response."""
        if self.process is None:
            await self.start()

        async with self._lock:
            self._request_id += 1
            request = {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params,
            }

            request_bytes = (json.dumps(request) + "\n").encode("utf-8")
            self.process.stdin.write(request_bytes)
            await self.process.stdin.drain()

            # Read response line
            response_line = await self.process.stdout.readline()
            if not response_line:
                raise RuntimeError("vantage-mcp process closed unexpectedly")

            response = json.loads(response_line.decode("utf-8"))
            return response

    async def initialize(self) -> None:
        """Send MCP initialize request."""
        if self._initialized:
            return

        response = await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "teradata-mcp-ui",
                "version": "0.1.0",
            },
        })

        if "error" in response:
            raise RuntimeError(f"Initialize failed: {response['error']}")

        self._initialized = True
        logger.info("MCP client initialized")

    async def call_tool(self, name: str, arguments: dict) -> dict:
        """Call an MCP tool."""
        await self.initialize()

        response = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments,
        })

        if "error" in response:
            return {
                "success": False,
                "error": response["error"].get("message", str(response["error"])),
            }

        return response.get("result", {})


async def get_stdio_client(binary_path: str, env: Optional[dict] = None) -> StdioMcpClient:
    """Get or create the stdio MCP client singleton."""
    global _stdio_client
    if _stdio_client is None:
        _stdio_client = StdioMcpClient(binary_path, env)
    return _stdio_client


async def execute_sql_tool(
    query: str,
    connection_id: Optional[str] = None,
    mock_mode: bool = True,
    vantage_addr: str = "",
    vantage_mode: str = "http",
    vantage_binary: str = "",
    vantage_env: Optional[dict] = None,
) -> str:
    """
    Execute a SQL query.

    Args:
        query: The SQL query to execute
        connection_id: Optional connection identifier
        mock_mode: If True, returns mock data for testing
        vantage_addr: HTTP address for vantage-mcp (used when vantage_mode="http")
        vantage_mode: Communication mode - "http" or "stdio"
        vantage_binary: Path to vantage-mcp binary (used when vantage_mode="stdio")
        vantage_env: Environment variables for vantage-mcp subprocess

    Returns:
        JSON string with query results
    """
    if mock_mode:
        return _get_mock_results(query)

    if vantage_mode == "stdio":
        return await _execute_via_stdio(query, connection_id, vantage_binary, vantage_env)
    else:
        return await _execute_via_http(query, connection_id, vantage_addr)


async def _execute_via_http(
    query: str,
    connection_id: Optional[str],
    vantage_addr: str,
) -> str:
    """Execute SQL via HTTP proxy to vantage-mcp."""
    if not vantage_addr:
        return json.dumps({
            "success": False,
            "error": "VANTAGE_MCP_ADDR not configured and MOCK_MODE is disabled",
        })

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{vantage_addr}/execute",
                json={"query": query, "connection_id": connection_id},
                timeout=60.0,
            )
            response.raise_for_status()
            # Normalize the result format
            return _normalize_result(response.text)
    except httpx.HTTPError as e:
        logger.error(f"Failed to execute SQL via HTTP: {e}")
        return json.dumps({
            "success": False,
            "error": f"Backend error: {str(e)}",
        })


async def _execute_via_stdio(
    query: str,
    connection_id: Optional[str],
    vantage_binary: str,
    vantage_env: Optional[dict],
) -> str:
    """Execute SQL via stdio JSON-RPC to vantage-mcp subprocess."""
    if not vantage_binary:
        return json.dumps({
            "success": False,
            "error": "VANTAGE_MCP_BINARY not configured for stdio mode",
        })

    try:
        client = await get_stdio_client(vantage_binary, vantage_env)

        # vantage-mcp uses "sql" as the argument name
        arguments = {"sql": query}

        result = await client.call_tool("teradata_execute_sql", arguments)

        # Parse the result from MCP tool response
        if "content" in result and len(result["content"]) > 0:
            content = result["content"][0]
            if content.get("type") == "text":
                raw_text = content.get("text", "")
                return _normalize_result(raw_text)

        return json.dumps({"success": False, "error": "Empty response from backend"})

    except Exception as e:
        logger.error(f"Failed to execute SQL via stdio: {e}")
        return json.dumps({
            "success": False,
            "error": f"Stdio backend error: {str(e)}",
        })


def _normalize_result(raw_text: str) -> str:
    """
    Normalize vantage-mcp result format to teradata-mcp-ui expected format.

    vantage-mcp returns:
        {"columns": ["col1", "col2"], "rows": [["val1", "val2"]]}

    teradata-mcp-ui expects:
        {"success": true, "columns": ["col1"], "data": [{"col1": "val1"}], "row_count": 1}
    """
    # Handle success messages (DDL/DML)
    if raw_text.startswith("✓") or "executed successfully" in raw_text.lower():
        return json.dumps({
            "success": True,
            "message": raw_text,
            "columns": [],
            "data": [],
            "row_count": 0,
        })

    # Try to parse as JSON
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        # Not JSON, treat as plain text result
        return json.dumps({
            "success": True,
            "message": raw_text,
            "columns": [],
            "data": [],
            "row_count": 0,
        })

    # If already in expected format (has success field), return as-is
    if "success" in result:
        return raw_text

    # Transform vantage-mcp format to teradata-mcp-ui format
    columns = result.get("columns", [])
    rows = result.get("rows", [])

    # Convert 2D array to array of objects
    data = []
    for row in rows:
        if isinstance(row, list):
            row_obj = {}
            for i, col in enumerate(columns):
                row_obj[col] = row[i] if i < len(row) else None
            data.append(row_obj)
        elif isinstance(row, dict):
            # Already an object
            data.append(row)

    return json.dumps({
        "success": True,
        "columns": columns,
        "data": data,
        "row_count": len(data),
    })


def _get_mock_results(query: str) -> str:
    """Generate mock results based on the query."""
    query_lower = query.lower().strip()

    if query_lower.startswith("select"):
        if "count(*)" in query_lower:
            return json.dumps({
                "success": True,
                "columns": ["count"],
                "data": [{"count": 42}],
                "row_count": 1,
            })

        if "from dbc.tables" in query_lower:
            return json.dumps({
                "success": True,
                "columns": ["DatabaseName", "TableName", "TableKind", "CreateTimeStamp"],
                "data": [
                    {"DatabaseName": "sales_db", "TableName": "customers", "TableKind": "T", "CreateTimeStamp": "2024-01-15"},
                    {"DatabaseName": "sales_db", "TableName": "orders", "TableKind": "T", "CreateTimeStamp": "2024-01-16"},
                    {"DatabaseName": "sales_db", "TableName": "products", "TableKind": "T", "CreateTimeStamp": "2024-01-17"},
                ],
                "row_count": 3,
            })

        return json.dumps({
            "success": True,
            "columns": ["id", "name", "value", "category", "date"],
            "data": [
                {"id": 1, "name": "Item A", "value": 100.50, "category": "Electronics", "date": "2024-01-01"},
                {"id": 2, "name": "Item B", "value": 250.75, "category": "Clothing", "date": "2024-01-02"},
                {"id": 3, "name": "Item C", "value": 75.00, "category": "Electronics", "date": "2024-01-03"},
                {"id": 4, "name": "Item D", "value": 320.00, "category": "Home", "date": "2024-01-04"},
                {"id": 5, "name": "Item E", "value": 180.25, "category": "Clothing", "date": "2024-01-05"},
            ],
            "row_count": 5,
        })

    if any(kw in query_lower for kw in ["insert", "update", "delete", "create", "drop", "alter"]):
        return json.dumps({
            "success": True,
            "message": "Statement executed successfully",
            "rows_affected": 1,
        })

    return json.dumps({
        "success": True,
        "columns": [],
        "data": [],
        "row_count": 0,
        "message": "Query executed (mock mode)",
    })
