# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Data scientists can generate production-quality data visualizations from natural language without touching React code.
**Current focus:** Phase 2 complete - Ready for Phase 3 (Registry Mappings)

## Current Position

Phase: 5 of 9 (Virtual Scrolling Performance)
Plan: 2 of 2 in current phase
Status: Complete
Last activity: 2026-02-17 — Completed 05-02-PLAN.md (Virtual scrolling performance tests)

Progress: [██████████] 100% (2/2 plans in Phase 05)

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: 4 minutes
- Total execution time: 1.57 hours

**By Phase:**

| Phase | Plans | Total  | Avg/Plan |
|-------|-------|--------|----------|
| 01    | 6     | 26 min | 4 min    |
| 02    | 3     | 20 min | 7 min    |
| 03    | 5     | 33 min | 7 min    |
| 04    | 3     | 12 min | 4 min    |
| 05    | 2     | 5 min  | 2.5 min  |

**Recent Plans:**

| Plan     | Duration | Tasks | Files | Notes                                              |
|----------|----------|-------|-------|----------------------------------------------------|
| 02-01    | 5 min    | 2     | 4     | Catalog schema refinement and prompt utilities     |
| 02-02    | 6 min    | 3     | 3     | Molecule catalog definitions (TableWithFilters, ChartWithControls) |
| 02-03    | 9 min    | 3     | 4     | SQLResultsDisplay organism catalog entry           |
| 03-01    | 1 min    | 2     | 2     | SurfacesRenderer integration with json-render      |
| 03-02    | 6 min    | 3     | 4     | CatalogDemo validation with example specs          |
| 03-03    | 20 min   | 1     | 3     | Registry mapping validation tests (completeness + 8 wrappers) |
| 03-04    | 2 min    | 2     | 1     | State binding fix - gap closure (useStateValue hook) |
| 03-05    | 4 min    | 3     | 3     | Registry type safety - gap closure (typed wrappers + type tests) |
| 04-01    | 3 min    | 3     | 3     | MCP action bridge layer (execute_sql action + createMcpActionHandlers) |
| 04-02    | 4 min    | 2     | 3     | Renderer MCP Bridge integration (optional bridge prop + handler merging) |
| 04-03    | 5 min    | 2     | 3     | MCP action integration tests (action + renderer tests) |
| 05-01    | 2 min    | 2     | 4     | Dynamic overscan and ARIA grid pattern for DataTable performance |
| 05-02    | 3 min    | 2     | 2     | Virtual scrolling performance tests (100K rows, DOM stability) |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- json-render over custom DSL: Proven framework from Vercel, cross-platform, no RSC dependency
- SQL results as v1 scope: Smallest proof of concept, validates full stack
- Covalent tokens as foundation: Design system north star, allows evolution without code changes
- Decompose before adding NL: Component API must be NL-describable, retrofit is harder
- Catalog and component evolve together: Avoid "component works but can't describe it to AI" problem
- **Use json-render v0.6.1** (01-01): Latest stable version with all core features
- **Limit schemas to 5-8 props** (01-01): Ensures AI describability and generation quality
- [Phase 01-03]: Limit DataTable to exactly 8 props for AI describability (json-render constraint)
- [Phase 01-04]: Filter primitive uses debounce with cleanup on unmount
- [Phase 01-04]: DensityToggle uses radiogroup ARIA pattern for accessibility
- [Phase 01-05]: TableWithFilters manages search/filter state internally with 150ms debounce
- [Phase 01-05]: ChartWithControls has collapsible controls panel with auto-detected axes
- [Phase 01-05]: Both molecules within atomic design size constraints (100 and 180 lines)
- [Phase 01-06]: Extract utilities to separate module for reusability (createDefaultActions, buildTeradataUrl)
- [Phase 01-06]: SQLResultsDisplay composes molecules achieving 86% code reduction (1772 to 247 lines)
- [Phase 01-06]: Use ComponentContext pattern with wrapper components for json-render registry
- [Phase 01-06]: Registry file uses .tsx extension to support JSX in wrapper components
- [Phase 02-01]: Use static component definitions instead of dynamic catalog iteration (json-render typing limitations)
- [Phase 02-01]: Alias catalog type exports to avoid collision with component interface types
- [Phase 02-01]: Keep schema descriptions under 60 chars for optimal AI processing
- [Phase 02-03]: SQLResultsDisplay organism has 7 AI-specifiable props (excludes runtime callbacks and context data)
- [Phase 02-03]: Registry wrapper constructs savedConfig from initialViewMode, tableHeight, chartHeight
- [Phase 02-03]: Catalog prompts list organisms first as "Recommended for complete views"
- [Phase 02-02]: TableWithFilters has 6 AI-specifiable props (excludes data, onRowClick, className)
- [Phase 02-02]: ChartWithControls has 7 AI-specifiable props (excludes data, onConfigChange, className)
- [Phase 02-02]: Molecule schemas follow same prop categorization as primitives (AI-specifiable, context-provided, runtime-only)
- [Phase 02-02]: Prompt generation groups components by atomic design level (organisms first, then molecules, then primitives)
- [Phase 03-04]: Use useStateValue hook instead of (ctx as any).data for json-render state access
- [Phase 03-04]: Type state data as Record<string, unknown>[] for table/chart data arrays
- [Phase 03-05]: Use explicit TypeScript interfaces instead of generic type inference for catalog-registry type safety
- [Phase 04-01]: Use functional setState for atomic state updates (prevents race conditions in MCP actions)
- [Phase 04-01]: Transform MCP columns/rows format to json-render Record[] format in action handlers
- [Phase 04]: Renderer accepts optional bridge prop for backward compatibility
- [Phase 04]: MCP action handlers merged with user handlers using useMemo
- [Phase 04-03]: Use direct URL assignment instead of vi.spyOn for test mocking (jsdom limitation)
- [Phase 04-03]: Add window.matchMedia mock to global test setup for ThemeProvider testing
- [Phase 04-03]: Use state tracking pattern to verify functional setState calls in tests
- [Phase 05-01]: Dynamic overscan thresholds: 5 (<1K), 10 (1K-50K), 15 (50K+) rows
- [Phase 05-01]: Apply ARIA grid attributes to both virtual and non-virtual rendering paths
- [Phase 05-01]: Memoize columns prop in registry wrappers to preserve VirtualRow memoization
- [Phase 05-02]: Test logic over visual rendering for jsdom virtualizer limitations
- [Phase 05-02]: Use DOM count (<50) and render time (<500ms) as 60FPS proxies
- [Phase 05-02]: Test with 100K rows for stress tests, 50K for standard performance tests

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 Concerns:**
- ~~SQLResultsDisplay decomposition strategy needs validation~~ ✓ RESOLVED: Successfully reduced to 247 lines via molecule composition
- Schema complexity risk: 5-8 props max per component for AI describability (maintained across all components)
- Zero-runtime styling must be preserved (no CSS-in-JS libraries) (maintained)

