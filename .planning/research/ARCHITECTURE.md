# Architecture Patterns: json-render Integration with SurfacesUI

**Domain:** AI-driven React component library with generative UI capabilities
**Researched:** 2026-02-15
**Confidence:** HIGH (based on json-render official docs, MCP-UI integration patterns, and SurfacesUI codebase analysis)

## Executive Summary

json-render integration with SurfacesUI follows a **three-layer declarative generative UI architecture**: (1) Catalog layer defines AI-describable component schemas using Zod validation, (2) Registry layer maps catalog definitions to existing React components, (3) Renderer layer transforms AI-generated JSON specifications into React trees. This architecture preserves SurfacesUI's existing patterns (MCP Bridge for tool calls, CSS custom properties for theming, Vite build pipeline) while adding NL-to-UI generation capabilities.

The key insight from the ecosystem is **separation of concerns**: catalog definitions are framework-agnostic (@json-render/core), while rendering is platform-specific (@json-render/react). This allows the same catalog to work across web, mobile, and MCP Apps contexts.

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Model (Claude)                        │
│  Receives: NL prompt + catalog.prompt() system instructions      │
│  Outputs: JSON spec conforming to catalog schemas                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Catalog Layer (@json-render/core)            │
│  - defineCatalog() with component schemas (Zod)                 │
│  - Action definitions (tool triggers, state updates)            │
│  - Validation rules (prop types, constraints)                   │
│  - catalog.prompt() → generates AI system prompt                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                Registry Layer (defineRegistry)                   │
│  - Maps catalog component IDs → React components                │
│  - Wraps existing SurfacesUI components                         │
│  - Injects MCP Bridge context via props/emit()                  │
│  - Passes ThemeProvider context to rendered components          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Renderer Layer (@json-render/react)                 │
│  - <Renderer spec={spec} registry={registry} />                 │
│  - Recursive tree traversal (flat spec → React tree)            │
│  - Visibility evaluation ({ "$state": "/path" })                │
│  - Dynamic prop resolution ({ "$cond": ... })                   │
│  - Action emission (emit() → MCP Bridge calls)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Existing SurfacesUI System                      │
│  - React components (SQLEditor, primitives)                     │
│  - MCP Bridge (useMcpTool hooks for tool calls)                 │
│  - Theme system (CSS custom properties + ThemeProvider)         │
│  - Vite build pipeline (library + HTML app bundles)             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With | Owned By |
|-----------|---------------|-------------------|----------|
| **AI Model** | Generates UI specs from NL prompts | Catalog (reads prompt), Renderer (outputs spec) | External (Claude/GPT) |
| **Catalog** | Defines AI-visible component surface area | AI Model (provides prompt), Registry (validates mappings) | New (@json-render/core) |
| **Registry** | Maps abstract catalog to concrete React components | Catalog (type-safe mapping), Renderer (provides component implementations) | New (custom) |
| **Renderer** | Transforms spec → React tree, handles visibility/actions | Registry (reads components), SurfacesUI components (renders) | New (@json-render/react) |
| **SurfacesUI Components** | Actual UI rendering, MCP Bridge calls, theming | Renderer (receives props/children), MCP Bridge (tool calls), ThemeProvider (styling) | Existing |
| **MCP Bridge** | Tool execution, state management | SurfacesUI components (via useMcpTool), Registry actions (via emit()) | Existing |
| **Theme System** | Styling, dark mode, accessibility | SurfacesUI components (via CSS vars), Renderer (via ThemeProvider context) | Existing |
| **Build Pipeline** | Bundling, type generation, HTML apps | All components (compiles), Server (serves bundles) | Existing (Vite) |

### New Components Required

1. **Catalog Definition Module** (`src/json-render/catalog.ts`)
   - Defines catalog using `defineCatalog()` from `@json-render/core`
   - One schema per SurfacesUI component (SQLEditor, Button, Card, etc.)
   - Action definitions for MCP Bridge tool calls

