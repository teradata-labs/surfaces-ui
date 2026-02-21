/**
 * Single source of truth for surfaces-ui app metadata.
 *
 * Each entry maps an app ID to its display name, description,
 * MIME type, and the filename of the built HTML bundle.
 */

export const SURFACES_APPS = {
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
} as const;

export type AppId = keyof typeof SURFACES_APPS;
