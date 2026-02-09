"""
Teradata MCP UI Server

FastMCP server that:
- Serves UI resources (HTML apps built from components)
- Provides tools that proxy to vantage-mcp or mock data for testing

Supports two communication modes with vantage-mcp:
- HTTP mode: Proxies requests to an HTTP endpoint (requires HTTP server wrapper)
- stdio mode: Spawns vantage-mcp as subprocess, communicates via JSON-RPC
"""

import asyncio
import logging
import os
from pathlib import Path

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Resource, Tool, TextContent

from .tools.sql import execute_sql_tool, get_sql_tool_definition
from .resources.ui import get_ui_resources, get_ui_resource_content

# Configure logging to stderr (MCP uses stdout for JSON-RPC)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Create MCP server instance
server = Server("teradata-mcp-ui")

# Environment configuration
MOCK_MODE = os.environ.get("MOCK_MODE", "true").lower() == "true"
VANTAGE_MCP_MODE = os.environ.get("VANTAGE_MCP_MODE", "stdio").lower()  # "http" or "stdio"
VANTAGE_MCP_ADDR = os.environ.get("VANTAGE_MCP_ADDR", "")  # For HTTP mode
VANTAGE_MCP_BINARY = os.environ.get("VANTAGE_MCP_BINARY", "")  # For stdio mode

# Environment variables to pass to vantage-mcp subprocess (stdio mode)
VANTAGE_ENV = {}
for key in ["TD_USER", "TD_PASSWORD", "TD_PASS", "TD_HOST", "TD_DEFAULT_HOST", "TD_LOGMECH", "LOG_LEVEL"]:
    value = os.environ.get(key)
    if value:
        VANTAGE_ENV[key] = value


@server.list_tools()
async def list_tools() -> list[dict]:
    """List available tools with MCP Apps UI metadata."""
    return [get_sql_tool_definition()]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool invocations."""
    if name == "execute_sql":
        result = await execute_sql_tool(
            query=arguments.get("query", ""),
            connection_id=arguments.get("connection_id"),
            mock_mode=MOCK_MODE,
            vantage_addr=VANTAGE_MCP_ADDR,
            vantage_mode=VANTAGE_MCP_MODE,
            vantage_binary=VANTAGE_MCP_BINARY,
            vantage_env=VANTAGE_ENV,
        )
        return [TextContent(type="text", text=result)]

    raise ValueError(f"Unknown tool: {name}")


@server.list_resources()
async def list_resources() -> list[Resource]:
    """List available UI resources."""
    return get_ui_resources()


@server.read_resource()
async def read_resource(uri: str) -> str:
    """Read a UI resource by URI."""
    return get_ui_resource_content(uri)


async def main():
    """Run the MCP server."""
    logger.info("Starting Teradata MCP UI Server")
    logger.info(f"Mock mode: {MOCK_MODE}")
    logger.info(f"Vantage MCP mode: {VANTAGE_MCP_MODE}")

    if VANTAGE_MCP_MODE == "http":
        logger.info(f"Vantage MCP HTTP address: {VANTAGE_MCP_ADDR or 'not configured'}")
    else:
        logger.info(f"Vantage MCP binary: {VANTAGE_MCP_BINARY or 'not configured'}")
        if VANTAGE_ENV:
            logger.info(f"Vantage environment variables: {list(VANTAGE_ENV.keys())}")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
