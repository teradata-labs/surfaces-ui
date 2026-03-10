/**
 * Single source of truth for surfaces-ui app metadata.
 *
 * Each entry maps an app ID to its display name, description,
 * MIME type, and the filename of the built HTML bundle.
 *
 * Note: The previous Python server also registered file-browser,
 * data-browser, and chat-panel as placeholder entries. These were
 * removed because they had no corresponding HTML builds. They can
 * be added here once build targets exist for them.
 */

export const SURFACES_APPS = {
  "test-tiny": {
    name: "Test Tiny App",
    description: "Minimal test app for debugging MCP resource loading",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "test-tiny.html",
  },
  "sql-editor-cdn": {
    name: "SQL Editor",
    description:
      "Interactive SQL editor with query execution and result visualization",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "sql-editor-cdn.html",
  },
  "json-render-cdn": {
    name: "NL UI Generator",
    description:
      "Natural language-driven UI component generator powered by json-render catalog",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "json-render-cdn.html",
  },
  "dashboard-viewer": {
    name: "Dashboard Viewer",
    description:
      "Interactive dashboard renderer for Claude-generated dashboard specs",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "dashboard-viewer.html",
  },
} as const;

export type AppId = keyof typeof SURFACES_APPS;
