---
phase: 04
plan: 02
subsystem: mcp-bridge-integration
tags: [renderer-integration, mcp, bridge-provider, action-handlers]
dependency_graph:
  requires: [04-01-mcp-action-handlers, 03-registry-mappings]
  provides: [mcp-enabled-renderer, bridge-context-wrapper]
  affects: [catalog-renderer, catalog-exports]
tech_stack:
  added: []
  patterns: [context-wrapping, handler-merging, optional-bridge-prop]
key_files:
  created: []
  modified:
    - packages/components/src/catalog/renderer.tsx
    - packages/components/src/bridge/index.ts
    - packages/components/src/catalog/index.ts
decisions:
  - Renderer accepts optional bridge prop for backward compatibility
  - McpBridgeProvider wraps renderer content only when bridge is provided
  - MCP action handlers merged with user handlers using useMemo
  - BridgeLike type exported from both bridge and catalog modules for consumer convenience
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed_date: 2026-02-17
---

# Phase 04 Plan 02: Renderer MCP Bridge Integration Summary

**One-liner:** Integrated MCP Bridge with SurfacesRenderer, enabling optional bridge prop that wraps content with McpBridgeProvider and merges MCP action handlers with user-provided handlers.

## What Was Built

Updated SurfacesRenderer to support optional MCP Bridge integration, enabling components rendered from JSON specs to execute MCP tool calls through the action system established in 04-01. The renderer now conditionally wraps content with McpBridgeProvider and merges MCP-generated action handlers with any user-provided handlers.

### Core Components

**1. SurfacesRenderer with Bridge Integration (renderer.tsx)**
- Added optional `bridge?: BridgeLike` prop to SurfacesRendererProps
- Import McpBridgeProvider and BridgeLike from bridge module
- Import createMcpActionHandlers from actions module
- Conditional McpBridgeProvider wrapper when bridge is provided
- useMemo-based handler merging for performance
- Backward compatible: works without bridge prop

**2. Bridge Type Exports**
- Exported BridgeLike from bridge/index.ts
- Re-exported BridgeLike from catalog/index.ts
- Enables consumers to import everything from catalog module

**3. Handler Merging Strategy**
- User handlers as base layer
- MCP handlers override for built-in actions (execute_sql, export_csv, copy_json)
- Computed once via useMemo to prevent re-creation on every render

## Key Implementation Details

### Optional Bridge Pattern
The renderer maintains full backward compatibility by making the bridge prop optional:
```typescript
bridge?: BridgeLike;
```

When no bridge is provided, the renderer behaves exactly as before (Theme → State → Action → Visibility → Renderer). When bridge is provided, McpBridgeProvider wraps the state/action layer.

### Context Wrapping Strategy
McpBridgeProvider wraps StateProvider/ActionProvider/VisibilityProvider as a unit:
- McpBridgeProvider enables useMcpBridge() hook in registry components
- StateProvider remains single source of truth for data
- ActionProvider receives merged handlers
- Visibility context unaffected

This layering ensures that:
1. Components can access bridge via context if needed
2. State management stays centralized in StateProvider
3. Actions work whether bridge is present or not

### Handler Merging Logic
```typescript
const mergedHandlers = useMemo(() => {
  if (!bridge) {
    return handlers; // No bridge - just user handlers
  }

  const mcpHandlers = createMcpActionHandlers(bridge);
  return {
    ...handlers,        // User handlers as base
    ...mcpHandlers,     // MCP handlers override (execute_sql, export_csv, copy_json)
  };
}, [bridge, handlers]);
```

MCP handlers take precedence for built-in actions to ensure correct behavior. User handlers can add custom actions or override non-MCP actions.

### Type Flexibility
Updated handlers prop type to accommodate json-render's ActionProvider signature:
```typescript
handlers?: Record<string, (...args: any[]) => Promise<unknown> | unknown>;
```

This matches json-render's expectation of handlers with variable arity (params, setState, state).

## Success Criteria Met

- ✅ SurfacesRenderer accepts optional `bridge?: BridgeLike` prop
- ✅ When bridge provided, McpBridgeProvider wraps the renderer content
- ✅ When bridge provided, createMcpActionHandlers creates action handlers
- ✅ Action handlers merged: user handlers + MCP handlers (MCP takes precedence for built-ins)
- ✅ Backward compatible: renderer works without bridge prop (existing behavior preserved)
- ✅ BridgeLike type exported from catalog index
- ✅ TypeScript compilation passes
- ✅ Build succeeds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing BridgeLike export from bridge module**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** BridgeLike type was defined in McpBridgeProvider.tsx but not exported from bridge/index.ts barrel file
- **Fix:** Added BridgeLike to bridge/index.ts type exports alongside McpBridgeProviderProps
- **Files modified:** packages/components/src/bridge/index.ts
- **Commit:** a01ac93 (combined with Task 1)
- **Rationale:** Import failure blocks execution - RULE 3 auto-fix for blocking issues

