# Phase 6: Theming Integration - Research

**Researched:** 2026-02-16
**Domain:** Design tokens, CSS custom properties, zero-runtime theming
**Confidence:** MEDIUM

## Summary

Phase 6 integrates Covalent design tokens (v11.7.0) into the existing SurfacesUI theming system, mapping external tokens to internal CSS custom properties, implementing density variants via CSS calc() scaling, and injecting theme context through the json-render renderer. The architecture preserves zero-runtime styling (no CSS-in-JS) by using CSS custom properties exclusively, while the existing ThemeProvider already handles light/dark mode switching without page reload.

**Critical discovery:** The @covalent/tokens package (v11.7.0) specified in requirements does not exist in the public npm registry. Research found @covalent/core and related packages, but no standalone tokens package at that version. This needs clarification before planning can proceed - either the package name/version is incorrect, tokens are embedded in another package, or it's an internal Teradata package.

**Primary recommendation:** Verify @covalent/tokens package availability first. If tokens exist in a different package, extract and map them to SurfacesUI's existing CSS custom property structure using a three-layer token system (primitive → semantic → component). Implement density scaling via CSS custom property multipliers on a wrapper element, avoiding per-component overrides.

## Standard Stack

### Core - Design Token Management
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Style Dictionary | 4.x | Transform design tokens to CSS custom properties | Industry standard for token transformation, platform-agnostic, used by major design systems |
| @tokens-studio/sd-transforms | Latest | Style Dictionary transforms for Tokens Studio exports | Official transforms for token preprocessing, handles complex token types |

**Note:** @covalent/tokens@11.7.0 could not be verified in public npm registry. Alternative approaches researched.

### Supporting - Already in Place
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Custom Properties | Native | Runtime theme switching, token application | All theming - already foundational to SurfacesUI |
| React Context | Native | Theme state management | Already implemented in ThemeProvider |
| Tailwind CSS | 3.4.0 | Utility classes referencing CSS vars | Already configured with semantic token mapping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Style Dictionary | Manual JSON → CSS conversion | Loss of automation, harder to maintain, no validation |
| CSS Custom Properties | CSS-in-JS (Emotion, styled-components) | Runtime cost violates THEME-06, incompatible with zero-runtime requirement |
| Context-based theme injection | CSS-only approach | Loss of dynamic control, cannot respond to user preference changes |

**Installation (if @covalent/tokens exists):**
```bash
npm install @covalent/tokens@11.7.0
npm install --save-dev style-dictionary @tokens-studio/sd-transforms
```

**Installation (alternative - extract from @covalent/core):**
```bash
npm install @covalent/core@latest  # Contains token definitions
npm install --save-dev style-dictionary
```

## Architecture Patterns

### Recommended Project Structure
```
packages/components/src/theme/
├── tokens/                  # Source design tokens
│   ├── covalent.json       # Raw Covalent token values
│   ├── primitives.json     # Base palette (colors, spacing, typography)
│   ├── semantic.json       # Role-based tokens (--color-interactive, --space-sm)
│   └── component.json      # Component-specific overrides (optional)
├── generated/              # Build output (gitignored)
│   └── tokens.css          # Generated CSS custom properties
├── density.css             # Density variant definitions
├── tokens.css              # Final output (imports generated + density)
├── tailwind-preset.ts      # Tailwind config (already exists)
└── ThemeProvider.tsx       # Theme context provider (already exists)
```

### Pattern 1: Three-Layer Token System (Industry Standard)

**What:** Separate tokens into primitive, semantic, and component layers with one-directional dependencies.

**When to use:** Always - this is the scalable pattern for design systems.

**Token Layer Definitions:**

1. **Primitive tokens** - Context-free design values
   - Colors: `--color-blue-600: #0052CC`
   - Spacing: `--space-base: 16px`
   - Typography: `--font-size-base: 16px`

2. **Semantic tokens** - Role-based, reference primitives
   - `--color-interactive: var(--color-blue-600)`
   - `--spacing-component-gap: var(--space-base)`
   - Reference changes based on theme (light vs dark)

3. **Component tokens** (optional) - Component-specific, reference semantic
   - `--button-background: var(--color-interactive)`
   - Only needed at enterprise scale

