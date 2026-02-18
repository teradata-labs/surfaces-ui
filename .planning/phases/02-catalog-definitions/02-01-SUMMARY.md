---
phase: 02-catalog-definitions
plan: 01
subsystem: catalog
tags: [ai-prompts, zod-schemas, json-render, catalog-refinement]
completed: 2026-02-16

dependency_graph:
  requires:
    - 01-01 (json-render foundation)
    - 01-03 (DataTable primitive)
    - 01-04 (Filter and DensityToggle primitives)
  provides:
    - AI-specifiable Zod schemas for all 5 primitives
    - Prompt generation utilities for LLM integration
  affects:
    - Future AI-driven UI generation (Phase 04+)
    - Monaco editor integration (02-02, 02-03)

tech_stack:
  added: []
  patterns:
    - "Prop categorization: AI-specifiable vs context-provided vs runtime"
    - "Zod schema descriptions under 60 chars for AI readability"
    - "Prompt generation from schema introspection"

key_files:
  created:
    - packages/components/src/catalog/prompts.ts
  modified:
    - packages/components/src/catalog/schema.ts
    - packages/components/src/catalog/index.ts
    - packages/components/src/index.ts

decisions:
  - Use static component definitions instead of dynamic catalog iteration (json-render typing limitations)
  - Alias catalog type exports to avoid collision with component interface types
  - Keep descriptions under 60 chars for optimal AI processing

metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 4
  commits: 2
---

# Phase 02 Plan 01: Catalog Schema Refinement Summary

**One-liner:** Refined Zod schemas to AI-specifiable props only and added prompt generation utilities for LLM-driven UI creation.

## Overview

Separated catalog Zod schemas from full TypeScript component interfaces by implementing prop categorization: AI-specifiable props (in catalog), context-provided props (data arrays), and runtime props (callbacks, className). Added three prompt generation utilities that produce coherent markdown descriptions for AI models.

## Tasks Completed

### Task 1: Refine primitive Zod schemas for AI-specifiable props only
**Status:** ✅ Complete
**Commit:** b861804

**Changes:**
- Updated ChartSchema: 6 AI-specifiable props (type, xAxis, yAxis, theme, height, showDataLabels)
- Updated DataTableSchema: 5 AI-specifiable props (columns, height, density, virtualScrolling, showRowNumbers)
- Updated FilterSchema: 3 AI-specifiable props (placeholder, debounceMs, ariaLabel) - removed incorrect `columns` prop
- Updated DensityToggleSchema: 2 AI-specifiable props (value, showLabels)
- Updated ViewModeToggleSchema: 3 AI-specifiable props (modes, activeMode, showLabels)
- Added documentation block explaining prop categorization strategy
- All descriptions reduced to under 60 chars for AI readability

**Verification:**
- ✅ All 5 primitive schemas have correct AI-specifiable prop counts
- ✅ All `.describe()` values are 11-29 chars (well under 60 char limit)
- ✅ Prop categorization strategy documented
- ✅ Build passes without errors

**Key Files:**
- Modified: `packages/components/src/catalog/schema.ts`

### Task 2: Create AI prompt generation utilities
**Status:** ✅ Complete
**Commit:** 4f50d98

**Changes:**
- Created `prompts.ts` with three utility functions:
  - `generateCatalogPrompt()`: Full catalog description (all components + actions)
  - `generateComponentPrompt(name)`: Single component focused prompt with optional prop indicators
  - `generateComponentExample(name)`: JSON usage examples for each component
- Used static component definitions to work around json-render catalog typing limitations
- Updated catalog/index.ts to export prompts module
- Updated main index.ts to export catalog with aliased types (avoid ViewModeToggleProps collision)

**Verification:**
- ✅ Build passes without errors
- ✅ `generateCatalogPrompt()` produces coherent markdown (19 props described across 5 components)
- ✅ `generateComponentPrompt('Chart')` correctly marks all props as optional
- ✅ All three functions return properly formatted output

