---
phase: 07-nl-generation
plan: 03
subsystem: ai-generation
tags: [streaming, explainability, progressive-rendering, jsonl, spec-validation, ui-generation]

# Dependency graph
requires:
  - phase: 07-nl-generation
    plan: 01
    provides: LLM provider integration and generate_ui tool
  - phase: 07-nl-generation
    plan: 02
    provides: Validation layer for AI-generated specs
provides:
  - Streaming spec compiler client (useSpecStream hook)
  - Progressive UI updates during generation
  - Component choice explanations from generate_ui
  - JSONL stream consumption with automatic validation
affects: [07-nl-generation, nl-editor-ui, progressive-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns: [streaming-state-management, progressive-updates, jsonl-parsing, dual-call-explainability]

key-files:
  created:
    - packages/components/src/catalog/stream.ts
  modified:
    - server/src/tools/generate_ui.py
    - packages/components/src/catalog/index.ts

key-decisions:
  - "Use JSONL streaming for progressive UI updates (chunk-by-chunk accumulation)"
  - "Progress estimation based on text length heuristic (500-2000 char typical spec)"
  - "Dual-call approach for explainability: explanation first, then structured spec"
  - "Explanation includes why components chosen, key props, and alternatives considered"
  - "Provide both streaming (useSpecStream) and non-streaming (generateSpec) variants"

patterns-established:
  - "useSpecStream hook manages streaming state with progress tracking"
  - "AbortController for cancellation, mountedRef for cleanup safety"
  - "Automatic validation on completion with ValidationResult tracking"
  - "Explanation as separate JSONL chunk before spec streaming begins"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 3: Streaming Spec Compiler & Explainability Summary

**Streaming client for progressive UI generation updates with component choice explanations**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-17T14:04:09Z
- **Completed:** 2026-02-17T14:07:11Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created useSpecStream hook with streaming state management
- Progress tracking based on accumulated text length (0-1 scale)
- Automatic spec validation on completion
- Abort/reset controls for streaming requests
- Enhanced generate_ui with dual-call explainability pattern
- Explanation describes component choices, prop decisions, and alternatives
- Exported streaming utilities from catalog index

## Task Commits

Each task was committed atomically:

1. **Task 1: Create streaming spec compiler client hook** - `5df91f0` (feat)
2. **Task 2: Add explainability to generate_ui tool** - `33c7194` (feat)
3. **Task 3: Export stream module from catalog index** - `3118e1f` (feat)

## Files Created/Modified

### Created
- `packages/components/src/catalog/stream.ts` - Streaming spec compiler client with useSpecStream hook and generateSpec function

### Modified
- `server/src/tools/generate_ui.py` - Enhanced with explainability support (dual-call pattern)
- `packages/components/src/catalog/index.ts` - Export streaming utilities

## Decisions Made

1. **JSONL streaming pattern**: Client accumulates chunks line-by-line, parsing each as JSON for progressive updates
2. **Progress heuristic**: Estimate progress based on typical spec size (500-2000 chars) to provide 0-1 progress indicator
3. **Dual-call explainability**: First call requests explanation of component choices, second call generates structured spec
4. **Explanation format**: Natural language describing why components chosen, key prop decisions, alternatives considered
5. **Both streaming and non-streaming**: Provide useSpecStream (progressive updates) and generateSpec (simple promise-based) variants

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - streaming implementation and explainability enhancement worked as designed.

## Integration Points

**Client-side streaming flow:**
1. `useSpecStream.generate(prompt)` initiates fetch to `/api/generate-ui?prompt=...&explain=true`
2. Reads response body stream, decodes as text, splits by newlines
3. Parses each line as JSON chunk: `{chunk, spec, explanation, error}`
4. Accumulates text, updates progress, tracks explanation
5. On completion, validates final spec with `validateGeneratedSpec`
6. Returns `SpecStreamState` with spec/validation/explanation/error

**Server-side explainability flow:**
1. If `include_explanation=true`, first call to LLM requests explanation
2. Yield explanation as JSONL chunk: `{"explanation": "..."}`
3. Then stream spec generation with regular chunks: `{"chunk": "..."}`
4. Final chunk includes both: `{"done": true, "spec": {...}, "explanation": "..."}`

## Next Phase Readiness

- Streaming client ready for NL editor UI integration (07-05)
- Explainability available for users to understand AI choices
- Progress tracking enables loading indicators
- Validation integrated ensures only valid specs rendered
- No blockers for next plans

---
*Phase: 07-nl-generation*
*Completed: 2026-02-17*

## Self-Check: PASSED

All files verified:
- packages/components/src/catalog/stream.ts ✓
- server/src/tools/generate_ui.py ✓
- packages/components/src/catalog/index.ts ✓

All commits verified:
- 5df91f0 ✓
- 33c7194 ✓
- 3118e1f ✓