**Mapping Strategy:**
```json
// covalent-to-surfacesui-mapping.json
{
  "primitives": {
    "--color-blue-600": "covalent.primary.500",
    "--color-gray-100": "covalent.surface.100"
  },
  "semantic": {
    "--background": {
      "light": "var(--color-gray-50)",
      "dark": "var(--color-gray-900)"
    },
    "--primary": {
      "light": "var(--color-blue-600)",
      "dark": "var(--color-blue-400)"
    }
  }
}
```

**Example:**
```css
/* primitives.css - from Covalent tokens */
:root {
  --covalent-primary-500: #3053f4;
  --covalent-surface-50: #fafafa;
  --covalent-surface-900: #212121;
  --space-base: 16px;
  --font-size-base: 16px;
}

/* semantic.css - mapped to SurfacesUI conventions */
:root {
  --background: var(--covalent-surface-50);
  --primary: var(--covalent-primary-500);
  --spacing-md: var(--space-base);
}

.dark {
  --background: var(--covalent-surface-900);
  --primary: var(--covalent-primary-400); /* lighter for contrast */
}
```

### Pattern 2: Density Scaling via Wrapper Element

**What:** Apply density multipliers to a wrapper element's CSS custom properties, letting inheritance scale all descendants.

**When to use:** For density variants (compact 0.8x, comfortable 1.0x, spacious 1.2x).

**Why this pattern:** Avoids per-component classes, maintains single source of truth, leverages CSS inheritance.

**Example:**
```css
/* density.css */
:root {
  /* Base spacing tokens */
  --space-base: 16px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --font-size-base: 16px;

  /* Density multiplier (default: comfortable) */
  --density-scale: 1;
}

/* Density variants applied via data attribute on wrapper */
[data-density="compact"] {
  --density-scale: 0.8;
}

[data-density="spacious"] {
  --density-scale: 1.2;
}

/* Components reference scaled values */
.component {
  padding: calc(var(--space-md) * var(--density-scale));
  font-size: calc(var(--font-size-base) * var(--density-scale));
  gap: calc(var(--space-sm) * var(--density-scale));
}
```

**Implementation in ThemeProvider:**
```tsx
// ThemeProvider.tsx enhancement
export interface ThemeConfig {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  density?: 'compact' | 'comfortable' | 'spacious'; // NEW
}

export function ThemeProvider({
  theme,
  tokenOverrides,
  density = 'comfortable', // NEW
  children
}) {
  // Apply density via data attribute on wrapper
  return (
    <ThemeContext.Provider value={value}>
      <div data-density={density} style={overrideStyle}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```

### Pattern 3: Style Dictionary Transform Pipeline

**What:** Automated transformation from design token source (JSON) to CSS custom properties.

**When to use:** Build-time token generation, ensures consistency.

**Example config:**
```js
// style-dictionary.config.js
module.exports = {
  source: ['src/theme/tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/theme/generated/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: {
          outputReferences: true, // Use var() references
        }
      }]
    }
  }
};
```

**Build integration:**
```json
// package.json scripts
{
  "scripts": {
    "build:tokens": "style-dictionary build",
    "prebuild": "npm run build:tokens",
    "dev": "npm run build:tokens && vite"
  }
}
```

### Pattern 4: Theme Context Injection to json-render Registry

**What:** Make theme values available to registry components via React context, not prop drilling.

**When to use:** Registry components need theme awareness (already done - ThemeProvider wraps SurfacesRenderer).

**Current architecture (already correct):**
```tsx
// renderer.tsx (EXISTING - no changes needed)
export function SurfacesRenderer({ spec, theme, tokenOverrides }) {
  return (
    <ThemeProvider theme={theme} tokenOverrides={tokenOverrides}>
      <StateProvider>
        <ActionProvider>
          <Renderer spec={spec} registry={registry} />
        </ActionProvider>
      </StateProvider>
    </ThemeProvider>
  );
}
```

**Registry components automatically inherit:**
- CSS custom properties via cascade
- Theme context via `useTheme()` hook (if needed)
- Density via inherited `data-density` attribute

**No changes required** - existing structure already provides theme context to registry.

### Anti-Patterns to Avoid

