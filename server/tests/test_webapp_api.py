#!/usr/bin/env python3
"""
Mock REST API for testing the web app version of SQL Editor.

This simulates a backend API endpoint that the HttpBridge calls.
"""
from aiohttp import web
import json


async def execute_sql(request):
    """Handle SQL execution requests."""
    try:
        data = await request.json()
        query = data.get('query', '').lower()

        print(f"[API] Received query: {query[:100]}...")

        # Simulate error for certain queries
        if 'error' in query or 'invalid' in query:
            return web.json_response({
                'success': False,
                'error': 'SQL Error: Syntax error near "invalid". Expected SELECT, INSERT, UPDATE, or DELETE.'
            }, status=400)

        # Mock table list query
        if 'dbc.tables' in query:
            return web.json_response({
                'success': True,
                'columns': ['DatabaseName', 'TableName', 'TableKind', 'CreateTimeStamp'],
                'data': [
                    {'DatabaseName': 'sales_db', 'TableName': 'customers', 'TableKind': 'T', 'CreateTimeStamp': '2024-01-15'},
                    {'DatabaseName': 'sales_db', 'TableName': 'orders', 'TableKind': 'T', 'CreateTimeStamp': '2024-01-16'},
                    {'DatabaseName': 'sales_db', 'TableName': 'products', 'TableKind': 'T', 'CreateTimeStamp': '2024-01-17'},
                ],
                'row_count': 3,
            })

        # Count query
        if 'count' in query:
            return web.json_response({
                'success': True,
                'columns': ['count'],
                'data': [{'count': 42}],
                'row_count': 1,
            })

        # Default query response
        return web.json_response({
            'success': True,
            'columns': ['id', 'name', 'email', 'created_at'],
            'data': [
                {'id': 1, 'name': 'Alice Johnson', 'email': 'alice@example.com', 'created_at': '2024-01-01'},
                {'id': 2, 'name': 'Bob Smith', 'email': 'bob@example.com', 'created_at': '2024-01-02'},
                {'id': 3, 'name': 'Carol White', 'email': 'carol@example.com', 'created_at': '2024-01-03'},
                {'id': 4, 'name': 'Dave Brown', 'email': 'dave@example.com', 'created_at': '2024-01-04'},
                {'id': 5, 'name': 'Eve Davis', 'email': 'eve@example.com', 'created_at': '2024-01-05'},
            ],
            'row_count': 5,
        })

    except Exception as e:
        print(f"[API] Error: {e}")
        return web.json_response({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)


async def handle_options(request):
    """Handle CORS preflight requests."""
    return web.Response(
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    )


def add_cors_headers(response):
    """Add CORS headers to response."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


@web.middleware
async def cors_middleware(request, handler):
    """Middleware to add CORS headers to all responses."""
    if request.method == 'OPTIONS':
        return await handle_options(request)

    response = await handler(request)
    return add_cors_headers(response)


async def main():
    """Run the mock API server."""
    app = web.Application(middlewares=[cors_middleware])

    # API routes
    app.router.add_post('/api/sql/execute', execute_sql)
    app.router.add_options('/api/sql/execute', handle_options)

    # Start server
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 3001)
    await site.start()

    print('=' * 60)
    print('Mock REST API Server Running')
    print('=' * 60)
    print('')
    print('Endpoint: http://localhost:3001/api/sql/execute')
    print('CORS: Enabled')
    print('')
    print('Test it with:')
    print('  curl -X POST http://localhost:3001/api/sql/execute \\')
    print('       -H "Content-Type: application/json" \\')
    print('       -d \'{"query": "SELECT * FROM users LIMIT 5"}\'')
    print('')
    print('Or open: http://localhost:3000/sql-editor-webapp')
    print('  (Make sure HTTP server is also running on port 3000)')
    print('')
    print('Press Ctrl+C to stop')
    print('=' * 60)

    try:
        # Keep server running
        import asyncio
        await asyncio.Future()
    except KeyboardInterrupt:
        print('\nStopping server...')
    finally:
        await runner.cleanup()


if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
