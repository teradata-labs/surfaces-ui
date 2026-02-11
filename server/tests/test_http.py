"""Test HTTP server without MCP stdio."""
import asyncio
import logging
from pathlib import Path
from aiohttp import web

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HTTP_PORT = 3000
HTTP_APPS_DIR = Path(__file__).parent.parent / "packages" / "components" / "dist" / "http"


async def serve_app(request):
    """Serve UI app HTML entry point."""
    app_name = request.match_info.get('app', 'sql-editor')
    html_path = HTTP_APPS_DIR / f"{app_name}.html"

    if not html_path.exists():
        return web.Response(
            text=f"App not found: {app_name}. Build apps with: pnpm build:http",
            status=404,
        )

    return web.FileResponse(html_path)


async def serve_assets(request):
    """Serve static assets."""
    path = request.match_info['path']
    asset_path = HTTP_APPS_DIR / "assets" / path

    if not asset_path.exists():
        return web.Response(text="Asset not found", status=404)

    return web.FileResponse(asset_path)


async def main():
    app = web.Application()
    app.router.add_get('/{app}', serve_app)
    app.router.add_get('/assets/{path:.*}', serve_assets)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', HTTP_PORT)
    await site.start()

    logger.info(f"HTTP server running on http://localhost:{HTTP_PORT}")
    logger.info(f"Serving apps from: {HTTP_APPS_DIR}")
    logger.info("Press Ctrl+C to stop")

    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