- **Don't apply density classes per component** - Use wrapper-level scaling via CSS custom properties
- **Don't hardcode Covalent token names in components** - Always map through SurfacesUI semantic layer
- **Don't use CSS-in-JS for theming** - Violates zero-runtime requirement (THEME-06)
- **Don't fetch tokens at runtime** - Build-time transformation only
- **Don't store theme preference in component state** - Use ThemeProvider context exclusively
- **Don't create component-level tokens prematurely** - Start with semantic layer, add component tokens only if needed at scale

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token transformation | Custom JSON parser and CSS generator | Style Dictionary | Handles complex token types (colors, spacing, typography, shadows), references, platform outputs, well-tested |
| Theme persistence | Custom localStorage wrapper | next-themes pattern or existing ThemeProvider | Handles SSR, hydration, system preference sync, prevents FOUC |
| Density calculation | JavaScript-based style injection | CSS calc() with custom properties | Zero runtime cost, works with SSR, better performance, leverages browser optimizations |
| Color format conversion | Custom HSL/RGB converters | Style Dictionary transforms | Built-in color transforms handle all formats, ensure consistency |
| Token validation | Custom JSON schema checker | Style Dictionary validators | Catches missing references, type errors, circular dependencies at build time |

**Key insight:** Token systems have deceptively complex edge cases (circular references, platform-specific transforms, dark mode mappings, missing fallbacks). Style Dictionary solves these; custom solutions inevitably rediscover these problems slowly.

## Common Pitfalls

### Pitfall 1: Flash of Unstyled Content (FOUC) with Theme Switching

**What goes wrong:** Page briefly shows wrong theme (light flash on dark mode preference) during initial load or theme switch, especially with SSR.

**Why it happens:** Theme preference loads from localStorage after HTML renders, causing class toggle after first paint. Server renders default theme, client hydrates with user preference.

**How to avoid:**
1. **Inline script before content** - Read theme preference from localStorage and apply class before first paint
2. **CSS-only fallback** - Use `@media (prefers-color-scheme: dark)` as SSR default
3. **No client-side conditional rendering** - Theme should only affect CSS vars, not component structure

**Warning signs:**
- Flicker on page load
- Theme switches after content appears
- Hydration warnings in console

**Implementation:**
```html
<!-- index.html - inline script BEFORE app renders -->
<script>
  const theme = localStorage.getItem('theme') || 'system';
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
</script>
```

### Pitfall 2: Density Scaling Breaking Fixed Sizes

**What goes wrong:** Applying density scale to all tokens breaks components with intentional fixed sizes (icons, borders, certain paddings).

**Why it happens:** `calc(var(--token) * var(--density-scale))` applied universally scales things that shouldn't change (1px borders become 0.8px, icon sizes distort).

**How to avoid:**
1. **Create density-exempt token category** - Separate tokens that should never scale
2. **Use density-aware token naming** - `--space-md-scalable` vs `--border-width-fixed`
3. **Selective calc() application** - Only multiply spacing/typography tokens, not borders/icons

**Warning signs:**
- Blurry borders (sub-pixel rendering)
- Distorted icons
- Broken alignment at different densities

**Solution:**
```css
/* WRONG - scales everything including borders */
.button {
  padding: calc(var(--space-md) * var(--density-scale));
  border-width: calc(var(--border-width) * var(--density-scale)); /* BREAKS */
}

/* CORRECT - selective scaling */
.button {
  padding: calc(var(--space-md) * var(--density-scale));
  border-width: var(--border-width); /* Fixed size */
}
```

### Pitfall 3: Performance Re-renders from Theme Context Changes

**What goes wrong:** Changing theme causes all components consuming ThemeContext to re-render, even if they only read `resolvedTheme` for CSS class application.

**Why it happens:** React Context treats entire context object as single value - any property change triggers re-render of all consumers.

**How to avoid:**
1. **Prefer CSS custom properties over context reads** - Components should style via CSS vars, not reading theme from context
2. **Minimize theme context consumers** - Only root-level components should use `useTheme()`
3. **Separate theme state from UI state** - Don't add UI state to ThemeContext

**Warning signs:**
- Profiler shows many components re-rendering on theme toggle
- Slow theme switching
- Unnecessary re-computation of expensive components

**Current SurfacesUI status:** GOOD - ThemeProvider only manages theme state, components use CSS vars for styling.

### Pitfall 4: Hardcoding Covalent Token Names in Components

**What goes wrong:** Components directly reference `var(--covalent-primary-500)` instead of semantic layer, making future token system changes break components.

**Why it happens:** Shortcuts during development, copying token names from design tools.

**How to avoid:**
1. **Enforce naming convention** - All component styles use `--background`, `--primary`, never `--covalent-*`
2. **Token mapping layer is mandatory** - Never skip the semantic abstraction
3. **Lint rule** - Flag direct primitive token usage in component files

**Warning signs:**
- Component styles break when updating Covalent tokens
- Dark mode mappings require component changes
- Difficulty swapping design systems

