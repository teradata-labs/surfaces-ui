# Phase 8: MCP Apps Deployment - Research

**Researched:** 2026-02-17
**Domain:** Single-file HTML bundling for MCP Apps distribution with postMessage bridge
**Confidence:** HIGH

## Summary

Phase 8 implements production-ready deployment of the json-render NLGenerator component as a standalone MCP App using the MCP Apps protocol. The technical foundation is well-established: the project already uses `@modelcontextprotocol/ext-apps` v1.0.1 for the App class and `vite-plugin-singlefile` v0.13.5 for single-file HTML bundling, with an existing reference implementation in `sql-editor-cdn.tsx/html`. The architecture follows the established pattern of creating an HTML entry point that instantiates the App class for postMessage communication with the MCP host (Claude Desktop, etc.), wrapping the UI in ThemeProvider for theme support, and building with Vite to produce a single HTML file with all assets inlined.

The primary deployment workflow involves creating a `json-render-cdn.html` entry point that imports `json-render-cdn.tsx`, which instantiates `McpAppsBridge`, wraps `NLGenerator` and `SurfacesRenderer` in required providers (McpBridgeProvider, ThemeProvider), configures `vite.config.apps.ts` to build the new entry point using `viteSingleFile()`, and runs bundle size verification to ensure the output stays under 500KB gzipped. The McpAppsBridge class already exists and provides the complete postMessage abstraction with methods for `connect()`, `callServerTool()`, and `openLink()`, eliminating the need for custom bridge implementation.

**Primary recommendation:** Create `src/apps/json-render-cdn.tsx` following the existing `sql-editor-cdn.tsx` pattern, wrapping NLGenerator with data prop for rendering via SurfacesRenderer, update `vite.config.apps.ts` rollupOptions.input array to include the new entry point, build and verify bundle size with `rollup-plugin-visualizer` for analysis.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/ext-apps | 1.0.1 | App class for MCP host communication | Official MCP Apps SDK, already integrated in project |
| vite-plugin-singlefile | 0.13.5 | Inline all assets into single HTML | Already used for sql-editor-cdn, proven for MCP Apps |
| Vite | 5.x | Build tool with Rollup | Project standard, excellent tree-shaking and minification |
| React | 18.3.1 | UI framework | Project dependency, peer dep for components |
| McpAppsBridge | Internal | Abstraction over App class | Already implemented in src/bridge/McpAppsBridge.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rollup-plugin-visualizer | Latest | Bundle size analysis | Verify 500KB gzip requirement, identify bloat |
| vite-plugin-compression | Latest | Pre-generate gzip files | Optional - helps test actual gzip size during build |
| @vitejs/plugin-react-swc | 3.x | Fast React refresh | Already in devDependencies, faster than Babel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-singlefile | Manual asset inlining | vite-plugin-singlefile is battle-tested, manual inlining error-prone |
| McpAppsBridge | Direct App class | Bridge provides tool name mapping and response normalization already |
| Single HTML bundle | Multi-file with CSP | Single-file simpler for distribution, CSP requires server config |

**Installation:**
```bash
# All core dependencies already installed in package.json
# Optional for bundle analysis:
npm install -D rollup-plugin-visualizer vite-plugin-compression
```

## Architecture Patterns

### Recommended Project Structure
```
packages/components/src/apps/
├── json-render-cdn.html       # HTML entry point
├── json-render-cdn.tsx        # React app entry
├── sql-editor-cdn.html        # Existing reference
└── sql-editor-cdn.tsx         # Existing reference

packages/components/dist/apps/
├── json-render-cdn.html       # Built single-file bundle
└── sql-editor-cdn.html        # Existing build output
```

### Pattern 1: MCP App Entry Point Structure
**What:** HTML + TypeScript entry that instantiates McpAppsBridge and renders UI with providers
**When to use:** Every MCP App deployment (required pattern for MCP Apps protocol)
**Example:**
```typescript
// Source: Existing sql-editor-cdn.tsx pattern
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NLGenerator } from '../catalog/NLGenerator';
import { SurfacesRenderer } from '../catalog/renderer';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();

// Render the application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ThemeProvider theme="system">
        <div className="p-4 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">JSON Render UI Generator</h1>
          <NLGenerator
            renderSpec={(spec) => (
              <SurfacesRenderer
                spec={spec}
                bridge={bridge}
                theme="system"
              />
            )}
            showExamples
          />
        </div>
      </ThemeProvider>
    </McpBridgeProvider>
  );
}
```