2. **Registry Module** (`src/json-render/registry.ts`)
   - Implements `defineRegistry()` to map catalog → components
   - Wraps SurfacesUI components to handle emit() → useMcpTool bridge
   - Injects ThemeProvider context

3. **Renderer Integration** (`src/json-render/Renderer.tsx`)
   - Wraps `@json-render/react` Renderer with SurfacesUI-specific context
   - Provides MCP Bridge and Theme providers
   - Handles error boundaries and loading states

4. **Spec Type Definitions** (`src/json-render/types.ts`)
   - TypeScript types for specs (inferred from catalog)
   - Action types for MCP Bridge integration
   - Visibility condition types

## Data Flow

### NL Prompt → AI → Spec → Renderer → React Tree

```typescript
// 1. Developer creates catalog (defines what AI can generate)
import { defineCatalog, action } from '@json-render/core'
import { z } from 'zod'

const catalog = defineCatalog({
  components: {
    SQLEditor: {
      description: 'Interactive SQL query editor with results display',
      props: z.object({
        connectionId: z.string().describe('Database connection identifier'),
        initialQuery: z.string().optional().describe('Pre-populated SQL query'),
        showVisualization: z.boolean().default(true)
      })
    },
    Button: {
      description: 'Clickable button that triggers actions',
      props: z.object({
        label: z.string(),
        variant: z.enum(['primary', 'secondary', 'destructive']),
        action: z.string().describe('Action ID to trigger on click')
      })
    }
  },
  actions: {
    execute_sql: action({
      description: 'Execute SQL query via MCP Bridge',
      parameters: z.object({
        query: z.string(),
        connectionId: z.string()
      })
    })
  }
})

// 2. AI receives prompt + catalog.prompt()
const systemPrompt = catalog.prompt()
// → "You can use these components: SQLEditor (Interactive SQL query editor...), Button (Clickable button...)
//    Component schemas: { SQLEditor: { connectionId: string, ... }, ... }"

// 3. AI generates spec
const spec = {
  root: 'editor-1',
  elements: {
    'editor-1': {
      component: 'SQLEditor',
      props: { connectionId: 'db-prod', showVisualization: true },
      children: ['button-1']
    },
    'button-1': {
      component: 'Button',
      props: { label: 'Run Query', variant: 'primary', action: 'execute_sql' },
      children: []
    }
  }
}

// 4. Registry maps catalog → React components
import { defineRegistry } from '@json-render/react'
import { SQLEditor, Button } from '@surfacesui/components'

const registry = defineRegistry(catalog, {
  SQLEditor: ({ props, children, emit }) => {
    // Bridge emit() to MCP Bridge
    const { data, loading } = useMcpTool('execute_sql', props.connectionId)
    return <SQLEditor {...props} onExecute={(q) => emit('execute_sql', { query: q, connectionId: props.connectionId })} />
  },
  Button: ({ props, emit }) => {
    return <Button {...props} onClick={() => emit(props.action)} />
  }
})

// 5. Renderer transforms spec → React tree
<Renderer spec={spec} registry={registry} />
// → <SQLEditor connectionId="db-prod" showVisualization={true}>
//      <Button label="Run Query" variant="primary" onClick={...} />
//    </SQLEditor>
```

### Dynamic Features Integration

**Visibility Conditions** (state-driven rendering):
```typescript
// Spec with visibility
elements: {
  'results-1': {
    component: 'ResultsTable',
    props: { data: { "$state": "/query/results" } },
    visible: { "$state": "/query/hasResults" } // Only render if hasResults === true
  }
}
```

**Dynamic Props** (reactive values):
```typescript
// Prop that changes based on state
props: {
  variant: {
    "$cond": { "$state": "/query/isRunning" },
    "$then": "secondary",
    "$else": "primary"
  }
}
```

