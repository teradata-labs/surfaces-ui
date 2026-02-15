# json-render Integration Research

**Date:** 2026-02-15
**Purpose:** Evaluate json-render for dynamic UI generation in SurfacesUI

## Executive Summary

json-render is a **client-side React framework** (not RSC) that enables AI to generate UIs from natural language while staying within developer-defined guardrails. It's highly compatible with SurfacesUI's architecture and can enable the transition from static component library to dynamic, NL-driven UI generation system.

**Key Finding:** json-render has NO dependency on Next.js or React Server Components - it's runtime React, making it ideal for MCP Apps and client-side rendering contexts.

## Architecture Overview

### Core Concepts

1. **Catalog** - Developer defines allowed components with Zod schemas
2. **Registry** - Maps catalog definitions to actual React component implementations
3. **Spec** - AI-generated JSON tree structure describing the UI
4. **Renderer** - Transforms specs into React components using registry

### Package Structure

```
@json-render/core      - Framework-agnostic schemas, validation, streaming
@json-render/react     - React renderer with hooks and context
@json-render/react-native - Mobile renderer (25+ components)
@json-render/remotion  - Video generation renderer
```

### Data Flow

```
Natural Language Prompt
  ↓
AI Model (with catalog as system prompt)
  ↓
JSON Spec (streamed via JSONL)
  ↓
SpecStreamCompiler (progressive updates)
  ↓
Renderer (maps to registry)
  ↓
React Components
```

## Integration with SurfacesUI

### Current Architecture Compatibility

| SurfacesUI Feature | json-render Support | Integration Approach |
|-------------------|-------------------|---------------------|
| React Components | ✅ Full support | Map existing components to registry |
| Vite Build | ✅ Runtime agnostic | Add json-render as dependency |
| Tailwind CSS | ⚠️ Manual | Inject utilities via component props |
| MCP Bridge | ✅ Compatible | Use callTool for AI generation endpoint |
| Theme System | ⚠️ Manual | Pass theme tokens to registry components |
| Single-file HTML | ✅ Works | Bundle json-render with app |
| TypeScript | ✅ Full support | Zod schemas provide type safety |

### Catalog Definition Strategy

**Approach:** Define catalog from existing primitives + components

```typescript
// Example: packages/components/src/json-render/catalog.ts
import { defineCatalog } from '@json-render/core';
import { z } from 'zod';

export const surfacesuiCatalog = defineCatalog(schema, {
  components: {
    // Primitives (from src/primitives/)
    Button: {
      props: z.object({
        variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']),
        size: z.enum(['default', 'sm', 'lg', 'icon']),
        children: z.string(),
        disabled: z.boolean().optional(),
      }),
      description: "A button component with multiple variants and sizes",
      hasChildren: true,
    },
    Card: {
      props: z.object({
        className: z.string().optional(),
      }),
      description: "A container card component",
      hasChildren: true,
    },

    // Complex Components
    SQLEditor: {
      props: z.object({
        initialCode: z.string().optional(),
        connectionId: z.string().optional(),
        readOnly: z.boolean().optional(),
      }),
      description: "SQL query editor with execution and results display",
    },

    // ... all other primitives and components
  },

  actions: {
    execute_sql: {
      params: z.object({
        query: z.string(),
        connection_id: z.string().optional(),
      }),
      description: "Execute SQL query via MCP bridge",
    },
    // ... other MCP tool actions
  },
});
```

### Registry Implementation Strategy

**Approach:** Map catalog to existing React components

```typescript
// Example: packages/components/src/json-render/registry.ts
import { defineRegistry } from '@json-render/react';
import { Button } from '../primitives/button';
import { Card } from '../primitives/card';
import { SQLEditor } from '../components/sql-editor';
import { useMcpBridge } from '../bridge';

export const { registry } = defineRegistry(surfacesuiCatalog, {
  components: {
    Button: ({ props, children }) => (
      <Button
        variant={props.variant}
        size={props.size}
        disabled={props.disabled}
      >
        {children}
      </Button>
    ),

    Card: ({ props, children }) => (
      <Card className={props.className}>
        {children}
      </Card>
    ),

    SQLEditor: ({ props, emit }) => {
      const bridge = useMcpBridge();

      return (
        <SQLEditor
          initialCode={props.initialCode}
          connectionId={props.connectionId}
          readOnly={props.readOnly}
          onExecutionComplete={(result) => {
            // Emit action to update spec state
            emit('sql_result', { result });
          }}
        />
      );
    },

    // ... map all components
  },
});
```

### Theming Integration Strategy

**Challenge:** json-render has no built-in theming; SurfacesUI uses CSS custom properties + Tailwind

**Solution:** Inject theme tokens into component props dynamically

