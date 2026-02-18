---
phase: 02-catalog-definitions
plan: 02
subsystem: catalog
tags: [json-render, zod, react, molecules, atomic-design]

# Dependency graph
requires:
  - phase: 02-01
    provides: Catalog schema foundation with primitive components and prompt utilities
provides:
  - Molecule Zod schemas (TableWithFilters, ChartWithControls) for AI-specifiable props
  - Registry wrappers for molecules with context data injection
  - Molecule examples in prompt generation utilities
  - Complete catalog hierarchy (primitives -> molecules -> organisms)
affects: [02-03, monaco-integration, ai-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Molecule composition pattern (6-7 AI-specifiable props per molecule)
    - Context data injection in registry wrappers (data from json-render context)
    - Categorized prompt generation (organisms -> molecules -> primitives)

key-files:
  created: []
  modified:
    - packages/components/src/catalog/schema.ts
    - packages/components/src/catalog/registry.tsx
    - packages/components/src/catalog/prompts.ts

key-decisions:
  - "TableWithFilters has 6 AI-specifiable props (excludes data, onRowClick, className)"
  - "ChartWithControls has 7 AI-specifiable props (excludes data, onConfigChange, className)"
  - "Molecule schemas follow same prop categorization as primitives (AI-specifiable, context-provided, runtime-only)"
  - "Prompt generation groups components by atomic design level (organisms first, then molecules, then primitives)"

patterns-established:
  - "Molecule schemas compose 6-7 AI-specifiable props following atomic design constraints"
  - "Registry wrappers inject data from (ctx as any).data?.value pattern"
  - "Prompt examples use realistic data (user tables, financial charts) not placeholder values"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 02 Plan 02: Molecule Catalog Definitions Summary

**Molecule catalog entries (TableWithFilters, ChartWithControls) with Zod schemas, registry wrappers, and AI prompt examples**

## Performance

- **Duration:** 6 min 2 sec
- **Started:** 2026-02-16T16:04:48Z
- **Completed:** 2026-02-16T16:10:50Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added TableWithFilters schema with 6 AI-specifiable props (columns, height, initialDensity, showFilter, showDensityToggle, virtualScrolling)
- Added ChartWithControls schema with 7 AI-specifiable props (columns, height, initialChartType, initialXAxis, initialYAxis, showControls, controlsCollapsed)
- Created registry wrappers for both molecules with context data injection pattern
- Updated prompt generation to group components by atomic design level (organisms -> molecules -> primitives)
- Added molecule examples to generateComponentExample function

## Task Commits

Each task was committed atomically:

1. **Task 1: Add molecule Zod schemas to catalog** - `aa3ff08` (feat)
2. **Task 2: Add molecule wrapper components to registry** - `7211d71` (feat) - includes SQLResultsDisplay organism wrapper added by linter
3. **Task 3: Update prompts with molecule examples** - `eb9b0ca` (feat)

## Files Created/Modified
- `packages/components/src/catalog/schema.ts` - Added TableWithFiltersSchema (6 props) and ChartWithControlsSchema (7 props)
- `packages/components/src/catalog/registry.tsx` - Added CatalogTableWithFilters and CatalogChartWithControls wrappers with context data injection
- `packages/components/src/catalog/prompts.ts` - Added molecule definitions with category field, updated generateCatalogPrompt to group by atomic design level, added molecule examples

## Decisions Made
- TableWithFilters excludes data (context-provided), onRowClick (runtime), className (runtime) from catalog schema - only AI-specifiable configuration props
- ChartWithControls excludes data (context-provided), onConfigChange (runtime), className (runtime) from catalog schema
- Prompt generation prioritizes organisms (recommended), then molecules (custom compositions), then primitives (fine-grained control)
- Molecule examples use realistic domain data (user records, financial charts) instead of generic placeholders

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linter added SQLResultsDisplay organism wrapper**
- **Found during:** Task 2 (Registry wrapper implementation)
- **Issue:** Registry was missing SQLResultsDisplay organism wrapper that was already defined in catalog schema (from plan 01-06)
- **Fix:** Auto-save/linter added CatalogSQLResultsDisplay wrapper with data format normalization and savedConfig construction
- **Files modified:** packages/components/src/catalog/registry.tsx
- **Verification:** Build passes, all 8 components registered (5 primitives + 2 molecules + 1 organism)
- **Committed in:** 7211d71 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to complete registry - SQLResultsDisplay schema was added in prior plan but wrapper was missing. No scope creep.

## Issues Encountered
None - plan executed smoothly with molecule schemas and registry wrappers implemented as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Catalog now includes complete hierarchy: primitives (5), molecules (2), organisms (1)
- Molecule schemas properly exclude context-provided and runtime props
- Registry wrappers follow consistent data injection pattern
- Prompt generation ready for AI consumption with categorized component listings
- Ready for Phase 02-03: Monaco JSON editor integration with schema-driven autocomplete

---
*Phase: 02-catalog-definitions*
*Completed: 2026-02-16*


## Self-Check: PASSED

All modified files exist:
- ✓ packages/components/src/catalog/schema.ts
- ✓ packages/components/src/catalog/registry.tsx
- ✓ packages/components/src/catalog/prompts.ts

All commits verified:
- ✓ aa3ff08 (Task 1: Add molecule Zod schemas)
- ✓ 7211d71 (Task 2: Add molecule registry wrappers)
- ✓ eb9b0ca (Task 3: Update prompts with molecule examples)
