/**
 * React Test - Minimal React MCP app to verify rendering
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ChartThemeProvider } from '../theme/ChartThemeProvider';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { ChartThemeSelector } from './ChartThemeSelector';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance for tool calls
const bridge = new McpAppsBridge();
bridge.connect();

function ReactTest() {
  const [clicks, setClicks] = React.useState(0);
  const [message, setMessage] = React.useState<string>('');
  const [status, setStatus] = React.useState<'loading' | 'ready'>('loading');

  React.useEffect(() => {
    console.log('[ReactTest] Mounting and setting up message listener');

    const handleMessage = (event: MessageEvent) => {
      // Listen for tool-input notification from Claude Desktop
      if (event.data?.method === 'ui/notifications/tool-input') {
        console.log('[ReactTest] Received tool-input notification');
        const args = event.data?.params?.arguments;
        if (args?.message) {
          console.log('[ReactTest] Setting message:', args.message);
          setMessage(args.message);
        }
        setStatus('ready');
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('[ReactTest] Message listener attached');

    // Notify parent we're ready
    if (window.parent !== window) {
      console.log('[ReactTest] Notifying parent: ready');
      window.parent.postMessage({ type: 'react-test-ready' }, '*');
    }

    // Show ready state after short timeout if no message received
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.log('[ReactTest] No message received, showing ready state');
        setStatus('ready');
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [status]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-outline border-t-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo height={32} />
            <div className="text-sm text-muted-foreground">React Test</div>
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
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl">
                ✓
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground m-0">
                  React Widget Test
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  MCP Apps with React + Tailwind
                </p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950 border-l-4 border-green-500 p-4 rounded mb-6">
              <p className="text-green-900 dark:text-green-100 mb-2">
                <strong>✅ Status:</strong> React is rendering correctly!
              </p>
              <p className="text-green-900 dark:text-green-100 mb-2">
                <strong>🕐 Time:</strong> {new Date().toLocaleTimeString()}
              </p>
              <p className="text-green-900 dark:text-green-100 mb-2">
                <strong>👆 Clicks:</strong> {clicks}
              </p>
              {message && (
                <p className="text-green-900 dark:text-green-100 m-0">
                  <strong>💬 Message:</strong> {message}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setClicks(c => c + 1)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Click Counter ({clicks})
              </button>

              <a
                href="https://google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors no-underline"
              >
                🔗 Open Google.com
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <ChartThemeProvider persistTheme>
          <ReactTest />
        </ChartThemeProvider>
      </ThemeProvider>
    </McpBridgeProvider>
  );
} else {
  document.body.innerHTML = '<div style="color:red;padding:40px">ERROR: Root element not found</div>';
}