### Pattern 2: Single-File HTML Build Configuration
**What:** Vite config that bundles all assets (JS, CSS, images) into single HTML file
**When to use:** For MCP Apps distribution to avoid CSP configuration complexity
**Example:**
```typescript
// Source: Existing vite.config.apps.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/apps',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'sql-editor-cdn': resolve(__dirname, 'src/apps/sql-editor-cdn.html'),
        'json-render-cdn': resolve(__dirname, 'src/apps/json-render-cdn.html'), // NEW
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

### Pattern 3: McpAppsBridge Lifecycle Management
**What:** Proper initialization and cleanup of App instance for postMessage communication
**When to use:** Always - prevents memory leaks and ensures proper host connection
**Example:**
```typescript
// Source: Existing McpAppsBridge implementation
import { App } from '@modelcontextprotocol/ext-apps';

export class McpAppsBridge {
  private app: App;
  private connected: boolean;

  constructor(config?: McpBridgeConfig) {
    this.app = new App({ name: 'SurfacesUI', version: '1.0.0' });
    this.connected = false;
  }

  connect(): void {
    if (this.connected) return;
    this.app.connect();

    // Listen for tool results pushed from host
    this.app.ontoolresult = (toolResult: unknown) => {
      const renderData: McpRenderData = { toolOutput: toolResult };
      for (const listener of this.listeners) {
        listener(renderData);
      }
    };
    this.connected = true;
  }

  async callTool<T>(toolName: string, args?: Record<string, unknown>): Promise<McpToolResult<T>> {
    const toolResult = await this.app.callServerTool({
      name: toolName,
      arguments: args ?? {},
    });
    // Parse and normalize response...
  }
}
```

### Pattern 4: Theme Integration in MCP Apps
**What:** ThemeProvider wraps entire app to inherit host theme preferences
**When to use:** All MCP Apps should respect system/host theme for consistency
**Example:**
```typescript
// Source: Existing ThemeProvider implementation
import { ThemeProvider } from '../theme/ThemeProvider';

// In app entry point:
<ThemeProvider theme="system" density="comfortable">
  {/* App content */}
</ThemeProvider>

// ThemeProvider automatically:
// 1. Detects system preference (light/dark)
// 2. Applies 'dark' class to document.documentElement
// 3. Listens for system preference changes
// 4. Sets data-density attribute for CSS scaling
```

### Anti-Patterns to Avoid
- **Not calling bridge.connect():** App won't receive tool results or communicate with host
- **Multiple App instances:** Creates duplicate postMessage listeners, causes race conditions
- **Forgetting ThemeProvider:** UI won't match host appearance, breaks user expectations
- **Hardcoded theme/density:** Should default to 'system' and 'comfortable' to respect user preferences
- **Not testing bundle size:** 500KB gzip limit is hard requirement, exceeding breaks MCP Apps hosts

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| postMessage bridge | Custom window.postMessage handlers | @modelcontextprotocol/ext-apps App class | Official SDK handles JSON-RPC protocol, versioning, error handling, host capabilities negotiation |
| Single-file bundling | Custom asset inlining scripts | vite-plugin-singlefile | Handles edge cases (base64 images, CSS @imports, font URLs), 2-year production track record |
| Theme detection | Manual prefers-color-scheme queries | ThemeProvider from project | Already handles system preference, localStorage persistence, SSR safety, change listeners |
| Bundle size analysis | Manual gzip testing | rollup-plugin-visualizer | Visual treemap shows what's bloating bundle, drill-down to specific imports |

**Key insight:** The MCP Apps protocol is complex (JSON-RPC over postMessage with capability negotiation) - using the official SDK eliminates hundreds of lines of error-prone bridge code. The existing McpAppsBridge already wraps the SDK with project-specific conventions (tool name mapping, response normalization), so just use it.

## Common Pitfalls

### Pitfall 1: Bundle Size Explosion from Dependencies
**What goes wrong:** Bundle exceeds 500KB gzip due to heavy dependencies (ECharts, CodeMirror, json-render)
**Why it happens:** Importing entire libraries instead of tree-shakeable modules, no bundle analysis during development
**How to avoid:** Use named imports (`import { Renderer } from '@json-render/react'` not `import * as JsonRender`), analyze with rollup-plugin-visualizer, consider lazy loading for heavy components
**Warning signs:** Build output shows large chunk sizes, slow initial page load, host rejects oversized bundle

### Pitfall 2: Missing Bridge Connection Call
**What goes wrong:** App renders but never receives tool results from host, no MCP tool calls work
**Why it happens:** Forgetting to call `bridge.connect()` after instantiation, calling it conditionally/async
**How to avoid:** Call `bridge.connect()` synchronously in top-level app code before rendering, verify connection in dev tools (check for postMessage traffic)
**Warning signs:** NLGenerator renders but never gets specs, console shows "not connected" errors, no postMessage events in Network tab

### Pitfall 3: Theme Flicker on Load (FOUC)
**What goes wrong:** Page loads in light mode then flashes to dark mode after React hydrates
**Why it happens:** ThemeProvider initializes theme client-side, no inline script to set class before render
**How to avoid:** Add inline script in HTML head to set `dark` class before React loads (see Phase 6 patterns)
**Warning signs:** Visible flash when opening app, users report "blinding white flash" on dark mode systems

### Pitfall 4: CSS Not Inlined Correctly
**What goes wrong:** Bundle references external CSS files that fail to load in sandboxed iframe
**Why it happens:** vite-plugin-singlefile has edge cases with @import, font-face URLs, or complex Tailwind configs
**How to avoid:** Test bundle by opening HTML file directly (file:// protocol), verify no external requests in Network tab, inline critical fonts
**Warning signs:** Unstyled content on load, missing fonts, broken layouts in production but not dev

### Pitfall 5: Exceeding iframe Sandbox Restrictions
**What goes wrong:** Features work in dev server but fail in MCP Apps host due to sandbox CSP
**Why it happens:** Sandboxed iframes block certain APIs (localStorage, cookies, window.open, etc.)
**How to avoid:** Use bridge.openLink() for external URLs instead of window.open, avoid localStorage (use in-memory state), test in actual MCP Apps host early
**Warning signs:** Features work locally but break in Claude Desktop, console errors about sandbox restrictions

## Code Examples

Verified patterns from official sources and current implementations:

### MCP Apps Entry Point with Bridge Initialization
```typescript
// Source: modelcontextprotocol.io/docs/extensions/apps official examples
import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'MyApp', version: '1.0.0' });

