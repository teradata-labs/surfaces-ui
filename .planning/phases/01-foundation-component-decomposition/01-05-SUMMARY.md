---
phase: 01-foundation-component-decomposition
plan: 05
subsystem: molecules
tags: [composition, molecules, table-with-filters, chart-with-controls, atomic-design]
dependency_graph:
  requires: [01-02, 01-03, 01-04]
  provides: [table-with-filters-molecule, chart-with-controls-molecule]
  affects: [sql-results-display]
tech_stack:
  added: []
  patterns: [molecule-composition, state-management, control-panels]
key_files:
  created:
    - packages/components/src/molecules/table-with-filters/TableWithFilters.tsx
    - packages/components/src/molecules/table-with-filters/types.ts
    - packages/components/src/molecules/table-with-filters/index.ts
    - packages/components/src/molecules/chart-with-controls/ChartWithControls.tsx
    - packages/components/src/molecules/chart-with-controls/types.ts
    - packages/components/src/molecules/chart-with-controls/index.ts
    - packages/components/src/molecules/index.ts
  modified: []
decisions:
  - TableWithFilters manages search/filter state internally with 150ms debounce
  - ChartWithControls has collapsible controls panel (Settings icon when collapsed)
  - ChartWithControls auto-detects best X/Y axes using detectBestAxes utility
  - Both molecules within atomic design size constraints (100 and 180 lines)
metrics:
  duration: 4
  completed: 2026-02-16
---

# Phase 01 Plan 05: TableWithFilters and ChartWithControls Molecules Summary

TableWithFilters and ChartWithControls molecules compose primitives into cohesive UI patterns with internal state management.

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-16T13:56:39Z
- **Completed:** 2026-02-16T14:00:39Z
- **Tasks:** 3
- **Files created:** 7

## Accomplishments

- TableWithFilters molecule composes DataTable, Filter, and DensityToggle with search filtering
- ChartWithControls molecule composes Chart with collapsible controls panel for axis and type selection
- Both molecules provide clean, reusable UI patterns ready for organism-level integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TableWithFilters molecule** - `f8a76a2` (feat)
2. **Task 2: Create ChartWithControls molecule** - `727403e` (feat)
3. **Task 3: Create molecules barrel export** - `e37c4b0` (feat)

## Files Created/Modified

### TableWithFilters Molecule (138 lines total)
- `packages/components/src/molecules/table-with-filters/TableWithFilters.tsx` (100 lines) - Composes DataTable + Filter + DensityToggle with search state
- `packages/components/src/molecules/table-with-filters/types.ts` (33 lines) - Props and state interfaces
- `packages/components/src/molecules/table-with-filters/index.ts` (5 lines) - Barrel export

### ChartWithControls Molecule (232 lines total)
- `packages/components/src/molecules/chart-with-controls/ChartWithControls.tsx` (180 lines) - Composes Chart with collapsible controls panel
- `packages/components/src/molecules/chart-with-controls/types.ts` (45 lines) - Props, state, and chart type options
- `packages/components/src/molecules/chart-with-controls/index.ts` (7 lines) - Barrel export

### Module Organization
- `packages/components/src/molecules/index.ts` - Barrel export for all molecules

## Implementation Details

### TableWithFilters (100 lines)
- **Composition:** DataTable + Filter + DensityToggle
- **State management:** Internal search term and density state
- **Features:**
  - Search filtering with 150ms debounce
  - Filtered row count display when searching
  - Toggleable filter and density controls
  - Auto-derives columns from data if not provided
  - Row count footer showing filtered/total
- **Props:** 9 (within molecule complexity range)

### ChartWithControls (180 lines)
- **Composition:** Chart + Card + Button + lucide-react icons
- **State management:** Chart type, X/Y axes, data labels, panel collapsed state
- **Features:**
  - Collapsible controls panel (Settings icon when collapsed)
  - Chart type selection (6 types: bar, line, area, pie, scatter, heatmap)
  - X/Y axis column selection
  - Data labels toggle
  - Auto-detects best axes using detectBestAxes utility
  - Empty state for no data
  - Config change callback for parent components
- **Props:** 10 (within molecule complexity range)

## Decisions Made

1. **TableWithFilters debounce:** Set to 150ms for responsive search while avoiding excessive filtering
2. **ChartWithControls collapsible panel:** Uses Settings icon when collapsed, expands to full controls panel
3. **Auto-detect axes:** ChartWithControls uses detectBestAxes from chart primitive for smart defaults
4. **Internal state management:** Both molecules manage their own state (search, density, chart config) rather than requiring controlled props
5. **Filtered count display:** TableWithFilters shows "X of Y rows" only when actively filtering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all primitives were available and properly exported. Build passed on first attempt.

## Atomic Design Compliance

Both molecules are within atomic design size constraints:

| Component | Main File | Total Lines | Range | Status |
|-----------|-----------|-------------|-------|--------|
| TableWithFilters | 100 lines | 138 lines | 50-150 | ✓ PASS |
| ChartWithControls | 180 lines | 232 lines | 80-180 | ✓ PASS |

ChartWithControls is at the upper end of the molecule range (180 lines vs planned 140) due to the collapsible controls panel implementation, but still within the specified 80-180 line maximum.

## Verification Results

1. **Directory structure:** Both molecules properly organized with component, types, and barrel exports
2. **Line counts:** TableWithFilters 100 lines, ChartWithControls 180 lines (both within range)
3. **Build:** TypeScript compilation and Vite build passed with no errors
4. **Imports:** All primitive dependencies correctly imported and used
5. **Key links verified:**
   - TableWithFilters imports DataTable, Filter, DensityToggle from primitives
   - ChartWithControls imports Chart, detectBestAxes, Card, Button from primitives

## Integration Points

Both molecules are ready for use in:
- **SQLResultsDisplay organism** (main consumer in Wave 4)
- **Any component needing filtered table views**
- **Any component needing chart visualization with controls**

These molecules provide the composition layer between atomic primitives and the full SQLResultsDisplay organism, following atomic design principles.

## Next Phase Readiness

- Molecules composition layer complete
- Ready for organism-level SQLResultsDisplay reconstruction in Wave 4
- All primitives and molecules available for integration
- Build pipeline validated and passing

## Self-Check: PASSED

**Created files verified:**
- [FOUND] packages/components/src/molecules/table-with-filters/TableWithFilters.tsx
- [FOUND] packages/components/src/molecules/table-with-filters/types.ts
- [FOUND] packages/components/src/molecules/table-with-filters/index.ts
- [FOUND] packages/components/src/molecules/chart-with-controls/ChartWithControls.tsx
- [FOUND] packages/components/src/molecules/chart-with-controls/types.ts
- [FOUND] packages/components/src/molecules/chart-with-controls/index.ts
- [FOUND] packages/components/src/molecules/index.ts

**Commits verified:**
- [FOUND] f8a76a2 (TableWithFilters molecule)
- [FOUND] 727403e (ChartWithControls molecule)
- [FOUND] e37c4b0 (molecules barrel export)

**Build verification:**
- TypeScript compilation: PASSED
- Vite build: PASSED (2.56 MB total, 681.89 kB gzipped)
- All imports resolved correctly
