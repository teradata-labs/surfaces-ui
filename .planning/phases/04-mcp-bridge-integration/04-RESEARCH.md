# Phase 4: MCP Bridge Integration - Research

**Researched:** 2026-02-16
**Domain:** json-render action system integration with MCP Bridge for async tool calls
**Confidence:** HIGH

## Summary

Phase 4 connects json-render's action system to SurfacesUI's MCP Bridge, enabling components rendered from JSON specs to execute SQL queries and other MCP tools asynchronously. The integration requires bridging two distinct architectural patterns: json-render's emit-based event system (designed for AI-generated UIs) and SurfacesUI's MCP Bridge pattern (designed for postMessage communication with MCP hosts).

**Key Challenge:** json-render actions are synchronous function calls registered with ActionProvider, while MCP tool calls are asynchronous postMessage operations that return promises. The state coordination layer must prevent race conditions when multiple tool calls update the same state path, and ensure that async results trigger proper re-renders in json-render components.

**Primary Recommendation:** Create an action bridge layer that wraps MCP Bridge callTool() in ActionProvider-compatible handlers, managing async state transitions explicitly through json-render's StateProvider to maintain single source of truth.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @json-render/react | 0.6.1 | Action system and state management | Official json-render React bindings with ActionProvider and StateProvider |
| @json-render/core | 0.6.1 | Action types and validation | Core types for action definitions and execution |
| McpBridge | (local) | MCP tool call abstraction | Existing SurfacesUI abstraction for postMessage-based tool calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Action parameter validation | Already used for catalog schemas, reuse for action params |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ActionProvider handlers | Direct bridge.callTool in components | Loses centralized action management, harder to test, breaks json-render patterns |
| StateProvider | React Context for MCP state | Duplicates state management, creates sync issues between contexts |
| Async handlers | Synchronous wrappers | Can't handle long-running queries, blocks UI |

**Installation:**
```bash
# Already installed - no new dependencies needed
# @json-render/react and @json-render/core already present
# McpBridge already implemented in packages/components/src/bridge/
```

## Architecture Patterns

### Recommended Integration Architecture
```
JSON Spec (from AI)
  ↓
json-render Renderer
  ↓
Component emits event: emit('execute_query')
  ↓
ActionProvider resolves event → action binding
  ↓
Action handler: async (params, setState, state) => {...}
  ↓
MCP Bridge: await bridge.callTool('execute_sql', params)
  ↓
postMessage to MCP host (parent window)
  ↓
MCP host executes tool and responds
  ↓
Bridge resolves promise with result
  ↓
Action handler: setState(prev => ({ ...prev, data: result }))
  ↓
StateProvider notifies subscribers
  ↓
Components re-render with new data
```

### Pattern 1: Action Bridge Layer
**What:** Wrapper that converts MCP Bridge calls into ActionProvider-compatible handlers
**When to use:** For all MCP tool integrations with json-render actions

**Example:**
```typescript
// Source: SurfacesUI architecture + json-render ActionProvider patterns
// packages/components/src/catalog/actions.ts

import type { McpBridge } from '../bridge';
import type { StateModel } from '@json-render/core';
import type { Actions } from '@json-render/react';
import { catalog } from './schema';

/**
 * Create ActionProvider handlers that bridge to MCP tool calls
 */
export function createMcpActionHandlers(
  bridge: McpBridge
): Actions<typeof catalog> {
  return {
    // MCP-02: Map execute_sql action to MCP tool call
    execute_sql: async (params, setState, state) => {
      // Validate params against catalog schema
      const { query, connection_id } = params as {
        query: string;
        connection_id?: string;
      };

      // Set loading state
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        // Call MCP tool via bridge
        const result = await bridge.callTool('execute_sql', {
          query,
          connection_id,
        });

        if (!result.success) {
          throw new Error(result.error ?? 'SQL execution failed');
        }

        // Transform result to match json-render state structure
        const { columns, rows } = result.data as {
          columns: string[];
          rows: unknown[][];
        };

        const data = rows.map(row => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });

        // Update state atomically - single source of truth
        setState(prev => ({
          ...prev,
          data,
          columns,
          row_count: data.length,
          loading: false,
        }));
      } catch (err) {
        // Error state coordination
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        }));
      }
    },
  };
}
```

### Pattern 2: State Coordination Layer
**What:** Explicit state management that prevents race conditions and maintains single source of truth
**When to use:** When multiple async operations can update the same state paths

