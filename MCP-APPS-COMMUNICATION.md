# MCP Apps Communication Protocol

## Critical Discovery: How Claude Desktop Sends Data to MCP Apps

### The Problem
URL-based data passing **does NOT work**:
- ❌ Query parameters (`?specId=123`) are stripped by Claude Desktop
- ❌ URL hash/fragments (`#base64data`) are stripped by Claude Desktop
- ❌ Custom URI schemes with data are normalized to base resource URI

### The Solution: postMessage Protocol

Claude Desktop communicates with MCP Apps via **postMessage** using a specific protocol:

#### Tool Input Message Format
```typescript
{
  method: "ui/notifications/tool-input",
  params: {
    arguments: {
      // Your tool arguments go here
      spec: { ... },
      title: "...",
      // etc.
    }
  },
  jsonrpc: "2.0"
}
```

#### How to Extract Data in Your App

```typescript
window.addEventListener('message', (event: MessageEvent) => {
  // Check for tool-input notification
  if (event.data?.method === 'ui/notifications/tool-input') {
    const args = event.data.params.arguments;

    // Access your tool parameters
    const spec = args.spec;
    const title = args.title;

    // Use the data
    setSpec(spec);
  }
});
```

#### Complete Example from dashboard-viewer.tsx

```typescript
React.useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    let receivedSpec: Spec | null = null;

    // CORRECT: Extract from tool-input notification
    if (event.data?.method === 'ui/notifications/tool-input' &&
        event.data?.params?.arguments?.spec) {
      receivedSpec = event.data.params.arguments.spec;
    }

    if (receivedSpec) {
      setSpec(receivedSpec);
    }
  };

  window.addEventListener('message', handleMessage);

  // Notify parent the app is ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'app-ready' }, '*');
  }

  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Other Message Types You Might Receive

1. **Protocol handshake**
   ```json
   {
     "result": {
       "protocolVersion": "2026-01-26",
       "hostCapabilities": { ... }
     },
     "jsonrpc": "2.0",
     "id": 0
   }
   ```

2. **Tool result notification**
   ```json
   {
     "method": "ui/notifications/tool-result",
     "params": {
       "content": [ ... ]
     }
   }
   ```

3. **Host context changes** (theme, locale, etc.)
   ```json
   {
     "method": "ui/notifications/host-context-changed",
     "params": {
       "theme": "dark",
       "locale": "en-US",
       "timeZone": "America/Chicago"
     }
   }
   ```

## Debug Component for MCP Apps

A reusable `MCPDebugPanel` component is available at `packages/components/src/apps/MCPDebugPanel.tsx`.

### Usage

```typescript
import { MCPDebugPanel } from './MCPDebugPanel';

// Enable debug panel for development
const ENABLE_DEBUG = true; // Set to false for production

function MyApp() {
  return (
    <div>
      {ENABLE_DEBUG && <MCPDebugPanel />}
      {/* Your app content */}
    </div>
  );
}
```

### Features
- ✅ Collapsible panel (click header to toggle)
- ✅ Shows URL, hash, and all postMessage events
- ✅ Real-time message logging with timestamps
- ✅ Auto-fading older messages for clarity
- ✅ No external dependencies (pure React)

Since Claude Desktop doesn't allow DevTools access, this panel is essential for debugging.

## Manual Debug Pattern (if needed)

If you prefer inline debug code instead of the component:

```typescript
React.useEffect(() => {
  // Create debug panel
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-output';
  debugDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: black;
    color: lime;
    padding: 8px;
    font-family: monospace;
    font-size: 10px;
    z-index: 9999;
    max-height: 200px;
    overflow: auto;
  `;
  debugDiv.innerHTML = `
    <div>APP DEBUG</div>
    <div>URL: ${window.location.href}</div>
    <div>Hash: ${window.location.hash}</div>
  `;
  document.body.appendChild(debugDiv);

  // Helper to add debug messages
  const addDebug = (msg: string) => {
    const debugDiv = document.getElementById('debug-output');
    if (debugDiv) {
      debugDiv.innerHTML += `<div>${msg}</div>`;
    }
    console.log(msg); // Also log to console
  };

  // Use addDebug throughout your code
  addDebug('✓ Component mounted');

  const handleMessage = (event: MessageEvent) => {
    addDebug(`📨 Message from: ${event.origin}`);
    addDebug(`   Type: ${typeof event.data}`);
    addDebug(`   Keys: ${Object.keys(event.data).join(', ')}`);

    const dataStr = JSON.stringify(event.data, null, 2);
    addDebug(`   Data: ${dataStr.substring(0, 200)}...`);

    // Process message...
  };

  window.addEventListener('message', handleMessage);

  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Debug Panel Benefits
- ✅ Visible in Claude Desktop (no DevTools needed)
- ✅ Shows URL, hash, all received messages
- ✅ Real-time updates as messages arrive
- ✅ Helps diagnose protocol issues quickly

## Server-Side: How to Pass Data

In your MCP server tool handler:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "show_dashboard") {
    const spec = args?.spec;

    // Simply return the data in _meta.ui
    // Claude Desktop will send it via postMessage as tool-input
    return {
      _meta: {
        ui: {
          resourceUri: "ui://dashboard-viewer",
          // No need to encode or pass in URL - just put it here
          // Claude Desktop handles the rest
        },
      },
      content: [
        {
          type: "text",
          text: "Opening dashboard...",
        },
      ],
    };
  }
});
```

**Note**: The spec data is automatically extracted from `args` and sent to the app via `ui/notifications/tool-input` message. You don't need to explicitly pass it in `_meta` - Claude Desktop does this automatically.

## Key Lessons

1. **MCP Apps run in sandboxed iframes** with URLs like:
   ```
   https://[hash].claudemcpcontent.com/mcp_apps?resource-src=https://assets.claude.ai
   ```

2. **All URL-based data passing fails** because Claude Desktop normalizes URIs to just the base resource identifier

3. **postMessage is the ONLY reliable way** to pass data to MCP Apps

4. **The protocol is specific**: Look for `ui/notifications/tool-input` with `params.arguments`

5. **Debug panels are essential** since DevTools access is restricted

6. **Console logs work** but you can't see them without DevTools - use visual debug panels instead

## Testing Checklist

When building MCP Apps:
- [ ] Add visual debug panel showing URL, hash, message count
- [ ] Log ALL postMessage events with full structure
- [ ] Check for `ui/notifications/tool-input` specifically
- [ ] Extract data from `params.arguments.[yourParam]`
- [ ] Test with real Claude Desktop (not just browser)
- [ ] Verify data appears in debug panel before using it

## Files Reference

- **Dashboard implementation**: `packages/components/src/apps/dashboard-viewer.tsx`
- **Server tool handler**: `packages/server/src/index.ts`
- **MCP adapter**: `packages/mcp-adapter/src/resources.ts`