**Actions → MCP Bridge**:
```typescript
// Action emission flow
emit('execute_sql', { query, connectionId })
  → Registry wrapper intercepts
  → Calls useMcpTool('execute_sql', { query, connectionId })
  → MCP Bridge executes tool
  → Result updates state
  → Renderer re-evaluates visibility/props
```

## Integration Points with Existing System

### 1. MCP Bridge Integration

**Current Pattern (direct usage):**
```tsx
// Existing component
const SQLEditor = () => {
  const { data, loading } = useMcpTool('execute_sql', { query, connectionId })
  return <ResultsTable data={data} loading={loading} />
}
```

**json-render Pattern (via emit):**
```tsx
// Registry wrapper
SQLEditor: ({ props, emit }) => {
  // Emit action → Registry converts to MCP Bridge call
  const handleExecute = (query) => emit('execute_sql', { query, connectionId: props.connectionId })

  // Use existing component
  return <SQLEditor connectionId={props.connectionId} onExecute={handleExecute} />
}
```

**Required Changes:**
- Components need action callback props (onExecute, onSave, etc.) to bridge emit() → MCP Bridge
- Registry module must wrap useMcpTool hooks to handle state updates
- Action results should update renderer state to trigger re-evaluation

**Touchpoint File:** `src/bridge/hooks.ts` (add `useJsonRenderAction` hook)

### 2. Theme System Integration

**Current Pattern:**
```tsx
// Components use ThemeProvider context
const Button = ({ variant }) => {
  const { theme } = useTheme()
  return <button className={cn('bg-primary text-primary-foreground', ...)} />
}
```

**json-render Integration:**
```tsx
// Renderer wraps with ThemeProvider
<ThemeProvider>
  <Renderer spec={spec} registry={registry} />
</ThemeProvider>

// Registry components automatically inherit theme context
Button: ({ props }) => {
  // No changes needed - existing components already use ThemeProvider
  return <Button {...props} />
}
```

**Required Changes:**
- None to existing components (they already use CSS custom properties)
- Renderer wrapper must ensure ThemeProvider is present
- Catalog should expose theme-related props (variant, color) as enums matching existing variants

**Touchpoint File:** `src/theme/ThemeProvider.tsx` (no changes), `src/json-render/Renderer.tsx` (wrap with ThemeProvider)

### 3. Build Pipeline Integration

**Current Pipeline:**
- `vite.config.ts` → Library build (exports React components)
- `vite.config.apps.ts` → HTML app bundles (SQLEditor standalone apps)
- Types generated via `vite-plugin-dts`

**json-render Additions:**
- Add `@json-render/core` and `@json-render/react` as dependencies
- Export catalog and registry from library build
- Create new HTML app: `src/apps/json-render-demo.tsx` (demonstrates generative UI)
- Generate types for catalog schemas (Zod → TypeScript)

**Required Changes:**
- Update `package.json`: Add `@json-render/core`, `@json-render/react`, `zod`
- Update `src/index.ts`: Export catalog, registry, Renderer wrapper
- Add build script: `pnpm build:catalog` (generates catalog prompt file for AI)
- Add app: `src/apps/generative-ui.tsx` (MCP Apps compatible)

**Touchpoint Files:**
- `packages/components/package.json` (dependencies)
- `packages/components/src/index.ts` (exports)
- `packages/components/vite.config.apps.ts` (new app entry)

### 4. Analytics Integration

**Current Pattern:**
```tsx
const analytics = useAnalytics()
analytics?.trackEvent('sql_query_executed', { queryLength: query.length })
```

**json-render Integration:**
```tsx
// Registry wrappers can inject analytics
SQLEditor: ({ props, emit }) => {
  const analytics = useAnalytics()
  const handleExecute = (query) => {
    analytics?.trackEvent('generative_ui_action', { action: 'execute_sql', component: 'SQLEditor' })
    emit('execute_sql', { query, connectionId: props.connectionId })
  }
  return <SQLEditor {...props} onExecute={handleExecute} />
}
```

**Required Changes:**
- Registry wrappers should access useAnalytics() and track generative UI actions
- Add catalog metadata for analytics (component usage, action triggers)