**2. [Rule 3 - Blocking] ActionProvider handler type mismatch**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** SurfacesRendererProps defined handlers with 1-param signature, but json-render ActionProvider expects handlers with (params, setState, state) signature
- **Fix:** Changed handlers type to `Record<string, (...args: any[]) => Promise<unknown> | unknown>` to match json-render's flexible handler signature
- **Files modified:** packages/components/src/catalog/renderer.tsx
- **Commit:** a01ac93 (combined with Task 1)
- **Rationale:** Type mismatch prevents handler assignment - RULE 3 auto-fix for blocking issues

## Commits

| Task | Commit  | Description                                      |
|------|---------|--------------------------------------------------|
| 1    | a01ac93 | Integrate MCP Bridge with SurfacesRenderer       |
| 2    | 9b50af9 | Export BridgeLike type from catalog index        |

## Files Modified

**Modified:**
- `packages/components/src/catalog/renderer.tsx` (104 lines) - Added bridge prop, McpBridgeProvider integration, handler merging
- `packages/components/src/bridge/index.ts` (28 lines) - Added BridgeLike type export
- `packages/components/src/catalog/index.ts` (16 lines) - Re-exported BridgeLike from bridge module

## Dependencies Satisfied

**From Phase 04-01 (MCP Action Handlers):**
- createMcpActionHandlers factory function
- McpActionState interface
- execute_sql, export_csv, copy_json action handlers

**From Phase 03 (Registry Mappings):**
- SurfacesRenderer component structure
- Registry and catalog integration
- json-render provider patterns

**Provides for Phase 04-03:**
- MCP-enabled SurfacesRenderer ready for integration testing
- Bridge prop API for consumers
- Complete action bridge flow (emit → handler → MCP tool call)

## Next Steps

**Phase 04-03:** Add MCP action integration tests
- Test SurfacesRenderer with and without bridge prop
- Test execute_sql action triggering and state updates
- Test handler merging (user + MCP handlers)
- Test McpBridgeProvider context availability
- Test backward compatibility (no bridge prop)

**Phase 05:** Registry component MCP integration
- Update SQLResultsDisplay to use emit('execute_sql')
- Add MCP tool call examples to CatalogDemo
- Document bridge prop usage patterns
- Create example specs with MCP actions

## Technical Notes

### Backward Compatibility
The optional bridge prop ensures zero breaking changes:
- Existing consumers without bridge prop: unchanged behavior
- New consumers with bridge prop: MCP integration enabled
- Component tests without bridge: continue to pass
- Demo specs without bridge: continue to render

### Performance Considerations
- useMemo prevents handler recreation on every render
- McpBridgeProvider memoizes context value
- No performance impact when bridge prop not provided
- Handler merging happens once per bridge instance change

### Context Hierarchy
Final provider hierarchy (with bridge):
```
ThemeProvider
  └─ McpBridgeProvider (when bridge provided)
      └─ StateProvider
          └─ ActionProvider
              └─ VisibilityProvider
                  └─ Renderer
```

This ensures:
1. Theme tokens available to all components
2. Bridge context available to registry components
3. State management centralized
4. Actions can access setState from context
5. Visibility rules apply to all elements

### Type Safety
- BridgeLike supports both McpBridge and McpAppsBridge
- Handler type flexible enough for json-render's ActionProvider
- All imports properly typed and exported
- No type assertions or 'any' casts in renderer

## Self-Check: PASSED

**Files modified verification:**
```
FOUND: packages/components/src/catalog/renderer.tsx
FOUND: packages/components/src/bridge/index.ts
FOUND: packages/components/src/catalog/index.ts
```

**Commits verification:**
```
FOUND: a01ac93
FOUND: 9b50af9
```

**Integration verification:**
```
FOUND: bridge?: BridgeLike in renderer.tsx
FOUND: McpBridgeProvider import in renderer.tsx
FOUND: createMcpActionHandlers import in renderer.tsx
FOUND: McpBridgeProvider wrapper in renderer.tsx
FOUND: BridgeLike export in bridge/index.ts
FOUND: BridgeLike export in catalog/index.ts
TypeScript compilation: PASSED
Build: PASSED
```

All files modified, all commits exist, all integrations verified. Plan complete.
