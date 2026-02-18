# Phase 1: Foundation & Component Decomposition - Research

**Researched:** 2026-02-16
**Domain:** json-render integration, React component decomposition, chart/table primitives
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 establishes json-render foundation and decomposes SQLResultsDisplay (1772 lines) into atomic primitives. The research validates the technical approach and identifies the standard stack for catalog-driven generative UI with React.

**Key findings:** json-render from Vercel is production-ready (released January 2026) with proven Zod-based catalog patterns. ECharts integration is well-established in the codebase. Virtual scrolling requires TanStack Virtual v3. Component decomposition follows atomic design principles with clear size boundaries.

**Primary recommendation:** Install @json-render/core and @json-render/react, define catalog with 5-8 props per component using Zod schemas, decompose SQLResultsDisplay into Chart, DataTable, Filter, DensityToggle, and ViewModeToggle primitives following atomic design hierarchy.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @json-render/core | latest | Framework-agnostic catalog, validation, actions | Official Vercel framework, Apache 2.0, production-ready Jan 2026 |
| @json-render/react | latest | React renderer, context providers, hooks | React-specific wrapper for core, streaming support |
| zod | ^3.x | Schema definition and validation for catalog | Required by json-render, industry standard for TypeScript validation |
| echarts | ^5.5.0 | Chart rendering engine | Already in package.json, 10 accessible themes already implemented |
| @tanstack/react-virtual | ^3.13.18 | Virtual scrolling for large tables | Headless, 60FPS, lightweight (10-15kb), v3 is current |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| echarts-for-react | ^3.x | React wrapper for ECharts | Consider if direct echarts usage becomes cumbersome, but existing ECharts component works |
| react-window | ^1.x | Alternative virtual scrolling | Consider if TanStack Virtual doesn't meet needs, but TanStack is more responsive |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| json-render | Custom DSL | json-render is proven, cross-platform, no RSC dependency - custom DSL is reinventing wheel |
| TanStack Virtual | react-window | TanStack more responsive on low-end machines, react-window better for stable grid layouts |
| Zod | TypeScript interfaces only | Zod provides runtime validation, required by json-render, generates JSON schemas |

**Installation:**
```bash
pnpm add @json-render/core @json-render/react @tanstack/react-virtual
# Note: echarts ^5.5.0 already installed, zod likely in dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
packages/components/src/
├── primitives/                  # Atomic components (<50 lines)
│   ├── chart/
│   │   ├── Chart.tsx           # Standalone ECharts wrapper
│   │   ├── Chart.test.tsx
│   │   └── index.ts
│   ├── data-table/
│   │   ├── DataTable.tsx       # Virtual scrolling table
│   │   ├── DataTable.test.tsx
│   │   └── index.ts
│   ├── filter/
│   ├── density-toggle/
│   └── view-mode-toggle/       # Already exists
├── molecules/                   # Composed components (50-150 lines)
│   ├── table-with-filters/
│   └── chart-with-controls/
├── organisms/                   # Complex compositions (150-400 lines)
│   └── sql-results/
│       ├── SQLResultsDisplay.tsx  # Now orchestrates primitives
│       └── types.ts
├── catalog/                     # json-render definitions
│   ├── schema.ts               # Zod schemas for all primitives
│   ├── registry.ts             # Maps catalog to components
│   └── prompt.ts               # Generated AI prompt
└── bridge/                     # Existing MCP Bridge
```

### Pattern 1: json-render Catalog Definition with Zod