```typescript
// Approach 1: Theme-aware registry wrapper
export function createThemedRegistry(catalog, theme: 'light' | 'dark') {
  return defineRegistry(catalog, {
    components: {
      Button: ({ props, children }) => (
        <Button
          {...props}
          className={cn(
            props.className,
            getThemeClasses('button', theme) // inject theme classes
          )}
        >
          {children}
        </Button>
      ),
    },
  });
}

// Approach 2: ThemeProvider wrapper in renderer
<ThemeProvider>
  <Renderer spec={spec} registry={registry} />
</ThemeProvider>
```

### Covalent Tokens Integration

**Goal:** Map Figma design tokens to dynamically generated utilities

**Strategy:**
1. Fetch Covalent tokens via Figma MCP server
2. Generate Tailwind config from tokens
3. Inject token-based classes into json-render component props
4. Support theme switching at runtime

```typescript
// packages/components/src/json-render/theme-tokens.ts
export async function fetchCovalentTokens() {
  // Use Figma MCP to fetch tokens
  const tokens = await fetchFigmaTokens('KvXVAmYdCVAS7hzkOa73Em');

  // Transform to Tailwind config
  return generateTailwindConfig(tokens);
}

// Registry uses tokens for styling
export function createTokenBasedRegistry(tokens) {
  return defineRegistry(catalog, {
    components: {
      Button: ({ props }) => {
        const classes = generateClassesFromTokens(tokens, {
          variant: props.variant,
          size: props.size,
        });

        return <Button {...props} className={classes} />;
      },
    },
  });
}
```

## Multi-Surface Support

### Target Surfaces

1. **MCP Apps** - Main use case for AI-generated UIs
2. **Reports** - Dynamic report generation from data
3. **Throwaway UIs** - Quick prototypes without coding
4. **Micro-apps** - Publishable single-purpose apps
5. **Production UIs** - Full-featured applications

### Implementation Strategy

```typescript
// packages/components/src/apps/json-render-app.tsx
import { Renderer } from '@json-render/react';
import { surfacesuiCatalog } from '../json-render/catalog';
import { registry } from '../json-render/registry';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { ThemeProvider } from '../theme/ThemeProvider';

export function JsonRenderApp() {
  const bridge = new McpAppsBridge();
  const [spec, setSpec] = useState(null);

  // Poll for AI-generated spec via MCP tool
  useEffect(() => {
    bridge.callTool('generate_ui', {
      prompt: 'Create a SQL dashboard',
      catalog: surfacesuiCatalog.prompt(), // Auto-generate catalog prompt
    }).then(result => {
      setSpec(result.data.spec);
    });
  }, []);

  if (!spec) return <div>Generating UI...</div>;

  return (
    <ThemeProvider>
      <Renderer spec={spec} registry={registry} />
    </ThemeProvider>
  );
}
```

## Action System Integration

### MCP Bridge Actions

**Strategy:** Map json-render actions to MCP tool calls

```typescript
// Registry implementation with MCP actions
export function createMcpRegistry(catalog, bridge: McpBridge) {
  return defineRegistry(catalog, {
    actions: {
      execute_sql: async (params) => {
        const result = await bridge.callTool('execute_sql', {
          query: params.query,
          connection_id: params.connection_id,
        });

        return result.data;
      },

      export_report: async (params) => {
        const result = await bridge.callTool('export_report', params);
        return result.data;
      },

      // ... map all MCP tools to actions
    },
  });
}
```

## Streaming & Progressive Rendering

**Use Case:** AI generates complex UIs incrementally

```typescript
import { createSpecStreamCompiler } from '@json-render/core';

export function useStreamedUI(prompt: string) {
  const [spec, setSpec] = useState(null);
  const compiler = createSpecStreamCompiler();

  useEffect(() => {
    // Stream from AI endpoint
    const stream = await fetch('/api/generate-ui', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });

    const reader = stream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const { result } = compiler.push(chunk); // Progressive update
      setSpec(result); // Triggers re-render
    }
  }, [prompt]);

  return spec;
}
```

## NL Pattern-Based Design

**Vision:** Move from discrete components to natural language patterns

### Current State (SurfacesUI)
```typescript
// Manual composition
<Card>
  <CardHeader>
    <CardTitle>Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <Metric value={1000} format="currency" />
  </CardContent>
</Card>
```

### Target State (NL-driven)
```typescript
// Natural language → JSON spec → Components
const spec = await generateUI("Show revenue as a metric card");
<Renderer spec={spec} registry={registry} />
```

### Pattern Catalog

**Strategy:** Define common UI patterns in catalog with semantic names