**Phase 4 Concerns (flagged by research):**
- State synchronization between json-render and MCP Bridge not well-documented
- May need deeper research during planning

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 05-02-PLAN.md (Virtual scrolling performance tests) - Phase 05 complete
Resume file: None

**Phase 01 Status: COMPLETE**
All 6 plans executed successfully. Foundation established for Phase 02.

**Phase 02 Status: COMPLETE (3/3 plans complete, verified)**
- ✅ 02-01: Catalog schema refinement (AI-specifiable props + prompt utilities)
- ✅ 02-02: Molecule catalog definitions (TableWithFilters, ChartWithControls)
- ✅ 02-03: SQLResultsDisplay organism catalog entry (complete hierarchy)
- ✅ Verification: All 5 success criteria met (see 02-VERIFICATION.md)

**Phase 03 Status: COMPLETE (5/5 plans complete, verified)**
- ✅ 03-01: SurfacesRenderer integration (json-render wrapper with theming)
- ✅ 03-02: CatalogDemo validation (interactive demo with example specs)
- ✅ 03-03: Registry mapping validation (completeness tests + all 8 wrappers)
- ✅ 03-04: State binding fix (useStateValue hook - gap closure)
- ✅ 03-05: Registry type safety (typed props, type tests - gap closure)
- ✅ Verification: All 5 success criteria met (see 03-VERIFICATION.md)
- ✅ 03-04: State binding fix - gap closure (useStateValue hook replaces direct context access)
- ✅ 03-05: Registry type safety - gap closure (typed wrappers eliminate 'as any' casts)

**Phase 04 Status: COMPLETE (3/3 plans complete, verified)**
- ✅ 04-01: MCP action bridge layer (execute_sql action + createMcpActionHandlers factory)
- ✅ 04-02: Renderer MCP Bridge integration (optional bridge prop + handler merging)
- ✅ 04-03: MCP action integration tests (17 tests covering action handlers and renderer)

**Phase 05 Status: COMPLETE (2/2 plans complete)**
- ✅ 05-01: Dynamic overscan and ARIA grid pattern (performance optimization)
- ✅ 05-02: Performance verification and testing (18 tests, 100K row validation)

**Next Step:** Proceed to Phase 06 (per ROADMAP.md)
