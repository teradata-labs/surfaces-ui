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
  "react-test": {
    name: "React Test",
    description:
      "Minimal React test app to verify MCP widget rendering",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "react-test.html",
  },
  "pure-html-test": {
    name: "Pure HTML Test",
    description:
      "Ultra-minimal pure HTML test (no React, no bundler) to verify MCP rendering",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "pure-html-test.html",
  },
  "simple-test": {
    name: "Simple Test",
    description:
      "Minimal test app to verify MCP rendering is working",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "simple-test.html",
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
  "component-gallery": {
    name: "Component Gallery",
    description:
      "Curated showcase of core SurfacesUI components optimized for MCP rendering with live interactive examples",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "component-gallery.html",
  },
  "test-viewer": {
    name: "Test Viewer",
    description:
      "Test copy of dashboard-viewer to verify rendering works",
    mimeType: "text/html;profile=mcp-app" as const,
    filename: "test-viewer.html",
  },
} as const;

/**
 * Stylesheet resources for standalone HTML/CSS/JS development.
 * These CSS files contain all the design tokens and component styles
 * needed to create UIs that match the SurfacesUI design system.
 */
export const SURFACES_STYLESHEETS = {
  "styles/tokens": {
    name: "Design Tokens CSS",
    description: "Core design tokens including colors, typography, spacing, and theme variables. Use this for standalone HTML/CSS without React components.",
    mimeType: "text/css" as const,
    filename: "tokens.css",
  },
  "styles/components": {
    name: "Component Styles CSS",
    description: "Complete compiled CSS for all SurfacesUI components including React Flow and third-party library styles. ~16KB minified.",
    mimeType: "text/css" as const,
    filename: "components.css",
  },
} as const;

/**
 * Documentation and prompt resources for AI-assisted development.
 */
export const SURFACES_DOCS = {
  "docs/react-components": {
    name: "React Components Guide",
    description: "Complete guide to SurfacesUI React components with TypeScript interfaces, usage examples, and best practices",
    mimeType: "text/markdown" as const,
    filename: "react-components.md",
  },
} as const;

export type AppId = keyof typeof SURFACES_APPS;
export type StylesheetId = keyof typeof SURFACES_STYLESHEETS;
export type DocId = keyof typeof SURFACES_DOCS;
export type ResourceId = AppId | StylesheetId | DocId;
