---
phase: 06-theming-integration
plan: 01
subsystem: theming
tags:
  - css
  - tokens
  - density
  - fouc-prevention
dependency_graph:
  requires: []
  provides:
    - density-token-system
    - fouc-prevention
  affects:
    - all-components
tech_stack:
  added:
    - density.css
  patterns:
    - css-custom-properties
    - data-attributes
    - localStorage-sync
key_files:
  created:
    - packages/components/src/theme/density.css
  modified:
    - packages/components/src/theme/tokens.css
    - packages/components/index.html
decisions: []
metrics:
  duration: 98
  completed: 2026-02-17T12:01:25Z
---

# Phase 06 Plan 01: Density Token System & FOUC Prevention Summary

**One-liner:** CSS density scaling system (0.8x/1.0x/1.2x) with FOUC prevention for theme/density persistence.

## Overview

Established the CSS foundation for density variants and prevented flash of unstyled content on page load. Created density.css with scaled spacing tokens, integrated it into tokens.css, and added inline script for theme initialization.

## Tasks Completed

### Task 1: Create density CSS token system
**Status:** ✅ Complete
**Commit:** df0dff5

Created `/packages/components/src/theme/density.css` with:
- Base `--density-scale` variable (default: 1)
- Data-attribute selectors for compact (0.8x), comfortable (1.0x), spacious (1.2x)
- Base spacing tokens (--space-xs through --space-xl)
- Scaled spacing variants (--space-*-scaled) using calc()
- Fixed typography tokens (14px-18px, WCAG compliant)
- Fixed line heights (20px-28px, readability preserved)
- Fixed icon sizes and borders (never scale)

**Key decision:** Typography and borders remain fixed per WCAG research (Pitfall 2: Density Scaling Breaking Fixed Sizes). Only spacing scales with density.

### Task 2: Import density.css and add FOUC prevention
**Status:** ✅ Complete
**Commit:** 2417951

**Part A - tokens.css:**
- Added `@import './density.css';` after Tailwind directives

**Part B - index.html:**
- Added inline FOUC prevention script in `<head>`
- Reads theme preference from localStorage (default: 'system')
- Respects system prefers-color-scheme when theme is 'system'
- Applies 'dark' class to documentElement before first paint
- Restores density preference from localStorage (default: 'comfortable')
- Sets data-density attribute before render

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

1. ✅ `density.css` contains complete density token system
2. ✅ `tokens.css` imports density.css via `@import './density.css'`
3. ✅ `index.html` has FOUC prevention script with localStorage access
4. ✅ `pnpm build` passes with no CSS errors (13.31s, 803.43 kB gzipped)

## Success Criteria

- ✅ density.css exists with --density-scale CSS variable
- ✅ data-density attribute selectors for compact (0.8x), comfortable (1.0x), spacious (1.2x)
- ✅ Scaled spacing tokens (--space-*-scaled) use calc() with density multiplier
- ✅ tokens.css imports density.css
- ✅ index.html has FOUC prevention inline script
- ✅ Build passes with no CSS errors

## Files Modified

**Created:**
- `packages/components/src/theme/density.css` (51 lines)

**Modified:**
- `packages/components/src/theme/tokens.css` (+2 lines)
- `packages/components/index.html` (+15 lines)

## Technical Notes

### Density Scaling Pattern

The density system uses CSS custom properties with calc() for runtime scaling:

```css
/* Base token */
--space-md: 16px;

/* Scaled variant */
--space-md-scaled: calc(var(--space-md) * var(--density-scale));
```

Components should use `-scaled` variants for padding/margins that should respond to density changes, and unscaled variants for fixed spacing.

### FOUC Prevention Strategy

The inline script executes before any React rendering:
1. Synchronously reads localStorage preferences
2. Applies classes/attributes to document root
3. Prevents theme flicker and density mismatch
4. Runs in IIFE for scope isolation

This approach eliminates the "flash of wrong theme" issue common in SSR/SSG applications.

## Next Steps

- Phase 06-02: Create ThemeProvider component for React theme management
- Phase 06-03: Create DensityToggle component for user density selection
- Phase 06-04: Update existing components to use scaled spacing tokens

## Self-Check: PASSED

All claimed files and commits verified:

- ✅ FOUND: density.css
- ✅ FOUND: df0dff5 (Task 1 commit)
- ✅ FOUND: 2417951 (Task 2 commit)
