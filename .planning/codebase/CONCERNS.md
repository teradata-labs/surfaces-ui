# Codebase Concerns

**Analysis Date:** 2026-02-15

## Component Size Violation - P2

**SQLResultsDisplay Exceeds Size Limits:**
- Issue: `SQLResultsDisplay.tsx` is 1772 lines, far exceeding the 400-line organism limit specified in CLAUDE.md. This component combines chart rendering, table display, filtering, grouping, sorting, and configuration management.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: Component is difficult to test, maintain, and reason about. Violates atomic design principles and review requirements.
- Fix approach: Decompose into smaller sub-components:
  - `<SQLTable>` (filtering, sorting, search, resizing)
  - `<ChartOptionsPanel>` (chart type, axis, grouping, stacking controls)
  - `<EChartsRenderer>` (chart rendering logic, theme detection)
  - Keep `<SQLResultsDisplay>` as coordinator (~300 lines)

## Deprecated API Usage - P2

**Browser Dialog APIs in Component:**
- Issue: Uses `prompt()` (line 1277) and `alert()` (lines 1058, 1060) for user interaction. These are deprecated and break modern UX patterns.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: Poor UX, blocking user interactions, not themable, not accessible without extra work.
- Current usage:
  - `prompt()` for column filtering (line 1277)
  - `alert()` for clipboard fallback feedback (lines 1058, 1060)
- Fix approach:
  - Replace `prompt()` with a modal dialog component (use existing Dialog primitive)
  - Replace `alert()` with toast notifications or inline feedback (consider `useToast()` pattern)

## Security Concern - P2

**Deprecated execCommand for Clipboard:**
- Issue: Line 71-78 uses `document.execCommand('copy')` as fallback for older browsers. This API is deprecated and may not work in future browser versions.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (lines 71-78)
- Impact: Clipboard fallback will fail in modern browsers, users unable to copy results.
- Current code:
  ```tsx
  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = JSON.stringify(data, null, 2);
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  ```
- Fix approach: Remove fallback entirely since Clipboard API is now widely supported (IE11 is the only holdout). Move to Clipboard API only with proper error handling.

## Missing Edge Case Handling - P3

**Hardcoded Defaults in getSystemTheme():**
- Issue: Function at lines 141-157 checks for `dark` class on `document.documentElement` OR `document.body`, but doesn't handle all theme scenarios (data attributes, CSS custom properties).
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: May fail to detect theme in non-standard theme implementations.
- Fix approach: Accept theme as prop from `ThemeProvider` context instead of relying on DOM inspection.

## Performance Concern - P2

**Expensive Data Transformations in useMemo:**
- Issue: `groupedData` computation (lines 333-396) creates aggregates on every data change without caching intermediate results. When groupBy/stackBy change, full re-computation happens even if data hasn't changed.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: Slow UI interactions with large result sets (>10k rows).
- Fix approach: Split aggregation logic into separate memoized helpers, cache by (data, groupBy, stackBy) tuples.

## Missing Error Boundaries - P2

**No Error Boundary for Chart Rendering:**
- Issue: ECharts initialization (line 1750) has no error boundary. If chart rendering fails, whole component crashes.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (line 1750)
- Impact: One malformed data type crashes results display entirely.
- Fix approach: Add try-catch in `generateChartOption()`, add Error Boundary wrapper around chart region, render fallback UI.

## Test Coverage Gaps - P2

**Integration Tests Missing MCP Apps Context:**
- Issue: SQLEditor integration tests mock hooks but don't test MCP Apps specific behavior: polling for `get_last_result`, localStorage persistence, auto-collapse/expand of sections.
- Files: `packages/components/src/components/sql-editor/__tests__/SQLEditor.integration.test.tsx`
- Impact: MCP Apps timing issues (polling, state sync) not caught before deployment.
- Test gaps:
  - Polling behavior (500ms intervals, 5 second timeout, max 10 attempts)
  - localStorage persistence and TTL (24 hour expiry)
  - Auto-collapse editor when results arrive
  - Clearing persisted state after fresh data
- Fix approach: Add dedicated MCP Apps context tests with controlled timer mocks (vi.useFakeTimers).

## Accessibility Concern - P1

**Using prompt() for Filter Input:**
- Issue: Line 1277 uses `prompt()` which is not accessible. Screen readers cannot properly announce what's being asked, and users cannot navigate with keyboard.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (line 1277)
- Impact: Violates WCAG 2.1 Level AA standards (component blocks review from UX Agent).
- Fix approach: Replace with accessible Dialog component + Input field. Requires UX redesign for filter UX.

## Fragile Timing - P2

