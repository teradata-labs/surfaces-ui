#!/usr/bin/env python3
"""Integration test for HTTP server and stdio MCP communication."""
import asyncio
import json
import subprocess
import time
import httpx
from pathlib import Path


async def test_http_server():
    """Test the HTTP server serving UI apps."""
    print("\n=== Testing HTTP Server ===")

    # Start test HTTP server
    server_proc = subprocess.Popen(
        ["python3", "test_http.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=Path(__file__).parent,
    )

    # Wait for server to start
    await asyncio.sleep(2)

    try:
        async with httpx.AsyncClient() as client:
            # Test SQL Editor HTML
            response = await client.get("http://localhost:3000/sql-editor")
            assert response.status_code == 200
            assert "SQL Editor" in response.text
            print("✓ SQL Editor HTML served successfully")

            # Test assets endpoint
            response = await client.get("http://localhost:3000/assets/sql-editor-B_A_GBse.js")
            assert response.status_code == 200
            assert len(response.content) > 1000000  # ~1.6MB
            print(f"✓ Assets served successfully ({len(response.content) / 1024 / 1024:.2f} MB)")

    finally:
        server_proc.terminate()
        server_proc.wait()


async def test_stdio_mock():
    """Test MCP server with mock mode via stdio."""
    print("\n=== Testing MCP stdio with Mock Mode ===")

    # Start MCP server in mock mode
    proc = await asyncio.create_subprocess_exec(
        "python3", "-m", "src.main",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=Path(__file__).parent,
        env={"MOCK_MODE": "true", "HTTP_PORT": "3001"},
    )

    # Wait for HTTP server to start
    await asyncio.sleep(2)

    try:
        # Check if process started successfully
        await asyncio.sleep(1)
        if proc.returncode is not None:
            stderr = await proc.stderr.read()
            print(f"✗ Server crashed on startup: {stderr.decode()}")
            return

        # Send MCP initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        }

        proc.stdin.write((json.dumps(init_request) + "\n").encode())
        await proc.stdin.drain()

        # Read initialize response
        response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=5.0)
        if not response_line:
            stderr = await proc.stderr.read()
            print(f"✗ No response from server. stderr: {stderr.decode()}")
            return

        response = json.loads(response_line.decode())
        assert "result" in response
        print(f"✓ MCP initialize successful: {response['result']['serverInfo']['name']}")

        # Send tools/list request
        tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }

        proc.stdin.write((json.dumps(tools_request) + "\n").encode())
        await proc.stdin.drain()

        response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=5.0)
        response = json.loads(response_line.decode())
        assert "result" in response
        tools = response["result"]["tools"]
        assert len(tools) > 0
        assert tools[0]["name"] == "execute_sql"
        print(f"✓ Tools listed: {[t['name'] for t in tools]}")

        # Send execute_sql tool call
        execute_request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "execute_sql",
                "arguments": {"query": "SELECT * FROM dbc.tables LIMIT 3"},
            },
        }

        proc.stdin.write((json.dumps(execute_request) + "\n").encode())
        await proc.stdin.drain()

        response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=5.0)
        response = json.loads(response_line.decode())
        assert "result" in response
        content = response["result"]["content"][0]["text"]
        result_data = json.loads(content)
        assert result_data["success"] is True
        assert len(result_data["data"]) == 3
        print(f"✓ SQL query executed (mock): {result_data['row_count']} rows")

        # Test HTTP server is running alongside
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:3001/sql-editor")
            assert response.status_code == 200
            print("✓ HTTP server running alongside MCP stdio")

    finally:
        proc.terminate()
        await proc.wait()


async def test_stdio_with_vantage_mcp():
    """Test MCP server with vantage-mcp stdio integration."""
    print("\n=== Testing MCP stdio with vantage-mcp ===")

    vantage_binary = Path.home() / "repos" / "vantage-mcp" / "vantage-mcp"

    if not vantage_binary.exists():
        print(f"⚠ Skipping: vantage-mcp binary not found at {vantage_binary}")
        return

    # Start MCP server with vantage-mcp
    proc = await asyncio.create_subprocess_exec(
        "python3", "-m", "src.main",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=Path(__file__).parent,
        env={
            "MOCK_MODE": "false",
            "VANTAGE_MCP_MODE": "stdio",
            "VANTAGE_MCP_BINARY": str(vantage_binary),
            "HTTP_PORT": "3002",
        },
    )

    # Wait for HTTP server to start
    await asyncio.sleep(2)

    try:
        # Send MCP initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        }

        proc.stdin.write((json.dumps(init_request) + "\n").encode())
        await proc.stdin.drain()

        # Read initialize response
        response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=5.0)
        response = json.loads(response_line.decode())
        assert "result" in response
        print(f"✓ MCP initialize with vantage-mcp backend")

        # Send execute_sql tool call (will fail without credentials, but tests connection)
        execute_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "execute_sql",
                "arguments": {"query": "SELECT 1"},
            },
        }

        proc.stdin.write((json.dumps(execute_request) + "\n").encode())
        await proc.stdin.drain()

        response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=10.0)
        response = json.loads(response_line.decode())

        # May fail due to missing credentials, but should get a response
        if "result" in response:
            print("✓ vantage-mcp communication successful")
        elif "error" in response:
            print(f"⚠ vantage-mcp error (expected without credentials): {response['error'].get('message', 'Unknown error')[:100]}")

    except asyncio.TimeoutError:
        print("⚠ vantage-mcp communication timeout (may need credentials)")
    finally:
        proc.terminate()
        await proc.wait()


async def main():
    """Run all integration tests."""
    print("Starting Integration Tests")
    print("=" * 50)

    try:
        await test_http_server()
    except Exception as e:
        print(f"✗ HTTP server test failed: {e}")

    try:
        await test_stdio_mock()
    except Exception as e:
        import traceback
        print(f"✗ MCP stdio mock test failed: {e}")
        traceback.print_exc()

    try:
        await test_stdio_with_vantage_mcp()
    except Exception as e:
        import traceback
        print(f"✗ MCP stdio with vantage-mcp test failed: {e}")
        traceback.print_exc()

    print("\n" + "=" * 50)
    print("Integration Tests Complete")


if __name__ == "__main__":
    asyncio.run(main())