**Touchpoint File:** `src/lib/analytics.ts` (no changes needed)

## Patterns to Follow

### Pattern 1: Catalog Schema Design (High Fidelity to React Props)

**What:** Catalog schemas should mirror React component prop interfaces with rich descriptions for AI guidance.

**When:** Defining catalog for any SurfacesUI component that should be AI-generatable.

**Example:**
```typescript
// React component interface
interface SQLEditorProps {
  connectionId: string
  initialQuery?: string
  showVisualization?: boolean
  onExecute?: (query: string) => void
}

// Catalog schema (high fidelity mapping)
const catalog = defineCatalog({
  components: {
    SQLEditor: {
      description: 'Interactive SQL query editor with syntax highlighting, auto-complete, and results visualization. Use for data exploration and ad-hoc queries.',
      props: z.object({
        connectionId: z.string().describe('Database connection identifier (e.g., "db-prod", "db-staging")'),
        initialQuery: z.string().optional().describe('Pre-populated SQL query text to display in editor on load'),
        showVisualization: z.boolean().default(true).describe('Whether to show chart/graph visualization of query results')
        // Note: onExecute is NOT in catalog - actions are defined separately
      })
    }
  },
  actions: {
    execute_sql: action({
      description: 'Execute a SQL query and return results',
      parameters: z.object({
        query: z.string(),
        connectionId: z.string()
      })
    })
  }
})
```

**Why:** Rich descriptions help AI choose correct components and provide appropriate prop values. Separating actions from props follows json-render's architecture (actions are emitted, not passed as callbacks).

### Pattern 2: Registry Wrapper (Bridge Layer)

**What:** Registry implementations wrap existing components to translate json-render's emit() system into SurfacesUI's MCP Bridge pattern.

**When:** Implementing registry for any component that needs to trigger MCP tools or update shared state.

**Example:**
```typescript
const registry = defineRegistry(catalog, {
  SQLEditor: ({ props, children, emit }) => {
    // Create MCP Bridge state holder
    const [state, setState] = useState({ results: null, isRunning: false })

    // Convert action emission to MCP Bridge call
    const handleExecute = async (query: string) => {
      setState({ ...state, isRunning: true })

      // Emit action (json-render pattern)
      const result = await emit('execute_sql', { query, connectionId: props.connectionId })

      // Update state (triggers renderer re-evaluation)
      setState({ results: result, isRunning: false })
    }

    // Use existing component unchanged
    return (
      <SQLEditor
        {...props}
        onExecute={handleExecute}
      >
        {children}
      </SQLEditor>
    )
  }
})
```

**Why:** Preserves SurfacesUI's MCP Bridge pattern while enabling json-render's action system. State updates in registry trigger renderer re-evaluation of visibility/dynamic props.

### Pattern 3: Theme-Aware Catalog (Enum Constraints)

**What:** Catalog prop schemas should use enums for theme-related values (variants, colors, sizes) that match existing Tailwind/theme system.

**When:** Defining components with visual variants or theme-dependent styling.

**Example:**
```typescript
// Existing component variants (from tailwind-preset.ts)
const buttonVariants = cva('...', {
  variants: {
    variant: { primary: '...', secondary: '...', destructive: '...' }
  }
})

// Catalog schema (matching variants)
Button: {
  props: z.object({
    variant: z.enum(['primary', 'secondary', 'destructive']).default('primary'),
    size: z.enum(['sm', 'md', 'lg']).default('md')
  })
}
```

**Why:** Constrains AI to valid theme values, prevents hallucination of non-existent variants, ensures generated UI respects design system.

### Pattern 4: Flat Spec Structure (Performance)

**What:** json-render uses flat spec format (root ID + elements map) rather than nested JSON for performance and streaming.

**When:** AI generates specs (system prompt should instruct flat format).