**Key Files:**
- Created: `packages/components/src/catalog/prompts.ts` (159 lines)
- Modified: `packages/components/src/catalog/index.ts`
- Modified: `packages/components/src/index.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type Collision] Resolved duplicate ViewModeToggleProps export**
- **Found during:** Task 2 - updating main index.ts exports
- **Issue:** ViewModeToggleProps was exported from both primitives (component interface) and catalog (Zod schema type), causing TypeScript error
- **Fix:** Aliased catalog type exports with `Catalog` prefix to avoid naming collision
- **Files modified:** `packages/components/src/index.ts`
- **Commit:** 4f50d98 (part of Task 2)

**2. [Rule 2 - Missing Implementation] Used static definitions instead of catalog iteration**
- **Found during:** Task 2 - implementing prompt generation
- **Issue:** json-render's `catalog` object doesn't expose `.components` and `.actions` properties in typed interface (only accessible via `.prompt()` method)
- **Fix:** Created static `componentDefinitions` and `actionDefinitions` objects that import schemas directly, allowing proper TypeScript inference
- **Files modified:** `packages/components/src/catalog/prompts.ts`
- **Commit:** 4f50d98 (part of Task 2)
- **Trade-off:** Requires manual updates when adding components (acceptable - low frequency change)

## Verification Results

### Schema Prop Counts (Must-Have Truth)
✅ Chart: 6 props (type, xAxis, yAxis, theme, height, showDataLabels)
✅ DataTable: 5 props (columns, height, density, virtualScrolling, showRowNumbers)
✅ Filter: 3 props (placeholder, debounceMs, ariaLabel)
✅ DensityToggle: 2 props (value, showLabels)
✅ ViewModeToggle: 3 props (modes, activeMode, showLabels)

### Description Length Verification
✅ All descriptions 11-29 characters (under 60 char limit)
✅ Most concise: "Row density" (11 chars)
✅ Longest: "Show values on chart elements" (29 chars)

### Build & Runtime Verification
✅ `pnpm build` passes with no errors or warnings
✅ `generateCatalogPrompt()` produces coherent markdown with all 5 components
✅ `generateComponentPrompt('Chart')` correctly formats single component
✅ All type exports available in main index

## Impact Analysis

**Immediate Benefits:**
- Catalog now correctly represents AI-specifiable configuration only
- LLM prompts can be generated programmatically from schemas
- Clear separation between AI domain (catalog) and runtime domain (component interfaces)

**Future Implications:**
- Phase 02-02/02-03: Monaco editor can use prompts for autocomplete/intellisense
- Phase 04+: AI agents can generate json-render specs using catalog prompts
- Maintains 5-8 prop limit for AI describability across all components

**Technical Debt:**
- Static component definitions require manual sync when adding components (low risk - infrequent change)

## Self-Check: PASSED

**Created files exist:**
✅ FOUND: packages/components/src/catalog/prompts.ts

**Modified files updated:**
✅ FOUND: packages/components/src/catalog/schema.ts (updated schemas)
✅ FOUND: packages/components/src/catalog/index.ts (exports prompts module)
✅ FOUND: packages/components/src/index.ts (exports catalog with aliased types)

**Commits exist:**
✅ FOUND: b861804 (Task 1 - schema refinement)
✅ FOUND: 4f50d98 (Task 2 - prompt utilities)

**Artifact verification:**
✅ ChartSchema exported from schema.ts
✅ generateCatalogPrompt exported from prompts.ts
✅ generateComponentPrompt exported from prompts.ts
✅ All catalog exports available in main index

## Next Steps

**Recommended order:**
1. **02-02-PLAN.md** - Monaco JSON editor integration (depends on schemas)
2. **02-03-PLAN.md** - Schema-driven autocomplete (depends on prompts)

**Blockers cleared:**
- Catalog schemas now ready for Monaco editor integration
- Prompt utilities available for AI-driven features