**What:** Define component catalog with Zod schemas that constrain AI generation
**When to use:** Every component that needs AI-describability
**Example:**
```typescript
// Source: https://json-render.dev/docs/catalog
import { defineSchema, defineCatalog } from '@json-render/core';
import { z } from 'zod';

const schema = defineSchema({ /* configuration */ });

export const catalog = defineCatalog(schema, {
  components: {
    Chart: {
      props: z.object({
        type: z.enum(['bar', 'line', 'pie', 'scatter']),
        xAxis: z.string(),
        yAxis: z.string(),
        theme: z.string().nullable(),
        height: z.number().default(400),
      }),
      description: "Render data as a chart with ECharts",
      hasChildren: false,
    },
    DataTable: {
      props: z.object({
        columns: z.array(z.string()),
        height: z.number().default(400),
        density: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
      }),
      description: "Display tabular data with virtual scrolling",
      hasChildren: false,
    },
  },
  actions: {
    export_csv: {
      params: z.object({ format: z.string() }),
      description: "Export data to CSV format",
    },
  },
});

// Generate AI system prompt
export const aiPrompt = catalog.prompt();
```

**Key principles:**
- **5-8 props maximum** for AI describability (token cost optimization)
- Use enums for variants, not open-ended strings
- Mark optional props with `.nullable()` or `.optional()`
- Provide contextual descriptions (AI understands "when to use", not just "what it is")
- `hasChildren: true` only for composable components

### Pattern 2: Component Registry Mapping

**What:** Map catalog definitions to React implementations
**When to use:** After defining catalog schemas
**Example:**
```typescript
// Source: https://github.com/vercel-labs/json-render
import { defineRegistry } from '@json-render/react';
import { catalog } from './schema';
import { Chart } from '../primitives/chart';
import { DataTable } from '../primitives/data-table';

export const registry = defineRegistry(catalog, {
  Chart,
  DataTable,
  // ... other components
});
```

### Pattern 3: ECharts Theme Integration

**What:** Register custom themes with echarts.registerTheme() for dark/light mode
**When to use:** Chart components that need theme support
**Example:**
```typescript
// Source: existing codebase packages/components/src/components/charts/echart-themes.ts
import * as echarts from 'echarts';
import { accessibleThemes } from './echart-themes';

// Register all themes on module load
Object.entries(accessibleThemes).forEach(([key, theme]) => {
  echarts.registerTheme(key, theme);
});

// Use theme in component
<ECharts
  option={chartOption}
  theme="professionalDark"  // or "professionalLight"
  style={{ height: '100%', width: '100%' }}
/>
```

**Current themes available:**
- professionalLight / professionalDark (default)
- highContrastLight / highContrastDark
- colorblindSafeLight / colorblindSafeDark
- oceanDepthsLight / oceanDepthsDark
- earthTonesLight / earthTonesDark

### Pattern 4: Virtual Scrolling with TanStack Virtual