**Example:**
```typescript
// GOOD: Flat structure (json-render standard)
{
  root: 'container-1',
  elements: {
    'container-1': { component: 'Card', children: ['editor-1'] },
    'editor-1': { component: 'SQLEditor', props: {...}, children: [] }
  }
}

// BAD: Nested structure (doesn't work with json-render)
{
  component: 'Card',
  children: [
    { component: 'SQLEditor', props: {...} }
  ]
}
```

**Why:** Flat structure enables efficient incremental rendering (AI can stream elements as generated), easier tree manipulation (add/remove elements by ID), and better performance (O(1) element lookup vs tree traversal).

### Pattern 5: Visibility-First Conditionals (Declarative Logic)

**What:** Use json-render's visibility conditions for show/hide logic rather than conditional rendering in React.

**When:** Component should appear/disappear based on state (e.g., loading spinners, error messages, result tables).

**Example:**
```typescript
// Spec with visibility
elements: {
  'loading-1': {
    component: 'Spinner',
    visible: { "$state": "/query/isRunning" } // Show only when query running
  },
  'results-1': {
    component: 'ResultsTable',
    props: { data: { "$state": "/query/results" } },
    visible: {
      "$and": [
        { "$not": { "$state": "/query/isRunning" } }, // Not running
        { "$state": "/query/hasResults" } // Has results
      ]
    }
  },
  'error-1': {
    component: 'Alert',
    props: { message: { "$state": "/query/error" } },
    visible: { "$state": "/query/hasError" }
  }
}
```

