/**
 * SQL Editor MCP App
 *
 * Single-file HTML bundle with CodeMirror editor.
 * Works in Claude Desktop's sandboxed MCP Apps environment.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { SQLEditor } from '../components/sql-editor/SQLEditor';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();

// Render the application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <SQLEditor
        context="mcp-apps"
        title="Teradata SQL Editor"
      />
    </McpBridgeProvider>
  );
}