**Example:**
```typescript
// Source: React best practices + json-render StateProvider patterns

// WRONG: Multiple setState calls create race conditions
execute_sql: async (params, setState) => {
  setState({ loading: true });
  const result = await bridge.callTool('execute_sql', params);
  setState({ data: result.data }); // Race: might overwrite newer state
  setState({ loading: false });
};

// CORRECT: Single atomic setState with functional update
execute_sql: async (params, setState) => {
  setState(prev => ({ ...prev, loading: true, error: null }));

  try {
    const result = await bridge.callTool('execute_sql', params);

    // Atomic update - reads latest state, writes once
    setState(prev => ({
      ...prev,
      data: result.data,
      loading: false,
    }));
  } catch (err) {
    setState(prev => ({
      ...prev,
      error: err.message,
      loading: false,
    }));
  }
};
```

### Pattern 3: Context Passing for MCP Bridge
**What:** Pass bridge instance through React context to make it available to registry components
**When to use:** When registry components need direct access to MCP Bridge for non-action operations

**Example:**
```typescript
// Source: SurfacesUI McpBridgeProvider pattern
// packages/components/src/catalog/renderer.tsx

import { McpBridgeProvider, useMcpBridge } from '../bridge';
import { StateProvider, ActionProvider, Renderer } from '@json-render/react';
import { createMcpActionHandlers } from './actions';
import { registry } from './registry';

export function SurfacesRenderer({ spec, bridge }) {
  const actionHandlers = createMcpActionHandlers(bridge);

  return (
    <McpBridgeProvider bridge={bridge}>
      <StateProvider initialState={spec.state}>
        <ActionProvider handlers={actionHandlers}>
          <Renderer spec={spec} registry={registry} />
        </ActionProvider>
      </StateProvider>
    </McpBridgeProvider>
  );
}

// In registry components - can access bridge if needed
function CatalogSQLEditor(ctx: ComponentContext) {
  const { bridge } = useMcpBridge(); // MCP-05: Context access
  // Most components use emit() instead of direct bridge calls
  // Direct access only needed for non-action operations
}
```

### Pattern 4: Action Binding in Catalog
**What:** Define actions in catalog schema with Zod parameter validation
**When to use:** For all actions that components can trigger

**Example:**
```typescript
// Source: json-render catalog patterns + SurfacesUI requirements
// packages/components/src/catalog/schema.ts

export const catalog = defineCatalog(schema, {
  components: {
    // ... component definitions
  },
  actions: {
    // MCP-01: Action system bridging emit() to MCP Bridge
    execute_sql: {
      params: z.object({
        query: z.string(),
        connection_id: z.string().optional(),
      }),
      description: 'Execute SQL query and update results state',
    },
    export_csv: {
      params: z.object({
        filename: z.string().default('export.csv'),
      }),
      description: 'Export current data to CSV file',
    },
  },
});
```

### Anti-Patterns to Avoid

- **Direct callTool in components:** Bypasses ActionProvider, makes testing harder, breaks json-render patterns
- **Multiple setState calls for single operation:** Creates race conditions, use atomic functional updates
- **Storing promises in state:** State should be serializable, store loading/error flags instead
- **Assuming synchronous state updates:** setState is async, never read state immediately after setting
- **Mixing ActionProvider and direct bridge calls:** Inconsistent state management, hard to debug

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Action parameter validation | Manual param checking in handlers | Zod schemas in catalog.actions | Consistent validation, type safety, AI-understandable |
| Async state management | Custom promise tracking | ActionProvider loadingActions + StateProvider | Race condition handling, single source of truth |
| Tool call abstraction | Direct postMessage code | McpBridge.callTool | Already handles message IDs, timeouts, origin validation |
| State coordination | Custom state sync logic | Functional setState updates | Prevents race conditions, React-standard pattern |
| Context propagation | Manual prop drilling | McpBridgeProvider + useMcpBridge hook | Standard React context pattern |

**Key insight:** The integration layer is small because both systems (json-render and MCP Bridge) are well-designed with clear boundaries. The bridge layer just needs to translate between their conventions—don't add complex state management or custom abstractions.

## Common Pitfalls

### Pitfall 1: Race Conditions from Concurrent Tool Calls
**What goes wrong:** Multiple execute_sql actions update /data state path simultaneously, results arrive out of order, UI shows wrong data
**Why it happens:** Async actions don't coordinate, last-to-complete wins regardless of request order
**How to avoid:**
- Use functional setState updates: `setState(prev => ...)` always reads latest state
- Add request cancellation: Track active request ID, cancel stale requests when new one starts
- Add optimistic updates carefully: Store pending state separately from confirmed state
**Warning signs:** Flickering data, old results appearing after new queries, state reset unexpectedly

### Pitfall 2: Forgetting setState is Async
**What goes wrong:** Reading state immediately after setState returns stale values, causing logic errors
```typescript
// WRONG
setState({ data: result });
console.log(state.data); // Still old value!
```
**Why it happens:** setState batches updates, doesn't update synchronously
**How to avoid:** Never read state after setState in same function, use returned state from action or useStateValue hook
**Warning signs:** Logs show old values, conditional logic based on state behaves incorrectly

