"""UI resource management for serving HTML apps via MCP."""

import logging
from pathlib import Path

from mcp.types import Resource

logger = logging.getLogger(__name__)

# Path to the built HTML apps (relative to package root)
APPS_DIR = Path(__file__).parent.parent.parent.parent / "packages" / "components" / "dist" / "apps"

# MCP Apps MIME type for UI resources
MCP_APP_MIME_TYPE = "text/html;profile=mcp-app"

# Registry of available UI apps
UI_APPS = {
    "sql-editor": {
        "name": "SQL Editor",
        "description": "Interactive SQL editor with query execution and visualization",
        "mimeType": MCP_APP_MIME_TYPE,
    },
    "file-browser": {
        "name": "File Browser",
        "description": "Browse and manage files",
        "mimeType": MCP_APP_MIME_TYPE,
    },
    "data-browser": {
        "name": "Data Browser",
        "description": "Browse database tables and schemas",
        "mimeType": MCP_APP_MIME_TYPE,
    },
    "chat-panel": {
        "name": "Chat Panel",
        "description": "AI chat interface",
        "mimeType": MCP_APP_MIME_TYPE,
    },
}


def get_ui_resources() -> list[Resource]:
    """Get list of available UI resources."""
    resources = []

    for app_id, app_info in UI_APPS.items():
        resources.append(
            Resource(
                uri=f"ui://{app_id}",
                name=app_info["name"],
                description=app_info["description"],
                mimeType=app_info["mimeType"],
            )
        )

    return resources


def get_ui_resource_content(uri: str) -> str:
    """Get the content of a UI resource."""
    if not uri.startswith("ui://"):
        raise ValueError(f"Invalid UI resource URI: {uri}")

    app_id = uri.replace("ui://", "")

    if app_id not in UI_APPS:
        raise ValueError(f"Unknown UI app: {app_id}")

    app_file = APPS_DIR / f"{app_id}.html"

    if app_file.exists():
        return app_file.read_text()

    logger.warning(f"App file not found: {app_file}. Returning placeholder.")
    return _get_placeholder_html(app_id, UI_APPS[app_id])


def _get_placeholder_html(app_id: str, app_info: dict) -> str:
    """Generate placeholder HTML when app is not built yet."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{app_info['name']}</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #333;
        }}
        .container {{
            text-align: center;
            padding: 2rem;
        }}
        h1 {{ color: #1976d2; }}
        p {{ color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{app_info['name']}</h1>
        <p>{app_info['description']}</p>
        <p><em>This app has not been built yet. Run <code>pnpm build:apps</code> to build.</em></p>
    </div>
</body>
</html>
"""
