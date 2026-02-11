/**
 * SQL Editor MCP App
 *
 * Standalone HTML app that wraps the SQLEditor component for use
 * in MCP Apps environments (Claude Desktop, etc.).
 *
 * Uses McpAppsBridge to communicate with the MCP host via the
 * @modelcontextprotocol/ext-apps protocol.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { SQLEditor } from '../components/sql-editor/SQLEditor';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();

// Declare MCP params type for TypeScript
declare global {
  interface Window {
    __MCP_PARAMS__?: {
      sql?: string;
      autoExecute?: string;
      projectId?: string;
    };
  }
}

// Get MCP params from either window.__MCP_PARAMS__ (injected by server) or URL search params
function getMcpParams(): { sql?: string; autoExecute?: string; projectId?: string } {
  if (typeof window === 'undefined') {
    return {};
  }

  // First check window.__MCP_PARAMS__ (injected by vantage-mcp server)
  if (window.__MCP_PARAMS__) {
    return window.__MCP_PARAMS__;
  }

  // Fallback to URL search params
  const params = new URLSearchParams(window.location.search);
  return {
    sql: params.get('sql') || undefined,
    autoExecute: params.get('autoExecute') || undefined,
    projectId: params.get('projectId') || undefined,
  };
}

// Get project ID from URL params or MCP context
function getProjectId(): string | undefined {
  return getMcpParams().projectId;
}

function App() {
  const projectId = getProjectId();
  const mcpParams = getMcpParams();

  // Get initial SQL from MCP params (passed by Claude when invoking the UI)
  const getInitialSQL = (): string => {
    const initialSQL = mcpParams.sql || 'SELECT TOP 10 * FROM dbc.TablesV';
    return initialSQL;
  };

  // Auto-execute when in MCP Apps context with a SQL param
  const shouldAutoExecute = (): boolean => {
    return Boolean(mcpParams.sql) || mcpParams.autoExecute === 'true';
  };

  return (
    <McpBridgeProvider bridge={bridge}>
      <div className="min-h-[400px] w-full p-4 bg-background">
        <SQLEditor
          title="Teradata SQL Editor"
          initialCode={getInitialSQL()}
          className="w-full"
          context="mcp-apps"
          projectId={projectId}
          teradataBaseUrl="http://localhost:8080"
          autoExecute={shouldAutoExecute()}
        />
      </div>
    </McpBridgeProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
