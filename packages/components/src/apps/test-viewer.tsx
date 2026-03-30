/**
 * Test Viewer MCP App
 *
 * Static card test - NO json-render, just a simple static card.
 * Testing if json-render is required for rendering.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ChartThemeProvider } from '../theme/ChartThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { ChartThemeSelector } from './ChartThemeSelector';
import { Logo } from './Logo';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance for tool calls
const bridge = new McpAppsBridge();
bridge.connect();

function TestViewer() {
  const [status, setStatus] = React.useState<'loading' | 'ready'>('loading');

  React.useEffect(() => {
    console.log('[TestViewer] Mounting and setting up message listener');

    const handleMessage = (event: MessageEvent) => {
      // Listen for tool-input notification from Claude Desktop
      if (event.data?.method === 'ui/notifications/tool-input') {
        console.log('[TestViewer] Received tool-input notification');
        setStatus('ready');
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('[TestViewer] Message listener attached');

    if (window.parent !== window) {
      console.log('[TestViewer] Notifying parent: ready');
      window.parent.postMessage({ type: 'test-viewer-ready' }, '*');
    }

    // Show ready state after short timeout
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.log('[TestViewer] Timeout reached, showing ready state');
        setStatus('ready');
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [status]);

  // Loading state - waiting for data
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-outline border-t-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Loading test viewer...</p>
        </div>
      </div>
    );
  }

  // Ready - show static card (NO json-render)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo height={32} />
            <div className="text-sm text-muted-foreground">Test Viewer (No json-render)</div>
          </div>
          <div className="flex items-center gap-2">
            <ChartThemeSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl">
                ✓
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground m-0">
                  Static Card Test
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  No json-render - just plain React
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-blue-900 dark:text-blue-100 mb-2">
                <strong>🧪 Test:</strong> Static Card Rendering
              </p>
              <p className="text-blue-900 dark:text-blue-100 mb-2">
                <strong>📦 Libraries:</strong> React 19, Tailwind CSS
              </p>
              <p className="text-blue-900 dark:text-blue-100 m-0">
                <strong>❌ NOT using:</strong> json-render, StateProvider, Renderer
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Render the application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <ChartThemeProvider persistTheme>
          <TestViewer />
        </ChartThemeProvider>
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
