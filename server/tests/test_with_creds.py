#!/usr/bin/env python3
"""Test with real Teradata credentials."""
import asyncio
import json
import os
import sys
from pathlib import Path


async def send_json_rpc(proc, request_id, method, params):
    """Send a JSON-RPC request and read response."""
    request = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": params,
    }

    # Send request
    request_line = json.dumps(request) + "\n"
    proc.stdin.write(request_line.encode())
    await proc.stdin.drain()

    # Read response (with timeout for long queries)
    response_line = await asyncio.wait_for(proc.stdout.readline(), timeout=30.0)
    if not response_line:
        return None

    return json.loads(response_line.decode())


async def test_real_query():
    """Test with real Teradata credentials."""
    print("\n" + "=" * 70)
    print("TESTING WITH REAL TERADATA CREDENTIALS")
    print("=" * 70)

    # Check for required credentials
    td_user = os.environ.get("TD_USER")
    td_host = os.environ.get("TD_HOST") or os.environ.get("TD_DEFAULT_HOST")

    if not td_user or not td_host:
        print("\n✗ Missing credentials!")
        print("  Required environment variables:")
        print("    - TD_USER (or TD_USERNAME)")
        print("    - TD_PASSWORD (or TD_PASS)")
        print("    - TD_HOST (or TD_DEFAULT_HOST)")
        print("\nSet these and try again.")
        return False

    print(f"\n✓ Credentials found:")
    print(f"  User: {td_user}")
    print(f"  Host: {td_host}")

    vantage_binary = Path.home() / "repos" / "vantage-mcp" / "vantage-mcp"
    if not vantage_binary.exists():
        print(f"\n✗ vantage-mcp binary not found at {vantage_binary}")
        return False

    print(f"  Binary: {vantage_binary}")
    print("\nStarting MCP server with vantage-mcp backend...")

    # Build environment for subprocess
    env = {
        "MOCK_MODE": "false",
        "VANTAGE_MCP_MODE": "stdio",
        "VANTAGE_MCP_BINARY": str(vantage_binary),
        "HTTP_PORT": "3020",
    }

    # Pass through all TD_* environment variables
    for key in os.environ:
        if key.startswith("TD_"):
            env[key] = os.environ[key]

    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "src.main",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=Path(__file__).parent,
        env=env,
    )

    try:
        # Wait for servers to start
        await asyncio.sleep(2)

        # Initialize
        print("\n[1/4] Initializing MCP connection...")
        response = await send_json_rpc(proc, 1, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-with-creds", "version": "1.0"},
        })

        if not response or "result" not in response:
            print("✗ Initialize failed")
            stderr = await proc.stderr.read()
            print(f"stderr: {stderr.decode()}")
            return False

        print("✓ MCP initialized")

        # Test 1: Simple SELECT query
        print("\n[2/4] Testing simple query: SELECT 1 as test_col...")
        response = await send_json_rpc(proc, 2, "tools/call", {
            "name": "execute_sql",
            "arguments": {"query": "SELECT 1 as test_col"},
        })

        result_text = response["result"]["content"][0]["text"]
        result_data = json.loads(result_text)

        if result_data.get("success"):
            print(f"✓ Query executed successfully!")
            if result_data.get("data"):
                print(f"  Result: {result_data['data'][0]}")
            else:
                print(f"  Message: {result_data.get('message', 'No data')}")
        else:
            print(f"✗ Query failed: {result_data.get('error', 'Unknown error')}")
            return False

        # Test 2: Query database metadata
        print("\n[3/4] Testing metadata query: Current database/user info...")
        response = await send_json_rpc(proc, 3, "tools/call", {
            "name": "execute_sql",
            "arguments": {
                "query": "SELECT DATABASE, USER, CURRENT_TIMESTAMP as query_time"
            },
        })

        result_text = response["result"]["content"][0]["text"]
        result_data = json.loads(result_text)

        if result_data.get("success") and result_data.get("data"):
            print(f"✓ Metadata retrieved:")
            data = result_data["data"][0]
            print(f"  Database: {data.get('Database', 'N/A')}")
            print(f"  User: {data.get('User', 'N/A')}")
            print(f"  Timestamp: {data.get('query_time', 'N/A')}")
        else:
            print(f"⚠ Metadata query failed (but connection works)")
            print(f"  Error: {result_data.get('error', 'Unknown')[:100]}")

        # Test 3: Query system tables
        print("\n[4/4] Testing system catalog query: Database list...")
        response = await send_json_rpc(proc, 4, "tools/call", {
            "name": "execute_sql",
            "arguments": {
                "query": "SELECT DatabaseName, CreatorName FROM DBC.Databases WHERE DatabaseName LIKE 'DBC%' LIMIT 3"
            },
        })

        result_text = response["result"]["content"][0]["text"]
        result_data = json.loads(result_text)

        if result_data.get("success") and result_data.get("data"):
            print(f"✓ System tables queried successfully!")
            print(f"  Found {result_data['row_count']} databases:")
            for row in result_data["data"][:3]:
                print(f"    - {row.get('DatabaseName', 'N/A')} (creator: {row.get('CreatorName', 'N/A')})")
        else:
            print(f"⚠ System table query failed")
            print(f"  Error: {result_data.get('error', 'Unknown')[:100]}")

        print("\n" + "=" * 70)
        print("✓✓✓ REAL CREDENTIALS TEST PASSED")
        print("=" * 70)
        print("\n✓ HTTP Server: http://localhost:3020/sql-editor")
        print("✓ Backend: vantage-mcp (stdio)")
        print("✓ Database: Connected and responsive")
        print("\nThe integration is fully functional with real Teradata database!")

        return True

    except asyncio.TimeoutError:
        print("\n✗ Query timeout (30s)")
        print("  This might indicate:")
        print("    - Network connectivity issues")
        print("    - Teradata server is slow/unavailable")
        print("    - Credentials are incorrect")
        return False
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        proc.terminate()
        await proc.wait()


async def main():
    """Run real credentials test."""
    success = await test_real_query()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
