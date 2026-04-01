/**
 * MCP Debug Panel
 *
 * Floating debug panel for MCP Apps (use only during development).
 * Shows URL, hash, and all postMessage events in real-time.
 * Toggleable via FAB button in bottom-right corner.
 *
 * Since Claude Desktop doesn't allow DevTools access, this panel
 * provides visibility into the MCP communication protocol.
 *
 * @example
 * import { MCPDebugPanel } from './MCPDebugPanel';
 *
 * function MyApp() {
 *   return (
 *     <>
 *       <MCPDebugPanel /> // Remove in production
 *       <YourApp />
 *     </>
 *   );
 * }
 */

import * as React from 'react';
import { Bug } from 'lucide-react';

export interface MCPDebugPanelProps {
  /** Maximum number of messages to display. Default: 20 */
  maxMessages?: number;
}

export function MCPDebugPanel({ maxMessages = 20 }: MCPDebugPanelProps) {
  const [messages, setMessages] = React.useState<Array<{ time: string; content: string }>>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const addMessage = (content: string) => {
      const time = new Date().toLocaleTimeString();
      setMessages((prev) => [{ time, content }, ...prev].slice(0, maxMessages));
    };

    // Log initial environment
    addMessage(`🚀 MCP App Mounted`);
    addMessage(`URL: ${window.location.href}`);
    addMessage(`Hash: ${window.location.hash || '(empty)'}`);
    addMessage(`Hash length: ${window.location.hash.length}`);

    // Listen for all postMessages
    const handleMessage = (event: MessageEvent) => {
      addMessage(`📨 Message from: ${event.origin}`);

      if (event.data && typeof event.data === 'object') {
        const keys = Object.keys(event.data);
        addMessage(`   Keys: ${keys.join(', ')}`);

        // Log method if present
        if (event.data.method) {
          addMessage(`   Method: ${event.data.method}`);
        }

        // Show data preview
        try {
          const dataStr = JSON.stringify(event.data, null, 2);
          addMessage(`   Data: ${dataStr.substring(0, 200)}${dataStr.length > 200 ? '...' : ''}`);
        } catch {
          addMessage(`   Data: [Unable to stringify]`);
        }
      } else {
        addMessage(`   Data: ${event.data}`);
      }
    };

    window.addEventListener('message', handleMessage);
    addMessage(`✓ Message listener attached`);

    // Notify parent we're ready
    if (window.parent !== window) {
      addMessage(`📤 Notifying parent: app-ready`);
      window.parent.postMessage({ type: 'mcp-debug-panel-ready' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [maxMessages]);

  return (
    <>
      {/* FAB Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#0f0',
          color: '#000',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 8px rgba(0, 255, 0, 0.3)',
          transition: 'all 0.2s',
        }}
        title="Toggle Debug Panel"
      >
        <Bug size={24} />
      </button>

      {/* Debug Panel Overlay */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '500px',
            maxHeight: '400px',
            background: '#000',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: '10px',
            zIndex: 9998,
            border: '2px solid #0f0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 8px 16px rgba(0, 255, 0, 0.3)',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              background: '#0f0',
              color: '#000',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>MCP DEBUG PANEL</span>
            <span>{messages.length} messages</span>
          </div>
          <div
            style={{
              padding: '12px',
              maxHeight: '350px',
              overflowY: 'auto',
            }}
          >
            {messages.length === 0 ? (
              <div>No messages yet...</div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '4px', opacity: 1 - i * 0.03 }}>
                  <span style={{ color: '#666' }}>[{msg.time}]</span> {msg.content}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