// Establish communication with the host
app.connect();

// Handle the initial tool result pushed by the host
app.ontoolresult = (result) => {
  const data = result.content?.find((c) => c.type === 'text')?.text;
  // Update UI with data
};

// Proactively call tools when users interact
button.addEventListener('click', async () => {
  const result = await app.callServerTool({
    name: 'get-data',
    arguments: { query: '...' },
  });
  // Process result
});
```

### Vite Single-File Bundle Configuration
```typescript
// Source: vite-plugin-singlefile npm package docs
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: 'src/apps/my-app.html',
    },
  },
});

// Produces: dist/my-app.html with all CSS/JS/images inlined
// No external requests needed - works in sandboxed iframes
```

### Bundle Size Analysis with Visualizer
```typescript
// Source: rollup-plugin-visualizer GitHub documentation
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true, // Auto-open in browser after build
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});

// After build: opens interactive treemap showing:
// - Which dependencies are largest
// - Actual gzip/brotli sizes
// - Drill-down to specific imports
```

### FOUC Prevention with Inline Script
```html
<!-- Source: Phase 6 theming implementation -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>JSON Render App</title>
  <script>
    // Set theme before React loads to prevent FOUC
    (function() {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
  <style>
    /* Inline critical CSS */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./json-render-cdn.tsx"></script>
</body>
</html>
```

### Tree-Shaking Optimization
```typescript
// Source: Existing codebase best practices

// BAD - imports entire library
import * as JsonRender from '@json-render/react';
import * as Lucide from 'lucide-react';

// GOOD - named imports enable tree-shaking
import { Renderer, StateProvider } from '@json-render/react';
import { ChevronDown, Filter } from 'lucide-react';

// BAD - re-exports bloat bundle
export * from './components';

// GOOD - explicit exports
export { DataTable } from './components/DataTable';
export { Chart } from './components/Chart';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-file HTML + CSP config | Single-file HTML with vite-plugin-singlefile | 2024 (MCP Apps v1.0 release) | Eliminates CSP complexity, works in sandboxed iframes out-of-box |
| Custom postMessage handlers | @modelcontextprotocol/ext-apps SDK | Jan 2026 (MCP Apps standardized) | Official protocol implementation, versioning, future-proof |
| Webpack + manual inlining | Vite + viteSingleFile plugin | 2023-2024 (Vite maturity) | Faster builds, better tree-shaking, simpler config |
| Manual theme detection | ThemeProvider with system preference | 2025 (React 18 patterns) | Automatic light/dark switching, no FOUC, SSR-safe |

**Deprecated/outdated:**
- **Separate MCP server for UI hosting:** MCP Apps resources are fetched via MCP protocol, no separate HTTP server needed
- **iframe sandbox="allow-scripts":** MCP Apps hosts use stricter sandbox policies, apps must use bridge for external access
- **CSS-in-JS for theming:** CSS custom properties + Tailwind faster and smaller than styled-components/emotion

## Open Questions

1. **NLGenerator data source in standalone app**
   - What we know: NLGenerator calls `/api/generate-ui` endpoint, which doesn't exist in standalone HTML bundle
   - What's unclear: Should we mock the endpoint, expect FastMCP server to be running, or add backend URL configuration?
   - Recommendation: Add `baseUrl` prop to NLGenerator, default to `window.location.origin`, document that users need FastMCP server running

2. **Bundle size with all dependencies**
   - What we know: React (45KB), json-render (30KB), ECharts (200KB), CodeMirror (150KB) = 425KB before gzip (~140KB gzipped)
   - What's unclear: Whether full bundle stays under 500KB gzip with NLGenerator, SurfacesRenderer, and all registry components
   - Recommendation: Build prototype bundle, analyze with visualizer, consider lazy loading ECharts/CodeMirror if needed

3. **Error handling when MCP server unavailable**
   - What we know: NLGenerator will fail if `/api/generate-ui` unreachable, shows error UI
   - What's unclear: Best user experience - show connection check UI, graceful degradation, or just error message?
   - Recommendation: Phase 8 shows error message (simplest), Phase 9 can add connection status indicator if needed

4. **Testing MCP Apps in development**
   - What we know: Can test in Claude Desktop (requires cloudflared tunnel) or basic-host (local test harness)
   - What's unclear: Whether to include basic-host setup in repository or document external testing only
   - Recommendation: Document both approaches, prioritize Claude Desktop testing as primary target

## Sources

### Primary (HIGH confidence)
- [MCP Apps Official Documentation](https://modelcontextprotocol.io/docs/extensions/apps) - Complete protocol specification and examples
- [MCP Apps Blog Announcement](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - Architecture and design rationale
- [ext-apps GitHub Repository](https://github.com/modelcontextprotocol/ext-apps) - Official SDK and examples
- [ext-apps Specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) - JSON-RPC protocol details
- [vite-plugin-singlefile npm](https://www.npmjs.com/package/vite-plugin-singlefile) - Plugin configuration and usage
- Existing codebase: `src/bridge/McpAppsBridge.ts`, `src/apps/sql-editor-cdn.tsx`, `vite.config.apps.ts`

### Secondary (MEDIUM confidence)
- [MCP Apps Patterns](https://modelcontextprotocol.github.io/ext-apps/api/documents/Patterns.html) - Advanced integration patterns
- [WorkOS Blog: MCP Apps](https://workos.com/blog/2026-01-27-mcp-apps) - Real-world implementation insights
- [Builder.io: MCP Apps Future](https://www.builder.io/blog/mcp-apps) - Industry perspective on protocol adoption
- [vite-plugin-singlefile GitHub](https://github.com/richardtallent/vite-plugin-singlefile) - Source code and edge cases
- [Vite Build Options](https://vite.dev/config/build-options) - Minification and optimization settings

### Tertiary (LOW confidence - for awareness)
- [rollup-plugin-visualizer GitHub](https://github.com/btd/rollup-plugin-visualizer) - Bundle analysis visualization
- [React Bundle Optimization Guide](https://medium.com/@jajibhee/the-complete-guide-to-javascript-bundle-optimization-code-splitting-and-tree-shaking-7ddbdcbd7957) - Tree-shaking patterns
- [vite-plugin-compression GitHub](https://github.com/vbenjs/vite-plugin-compression) - Pre-compression during build

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in package.json, reference implementation exists
- Architecture: HIGH - Existing sql-editor-cdn.tsx demonstrates exact pattern needed
- Pitfalls: MEDIUM - Based on MCP Apps community reports and single-file bundle common issues
- Bundle optimization: MEDIUM - General React best practices apply, project-specific needs TBD

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days - stable technology, MCP Apps v1.0 released)

**Key dependencies validated:**
- @modelcontextprotocol/ext-apps v1.0.1 in package.json ✓
- vite-plugin-singlefile v0.13.5 in package.json ✓
- Existing McpAppsBridge implementation in src/bridge/McpAppsBridge.ts ✓
- Existing sql-editor-cdn reference in src/apps/sql-editor-cdn.tsx ✓
- vite.config.apps.ts with viteSingleFile() plugin ✓

**Critical path items:**
1. Create json-render-cdn.html and json-render-cdn.tsx entry points
2. Integrate NLGenerator + SurfacesRenderer with McpBridgeProvider + ThemeProvider
3. Update vite.config.apps.ts rollupOptions.input to include new entry
4. Build and verify bundle size with rollup-plugin-visualizer
5. Test in Claude Desktop or basic-host to verify postMessage communication
6. Document FastMCP server requirement for /api/generate-ui endpoint
