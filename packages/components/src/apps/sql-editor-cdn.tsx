/**
 * SQL Editor MCP App
 *
 * Single-file HTML bundle with CodeMirror editor.
 * Works in Claude Desktop's sandboxed MCP Apps environment.
 *
 * Receives data via ui/notifications/tool-input postMessage:
 *   { initialQuery?: string, queryResults?: { sql?: string, columns: string[], rows: unknown[][] } }
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { SQLEditor } from '../components/sql-editor/SQLEditor';
import type { SQLResult } from '../components/sql-editor/types';
import '../theme/tokens.css';

const bridge = new McpAppsBridge();

function SQLEditorApp() {
  const [initialQuery, setInitialQuery] = React.useState<string>('');
  const [initialResults, setInitialResults] = React.useState<SQLResult | null>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.method === 'ui/notifications/tool-input') {
        const args: Record<string, unknown> = event.data.params?.arguments ?? {};

        if (typeof args.initialQuery === 'string') {
          setInitialQuery(args.initialQuery);
        }

        // queryResults shape from open_sql_editor: { sql?, columns, rows }
        // This is the raw base_readQuery response format
        const qr = args.queryResults as { sql?: string; columns?: string[]; rows?: unknown[][] } | undefined;
        if (qr?.columns && qr?.rows) {
          const { sql, columns, rows } = qr;
          const data = rows.map((row) => {
            const obj: Record<string, unknown> = {};
            columns.forEach((col, i) => { obj[col] = (row as unknown[])[i] ?? null; });
            return obj;
          });
          setInitialResults({ success: true, columns, data, row_count: data.length });
          if (typeof sql === 'string' && sql) {
            setInitialQuery(sql);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    // Signal to Claude Desktop that the app is ready to receive data
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'sql-editor-ready' }, '*');
    }
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <McpBridgeProvider bridge={bridge}>
      <SQLEditor
        context="mcp-apps"
        title="Teradata SQL Editor"
        initialCode={initialQuery}
        initialResults={initialResults}
      />
    </McpBridgeProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SQLEditorApp />);
}
