/**
 * Simple Test - Minimal MCP test app
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();
bridge.connect();

function SimpleTest() {
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'system-ui',
      background: '#1a1a1a',
      color: '#ffffff',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>✅ Simple Test App</h1>
      <p style={{ fontSize: '18px', marginBottom: '10px' }}>If you can see this, React is working!</p>
      <div style={{
        padding: '20px',
        background: '#2a2a2a',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <p style={{ fontSize: '16px' }}>App loaded at: {new Date().toLocaleTimeString()}</p>
        <p style={{ fontSize: '16px', marginTop: '10px' }}>React version: {React.version}</p>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <SimpleTest />
    </McpBridgeProvider>
  );
} else {
  document.body.innerHTML = '<div style="color:red;padding:40px">ERROR: Root element not found</div>';
}