**What:** Render only visible rows for tables with thousands of rows at 60FPS
**When to use:** Tables with >100 rows, especially >1000 rows
**Example:**
```typescript
// Source: https://tanstack.com/virtual/latest/docs/framework/react/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function DataTable({ rows, columns }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // estimated row height in px
    overscan: 5, // render 5 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {/* Render row content */}
            {columns.map(col => <td>{rows[virtualRow.index][col]}</td>)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 5: Atomic Design Component Decomposition

**What:** Extract primitives from complex components following size limits
**When to use:** Any component exceeding 400 lines
**Decomposition strategy for SQLResultsDisplay (1772 lines):**

1. **Identify cohesive modules** (Identify and Size Components pattern):
   - Chart rendering logic → Chart primitive (atom)
   - Table rendering logic → DataTable primitive (atom)
   - Filter UI → Filter primitive (atom)
   - Density controls → DensityToggle primitive (atom)
   - View mode toggle → ViewModeToggle primitive (already exists)

2. **Extract primitives** (Extract Primitives approach):
   - Each primitive: single responsibility, <50 lines core logic
   - Co-located tests, types, hooks
   - Props interface: 5-8 props maximum for AI describability

3. **Create molecules** (composition layer):
   - TableWithFilters: compose DataTable + Filter (50-150 lines)
   - ChartWithControls: compose Chart + axis config (50-150 lines)

4. **Refactor organism** (SQLResultsDisplay):
   - Becomes composition layer (150-400 lines)
   - Orchestrates primitives and molecules
   - Handles state management, data flow, MCP Bridge integration

**Size limits enforcement:**
- Atoms: <50 lines
- Molecules: 50-150 lines
- Organisms: 150-400 lines
- >400 lines: MUST decompose

### Anti-Patterns to Avoid

- **Catalog bloat:** Don't add every component variation to catalog. Define base primitives with variant props instead.
- **Prop explosion:** >8 props makes components hard for AI to describe. Group related props into objects or split component.
- **Direct DOM manipulation in virtual lists:** Let TanStack Virtual handle positioning, don't override transform styles.
- **Hardcoded colors in charts:** Always use theme system, never inline color values.
- **Missing hasChildren flag:** If component can contain children, MUST set `hasChildren: true` in catalog.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom viewport calculation, manual row positioning | @tanstack/react-virtual | Edge cases: variable row heights, sticky headers, horizontal scrolling, resize handling, scroll position restoration - 10-15kb solves all |
| Chart theming | Custom color palette management | echarts.registerTheme() | Already implemented 10 accessible themes (WCAG compliant), dark/light variants, colorblind safe |
| Component validation | Custom prop validation with TypeScript | Zod schemas in catalog | Runtime validation, JSON schema generation, AI prompt generation, type safety - all in one |
| Catalog prompt generation | Manual AI prompt writing | catalog.prompt() | Generates consistent system prompts, handles component descriptions, action definitions, validation rules |
| Virtual DOM for lists | Re-implementing windowing logic | TanStack Virtual (or react-window) | Windowing is deceptively complex: dynamic sizing, scroll restoration, keyboard navigation, accessibility, 60FPS performance |

**Key insight:** Virtual scrolling and catalog validation are "solved problems" with production-ready libraries. Custom implementations will have bugs, missing edge cases, and poor performance. Use standard libraries.

## Common Pitfalls

### Pitfall 1: Catalog Components Not AI-Describable
**What goes wrong:** AI generates invalid or unexpected UI because component has too many props or unclear descriptions.
**Why it happens:** Components designed for human developers, not AI consumption. Props >8 make token costs high and increase error rate.
**How to avoid:**
- Limit to 5-8 props per catalog component
- Use enums for variants (AI understands bounded choices)
- Write descriptions that explain "when to use" not just "what it is"
- Test with `catalog.prompt()` - if generated prompt is confusing, simplify component
**Warning signs:**
- Component has >10 props
- Props are complex nested objects
- Description is technical jargon ("renders a polymorphic container with slot-based composition")
- AI repeatedly misuses component in testing

### Pitfall 2: Virtual Scrolling Performance Degradation
**What goes wrong:** Table becomes janky, drops frames, or scrolling is sluggish despite virtual scrolling.
**Why it happens:** Expensive operations in render path (complex calculations, inline function creation, unnecessary re-renders).
**How to avoid:**
- Use `React.memo()` for row components
- Memoize expensive calculations with `useMemo()`
- Avoid inline functions in virtualized rows (use `useCallback()`)
- Set accurate `estimateSize` - wrong estimates cause janky scrolling
- Use `overscan` to render extra rows (prevents white flash during scroll)
**Warning signs:**
- Frame rate drops below 60FPS during scrolling
- White flashing as new rows appear
- Scroll position jumps unexpectedly
- High CPU usage during scrolling

### Pitfall 3: ECharts Theme Not Respecting System Theme
**What goes wrong:** Chart stays in light mode when system is dark, or vice versa.
**Why it happens:** Theme is set once on mount, doesn't react to theme changes. Or using echarts `darkMode` flag (only partially works - doesn't update all text colors).
**How to avoid:**
- Detect theme changes with `window.matchMedia('(prefers-color-scheme: dark)')` listener
- Re-render chart with new theme when system theme changes
- Use `professionalLight` / `professionalDark` themes (already implemented)
- Check for `.dark` class on document element (Tailwind strategy)
- Register themes on module load, not component mount
**Warning signs:**
- Chart theme doesn't match surrounding UI
- Text colors have poor contrast in one theme
- Theme builder exports don't work with existing themes
- Users report accessibility issues in one theme mode

### Pitfall 4: Component Decomposition Creates Prop Drilling
**What goes wrong:** After decomposition, props are passed through 3-4 component layers, creating maintenance burden.
**Why it happens:** Poor decomposition boundaries - split components by UI, not by data flow.
**How to avoid:**
- Use composition pattern (pass components as props/children)
- Introduce context for shared state (but don't overuse - context makes testing harder)
- Keep related state and UI together (co-location principle)
- Consider "lifting state up" vs "pushing state down" tradeoffs
- Use MCP Bridge provider for data fetching, not prop passing
**Warning signs:**
- Same prop passed through 3+ components
- Component takes props it doesn't use (just passes down)
- Adding new feature requires changing 5+ component signatures
- Tests become difficult because of deep prop mocking

### Pitfall 5: Catalog Schema Too Strict or Too Loose
**What goes wrong:** AI either can't generate desired UI (too strict) or generates invalid/unsafe UI (too loose).
**Why it happens:** Schema validation doesn't match actual component capabilities. Missing `.nullable()`, overly restrictive enums, or no validation on dangerous props.
**How to avoid:**
- Start loose, tighten based on AI output errors
- Use `.nullable()` for truly optional props (vs `.optional()` which allows undefined)
- Include all valid variants in enums (don't artificially limit)
- Validate dangerous props (URLs, scripts, HTML) with refinements
- Test with real AI model - don't assume validation works until verified
**Warning signs:**
- AI frequently generates JSON that fails validation
- AI avoids using component (schema too confusing)
- Generated UI has security issues (XSS, data leaks)
- Schema has many refinements/transforms (sign of wrong abstraction)

### Pitfall 6: Monorepo Package Not Linked with workspace: Protocol
**What goes wrong:** After installing json-render packages, imports fail or wrong versions are resolved.
**Why it happens:** pnpm workspaces require explicit `workspace:*` protocol for internal packages. Without it, pnpm tries to resolve from npm registry.
**How to avoid:**
- Use `pnpm add @json-render/core @json-render/react` in workspace root or specific package
- Check pnpm-workspace.yaml includes packages path
- Use `workspace:*` for internal package dependencies
- Run `pnpm install` after adding packages (don't use npm/yarn)
- Verify with `pnpm list` that packages are resolved correctly
**Warning signs:**
- Import errors after installation
- TypeScript can't find type definitions
- Multiple versions of same package in node_modules
- Build fails but development works (or vice versa)

## Code Examples

Verified patterns from research:

### json-render Catalog with Component Registry
```typescript
// catalog/schema.ts
import { defineSchema, defineCatalog } from '@json-render/core';
import { z } from 'zod';