**get_last_result Polling Race Condition:**
- Issue: SQLEditor polls `get_last_result` every 500ms for up to 5 seconds. If query completes during the 5-second window, timing is non-deterministic. No backoff or adaptive polling.
- Files: `packages/components/src/components/sql-editor/SQLEditor.tsx` (lines 145-174)
- Impact: User may see stale cached results if they open the same conversation shortly after executing a new query.
- Current behavior:
  - Polls 10 times (0ms, 500ms, 1000ms, 1500ms, 2000ms, 2500ms, 3000ms, 3500ms, 4000ms, 4500ms)
  - Stops at 5 seconds regardless of whether result arrived
  - No way to cancel early if result found
- Fix approach: Stop polling immediately after successful result (refetch returns data), add exponential backoff for subsequent polls.

## Bundle Size Risk - P3

**ECharts Import May Exceed 500KB Limit:**
- Issue: Full echarts library (line 15 of SQLResultsDisplay.tsx) is ~1MB+ when bundled. Project limit is 500KB gzipped per HTML app.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (line 15)
- Impact: May violate Engineering Agent bundle size checks.
- Current setup: Using full echarts import, 8 chart types, 10 themes.
- Fix approach: Verify gzipped bundle size with `pnpm build:apps`. If needed, use tree-shaking or switch to lightweight charting library (Recharts, Nivo).

## Configuration State Management - P3

**onConfigChange Never Used:**
- Issue: `SQLResultsDisplay` accepts `onConfigChange` prop (line 197) but callback is invoked on every state change (line 441-456). Component holds chart config in local state without proper synchronization.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: State can become out-of-sync if parent doesn't handle updates correctly. Consumer must manage config persistence themselves.
- Fix approach: Document contract clearly (controlled vs uncontrolled patterns), consider lifting all config state to parent.

## Missing Type Safety - P3

**Loose Typing in Result Data:**
- Issue: Result data normalized at lines 244-248 uses broad `Record<string, unknown>` typing. Chart axis data parsing at lines 590-592 does parseFloat on any value.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: Runtime errors when data schema doesn't match expectations (missing columns, wrong types).
- Fix approach: Add runtime validation (Zod schema) for SQLResult type, validate in bridge before rendering.

## Potential Memory Leak - P2

**Document Event Listeners in Resize Handlers:**
- Issue: Mouse move/up listeners attached at lines 975, 1005 but cleanup only happens via mouseup. If mouseup doesn't fire (e.g., mouse leaves window), listeners remain forever.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (lines 962-1011)
- Impact: Multiple resize interactions can accumulate listeners, causing memory leak over long sessions.
- Fix approach: Use `useWindowEvent()` hook or ensure cleanup in all code paths, add guards for missing mouseup.

## Hardcoded Theming - P2

**Color Values Not Themable:**
- Issue: Axis styling uses hardcoded color `#6b7280` (line 514, 527, etc.) instead of CSS custom properties.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` (lines 507-537)
- Impact: Chart colors don't adapt to theme changes. Violates CLAUDE.md theming requirements ("NEVER hardcode colors").
- Fix approach: Use `getComputedStyle()` to read theme colors from CSS variables (`--muted-foreground`, etc.).

## Python Server Error Handling - P2

**Bare Exception Handling in sql.py:**
- Issue: `server/src/tools/sql.py` likely has broad exception handlers without specific error types.
- Files: `server/src/tools/sql.py`
- Impact: Errors masked, hard to debug, inconsistent error responses to client.
- Fix approach: Catch specific exception types (ConnectionError, TimeoutError, JSONDecodeError), return structured error objects with error codes.

## Missing Validation - P2

**No Input Validation on SQL Queries:**
- Issue: `execute_sql_tool` in `server/src/tools/sql.py` accepts query parameter directly without validation (line 68 of main.py).
- Files: `server/src/main.py` (line 68), `server/src/tools/sql.py`
- Impact: Could pass malformed SQL, extremely large queries, or injection attempts to backend.
- Fix approach: Add query validation: max length limit, basic syntax check, reject dangerous patterns (DROP DATABASE, etc. if appropriate).

## Incomplete Type Coverage - P3

**Bridge Return Types Missing Specificity:**
- Issue: `callTool<T>()` returns generic T without discriminating success/failure at type level.
- Files: `packages/components/src/bridge/McpBridge.ts` (line 98)
- Impact: Must check `.success` at runtime, easy to forget error handling.
- Fix approach: Use discriminated union: `{ success: true; data: T } | { success: false; error: string }`.

## Documentation Debt - P3

**Complex Chart Generation Logic Undocumented:**
- Issue: `generateChartOption()` function (lines 471-953) is 500+ lines with complex branching logic for 8 chart types. No comments explaining chart option generation or aggregation logic.
- Files: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx`
- Impact: Hard to debug chart rendering issues, risky to modify.
- Fix approach: Break into separate functions per chart type, add JSDoc comments explaining aggregation approach and axis selection.

---

*Concerns audit: 2026-02-15*
