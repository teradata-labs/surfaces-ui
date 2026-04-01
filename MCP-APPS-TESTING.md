# MCP Apps Testing Guide

## Critical Requirements for Rendering in Claude Desktop

### ✅ REQUIRED: McpBridgeProvider

**All MCP Apps MUST wrap their component tree with `McpBridgeProvider` to render in Claude Desktop.**

```tsx
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';

// Create bridge instance before component
const bridge = new McpAppsBridge();
bridge.connect();

// Render with McpBridgeProvider wrapper
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <YourApp />
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
```

### Why This Matters

**McpBridgeProvider blocks rendering until the bridge is connected** (see `packages/components/src/bridge/McpBridgeProvider.tsx:118-120`):

```typescript
// Don't render children until bridge is ready
if (!bridgeRef.current) {
  return null;
}
```

This ensures proper synchronization with Claude Desktop's iframe rendering system.

**Without McpBridgeProvider:**
- ❌ App tries to render immediately
- ❌ Claude Desktop iframe may not be ready
- ❌ Result: No UI shown, only automated "[This tool call rendered an interactive widget...]" message

**With McpBridgeProvider:**
- ✅ Bridge connects and establishes postMessage communication
- ✅ Provider waits for handshake to complete
- ✅ Children render only when bridge is ready
- ✅ Result: UI displays successfully

---

## Historical Context (Root Cause Analysis)

### What Went Wrong

During initial debugging, we observed:
- `show_dashboard` rendered perfectly ✅
- `show_react_test`, `show_component_gallery`, `show_simple_test` showed only automated message ❌

We initially suspected:
1. ❌ JSON-render library dependency (red herring)
2. ❌ MCP protocol handshake issues (partially related)
3. ❌ URI scheme format (fixed but not root cause)
4. ❌ Required vs optional parameters (good practice but not root cause)

### The Real Issue

Apps were inconsistent:

**Working Apps (always had McpBridgeProvider):**
- `sql-editor-cdn.tsx` ✅
- `dashboard-viewer.tsx` ✅
- `json-render-cdn.tsx` ✅
- `demo-loom.tsx` ✅

**Broken Apps (missing McpBridgeProvider):**
- `component-gallery.tsx` ❌
- `simple-test.tsx` ❌
- `react-test.tsx` ❌ (before fix)

**Key Discovery:** Creating `test-viewer.tsx` as an exact copy of `dashboard-viewer.tsx` revealed the pattern. Removing json-render but keeping McpBridgeProvider proved json-render was irrelevant.

**Adding McpBridgeProvider to react-test.tsx fixed the rendering issue.**

---

## Testing Checklist for New MCP Apps

Before shipping any MCP app, verify:

### 1. Required Components
- [ ] Has `McpBridgeProvider` wrapping the component tree
- [ ] Has `ThemeProvider` for theme support
- [ ] Creates and connects `McpAppsBridge` instance before render
- [ ] Has proper tool definition in `packages/server/src/index.ts`
- [ ] Registered in `packages/mcp-adapter/src/registry.ts`
- [ ] Added to `vite.config.apps.ts` validApps list
- [ ] Added to `package.json` build:apps script

### 2. MCP Protocol Compliance
- [ ] Listens for `ui/notifications/tool-input` messages
- [ ] Sends `postMessage({ type: 'app-name-ready' }, '*')` handshake
- [ ] Has loading state while waiting for protocol handshake
- [ ] Tool has at least one required parameter (recommended)

### 3. Structure
```tsx
// Template structure
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ChartThemeProvider } from '../theme/ChartThemeProvider';

// 1. Create bridge BEFORE component
const bridge = new McpAppsBridge();
bridge.connect();

// 2. Component with message listener
function MyApp() {
  const [status, setStatus] = React.useState<'loading' | 'ready'>('loading');

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.method === 'ui/notifications/tool-input') {
        setStatus('ready');
      }
    };
    window.addEventListener('message', handleMessage);

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'my-app-ready' }, '*');
    }

    const timeout = setTimeout(() => setStatus('ready'), 1000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, [status]);

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  return <YourUI />;
}

// 3. Render with all required providers
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider persistTheme density="comfortable">
        <ChartThemeProvider persistTheme>
          <MyApp />
        </ChartThemeProvider>
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
```

### 4. Build & Test
```bash
# Build the app
pnpm build

# Test in Claude Desktop
# 1. Restart Claude Desktop to pick up new build
# 2. Call the tool from chat
# 3. Verify UI renders (not just automated message)
# 4. Check console logs for bridge connection
# 5. Test theme toggle, interactions
```

### 5. Verification in Claude Desktop

**Success Criteria:**
- ✅ UI displays in iframe immediately (within 1-2 seconds)
- ✅ Theme toggle works
- ✅ All interactive elements functional
- ✅ Console shows `[AppName] Notifying parent: ready`
- ✅ No errors in browser console (Cmd+Opt+I in Claude Desktop)

**Failure Indicators:**
- ❌ Only shows automated "[This tool call rendered an interactive widget...]" message
- ❌ No iframe appears
- ❌ Console shows bridge connection errors
- ❌ App renders but theme doesn't apply

---

## Common Pitfalls

### 1. Forgetting McpBridgeProvider
**Symptom:** Tool call succeeds, logs show HTML loaded, but no UI appears

**Fix:** Add McpBridgeProvider wrapper as shown above

### 2. Creating Bridge Inside Component
**Symptom:** Bridge recreates on every render, connection issues

**Fix:** Create bridge at module level, not inside component

```tsx
// ❌ WRONG - creates new bridge every render
function MyApp() {
  const bridge = new McpAppsBridge();
  bridge.connect();
  // ...
}

// ✅ CORRECT - create once at module level
const bridge = new McpAppsBridge();
bridge.connect();

function MyApp() {
  // Use existing bridge
}
```

### 3. Missing ChartThemeProvider
**Symptom:** Charts render without theme, wrong colors in dark mode

**Fix:** Add ChartThemeProvider between ThemeProvider and app component

### 4. Not Testing in Actual Claude Desktop
**Symptom:** Works in browser dev server but not in Claude Desktop

**Fix:** Always test final built HTML in Claude Desktop, not just dev server

---

## Reference Apps

**Good Examples (copy these patterns):**
- `packages/components/src/apps/test-viewer.tsx` - Minimal working example
- `packages/components/src/apps/dashboard-viewer.tsx` - Full-featured with json-render
- `packages/components/src/apps/sql-editor-cdn.tsx` - Complex editor app

**Updated Examples (recently fixed):**
- `packages/components/src/apps/react-test.tsx` - Now has McpBridgeProvider

---

## Related Documentation

- See `MCP-APPS-COMMUNICATION.md` for postMessage protocol details
- See `CLAUDE.md` for overall project architecture
- See `packages/components/src/bridge/README.md` for bridge API reference

---

## Date of Discovery

**2026-03-30** - Root cause identified after extensive debugging session. The issue was that `McpBridgeProvider` was present in all working apps (sql-editor, dashboard-viewer, json-render) but missing from test apps (component-gallery, simple-test, react-test). Adding McpBridgeProvider to react-test resolved the rendering issue.

**Key Learning:** Always include McpBridgeProvider in MCP Apps, even if the app doesn't actively use the bridge for API calls. The provider's connection synchronization is required for proper rendering in Claude Desktop.
