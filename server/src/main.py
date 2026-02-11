"""
Teradata MCP UI Server

FastMCP server that:
- Serves UI resources (HTML apps built from components)
- Provides tools that proxy to vantage-mcp or mock data for testing
- Runs HTTP server for serving UI apps with full asset support (Monaco Editor, etc.)

Supports two communication modes with vantage-mcp:
- HTTP mode: Proxies requests to an HTTP endpoint (requires HTTP server wrapper)
- stdio mode: Spawns vantage-mcp as subprocess, communicates via JSON-RPC
"""

import asyncio
import logging
import os
from pathlib import Path

from aiohttp import web
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
HTTP_PORT = int(os.environ.get("HTTP_PORT", "3000"))  # HTTP server port

# Environment variables to pass to vantage-mcp subprocess (stdio mode)
VANTAGE_ENV = {}
for key in ["TD_USER", "TD_PASSWORD", "TD_PASS", "TD_HOST", "TD_DEFAULT_HOST", "TD_LOGMECH", "LOG_LEVEL"]:
    value = os.environ.get(key)
    if value:
        VANTAGE_ENV[key] = value

# Path to built UI apps for HTTP serving
HTTP_APPS_DIR = Path(__file__).parent.parent.parent / "packages" / "components" / "dist" / "http"


@server.list_tools()
async def list_tools() -> list[Tool]:
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
    # Convert uri to string if it's an AnyUrl object from pydantic
    uri_str = str(uri) if not isinstance(uri, str) else uri
    return get_ui_resource_content(uri_str)


# HTTP Server Routes
async def serve_app(request):
    """Serve UI app HTML entry point."""
    app_name = request.match_info.get('app', 'sql-editor')

    # Look for the app's HTML file in the HTTP dist directory
    # Vite outputs to dist/http/sql-editor.html
    html_path = HTTP_APPS_DIR / f"{app_name}.html"

    if not html_path.exists():
        logger.warning(f"App not found: {app_name} at {html_path}")
        return web.Response(
            text=f"App not found: {app_name}. Build apps with: pnpm build:http",
            status=404,
        )

    return web.FileResponse(html_path)


async def serve_assets(request):
    """Serve static assets (JS, CSS, web workers, etc.)."""
    path = request.match_info['path']
    asset_path = HTTP_APPS_DIR / "assets" / path

    if not asset_path.exists():
        logger.warning(f"Asset not found: {path}")
        return web.Response(text="Asset not found", status=404)

    return web.FileResponse(asset_path)


async def start_http_server():
    """Start HTTP server for serving UI apps."""
    app = web.Application()

    # Add routes
    app.router.add_get('/{app}', serve_app)
    app.router.add_get('/assets/{path:.*}', serve_assets)

    # Start server
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', HTTP_PORT)
    await site.start()

    logger.info(f"HTTP server running on http://localhost:{HTTP_PORT}")
    logger.info(f"Serving apps from: {HTTP_APPS_DIR}")

    # Return runner for cleanup
    return runner


async def run_mcp_server():
    """Run MCP server (stdio)."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


async def main():
    """Run the MCP server and HTTP server in parallel."""
    logger.info("Starting Teradata MCP UI Server")
    logger.info(f"Mock mode: {MOCK_MODE}")
    logger.info(f"Vantage MCP mode: {VANTAGE_MCP_MODE}")
    logger.info(f"HTTP port: {HTTP_PORT}")

    if VANTAGE_MCP_MODE == "http":
        logger.info(f"Vantage MCP HTTP address: {VANTAGE_MCP_ADDR or 'not configured'}")
    else:
        logger.info(f"Vantage MCP binary: {VANTAGE_MCP_BINARY or 'not configured'}")
        if VANTAGE_ENV:
            logger.info(f"Vantage environment variables: {list(VANTAGE_ENV.keys())}")

    # Start HTTP server
    http_runner = await start_http_server()

    try:
        # Run MCP server (stdio) - this blocks until stdin closes
        await run_mcp_server()
    finally:
        # Cleanup HTTP server
        logger.info("Shutting down HTTP server")
        await http_runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