### Pitfall 3: Breaking StateProvider Single Source of Truth
**What goes wrong:** Storing MCP results in separate React state, causing sync issues between StateProvider and component state
```typescript
// WRONG
const [data, setData] = useState([]);
execute_sql: async (params) => {
  const result = await bridge.callTool('execute_sql', params);
  setData(result.data); // Now data lives outside StateProvider!
};
```
**Why it happens:** Mixing React useState with json-render StateProvider
**How to avoid:** All data goes through StateProvider setState, components read with useStateValue
**Warning signs:** Components don't re-render on state changes, data inconsistencies between components

### Pitfall 4: Not Handling Bridge Connection State
**What goes wrong:** Calling bridge.callTool before bridge.connect() throws errors or times out
**Why it happens:** McpBridge requires explicit connect() call, not connected by default
**How to avoid:** McpBridgeProvider calls connect() on mount, always wrap renderer in provider
**Warning signs:** "McpBridge is not connected" errors, tool calls timing out immediately

### Pitfall 5: Passing Wrong Context Type to Registry
**What goes wrong:** Registry components receive ComponentContext but cast to wrong type, losing emit/bindings
```typescript
// WRONG
function CatalogChart(props: any) {
  // Lost emit() function, can't trigger actions!
}

// CORRECT
function CatalogChart(ctx: ComponentContext<typeof catalog, 'Chart'>) {
  const { props, emit } = ctx;
  // Can call emit('refresh') to trigger actions
}
```
**Why it happens:** Misunderstanding ComponentContext structure from json-render
**How to avoid:** Use ComponentContext<typeof catalog, ComponentName> type, always destructure ctx
**Warning signs:** TypeScript errors on emit(), actions not triggering, missing bindings

## Code Examples

Verified patterns from official sources and existing implementation:

### Async Action Handler with MCP Bridge
```typescript
// Source: json-render ActionProvider + SurfacesUI McpBridge patterns
// packages/components/src/catalog/actions.ts

import type { McpBridge } from '../bridge';
import type { Actions } from '@json-render/react';
import { catalog } from './schema';

export function createMcpActionHandlers(
  bridge: McpBridge
): Actions<typeof catalog> {
  return {
    execute_sql: async (params, setState, state) => {
      // MCP-04: Handle async tool results in registry action handlers
      const { query, connection_id } = params as {
        query: string;
        connection_id?: string;
      };

      // Set loading state
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        // MCP-02: Map execute_sql action to MCP tool call
        const result = await bridge.callTool('execute_sql', {
          query,
          connection_id,
        });

        if (!result.success) {
          throw new Error(result.error ?? 'SQL execution failed');
        }

        // Transform vantage-mcp format to json-render state format
        const { columns, rows } = result.data as {
          columns: string[];
          rows: unknown[][];
        };

        const data = rows.map(row => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });

        // MCP-03: State coordination layer - atomic update
        setState(prev => ({
          ...prev,
          data,
          columns,
          row_count: data.length,
          loading: false,
          error: null,
        }));
      } catch (err) {
        // Error handling with state coordination
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        }));
      }
    },
  };
}
```

### Registry Component with Action Emit
```typescript
// Source: json-render ComponentContext patterns + Phase 3 decisions
// packages/components/src/catalog/registry.tsx

import { ComponentContext, useStateValue } from '@json-render/react';
import { catalog } from './schema';
import type { DataRow } from './types';

function CatalogSQLResultsDisplay(
  ctx: ComponentContext<typeof catalog, 'SQLResultsDisplay'>
) {
  const { props, emit } = ctx;

  // Phase 03-04 decision: Use useStateValue instead of (ctx as any).data
  const data = useStateValue<DataRow[]>('/data') || [];
  const loading = useStateValue<boolean>('/loading') || false;
  const error = useStateValue<string | null>('/error') || null;

  // Emit action when user clicks execute
  const handleExecute = (query: string) => {
    // MCP-01: Bridge json-render emit() to action system
    emit('execute_sql', { query, connection_id: props.connectionId });
  };

  return (
    <SQLResultsDisplay
      data={{ rows: data, columns: props.columns || [] }}
      sql={props.sql}
      loading={loading}
      error={error}
      onExecute={handleExecute}
    />
  );
}
```

