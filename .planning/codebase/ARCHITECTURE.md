# Architecture

**Analysis Date:** 2026-02-15

## Pattern Overview

**Overall:** MCP-Bridge Component Architecture

SurfacesUI is a decoupled React component library that communicates exclusively through the MCP (Model Context Protocol) Bridge layer. Components never make direct API calls; instead, all data flows through a postMessage-based bridge that abstracts communication with an MCP host (either a FastMCP Python server or Claude Desktop's MCP Apps environment).

**Key Characteristics:**
- **Bridge-first communication** - All external data flows through McpBridge using postMessage
- **Layered isolation** - Primitives (basic UI) → Components (business logic) → Apps (deployable bundles)
- **Declarative theming** - CSS custom properties + Tailwind tokens, no hardcoded colors
- **Streaming and pagination support** - Built-in hooks for complex data patterns
- **Tool-agnostic** - Components call abstract tool names; actual implementation lives in MCP host

## Layers

**Bridge Layer:**
- Purpose: Abstracts postMessage communication between UI and MCP host
- Location: `src/bridge/`
- Contains: McpBridge (core class), McpAppsBridge (MCP Apps variant), hooks (useMcpTool, useMcpPagination, useMcpStream)
- Depends on: None (no external dependencies)
- Used by: All components via McpBridgeProvider context

**Primitive Components Layer:**
- Purpose: Unstyled, behavior-only UI building blocks
- Location: `src/primitives/`
- Contains: Button, Card, Dialog, Input, Select, Tabs, etc. (Radix UI + Tailwind)
- Depends on: React, Tailwind CSS, CSS custom properties
- Used by: Higher-level components and apps

**Business Logic Components Layer:**
- Purpose: Feature-rich, user-facing components
- Location: `src/components/`
  - `sql-editor/` - SQL query editor with CodeMirror, execution, and result display
  - `sql-results/` - Reusable results display with tables, charts, filtering
  - `charts/` - ECharts wrapper with theme integration
- Depends on: Primitives, Bridge hooks, theme tokens, external libraries (CodeMirror, ECharts)
- Used by: App bundles and external consumers

**Theme Layer:**
- Purpose: Centralized styling and color system
- Location: `src/theme/`
- Contains: ThemeProvider (React context), tokens.css (CSS variables), tailwind-preset.ts
- Depends on: React, Tailwind CSS, PostCSS
- Used by: All components via ThemeProvider

**Utility Layer:**
- Purpose: Shared helpers and cross-cutting concerns
- Location: `src/lib/`
- Contains: analytics hook, utility functions (cn for class merging)
- Depends on: React (optional for analytics hook)
- Used by: Components as needed

**App Bundle Layer:**
- Purpose: Standalone, self-contained HTML bundles for deployment
- Location: `src/apps/`
- Contains: Entry points that wire together components with bridge and theme
- Deployed as: Single-file HTML (via vite-plugin-singlefile)
- Examples: `sql-editor-cdn.tsx` builds to `sql-editor-cdn.html`

## Data Flow

**Tool Call Flow:**
1. Component calls `useMcpTool('execute_sql', { query })` or direct `bridge.callTool()`
2. Hook sets loading=true, sends message to window.parent via postMessage
3. MCP host receives message, routes to tool handler, executes
4. Host sends response back via postMessage with matching ID
5. Bridge resolves promise, hook sets data + loading=false
6. Component re-renders with result

**Streaming Flow:**
1. Component calls `useMcpStream('list_queries').start()`
2. Bridge generates unique stream ID, initiates stream via postMessage
3. MCP host sends chunks incrementally, each with stream ID
4. Bridge routes chunks to registered listeners via `onStreamChunk`
5. Hook accumulates chunks in state, component renders incrementally
6. When stream ends, bridge sends 'stream_end', hook sets isStreaming=false

**Pagination Flow:**
1. Component calls `useMcpPagination('list_items', pageSize)`
2. Pagination hook manages page state (0-indexed)
3. On page change, calls `bridge.fetchPage()` with offset/limit/filters
4. Bridge sends paginated request to host
5. Host returns { rows, total, offset, limit, hasMore }
6. Hook updates data array and total count, computes pageCount

**State Management:**
- **Local component state** - UI state (expanded, selected tab, etc.)
- **Hook state** - Loading, data, error states managed by useMcpTool/useMcpPagination/useMcpStream
- **localStorage (SQLEditor only)** - Persists query and results for 24 hours; replaces with fresh data from thread context when available
- **Theme context** - Current theme mode and token overrides shared via ThemeProvider
- **Analytics context (optional)** - Injected via AnalyticsProvider; null if not configured

## Key Abstractions

**McpBridge:**
- Purpose: Wraps postMessage communication in a request-response pattern
- Examples: `src/bridge/McpBridge.ts`, `src/bridge/McpAppsBridge.ts`
- Pattern:
  - Maintains nextId counter for request correlation
  - Tracks pending calls in Map<id, { resolve, reject, timer }>
  - Binds handleMessage once and stores bound reference for cleanup
  - All timeouts default to 30s; configurable
  - Validates origin on incoming messages (default: any origin)

**useMcpTool Hook:**
- Purpose: Generic MCP tool invocation with auto-fetch on mount/args-change
- Example usage:
  ```tsx
  const { data, loading, error, refetch } = useMcpTool<QueryResult>(
    'execute_sql',
    { query: 'SELECT * FROM users' },
    { refetchInterval: 5000 }
  );
  ```
- Handles: Auto-fetch control, refetch intervals, unmount cleanup

**useMcpPagination Hook:**
- Purpose: List-based tool calls with page state management
- Example usage:
  ```tsx
  const { data, page, pageCount, nextPage, prevPage, goToPage } =
    useMcpPagination<User>('list_users', 20, { department: 'engineering' });
  ```
- Handles: Page bounds, filter reset on filter change, total calculation

**useMcpStream Hook:**
- Purpose: Long-running operations that produce incremental results
- Example usage:
  ```tsx
  const { chunks, isStreaming, start, stop, reset } =
    useMcpStream<LogEntry>('stream_logs');
  ```
- Handles: Stream lifecycle (start/stop/cleanup), chunk accumulation, auto-unsubscribe on unmount

**ThemeProvider:**
- Purpose: System and user theme management
- Pattern: Context-based; resolves 'system' mode to actual light/dark via window.matchMedia
- Applies theme class to document root; components reference via CSS custom properties
- Supports token overrides as inline styles on wrapper

**SQLEditor:**
- Purpose: Full-featured SQL editor with MCP bridge integration
- Timing behavior: In MCP Apps context, polls `get_last_result` every 500ms for up to 5 seconds (Claude Desktop loads UI before query executes)
- State priority: Fresh data from thread → Persisted localStorage (24h TTL)

## Entry Points

**Library Entry Point:**
- Location: `src/index.ts`
- Triggers: Direct import from npm package `@surfacesui/components`
- Responsibilities: Exports all public types and components as barrel export

**App Entry Point (SQLEditor):**
- Location: `src/apps/sql-editor-cdn.tsx`
- Triggers: Built to `dist/apps/sql-editor-cdn.html` and loaded in MCP Apps context
- Responsibilities:
  1. Creates McpAppsBridge instance
  2. Wraps SQLEditor in McpBridgeProvider
  3. Imports tokens.css for theming
  4. Renders to #root

**Server Entry Point (Python):**
- Location: `server/src/main.py`
- Triggers: `python -m src.main`
- Responsibilities:
  1. Creates MCP server instance
  2. Registers `execute_sql` tool handler
  3. Registers UI resource list and content handlers
  4. Starts HTTP server on port 3000 (optional)
  5. Optionally spawns vantage-mcp subprocess (stdio mode)

## Error Handling

**Strategy:** Errors surface to component level; components decide how to display

**Patterns:**
- Bridge timeouts: Promise rejects with "McpBridge timeout after XXs"
- Tool errors: Returned as { success: false, error: "message" }
- Hook error state: Set and preserved until refetch succeeds
- Component-level: Each component displays its own error UI or passes error prop up
- Streaming errors: Stream ends with error message in finalResult
- Unmount safety: All hooks check mountedRef before state updates to prevent "can't perform React state update on unmounted component" warning

## Cross-Cutting Concerns

**Logging:** No structured logging in components. Server logs to stderr via Python logging module (stdout reserved for MCP JSON-RPC).

**Validation:**
- Bridge validates postMessage origin (configurable, defaults to any origin)
- Tool arguments passed through to MCP host; no client-side schema validation
- TypeScript provides compile-time type safety for tool arguments

**Authentication:** Not handled in SurfacesUI. Bridge assumes authentication occurs at:
- Server (MCP host validates requests before tool execution)
- Host environment (Claude Desktop or Vantage MCP server)

**Styling:**
- No inline styles; all colors via CSS custom properties (--background, --foreground, etc.)
- Tailwind tokens reference CSS variables
- Dark mode via `class="dark"` on document root; ThemeProvider applies this
- No hardcoded brand colors; Teradata theme is optional preset

**Analytics:** Optional via `useAnalytics()` hook; always returns null if AnalyticsProvider not configured. Components use optional chaining: `analytics?.trackEvent('name')`.

---

*Architecture analysis: 2026-02-15*