**Solution:**
```tsx
/* WRONG - hardcoded Covalent token */
<div className="bg-[var(--covalent-primary-500)]">

/* CORRECT - semantic token */
<div className="bg-primary">
```

### Pitfall 5: Missing Dark Mode Token Mappings

**What goes wrong:** Light mode looks perfect, dark mode has invisible text, poor contrast, or identical background/foreground colors.

**Why it happens:** Forgetting to map semantic tokens to different primitive values for `.dark` selector, or assuming same token works for both modes.

**How to avoid:**
1. **Swap test** - For every semantic token, verify it maps to appropriate primitive in both light and dark
2. **Contrast checking** - Automated tests for WCAG AA contrast ratios in both modes
3. **Dark-first development** - Build in dark mode, verify in light mode (catches missing mappings early)

**Warning signs:**
- Text disappears in dark mode
- Borders invisible
- Contrast failures in accessibility tests

**Solution:**
```css
/* WRONG - same primitive for both modes */
:root {
  --foreground: var(--covalent-surface-900);
}
.dark {
  --foreground: var(--covalent-surface-900); /* BREAKS - dark text on dark bg */
}

/* CORRECT - inverted mapping */
:root {
  --foreground: var(--covalent-surface-900); /* dark text */
  --background: var(--covalent-surface-50);  /* light bg */
}
.dark {
  --foreground: var(--covalent-surface-50);  /* light text */
  --background: var(--covalent-surface-900); /* dark bg */
}
```

## Code Examples

Verified patterns from research and existing codebase:

### Covalent Token Extraction (if embedded in @covalent/core)

**Source:** Style Dictionary documentation + research findings

```js
// scripts/extract-covalent-tokens.js
// If @covalent/tokens doesn't exist standalone, extract from @covalent/core

import * as covalentCore from '@covalent/core';
import fs from 'fs';

// This is speculative - actual structure depends on @covalent/core exports
// May need to parse SCSS variables or CSS custom properties instead

const extractedTokens = {
  colors: {
    primary: {
      500: '#3053f4',  // From research - Covalent primary blue
      // ... extract rest
    },
    surface: {
      50: '#fafafa',
      // ... extract rest
    }
  },
  spacing: {
    base: '16px',
    // ... extract rest
  }
};

fs.writeFileSync(
  './src/theme/tokens/covalent.json',
  JSON.stringify(extractedTokens, null, 2)
);
```

### Style Dictionary Configuration for SurfacesUI

