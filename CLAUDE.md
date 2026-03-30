# SurfacesUI - Session Instructions for Claude

## Project Overview

Reusable React component library served as pre-built HTML bundles via MCP. Three packages: `@surfacesui/components` (React library + bridges), `@surfacesui/mcp-adapter` (framework-agnostic adapter for embedding in any MCP server), and `@surfacesui/server` (standalone Node.js MCP server).

## Architecture

- **packages/components/** - React component library (Vite + TypeScript + Tailwind)
- **packages/mcp-adapter/** - Framework-agnostic MCP resource adapter (pure TypeScript, no SDK dependency)
- **packages/server/** - Standalone Node.js MCP server (uses `@modelcontextprotocol/sdk` + `@surfacesui/mcp-adapter`)
- **.claude/agents/** - UX, Engineering, and Testing review agents

## Key Patterns

### MCP Apps Communication (CRITICAL)
**See MCP-APPS-COMMUNICATION.md for complete details.**
**See MCP-APPS-TESTING.md for testing checklist and requirements.**

**⚠️ REQUIRED: All MCP Apps MUST use McpBridgeProvider to render in Claude Desktop.**

```tsx
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';

// Create bridge instance BEFORE component (at module level)
const bridge = new McpAppsBridge();
bridge.connect();

// Wrap app with McpBridgeProvider
createRoot(root).render(
  <McpBridgeProvider bridge={bridge}>
    <ThemeProvider persistTheme density="comfortable">
      <MyApp />
    </ThemeProvider>
  </McpBridgeProvider>
);
```

**Why:** McpBridgeProvider blocks rendering until the bridge connects, ensuring proper synchronization with Claude Desktop. Without it, apps will not render (only show automated message).

MCP Apps receive data via postMessage, NOT via URL parameters:
```typescript
// CORRECT: Listen for tool-input notifications
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.method === 'ui/notifications/tool-input') {
    const args = event.data.params.arguments;
    // Use args.spec, args.title, etc.
  }
});

// WRONG: URL params and hash are stripped by Claude Desktop
const params = new URLSearchParams(window.location.search); // Always empty!
const hash = window.location.hash; // Always empty!
```

**Debug pattern**: Use `MCPDebugPanel` component (see MCP-APPS-COMMUNICATION.md) since DevTools aren't accessible in Claude Desktop:
```tsx
import { MCPDebugPanel } from './MCPDebugPanel';
const ENABLE_DEBUG = true; // Toggle for development
{ENABLE_DEBUG && <MCPDebugPanel />}
```

### MCP Bridge (NOT direct API calls)
Components NEVER call REST APIs directly. All data flows through the MCP Bridge:
```tsx
// CORRECT
const { data, loading } = useMcpTool('execute_sql', { query, connectionId });

// WRONG - never do this
const response = await fetch('/api/v1/query', ...);
```

### Theming
- All colors via CSS custom properties (`--background`, `--foreground`, etc.)
- NEVER hardcode colors. Use Tailwind semantic tokens or CSS vars.
- Dark mode via `class` strategy on document root
- WCAG utility classes: `text-error-accessible`, `text-warning-accessible`, etc.

### Analytics
- Optional via `useAnalytics()` hook
- Returns null if no provider configured
- Always use optional chaining: `analytics?.trackEvent('name')`

### Branding
- No hardcoded Teradata/Terry references in components
- Branding elements (icons, names) are configurable via props/slots
- Teradata theme is a preset consumers can opt into

## Quality Gates

**Nothing ships with open P0 or P1 issues.**

| Severity | Definition | Blocks? |
|----------|-----------|---------|
| P0 | Crash, data loss, security, complete feature failure | YES |
| P1 | Major feature broken (no workaround), WCAG failure, broken MCP comms | YES |
| P2 | Degraded feature (workaround exists), minor styling | No |
| P3 | Cosmetic, polish, code style | No |

### Review Pipeline
Every component must pass all 3 agents:
1. **UX Agent** - WCAG AA 2.2, Teradata UX principles, atomic design (<400 lines)
2. **Engineering Agent** - Strict TypeScript, MCP correctness, perf, security, <500KB bundle
3. **Testing Agent** - 80% coverage, axe-core, bridge mocks, theme tests

## Component Size Rules (Atomic Design)

- **Atoms** (<50 lines): Buttons, icons, badges, inputs
- **Molecules** (50-150 lines): Search bars, form groups, status indicators
- **Organisms** (150-400 lines): Panels, editors, browsers
- **>400 lines**: MUST be decomposed with specific split recommendations

## Commands

```bash
# Development
pnpm install
pnpm dev

# Build (components -> mcp-adapter -> server, in dependency order)
pnpm build
pnpm build:apps               # HTML app bundles only

# Test
pnpm test
pnpm --filter @surfacesui/components test:coverage
pnpm --filter @surfacesui/mcp-adapter test

# Run standalone MCP server
pnpm --filter @surfacesui/server start
# Or via npx: npx @surfacesui/server
```

## File Structure Convention

Each component lives in its own directory with co-located tests:
```
src/components/[name]/
├── index.ts                       # Barrel export
├── [Name].tsx                     # Main component
├── [SubComponent].tsx             # Sub-components
├── [Name].test.tsx                # Unit tests
├── [Name].a11y.test.tsx           # Accessibility tests
├── [Name].integration.test.tsx    # Bridge integration tests
├── types.ts                       # Component-specific types
└── hooks.ts                       # Component-specific hooks
```

## Never Forget

- **ALL MCP Apps MUST use McpBridgeProvider** - Without it, apps won't render in Claude Desktop (see MCP-APPS-TESTING.md)
- Components communicate via MCP Bridge, not REST
- All styling through CSS custom properties + Tailwind tokens
- 400-line component limit enforced by all agents
- 80% test coverage minimum
- axe-core 0 violations required
- Bundle size target: ~700KB gzipped per HTML app (sql-editor is ~660KB with React 19 + ECharts)
- Branding is always configurable, never hardcoded
