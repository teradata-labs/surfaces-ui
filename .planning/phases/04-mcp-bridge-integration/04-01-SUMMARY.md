---
phase: 04
plan: 01
subsystem: mcp-bridge-integration
tags: [action-bridge, mcp, json-render, state-management]
dependency_graph:
  requires: [03-registry-mappings]
  provides: [mcp-action-handlers, execute-sql-action]
  affects: [catalog-schema, catalog-actions]
tech_stack:
  added: []
  patterns: [functional-setState, atomic-state-updates, mcp-tool-bridging]
key_files:
  created:
    - packages/components/src/catalog/actions.ts
  modified:
    - packages/components/src/catalog/schema.ts
    - packages/components/src/catalog/index.ts
decisions:
  - Use functional setState for atomic state updates (prevents race conditions)
  - Transform MCP columns/rows format to json-render Record[] format
  - Include export_csv and copy_json handlers in action factory for completeness
metrics:
  duration_minutes: 3
  tasks_completed: 3
  files_modified: 3
  commits: 3
  completed_date: 2026-02-17
---

# Phase 04 Plan 01: MCP Action Bridge Layer Summary

**One-liner:** Created action bridge layer that converts json-render emit() calls to MCP Bridge tool invocations with execute_sql action for SQL execution.

## What Was Built

Created the foundational action bridge layer that enables components to trigger MCP tool calls through the json-render action system. The `createMcpActionHandlers` factory function bridges the gap between json-render's action emit system and the MCP Bridge's callTool API.

### Core Components

**1. execute_sql Action Definition (schema.ts)**
- Added to catalog actions with Zod-validated params (query, connection_id)
- Enables AI-describable SQL execution through catalog system
- Description: "Execute SQL query via MCP Bridge and update state with results"

**2. createMcpActionHandlers Factory (actions.ts)**
- Factory function that accepts BridgeLike instance
- Returns object with execute_sql, export_csv, copy_json handlers
- Uses functional setState pattern for atomic state updates (MCP-03)
- Transforms MCP's {columns, rows} format to json-render's {data: Record[]} format

**3. Catalog Module Exports (index.ts)**
- Exported createMcpActionHandlers function
- Exported McpActionState type interface
- Makes action handlers available to catalog consumers

## Key Implementation Details

### Functional setState Pattern
All handlers use functional setState to prevent race conditions:
```typescript
setState(prev => ({
  ...prev,
  loading: true,
  error: null,
}));
```

This ensures atomic state updates even with concurrent action calls.

### MCP Format Transformation
The execute_sql handler transforms MCP's columnar format to json-render's expected format:
- **MCP format:** `{ columns: string[], rows: unknown[][] }`
- **json-render format:** `{ data: Record<string, unknown>[] }`

Transformation maps each row array to an object keyed by column names.

### Error Handling
The execute_sql handler implements proper error handling with loading states:
- Sets loading=true before MCP call
- Sets error state if callTool returns success=false
- Catches exceptions and stores error messages
- Always sets loading=false in finally equivalent

## Success Criteria Met

- ✅ execute_sql action defined in catalog schema with Zod-validated params (query: string, connection_id?: string)
- ✅ createMcpActionHandlers factory function exists and compiles
- ✅ Factory returns object with execute_sql, export_csv, copy_json handlers
- ✅ execute_sql handler calls bridge.callTool() and uses functional setState updates
- ✅ All exports available from catalog index
- ✅ TypeScript compilation passes with zero errors
- ✅ Build succeeds without errors

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit  | Description                              |
|------|---------|------------------------------------------|
| 1    | 1836f10 | Add execute_sql action to catalog schema |
| 2    | 1e80b10 | Create MCP action bridge layer           |
| 3    | 631d7b0 | Export action handlers from catalog      |

## Files Modified

**Created:**
- `packages/components/src/catalog/actions.ts` (144 lines) - Action bridge layer with MCP integration

**Modified:**
- `packages/components/src/catalog/schema.ts` - Added execute_sql action definition
- `packages/components/src/catalog/index.ts` - Added action handler exports

## Dependencies Satisfied

**From Phase 03 (Registry Mappings):**
- BridgeLike type from McpBridgeProvider
- json-render catalog schema structure
- Component state patterns

**Provides for Phase 04:**
- MCP action handler factory
- execute_sql action definition
- State transformation utilities

## Next Steps

**Phase 04-02:** Integrate action handlers with SurfacesRenderer
- Wire createMcpActionHandlers into json-render ActionProvider
- Pass bridge instance from McpBridgeProvider context
- Enable execute_sql action in rendered components

**Phase 04-03:** Add MCP action integration tests
- Test execute_sql handler with mock bridge
- Verify state transformation logic
- Test error handling and loading states

## Technical Notes

### Type Safety
- All handlers properly typed with SetState signature
- McpActionState interface documents expected state shape
- BridgeLike type ensures compatibility with both McpBridge and McpAppsBridge

### Performance Considerations
- Functional setState prevents unnecessary re-renders
- Single atomic state update after MCP result received
- No intermediate state updates during transformation

### Future Enhancements
- Add support for streaming results via bridge.startStream()
- Implement retry logic for failed MCP calls
- Add progress tracking for long-running queries

## Self-Check: PASSED

**Files created verification:**
```
FOUND: packages/components/src/catalog/actions.ts
```

**Commits verification:**
```
FOUND: 1836f10
FOUND: 1e80b10
FOUND: 631d7b0
```

**Exports verification:**
```
FOUND: createMcpActionHandlers in actions.ts
FOUND: createMcpActionHandlers in index.ts
FOUND: execute_sql in schema.ts
FOUND: bridge.callTool in actions.ts
```

All files created, all commits exist, all exports verified. Plan complete.