**Source:** [Style Dictionary documentation](https://styledictionary.com/reference/config/)

```js
// style-dictionary.config.js
module.exports = {
  source: [
    'src/theme/tokens/covalent.json',
    'src/theme/tokens/primitives.json',
    'src/theme/tokens/semantic.json'
  ],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/theme/generated/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
            selector: ':root'
          },
          // Light mode tokens
          filter: (token) => !token.attributes.mode || token.attributes.mode === 'light'
        },
        {
          destination: 'tokens-dark.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
            selector: '.dark'
          },
          // Dark mode tokens
          filter: (token) => token.attributes.mode === 'dark'
        }
      ]
    }
  },
  transform: {
    // Custom transform to map Covalent names to SurfacesUI names
    'name/covalent-to-surfaces': {
      type: 'name',
      transformer: (token) => {
        // Map covalent.primary.500 -> --primary
        // This mapping would need customization based on actual Covalent structure
        return token.path.join('-').replace('covalent-', '--');
      }
    }
  }
};
```

### Enhanced ThemeProvider with Density

**Source:** Existing ThemeProvider.tsx + research patterns

```tsx
// theme/ThemeProvider.tsx (enhanced)
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

export interface ThemeConfig {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  density: DensityMode;
  setDensity: (mode: DensityMode) => void;
}

interface ThemeProviderProps {
  theme?: ThemeMode;
  density?: DensityMode;
  tokenOverrides?: Record<string, string>;
  children: React.ReactNode;
}

const ThemeContext = createContext<ThemeConfig | undefined>(undefined);

export function ThemeProvider({
  theme: initialTheme = 'system',
  density: initialDensity = 'comfortable',
  tokenOverrides,
  children,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [density, setDensity] = useState<DensityMode>(initialDensity);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    theme === 'system'
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
  );

  // Theme resolution logic (existing)
  useEffect(() => {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const value = useMemo<ThemeConfig>(
    () => ({ theme, setTheme, resolvedTheme, density, setDensity }),
    [theme, resolvedTheme, density]
  );

  const overrideStyle = useMemo(() => {
    if (!tokenOverrides || Object.keys(tokenOverrides).length === 0) {
      return undefined;
    }
    const style: Record<string, string> = {};
    for (const [key, val] of Object.entries(tokenOverrides)) {
      const prop = key.startsWith('--') ? key : `--${key}`;
      style[prop] = val;
    }
    return style;
  }, [tokenOverrides]);

  return (
    <ThemeContext.Provider value={value}>
      <div data-density={density} style={overrideStyle}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeConfig {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### Density-Aware Component Styling

**Source:** Research findings + existing Tailwind patterns

```tsx
// primitives/data-table/DataTable.tsx (example enhancement)

// CSS Module or Tailwind classes referencing scaled tokens
const styles = {
  // BEFORE: Fixed spacing
  // padding: 'px-4 py-2'

  // AFTER: Density-aware via calc() in CSS
  // Tailwind classes reference CSS vars that use density scaling
};

// Component code unchanged - density applied via CSS inheritance
export function DataTable({ data, columns, density }: DataTableProps) {
  // No density logic needed in component
  // CSS handles scaling via inherited --density-scale
  return (
    <div className="px-[--space-md-scaled] py-[--space-sm-scaled]">
      {/* content */}
    </div>
  );
}
```

```css
/* In tokens.css or component CSS */
:root {
  --space-sm: 8px;
  --space-md: 16px;
  --density-scale: 1;

  /* Scaled versions for component use */
  --space-sm-scaled: calc(var(--space-sm) * var(--density-scale));
  --space-md-scaled: calc(var(--space-md) * var(--density-scale));
}

[data-density="compact"] {
  --density-scale: 0.8;
}

[data-density="spacious"] {
  --density-scale: 1.2;
}
```

### Token Mapping Example

**Source:** [Design token architecture research](https://www.contentful.com/blog/design-token-system/)

```json
// src/theme/tokens/semantic.json
{
  "color": {
    "background": {
      "value": "{color.primitive.surface.50}",
      "attributes": { "mode": "light" }
    },
    "foreground": {
      "value": "{color.primitive.surface.900}",
      "attributes": { "mode": "light" }
    },
    "primary": {
      "value": "{color.primitive.blue.600}",
      "attributes": { "mode": "light" }
    }
  }
}

// Dark mode overrides
{
  "color": {
    "background": {
      "value": "{color.primitive.surface.900}",
      "attributes": { "mode": "dark" }
    },
    "foreground": {
      "value": "{color.primitive.surface.50}",
      "attributes": { "mode": "dark" }
    },
    "primary": {
      "value": "{color.primitive.blue.400}",
      "attributes": { "mode": "dark" }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS-in-JS for theming (Emotion, styled-components) | CSS custom properties + zero-runtime | 2023-2025 | Better performance, SSR/RSC compatibility, smaller bundles |
| Theme object prop drilling | CSS vars + React Context for state only | 2024-2026 | Fewer re-renders, simpler component code, leverages browser cascade |
| Flat token structure | 3-layer hierarchy (primitive → semantic → component) | Design Tokens spec v1.0 (2025) | Better scalability, easier refactoring, clearer governance |
| Manual token transformation | Style Dictionary automation | Industry standard since ~2019 | Consistency, validation, multi-platform support |
| Per-component density classes | Wrapper-level CSS var multiplication | Material Design 3 (2022+) | DRY, fewer variants, easier maintenance |

**Deprecated/outdated:**
- **ThemeProvider as style injector:** Old pattern had ThemeProvider inject `<style>` tags with theme CSS. Current: CSS files with custom properties, context only manages state.
- **JavaScript-based density calculation:** Old: Calculate spacing in JS, pass as inline styles. Current: CSS calc() with custom property multipliers.
- **Hard-coded theme values in components:** Old: Components had light/dark color values in code. Current: Always reference semantic CSS vars.

## Open Questions

### 1. What is the actual package name/version for Covalent tokens?

**What we know:**
- Requirements specify `@covalent/tokens@11.7.0`
- Public npm registry has no package named `@covalent/tokens`
- Teradata Covalent packages exist: `@covalent/core`, `@covalent/components`, etc.
- Covalent design system exists with documented color/spacing scales (found in tailwind-preset.ts)

**What's unclear:**
- Is `@covalent/tokens` an internal Teradata package not publicly published?
- Should tokens be extracted from `@covalent/core` or another package?
- Is v11.7.0 the correct version, or is this a typo/placeholder?
- Are Covalent tokens already present in the codebase (tailwind-preset.ts has Covalent colors)?

**Recommendation:**
1. Check with stakeholder/PM about token source
2. If tokens already in codebase (tailwind-preset.ts), use those as source of truth
3. If need external package, identify correct package name from Teradata
4. Proceed with token mapping regardless of source (JSON, npm, or existing code)

### 2. What is the full scope of Covalent tokens to integrate?

**What we know:**
- tailwind-preset.ts already has Covalent brand colors (primary, secondary, tertiary, etc.)
- Spacing scale exists (`--space-base` etc.)
- Typography scale exists (headline-1 through body-2, caption)

**What's unclear:**
- Should existing Covalent colors in tailwind-preset.ts be replaced or augmented?
- Are there additional Covalent tokens beyond colors (shadows, borders, radii, transitions)?
- Which Covalent tokens are mandatory vs. optional?
- Do Covalent tokens need to replace all existing tokens, or just supplement?

**Recommendation:**
- Start with color tokens (highest impact)
- Add spacing/typography if different from current system
- Document which SurfacesUI tokens map to which Covalent tokens
- Create mapping file showing Covalent → SurfacesUI correspondence

### 3. How should density affect typography scaling?

**What we know:**
- Density variants: compact (0.8x), comfortable (1.0x), spacious (1.2x)
- Spacing should scale with density
- Components need different density levels

**What's unclear:**
- Should font sizes scale with density, or only spacing/padding?
- Should line heights scale proportionally, or stay fixed for readability?
- Do icon sizes scale with density?
- Are there accessibility implications of scaling font sizes below 14px in compact mode?

**Recommendation:**
- **Spacing/padding:** Always scale with density (safe)
- **Typography:** Scale conservatively - only increase in spacious, don't decrease below 14px in compact (WCAG)
- **Icons:** Fixed sizes (16px, 20px, 24px) - don't scale
- **Borders:** Fixed widths (1px, 2px) - don't scale
- Test with accessibility tools to verify readability at all densities

## Sources

### Primary (HIGH confidence)
- Existing SurfacesUI codebase analysis:
  - `/packages/components/src/theme/ThemeProvider.tsx` - Current theme management implementation
  - `/packages/components/src/theme/tokens.css` - Existing CSS custom property structure
  - `/packages/components/src/theme/tailwind-preset.ts` - Covalent colors already present
  - `/packages/components/src/catalog/renderer.tsx` - Theme context wrapping (already correct)
- [CSS Custom Properties Guide 2026](https://devtoolbox.dedyn.io/blog/css-variables-complete-guide) - Modern CSS variables patterns
- [Design Tokens Developer's Guide](https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/) - Token system architecture

### Secondary (MEDIUM confidence)
- [GitHub: Teradata/covalent](https://github.com/Teradata/covalent) - Covalent design system repository (package structure unclear)
- [Style Dictionary Documentation](https://styledictionary.com/reference/config/) - Official transform/build documentation
- [Material Design 3 Design Tokens](https://m3.material.io/foundations/design-tokens) - Token hierarchy patterns
- [Contentful: Design Token System](https://www.contentful.com/blog/design-token-system/) - Three-layer architecture explanation
- [React Context Performance 2026](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view) - Context optimization patterns
- [Fixing Dark Mode Flickering in React](https://notanumber.in/blog/fixing-react-dark-mode-flickering) - FOUC prevention strategies

### Tertiary (LOW confidence - needs verification)
- [@covalent/tokens package](https://www.npmjs.com/package/@covalent/tokens) - **COULD NOT VERIFY** - Package not found in npm registry
- Covalent v11.7.0 release notes - **NOT FOUND** - Version unclear, may be internal or incorrect

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Style Dictionary verified, @covalent/tokens unverified
- Architecture: HIGH - Patterns well-documented, existing code analyzed, industry standards confirmed
- Pitfalls: HIGH - Multiple authoritative sources, real-world examples, existing codebase validates patterns
- Covalent integration: LOW - Cannot verify token package, unclear source of truth

**Research date:** 2026-02-16
**Valid until:** 30 days (2026-03-18) - Design token standards stable, CSS custom properties mature, unlikely to change significantly

**Critical blocker:** @covalent/tokens@11.7.0 package verification needed before planning Phase 6 tasks.