### Complete Integration in Renderer
```typescript
// Source: SurfacesUI renderer pattern + json-render providers
// packages/components/src/catalog/renderer.tsx

import React, { useMemo } from 'react';
import { Renderer, StateProvider, ActionProvider } from '@json-render/react';
import { McpBridgeProvider } from '../bridge';
import { ThemeProvider } from '../theme/ThemeProvider';
import { createMcpActionHandlers } from './actions';
import { registry } from './registry';
import type { Spec } from '@json-render/core';
import type { McpBridge } from '../bridge';

export interface SurfacesRendererProps {
  spec: Spec | null;
  bridge: McpBridge;
  initialState?: Record<string, unknown>;
  theme?: 'light' | 'dark' | 'system';
}

export function SurfacesRenderer({
  spec,
  bridge,
  initialState = {},
  theme = 'system',
}: SurfacesRendererProps) {
  // MCP-01: Create action handlers that bridge to MCP tools
  const actionHandlers = useMemo(
    () => createMcpActionHandlers(bridge),
    [bridge]
  );

  // Merge spec.state with initialState
  const combinedState = {
    ...initialState,
    ...(spec?.state ?? {}),
  };

  return (
    <ThemeProvider theme={theme}>
      {/* MCP-05: Pass MCP Bridge via context */}
      <McpBridgeProvider bridge={bridge}>
        {/* MCP-03: StateProvider is single source of truth */}
        <StateProvider initialState={combinedState}>
          {/* MCP-04: ActionProvider handles async results */}
          <ActionProvider handlers={actionHandlers}>
            <Renderer spec={spec} registry={registry} />
          </ActionProvider>
        </StateProvider>
      </McpBridgeProvider>
    </ThemeProvider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct REST API calls | MCP Bridge postMessage | 2026 (MCP protocol adoption) | Better isolation, works in iframe contexts |
| Synchronous action handlers | Async handlers with promises | json-render 0.6.0+ | Proper async tool call support |
| Manual state sync | StateProvider single source | json-render 0.5.0+ | Prevents race conditions |
| Props drilling bridge instance | React Context (McpBridgeProvider) | SurfacesUI architecture | Cleaner component APIs |

**Deprecated/outdated:**
- Direct fetch() calls in components: Use MCP Bridge instead
- (ctx as any).data access: Use useStateValue('/data') (Phase 3 decision)
- Storing MCP results in component useState: Use StateProvider
- Separate loading state context: Use StateProvider with /loading path

## Open Questions

1. **Request Cancellation**
   - What we know: MCP Bridge has cancelStream() for streaming operations
   - What's unclear: Does cancelStream() work for non-streaming callTool()? Do we need AbortController?
   - Recommendation: Start without cancellation for execute_sql (queries are fast), add if users report stale results

2. **Action Error Recovery**
   - What we know: ActionProvider has pendingConfirmation for confirmation dialogs
   - What's unclear: Should failed MCP calls show confirmation dialog, or just set error state?
   - Recommendation: Set error state for automatic failures, use confirmation for user-facing decisions (e.g., "Query returned 1M rows, continue?")

3. **State Migration Between Specs**
   - What we know: StateProvider accepts initialState prop
   - What's unclear: When AI generates new spec, should /data state carry over or reset?
   - Recommendation: Reset state when spec.root changes (new UI), preserve when only elements change (refinement)

4. **Tool Call Deduplication**
   - What we know: Multiple components could emit same action with same params
   - What's unclear: Should we deduplicate identical in-flight requests, or let them race?
   - Recommendation: Start without deduplication (simpler), add request ID tracking if needed

## Sources

### Primary (HIGH confidence)
- @json-render/react documentation (node_modules/.pnpm/@json-render+react@0.6.1_react@18.3.1_zod@4.3.6/node_modules/@json-render/react/README.md)
- @json-render/core documentation (node_modules/.pnpm/@json-render+core@0.6.1_zod@4.3.6/node_modules/@json-render/core/README.md)
- SurfacesUI McpBridge implementation (packages/components/src/bridge/McpBridge.ts)
- SurfacesUI McpBridgeProvider implementation (packages/components/src/bridge/McpBridgeProvider.tsx)
- Phase 3 decisions (03-04-PLAN.md, 03-05-PLAN.md) on useStateValue and type safety

### Secondary (MEDIUM confidence)
- [Fixing Race Conditions in React with useEffect - Max Rozen](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)
- [Handling API request race conditions in React](https://sebastienlorber.com/handling-api-request-race-conditions-in-react)
- [Model Context Protocol (MCP) - Docs by LangChain](https://docs.langchain.com/oss/python/langchain/mcp)
- [Asynchronous operations in MCP · Discussion #491](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/491)
- [IBM MCP architecture patterns for multi-agent AI systems](https://developer.ibm.com/articles/mcp-architecture-patterns-ai-systems/)

### Tertiary (LOW confidence - needs verification)
- None - all core patterns verified with official documentation and existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, versions verified in package.json
- Architecture: HIGH - patterns verified in existing McpBridge and json-render documentation
- Pitfalls: HIGH - derived from React async patterns (widely documented) and json-render state management

**Research date:** 2026-02-16
**Valid until:** 30 days (stable APIs, no breaking changes expected in json-render 0.6.x or MCP Bridge)