const schema = defineSchema({
  // Schema configuration
});

export const catalog = defineCatalog(schema, {
  components: {
    Chart: {
      props: z.object({
        type: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'heatmap']),
        xAxis: z.string(),
        yAxis: z.string(),
        theme: z.string().nullable(),
        height: z.number().default(400),
        showDataLabels: z.boolean().default(false),
      }),
      description: "Render data as a chart using ECharts with theme integration",
      hasChildren: false,
    },
    DataTable: {
      props: z.object({
        columns: z.array(z.string()),
        height: z.number().default(400),
        density: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
        virtualScrolling: z.boolean().default(true),
      }),
      description: "Display tabular data with virtual scrolling for large datasets",
      hasChildren: false,
    },
    Filter: {
      props: z.object({
        placeholder: z.string().default('Search...'),
        columns: z.array(z.string()),
      }),
      description: "Filter table data by search term or column-specific filters",
      hasChildren: false,
    },
  },
  actions: {
    export_csv: {
      params: z.object({ filename: z.string().default('export.csv') }),
      description: "Export current data to CSV file",
    },
  },
});

// catalog/registry.ts
import { defineRegistry } from '@json-render/react';
import { catalog } from './schema';
import { Chart } from '../primitives/chart';
import { DataTable } from '../primitives/data-table';
import { Filter } from '../primitives/filter';

export const registry = defineRegistry(catalog, {
  Chart,
  DataTable,
  Filter,
});