```typescript
export const patternCatalog = defineCatalog(schema, {
  patterns: {
    MetricCard: {
      description: "Card displaying a single metric with optional comparison",
      props: z.object({
        title: z.string(),
        value: z.number(),
        format: z.enum(['currency', 'percent', 'number']),
        comparison: z.object({
          value: z.number(),
          period: z.string(),
        }).optional(),
      }),
      // AI generates: Card > CardHeader > Metric > ComparisonBadge
    },

    DataTable: {
      description: "Table with sorting, filtering, and pagination",
      props: z.object({
        columns: z.array(z.object({
          key: z.string(),
          label: z.string(),
          sortable: z.boolean().optional(),
        })),
        data: z.array(z.record(z.unknown())),
        pageSize: z.number().default(10),
      }),
    },

    // ... more semantic patterns
  },
});
```

## Technical Challenges & Solutions

### 1. Dynamic Utility Generation

**Challenge:** Tailwind CSS is compiled at build time; json-render needs runtime styling

**Solutions:**
- **Option A:** UnoCSS (runtime utility generation)
- **Option B:** Predefine all possible utility combinations in catalog props
- **Option C:** CSS-in-JS with Covalent tokens (runtime)

**Recommendation:** Option B (short-term) + Option A (long-term)

### 2. Bundle Size

**Challenge:** Adding json-render + Zod increases bundle size

**Current State:**
- SQLEditor app: ~300KB gzipped
- Project limit: 500KB gzipped

**Mitigation:**
- Tree-shake unused catalog components
- Lazy-load json-render renderer
- Split catalog by surface type (reports vs micro-apps)

### 3. Type Safety Across Layers

**Challenge:** Maintain type safety from catalog → registry → components

**Solution:**
```typescript
// Use TypeScript inference from Zod schemas
type CatalogComponents = z.infer<typeof surfacesuiCatalog.components>;
type RegistryComponents = ComponentRegistry<CatalogComponents>;

// Type-safe registry definition
const registry: RegistryComponents = defineRegistry(catalog, {
  components: {
    // TypeScript enforces matching catalog definition
    Button: ({ props }) => <Button {...props} />,
  },
});
```

### 4. Testing AI-Generated UIs

**Challenge:** How to test dynamically generated UIs?

**Strategy:**
- Unit test catalog definitions (Zod validation)
- Integration test registry mappings (component snapshots)
- E2E test common NL patterns (prompt → spec → rendered output)

```typescript
// Example test
describe('json-render integration', () => {
  it('generates metric card from NL prompt', async () => {
    const spec = await generateUI("Show revenue metric");

    render(<Renderer spec={spec} registry={registry} />);

    expect(screen.getByRole('heading', { name: /revenue/i })).toBeInTheDocument();
    expect(screen.getByText(/\$/)).toBeInTheDocument(); // Currency format
  });
});
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Install json-render packages
- [ ] Create catalog from existing primitives
- [ ] Build basic registry mapping
- [ ] Add json-render renderer to component library
- [ ] Unit tests for catalog validation

### Phase 2: MCP Integration (Weeks 3-4)
- [ ] Create MCP tool for UI generation
- [ ] Integrate action system with MCP Bridge
- [ ] Build streaming support for progressive rendering
- [ ] Add MCP Apps entry point with json-render

### Phase 3: Theming (Weeks 5-6)
- [ ] Integrate Figma MCP server
- [ ] Fetch Covalent tokens from Figma
- [ ] Map tokens to Tailwind utilities
- [ ] Implement theme switching in json-render renderer
- [ ] Test dark/light mode with generated UIs

### Phase 4: Pattern Library (Weeks 7-8)
- [ ] Define semantic pattern catalog (MetricCard, DataTable, etc.)
- [ ] Document NL → pattern mappings
- [ ] Create pattern test suite
- [ ] Build pattern playground (like Storybook but NL-driven)

### Phase 5: Multi-Surface Support (Weeks 9-10)
- [ ] Report generation surface
- [ ] Micro-app builder surface
- [ ] Publishable app export
- [ ] Production UI guardrails

## Success Metrics

1. **Component Coverage:** 100% of primitives in catalog
2. **Pattern Library:** 20+ semantic patterns defined
3. **Bundle Size:** <500KB gzipped per surface
4. **Generation Speed:** <2s for simple UIs, <10s for complex dashboards
5. **Type Safety:** Zero TypeScript errors in registry
6. **Test Coverage:** 80% coverage of catalog + registry

## References

- [json-render GitHub](https://github.com/vercel-labs/json-render)
- [json-render Documentation](https://json-render.dev/)
- [Covalent Design Tokens](https://cdn.jsdelivr.net/npm/@covalent/tokens@11.7.0/index.css)
- [Figma Design System](https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles)
- [SurfacesUI Codebase Map](.planning/codebase/)

---

**Next Steps:** Create detailed implementation plan via `/gsd:new-project`
