---
phase: 07-nl-generation
plan: 02
subsystem: catalog-validation
status: complete
completed: 2026-02-17
duration_minutes: 3
tags:
  - validation
  - error-handling
  - ai-safety
  - fallback-ui
dependencies:
  requires:
    - 07-01 (Zod schemas from catalog/schema.ts)
  provides:
    - validateGeneratedSpec function for spec validation
    - SpecValidationError component for error display
    - createFallbackSpec for graceful degradation
  affects:
    - Future NL generation plans will use validation layer
    - Prevents hallucinated specs from crashing renderer
tech_stack:
  added:
    - Zod validation for AI-generated specs
    - React error fallback components
  patterns:
    - Structured ValidationError interface
    - Auto-fix for common validation errors
    - Fallback spec generation using DataTable
key_files:
  created:
    - packages/components/src/catalog/validation.ts (194 lines)
    - packages/components/src/catalog/fallback.tsx (170 lines)
  modified:
    - packages/components/src/catalog/index.ts (added exports)
decisions:
  - Use Zod safeParse for validation (non-throwing)
  - Separate unknown components from invalid props errors
  - Fallback spec uses DataTable to display errors
  - ValidatedSpecRenderer uses dynamic require to avoid circular deps
metrics:
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  commits: 3
  lines_added: 378
---

# Phase 07 Plan 02: Validation Layer & Error Fallbacks Summary

Validation and fallback error handling for AI-generated json-render specs using Zod schemas with graceful error recovery.

## Objective

Create the validation layer that catches invalid AI-generated specs before rendering and provides graceful error recovery with fallback UI components to prevent hallucinated specs from crashing the renderer.

## Tasks Completed

### Task 1: Create spec validation module ✓
**Commit:** 23dbd45
**Files:** packages/components/src/catalog/validation.ts

Created comprehensive validation module with:
- `validateGeneratedSpec()` function that validates specs against catalog Zod schemas
- Three-step validation: structure, root element, component types and props
- `ValidationResult` interface with `valid`, `spec`, `errors` fields
- `ValidationError` interface with path, message, code, expected, received fields
- `attemptAutoFix()` for common validation errors (missing props objects)
- `getKnownComponentTypes()` returns list of valid component types
- Type-safe error formatting from ZodIssue to ValidationError

**Validation stages:**
1. Validate overall spec structure (root, elements, data)
2. Validate root element exists in elements map
3. Validate each element's component type and props against schemas

### Task 2: Create fallback UI component ✓
**Commit:** 6415836
**Files:** packages/components/src/catalog/fallback.tsx, packages/components/src/catalog/validation.ts (fix)

Created fallback UI components with:
- `SpecValidationError` component displays validation errors accessibly
- Shows up to 5 errors with path, message, expected values
- Optional retry button and original prompt display
- `createFallbackSpec()` generates DataTable spec showing error details
- `ValidatedSpecRenderer` wrapper validates before rendering
- All components use CSS custom properties (no hardcoded colors)
- WCAG compliant with role="alert" and aria-live="polite"

**Auto-fixed issue (Deviation Rule 1):**
- Fixed type safety in validation.ts attemptAutoFix function
- Added null check before accessing fixedSpec.elements[pathParts[1]]
- Changed return type check from `revalidated.spec` to include undefined check

### Task 3: Export validation and fallback from catalog index ✓
**Commit:** 0f27984
**Files:** packages/components/src/catalog/index.ts

Exported all validation and fallback exports:
- Functions: validateGeneratedSpec, attemptAutoFix, getKnownComponentTypes
- Types: ValidationResult, ValidationError
- Components: SpecValidationError, createFallbackSpec, ValidatedSpecRenderer
- Props types: SpecValidationErrorProps, ValidatedSpecRendererProps
- Package builds successfully (804KB gzipped)

## Verification Results

All verification criteria met:

1. ✓ TypeScript compilation passes without errors
2. ✓ Package build successful (vite build completed in 12.82s)
3. ✓ All exports available from catalog index
4. ✓ validateGeneratedSpec returns ValidationResult with errors array
5. ✓ Invalid specs produce structured error information with paths
6. ✓ SpecValidationError component renders errors accessibly
7. ✓ createFallbackSpec produces a renderable DataTable spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type safety in attemptAutoFix function**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** TypeScript error "Object is possibly 'undefined'" when accessing fixedSpec.elements[pathParts[1]].props
- **Fix:** Added null check before accessing element and fixed return type check to handle undefined spec
- **Files modified:** packages/components/src/catalog/validation.ts
- **Commit:** 6415836

## Technical Implementation

### Validation Architecture

```typescript
// Three-stage validation pipeline
validateGeneratedSpec(rawSpec) →
  1. Validate spec structure (root, elements, data)
  2. Validate root element exists
  3. Validate each element type & props against catalog schemas
  → ValidationResult { valid, spec?, errors[] }
```

### Error Display

```typescript
// Graceful error display with accessibility
<SpecValidationError
  errors={validationErrors}
  originalPrompt={userPrompt}
  onRetry={handleRetry}
/>
// Shows: path, message, expected, received
// WCAG: role="alert", aria-live="polite"
```

### Component Validation

Known component types validated:
- Chart, DataTable, Filter, DensityToggle, ViewModeToggle
- TableWithFilters, ChartWithControls
- SQLResultsDisplay

## Integration Points

### For NL-03 (AI spec generation):
```typescript
const result = validateGeneratedSpec(aiGeneratedSpec);
if (!result.valid) {
  // Show SpecValidationError or createFallbackSpec
}
```

### For NL-04 (SurfacesUI integration):
```typescript
<ValidatedSpecRenderer
  spec={generatedSpec}
  originalPrompt={nlPrompt}
  onRetry={regenerate}
>
  {(validSpec) => <SurfacesRenderer spec={validSpec} />}
</ValidatedSpecRenderer>
```

## Success Criteria Status

- ✓ validateGeneratedSpec returns ValidationResult with errors array
- ✓ Invalid specs produce structured error information with paths
- ✓ SpecValidationError component renders errors accessibly
- ✓ createFallbackSpec produces a renderable DataTable spec
- ✓ All exports available from catalog index
- ✓ Build passes without errors

## Files Changed

**Created:**
- `packages/components/src/catalog/validation.ts` - Spec validation with Zod (194 lines)
- `packages/components/src/catalog/fallback.tsx` - Error fallback UI (170 lines)

**Modified:**
- `packages/components/src/catalog/index.ts` - Added 14 exports

## Commits

1. **23dbd45** - feat(07-02): add spec validation module
2. **6415836** - feat(07-02): add fallback UI for validation errors
3. **0f27984** - feat(07-02): export validation and fallback from catalog

## Self-Check

Verifying all claims in this summary.

### File existence check
```
✓ FOUND: packages/components/src/catalog/validation.ts
✓ FOUND: packages/components/src/catalog/fallback.tsx
✓ FOUND: packages/components/src/catalog/index.ts
```

### Commit verification
```
✓ FOUND: 23dbd45 (spec validation module)
✓ FOUND: 6415836 (fallback UI for validation errors)
✓ FOUND: 0f27984 (export validation and fallback from catalog)
```

### Build verification
```
✓ PASSED: Package build successful (804KB gzipped)
✓ PASSED: TypeScript compilation without errors
```

## Self-Check: PASSED

All files created, all commits exist, build successful.