// catalog/prompt.ts
import { catalog } from './schema';

// Generate system prompt for AI
export const aiSystemPrompt = catalog.prompt({
  customRules: [
    'Use Chart for visualizing trends and comparisons',
    'Use DataTable for detailed row-by-row inspection',
    'Always include Filter when showing large datasets',
  ],
});
```

### Virtual Table with TanStack Virtual
```typescript
// primitives/data-table/DataTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useMemo } from 'react';

interface DataTableProps {
  rows: Record<string, unknown>[];
  columns: string[];
  height?: number;
  density?: 'compact' | 'comfortable' | 'spacious';
}

const ROW_HEIGHTS = {
  compact: 28,
  comfortable: 35,
  spacious: 42,
};

export function DataTable({
  rows,
  columns,
  height = 400,
  density = 'comfortable'
}: DataTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = ROW_HEIGHTS[density];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="border rounded-lg overflow-auto"
      style={{ height: `${height}px` }}
    >
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0 z-10">
          <tr>
            {columns.map(col => (
              <th key={col} className="px-3 py-2 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }} />
          {virtualItems.map(virtualRow => (
            <tr
              key={virtualRow.index}
              className="border-b hover:bg-muted/30"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {columns.map(col => (
                <td key={col} className="px-3 py-2">
                  {String(rows[virtualRow.index][col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Chart Primitive with Theme Integration
```typescript
// primitives/chart/Chart.tsx
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { registerEChartsThemes } from '../../components/charts/echart-themes';

interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'heatmap';
  data: Record<string, unknown>[];
  xAxis: string;
  yAxis: string;
  theme?: string;
  height?: number;
  showDataLabels?: boolean;
}

// Register themes on module load
registerEChartsThemes(echarts);

export function Chart({
  type,
  data,
  xAxis,
  yAxis,
  theme = 'professionalLight',
  height = 400,
  showDataLabels = false
}: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);

  // Detect system theme
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Theme changed - could update chart here
    };
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, theme);
    setChartInstance(chart);
    return () => chart.dispose();
  }, [theme]);

  // Update chart options
  useEffect(() => {
    if (!chartInstance) return;

    const xData = data.map(row => String(row[xAxis]));
    const yData = data.map(row => parseFloat(String(row[yAxis])) || 0);

    const option: echarts.EChartsOption = {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series: [{
        name: yAxis,
        type: type === 'area' ? 'line' : type,
        data: yData,
        areaStyle: type === 'area' ? {} : undefined,
        label: showDataLabels ? { show: true } : undefined,
      }],
    };

    chartInstance.setOption(option);
  }, [chartInstance, data, type, xAxis, yAxis, showDataLabels]);

  return <div ref={chartRef} style={{ height: `${height}px`, width: '100%' }} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom DSL for UI generation | json-render catalog with Zod | January 2026 | Standardized generative UI, reduced token costs, improved AI accuracy |
| react-virtualized | TanStack Virtual v3 | 2023-2024 | Lighter (10-15kb vs 30kb+), more responsive, headless architecture |
| Manual prop validation | Zod runtime validation | Zod 3.x (2023+) | Type safety + runtime checks, JSON schema generation, better DX |
| Global state management (Redux) | Composition + Context | React 18+ (2022+) | Simpler architecture, better tree-shaking, easier testing |
| echarts.darkMode flag | echarts.registerTheme() | ECharts 5.x (2020+) | Full theme control, WCAG compliance, colorblind safety |

**Deprecated/outdated:**
- **react-virtualized**: Replaced by react-window (2018) and TanStack Virtual (2023). No longer maintained.
- **Custom JSON schemas**: Zod generates schemas, don't hand-write JSON Schema definitions.
- **echarts.darkMode option**: Only partially works (text colors inconsistent). Use registerTheme() instead.
- **Prop drilling for data**: Use MCP Bridge provider and composition patterns, not deep prop passing.

## Open Questions

1. **What's the optimal overscan value for TanStack Virtual with SQL results?**
   - What we know: Default is 5 rows, docs say adjust based on row complexity
   - What's unclear: SQL tables have variable column widths, complex cell rendering - does this need higher overscan?
   - Recommendation: Start with 5, profile with Chrome DevTools Performance tab, increase if white flashing occurs

2. **Should catalog include both primitives and composed organisms?**
   - What we know: json-render allows nested components, AI can compose primitives
   - What's unclear: Does exposing SQLResultsDisplay organism improve or confuse AI generation?
   - Recommendation: Start with primitives only in catalog (Chart, DataTable, Filter). If AI frequently needs full SQL results UI, add organism with clear composition description.

3. **How to handle catalog versioning as components evolve?**
   - What we know: Zod schemas will change as components evolve
   - What's unclear: Does json-render support schema versioning? How to handle breaking changes?
   - Recommendation: Research json-render documentation for versioning patterns. May need separate catalogs per major version.

4. **What's the bundle size impact of adding json-render?**
   - What we know: @json-render/core and @json-render/react are separate packages
   - What's unclear: Total gzipped size, tree-shaking effectiveness
   - Recommendation: Measure bundle size after installation with `pnpm build` and check dist/ sizes. Target: <500KB per HTML app (existing limit).

5. **Does pnpm workspace require specific configuration for json-render?**
   - What we know: pnpm workspaces use pnpm-workspace.yaml and workspace: protocol
   - What's unclear: Any conflicts with existing monorepo setup? json-render has peer dependencies?
   - Recommendation: Install in packages/components specifically: `pnpm --filter @surfacesui/components add @json-render/core @json-render/react`. Check for peer dependency warnings.

## Sources

### Primary (HIGH confidence)
- [json-render Official Documentation](https://json-render.dev/) - Installation, catalog patterns, AI prompt generation
- [json-render GitHub Repository](https://github.com/vercel-labs/json-render) - Source code, examples, issue tracking
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest) - Installation, API reference, examples
- [ECharts Official Handbook - Style](https://apache.github.io/echarts-handbook/en/concepts/style/) - Theme registration, customization
- [Zod Metadata and Registries Documentation](https://zod.dev/metadata) - Registry patterns, schema definitions
- Existing codebase: packages/components/src/components/charts/echart-themes.ts - 10 accessible themes already implemented

### Secondary (MEDIUM confidence)
- [Atomic Design Methodology by Brad Frost](https://atomicdesign.bradfrost.com/chapter-2/) - Component hierarchy principles
- [Component-Based Decomposition Patterns](https://hewi.blog/software-architecture-the-hard-partschapter-5-component-based-decomposition-patterns) - Extraction strategies
- [pnpm Workspaces Documentation](https://pnpm.io/workspaces) - Monorepo configuration, workspace protocol
- [React Virtualization Showdown: TanStack vs react-window](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83) - Performance comparison
- [Vercel's json-render vs. Google's A2UI](https://dipjyotimetia.medium.com/vercels-json-render-vs-google-s-a2ui-the-head-to-head-6f213cf1a23b) - Generative UI frameworks comparison

### Tertiary (LOW confidence)
- [Generative UI in 2026 Comparison](https://quickleap.io/blog/generative-ui-platforms-comparison-2026) - Market status, requires verification
- WebSearch results on catalog prompt generation - Token costs cited need verification with actual testing
- WebSearch results on atomic design 400-line limit - No specific source found for this threshold, appears to be project-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - json-render is official Vercel release (Jan 2026), ECharts and TanStack Virtual are production-proven
- Architecture: MEDIUM-HIGH - Catalog patterns are well-documented, component decomposition follows established atomic design, but json-render is new (2 months old)
- Pitfalls: MEDIUM - ECharts and virtual scrolling pitfalls are known from community experience, json-render pitfalls are inferred from documentation (not battle-tested yet)
- Code examples: HIGH - Based on official documentation and existing codebase patterns

**Research date:** 2026-02-16
**Valid until:** ~2026-03-16 (30 days) - json-render is fast-moving (just released), re-verify if issues or breaking changes