**Why:** Declarative visibility is easier for AI to generate (no JSX ternary logic), enables renderer optimization (doesn't mount invisible components), and matches json-render's architecture (visibility evaluated before rendering).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Leaking Component Implementation to Catalog

**What:** Exposing internal component details (state, effects, hooks) in catalog schemas.

**Why bad:** Catalog should be a high-level API surface for AI, not a 1:1 mapping of React internals. Internal details change, breaking AI prompts.

**Instead:** Only expose props that affect component behavior from the outside. Internal state management stays in component.

**Example:**
```typescript
// BAD: Exposing internal state
SQLEditor: {
  props: z.object({
    queryState: z.object({ text: z.string(), isValid: z.boolean() }), // Internal state leaked
    editorRef: z.any() // Ref leaked
  })
}

// GOOD: Only external API
SQLEditor: {
  props: z.object({
    initialQuery: z.string().optional(), // External control only
    connectionId: z.string()
  })
}
```

### Anti-Pattern 2: Bypassing Registry for Direct Component Import

**What:** Importing SurfacesUI components directly in renderer instead of through registry.

**Why bad:** Loses type safety (catalog schema → component props validation), breaks action system (no emit() bridging), prevents theme/context injection.

**Instead:** Always route through registry, even for simple passthrough components.

**Example:**
```typescript
// BAD: Direct import
import { Button } from '@surfacesui/components'
<Renderer spec={spec} registry={{ Button }} /> // Missing catalog validation

// GOOD: Registry wrapper
const registry = defineRegistry(catalog, {
  Button: ({ props }) => <Button {...props} /> // Type-safe, validated
})
<Renderer spec={spec} registry={registry} />
```

### Anti-Pattern 3: Complex Logic in Visibility Conditions

**What:** Embedding business logic or complex calculations in "$cond" visibility expressions.

**Why bad:** Visibility conditions should be simple boolean checks. Complex logic is hard for AI to generate correctly and makes specs brittle.

**Instead:** Compute derived state in registry wrappers or action handlers, expose as simple boolean flags.

**Example:**
```typescript
// BAD: Complex logic in spec
visible: {
  "$cond": {
    "$and": [
      { "$gte": [{ "$state": "/query/rowCount" }, 100] },
      { "$lt": [{ "$state": "/query/executionTime" }, 5000] }
    ]
  },
  "$then": true,
  "$else": false
}

// GOOD: Derived state in registry
// Registry action computes derived state
const handleQueryComplete = (results) => {
  setState({
    ...state,
    shouldShowOptimizationTip: results.rowCount >= 100 && results.executionTime < 5000
  })
}

// Spec uses simple boolean check
visible: { "$state": "/query/shouldShowOptimizationTip" }
```

### Anti-Pattern 4: Mixing MCP Bridge Patterns

**What:** Using both useMcpTool (SurfacesUI pattern) and emit() (json-render pattern) in same component without clear boundary.

**Why bad:** Creates confusion about data flow, makes components harder to test, loses benefits of registry abstraction.

**Instead:** Registry wrappers handle translation (emit → useMcpTool), inner components stay pure.

**Example:**
```typescript
// BAD: Mixed patterns
Button: ({ props, emit }) => {
  const { data } = useMcpTool('get_data') // Direct MCP Bridge usage
  return <Button onClick={() => emit('save_data', data)} /> // Also using emit
}

// GOOD: Clear boundary
Button: ({ props, emit }) => {
  // Registry handles all MCP Bridge interaction
  const handleClick = () => emit('save_data', { id: props.dataId })

  // Component stays pure (no MCP Bridge awareness)
  return <Button onClick={handleClick} />
}
```

### Anti-Pattern 5: Hardcoded MCP Tool Names in Catalog

**What:** Using exact MCP tool names (e.g., "execute_sql") as component prop values instead of action IDs.

**Why bad:** Couples catalog to specific MCP server implementation, breaks if tool names change, prevents action reuse across components.

**Instead:** Define abstract actions in catalog, map actions → MCP tools in registry.

**Example:**
```typescript
// BAD: MCP tool name in props
Button: {
  props: z.object({
    mcpTool: z.string() // AI would need to know exact MCP tool names
  })
}

// GOOD: Abstract actions
catalog = defineCatalog({
  actions: {
    run_query: action({ description: 'Execute query', parameters: {...} }),
    save_results: action({ description: 'Save results', parameters: {...} })
  }
})

// Registry maps actions → MCP tools
registry = defineRegistry(catalog, {
  Button: ({ props, emit }) => {
    const handleClick = async () => {
      // Registry knows MCP tool name, not AI
      const result = await emit('run_query', props.queryParams)
      // Could be mapped to 'execute_sql' or 'query_database' MCP tool
    }
  }
})
```

## Build Order and Dependencies

### Phase 1: Foundation (Catalog + Core Types)
**Goal:** Establish catalog schema and type definitions without touching existing components.

**Dependencies:** None (purely additive).

**Deliverables:**
1. Install dependencies: `@json-render/core`, `@json-render/react`, `zod`
2. Create `src/json-render/catalog.ts` with schemas for 2-3 simple components (Button, Card, Badge)
3. Create `src/json-render/types.ts` with TypeScript types for specs/actions
4. Add test: `src/json-render/__tests__/catalog.test.ts` (validate schemas)

**Success Criteria:**
- `catalog.prompt()` generates coherent system prompt
- Zod validation catches invalid prop values
- Types inferred correctly from catalog

**Why First:** No dependencies on existing system, establishes contracts for subsequent phases, validates json-render integration feasibility.

---

### Phase 2: Registry + Renderer Wrapper (Integration Layer)
**Goal:** Create registry mapping catalog → existing components, wrap renderer with SurfacesUI context.

**Dependencies:** Phase 1 (catalog schemas), existing theme system.

**Deliverables:**
1. Create `src/json-render/registry.ts` implementing `defineRegistry()` for Phase 1 components
2. Create `src/json-render/Renderer.tsx` wrapping `@json-render/react` with ThemeProvider
3. Add demo app: `src/apps/generative-ui-demo.tsx` (static spec → rendered UI)
4. Add test: `src/json-render/__tests__/renderer.test.ts` (spec → React tree)

**Success Criteria:**
- Static specs render correctly with theme applied
- Registry components receive props from catalog schemas
- Renderer handles nested component trees

**Why Second:** Validates integration with existing theme system before adding MCP Bridge complexity, provides visual feedback for catalog correctness.

---

### Phase 3: Action System (MCP Bridge Integration)
**Goal:** Bridge json-render actions to SurfacesUI MCP Bridge, enable tool calls from generated UI.

**Dependencies:** Phase 2 (renderer working), existing MCP Bridge (`src/bridge/`).

**Deliverables:**
1. Update catalog with action definitions for MCP tools (execute_sql, etc.)
2. Create `src/bridge/useJsonRenderAction.ts` hook (emit → useMcpTool bridge)
3. Update registry to use action hook for MCP-aware components
4. Add test: `src/json-render/__tests__/actions.test.ts` (action emission → MCP call)

**Success Criteria:**
- Actions trigger MCP Bridge tool calls
- Results update state → renderer re-evaluates
- Error handling works (failed actions → error state)

**Why Third:** Requires stable renderer and catalog, touches existing MCP Bridge (risk of breaking existing components if done earlier).

---

### Phase 4: Complex Components (SQLEditor, Charts)
**Goal:** Add catalog schemas for organism-level components with rich interactions.

**Dependencies:** Phase 3 (actions working), existing complex components.

**Deliverables:**
1. Expand catalog with SQLEditor, ECharts, SQLResultsDisplay schemas
2. Update registry with wrappers for complex components
3. Create example specs demonstrating common patterns (dashboard, data explorer)
4. Add integration test: `src/json-render/__tests__/complex-components.test.tsx`

**Success Criteria:**
- AI can generate functional dashboards with SQLEditor + charts
- Complex components work correctly via registry wrappers
- All existing component features accessible through catalog

**Why Fourth:** Complex components have more edge cases, easier to debug with simpler components already working.

---

### Phase 5: Dynamic Features (Visibility, State Management)
**Goal:** Enable visibility conditions, dynamic props, state-driven reactivity.

**Dependencies:** Phase 4 (complex components working).

**Deliverables:**
1. Add state management to registry (useState integration)
2. Implement visibility evaluation in renderer wrapper
3. Add dynamic prop resolution ($cond, $state expressions)
4. Create example specs using visibility/dynamic props
5. Add test: `src/json-render/__tests__/dynamic-features.test.tsx`

**Success Criteria:**
- Components show/hide based on state
- Props update reactively when state changes
- State updates from actions trigger re-evaluation

**Why Fifth:** Most complex feature, depends on all previous layers working correctly, has most potential for subtle bugs.

---

### Phase 6: Build Pipeline + Distribution
**Goal:** Integrate json-render into build pipeline, enable distribution.

**Dependencies:** Phase 5 (all features working).

**Deliverables:**
1. Update `vite.config.ts` to export catalog/registry/renderer
2. Add build script: `pnpm build:catalog` (generates catalog.json for AI)
3. Create MCP Apps compatible bundle: `generative-ui.html`
4. Update `src/index.ts` to export json-render public API
5. Generate types: `dist/json-render/*.d.ts`

**Success Criteria:**
- Library exports catalog, registry, Renderer
- HTML bundle works in MCP Apps context
- TypeScript types available for consumers
- Bundle size <500KB (json-render adds ~50KB)

**Why Last:** No point optimizing build until features are complete, dependencies on all previous phases.

---

### Dependency Graph

```
Phase 1: Catalog/Types (no dependencies)
    ↓
Phase 2: Registry/Renderer (depends on: Phase 1, ThemeProvider)
    ↓
Phase 3: Actions (depends on: Phase 2, MCP Bridge)
    ↓
Phase 4: Complex Components (depends on: Phase 3)
    ↓
Phase 5: Dynamic Features (depends on: Phase 4)
    ↓
Phase 6: Build Pipeline (depends on: Phase 5)
```

**Critical Path:** Phases must be completed sequentially (each depends on previous). Parallelization not possible due to tight coupling.

**Risk Mitigation:**
- Phase 1-2 can be experimental (no changes to existing code)
- Phase 3 touches MCP Bridge (create feature branch, extensive testing)
- Phase 4-5 are iterative (can ship subset of components/features)
- Phase 6 is low-risk (build config only)

## Scalability Considerations

| Concern | At 10 Components | At 50 Components | At 100+ Components |
|---------|------------------|------------------|-------------------|
| **Catalog Size** | Small (~500 lines) | Medium (~2500 lines) | Split into modules (`catalog/primitives.ts`, `catalog/organisms.ts`) |
| **Prompt Length** | ~2K tokens | ~10K tokens | Use catalog subsets (AI selects relevant module based on user intent) |
| **Registry Complexity** | Simple wrappers | Shared wrapper patterns | Extract common patterns to `createRegistryWrapper()` utility |
| **Type Safety** | Direct inference | Discriminated unions | Code generation (`catalog-to-types` CLI tool) |
| **Bundle Size** | +50KB (json-render) | +100KB (more components) | Lazy load registry modules (dynamic import by component type) |
| **Spec Validation** | Fast (<1ms) | Moderate (~10ms) | Async validation with caching |
| **Testing** | Unit tests per component | Integration tests for common patterns | Property-based testing (generative specs) |

**Scaling Strategies:**

1. **Catalog Modularization** (50+ components):
   ```typescript
   // catalog/index.ts
   import { primitives } from './primitives'
   import { organisms } from './organisms'

   export const catalog = defineCatalog({
     components: { ...primitives.components, ...organisms.components },
     actions: { ...primitives.actions, ...organisms.actions }
   })
   ```

2. **Prompt Optimization** (10K+ token prompts):
   - AI first receives component category list
   - User intent classified → relevant catalog subset loaded
   - Example: "show me data" → loads data-related components (SQLEditor, Charts, Tables)

3. **Registry Code Generation** (100+ components):
   ```bash
   pnpm generate:registry --components src/components/**/*.tsx
   # → Auto-generates registry wrappers from component prop types
   ```

4. **Lazy Loading** (bundle size optimization):
   ```typescript
   const registry = defineRegistry(catalog, {
     // Synchronous primitives (always loaded)
     Button: ({ props }) => <Button {...props} />,

     // Lazy organisms (loaded on demand)
     SQLEditor: React.lazy(() => import('./registry/SQLEditor')),
   })
   ```

## Sources

### Primary Sources (HIGH confidence)
- [Vercel json-render GitHub Repository](https://github.com/vercel-labs/json-render) - Official architecture documentation
- [json-render Official Website](https://json-render.dev/) - Integration guides
- [MCP-UI Custom Component Libraries](https://mcpui.dev/guide/client/custom-component-libraries) - Component library integration patterns
- [MCP Apps Protocol](https://modelcontextprotocol.io/docs/extensions/apps) - MCP Apps architecture

### Secondary Sources (MEDIUM confidence)
- [CopilotKit Generative UI Guide](https://www.copilotkit.ai/generative-ui) - Generative UI architecture patterns
- [Building a Component Registry in React](https://medium.com/front-end-weekly/building-a-component-registry-in-react-4504ca271e56) - Registry pattern implementation
- [shadcn Registry Architecture](https://ui.shadcn.com/docs/registry) - Component registry design patterns
- [The React + AI Stack for 2026](https://www.builder.io/blog/react-ai-stack-2026) - AI-driven React architecture trends

### Tertiary Sources (MEDIUM confidence, verification recommended)
- [Material UI CSS Theme Variables](https://mui.com/material-ui/customization/css-theme-variables/overview/) - CSS custom properties theme integration
- [Zod Documentation](https://zod.dev/) - Runtime validation with TypeScript inference
- [The Complete Guide to Generative UI Frameworks in 2026](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc) - Ecosystem overview

**Note:** All architectural recommendations derived from official json-render documentation and verified integration patterns. Build order based on dependency analysis of SurfacesUI codebase and json-render's layered architecture.
