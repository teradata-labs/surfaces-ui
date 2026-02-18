# Integration Guide

How to integrate json-render components into existing SurfacesUI applications.

## Overview

This guide covers:
1. Installing json-render packages
2. Using SurfacesRenderer in your app
3. Migrating from direct component usage to catalog specs
4. Integrating with MCP Bridge for tool calls
5. Natural language UI generation

## Installation

```bash
pnpm add @json-render/react @json-render/core
```

Already included in `@surfacesui/components@0.1.0`.

## Quick Start

### 1. Render a Static Spec

```tsx
import { SurfacesRenderer } from '@surfacesui/components';

const spec = {
  root: 'table',
  elements: {
    table: {
      type: 'DataTable',
      props: {
        columns: ['id', 'name', 'email'],
        height: 400,
        density: 'comfortable',
      },
    },
  },
};

const data = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
];

function App() {
  return (
    <SurfacesRenderer
      spec={spec}
      initialState={{ data }}
    />
  );
}
```

### 2. Generate Spec from Natural Language

```tsx
import { NLGenerator, SurfacesRenderer } from '@surfacesui/components';
import { useState } from 'react';

function App() {
  const [spec, setSpec] = useState(null);
  const [data, setData] = useState([]);

  return (
    <div>
      <NLGenerator
        baseUrl="http://localhost:8000"
        renderSpec={(generatedSpec) => setSpec(generatedSpec)}
      />

      {spec && (
        <SurfacesRenderer
          spec={spec}
          initialState={{ data }}
        />
      )}
    </div>
  );
}
```

### 3. Integrate with MCP Bridge

```tsx
import {
  SurfacesRenderer,
  McpBridgeProvider,
  McpAppsBridge,
} from '@surfacesui/components';

const bridge = new McpAppsBridge();

function App() {
  const spec = {
    root: 'results',
    elements: {
      results: {
        type: 'SQLResultsDisplay',
        props: {
          initialViewMode: 'table',
          tableHeight: 400,
        },
      },
    },
  };

  return (
    <McpBridgeProvider bridge={bridge}>
      <SurfacesRenderer
        spec={spec}
        bridge={bridge} // Enable MCP actions
        initialState={{ data: [] }}
      />
    </McpBridgeProvider>
  );
}
```

## Migration Patterns

### From Direct Components to Catalog

**Before** (direct component usage):
```tsx
import { DataTable } from '@surfacesui/components';

function Results({ data }) {
  return (
    <DataTable
      data={data}
      columns={['id', 'name']}
      height={400}
      density="comfortable"
    />
  );
}
```

**After** (catalog spec):
```tsx
import { SurfacesRenderer } from '@surfacesui/components';

function Results({ data }) {
  const spec = {
    root: 'table',
    elements: {
      table: {
        type: 'DataTable',
        props: {
          columns: ['id', 'name'],
          height: 400,
          density: 'comfortable',
        },
      },
    },
  };

  return <SurfacesRenderer spec={spec} initialState={{ data }} />;
}
```

**Why migrate**: Enables AI generation, spec serialization, and registry extensibility.

### From SQLResultsDisplay to Organism Spec

**Before**:
```tsx
import { SQLResultsDisplay } from '@surfacesui/components';

<SQLResultsDisplay
  data={{ rows: queryResults, columns: ['id', 'name'] }}
  sql="SELECT id, name FROM users"
  savedConfig={{
    resultsViewMode: 'table',
    tableHeight: 400,
    chartHeight: 300,
  }}
/>
```

**After**:
```tsx
const spec = {
  root: 'results',
  elements: {
    results: {
      type: 'SQLResultsDisplay',
      props: {
        sql: 'SELECT id, name FROM users',
        initialViewMode: 'table',
        tableHeight: 400,
        chartHeight: 300,
      },
    },
  },
};

<SurfacesRenderer
  spec={spec}
  initialState={{
    data: { rows: queryResults, columns: ['id', 'name'] },
  }}
/>
```

### From Molecule Components to Specs

**TableWithFilters Before**:
```tsx
import { TableWithFilters } from '@surfacesui/components';

<TableWithFilters
  data={records}
  columns={['id', 'name', 'email']}
  height={500}
  initialDensity="comfortable"
/>
```

**TableWithFilters After**:
```tsx
const spec = {
  root: 'table',
  elements: {
    table: {
      type: 'TableWithFilters',
      props: {
        columns: ['id', 'name', 'email'],
        height: 500,
        initialDensity: 'comfortable',
        showFilter: true,
        showDensityToggle: true,
      },
    },
  },
};

<SurfacesRenderer spec={spec} initialState={{ data: records }} />
```

**ChartWithControls Before**:
```tsx
import { ChartWithControls } from '@surfacesui/components';

<ChartWithControls
  data={metrics}
  columns={['month', 'revenue', 'cost']}
  initialChartType="line"
  initialXAxis="month"
  initialYAxis="revenue"
/>
```

**ChartWithControls After**:
```tsx
const spec = {
  root: 'chart',
  elements: {
    chart: {
      type: 'ChartWithControls',
      props: {
        columns: ['month', 'revenue', 'cost'],
        height: 400,
        initialChartType: 'line',
        initialXAxis: 'month',
        initialYAxis: 'revenue',
        showControls: true,
      },
    },
  },
};

<SurfacesRenderer spec={spec} initialState={{ data: metrics }} />
```

## MCP Bridge Integration

### Enable Tool Calls

Components can trigger MCP tool calls via actions (e.g., execute_sql, export_csv):

```tsx
import { SurfacesRenderer, createMcpActionHandlers } from '@surfacesui/components';
import { useMcpBridge } from '@surfacesui/components';

function ResultsView({ spec, data }) {
  const bridge = useMcpBridge();

  // Create action handlers for MCP tools
  const handlers = createMcpActionHandlers(bridge);

  return (
    <SurfacesRenderer
      spec={spec}
      initialState={{ data }}
      bridge={bridge}
      handlers={handlers}
    />
  );
}
```

### Custom Action Handlers

Extend or override default handlers:

```tsx
const customHandlers = {
  execute_sql: async (args) => {
    const { query, connection_id } = args;
    // Your custom logic
    const result = await yourApiCall(query, connection_id);
    return result;
  },
  export_csv: async (args) => {
    // Custom export logic
    const { filename } = args;
    console.log('Exporting to:', filename);
  },
};

<SurfacesRenderer
  spec={spec}
  initialState={{ data }}
  handlers={customHandlers}
/>
```

### Merging MCP and Custom Handlers

When you provide both a bridge and custom handlers, they are merged:

```tsx
import { createMcpActionHandlers } from '@surfacesui/components';

function App() {
  const bridge = useMcpBridge();

  // MCP handlers for standard actions
  const mcpHandlers = createMcpActionHandlers(bridge);

  // Your custom handlers
  const customHandlers = {
    custom_action: async (args) => {
      // Your custom action
    },
  };

  // Merge: custom handlers + MCP handlers (MCP takes precedence)
  const mergedHandlers = {
    ...customHandlers,
    ...mcpHandlers,
  };

  return (
    <SurfacesRenderer
      spec={spec}
      bridge={bridge}
      handlers={mergedHandlers}
    />
  );
}
```

Note: The SurfacesRenderer automatically merges handlers when you pass a `bridge` prop, so you typically don't need to manually create MCP handlers.

## Theming

### Apply Density and Theme

```tsx
import { ThemeProvider, SurfacesRenderer } from '@surfacesui/components';

function App() {
  return (
    <SurfacesRenderer
      spec={spec}
      initialState={{ data }}
      theme="dark"
      density="comfortable"
    />
  );
}
```

### Theme Options

- **theme**: `'light' | 'dark' | 'system'` - Color scheme (default: 'system')
- **density**: `'compact' | 'comfortable' | 'spacious'` - Spacing scale (default: 'comfortable')

### Custom Token Overrides

Override specific CSS custom properties:

```tsx
<SurfacesRenderer
  spec={spec}
  initialState={{ data }}
  tokenOverrides={{
    '--primary': '#0066cc',
    '--background': '#ffffff',
    '--spacing-md': '16px',
  }}
/>
```

### Persistent Density Preference

Density preference is automatically persisted to localStorage:

```tsx
// User changes density via DensityToggle component
// Preference is saved to localStorage as 'surfaces-density'
// On next page load, density is restored automatically

<SurfacesRenderer
  spec={spec}
  density="comfortable" // Used as fallback if no stored preference
/>
```

## Natural Language Generation

### Setup Backend

SurfacesUI requires a backend service for NL generation. The backend uses FastMCP to provide a `generate_ui` tool:

```python
# Python server with FastMCP
from fastmcp import FastMCP
from surfacesui.nlgen import generate_ui_spec

mcp = FastMCP("SurfacesUI")

@mcp.tool()
async def generate_ui(prompt: str, include_explanation: bool = False) -> dict:
    """Generate UI spec from natural language."""
    # Your LLM integration (Bedrock, Anthropic, OpenAI)
    spec = await your_llm_call(prompt, include_explanation)
    return spec
```

See the `server/` directory for complete backend setup including:
- AWS Bedrock integration (default)
- Anthropic API integration
- OpenAI API integration
- Streaming support via JSONL

### Frontend Integration

```tsx
import { NLGenerator } from '@surfacesui/components';

function App() {
  const [spec, setSpec] = useState(null);

  return (
    <div>
      <NLGenerator
        baseUrl="http://localhost:8000"
        showExamples={true}
        includeExplanation={false}
        renderSpec={(spec) => {
          // Handle generated spec
          setSpec(spec);
        }}
      />

      {spec && (
        <SurfacesRenderer
          spec={spec}
          initialState={{ data: yourData }}
        />
      )}
    </div>
  );
}
```

### NLGenerator Props

- **baseUrl**: Backend server URL for MCP tools
- **showExamples**: Show example prompts for UX discoverability (default: false)
- **includeExplanation**: Request AI explanation of generated spec (default: false, adds API cost)
- **renderSpec**: Callback fired when spec is generated

### Streaming Support

The backend can stream spec generation for progressive rendering:

```tsx
import { useSpecStream } from '@surfacesui/components';

function App() {
  const { spec, progress, error, generating } = useSpecStream({
    baseUrl: 'http://localhost:8000',
    prompt: 'Show sales data as a bar chart',
  });

  return (
    <div>
      {generating && <progress value={progress} max={100} />}
      {error && <div>Error: {error}</div>}
      {spec && <SurfacesRenderer spec={spec} />}
    </div>
  );
}
```

## State Management

### Initial State

Provide initial state via `initialState` prop:

```tsx
<SurfacesRenderer
  spec={spec}
  initialState={{
    data: queryResults,
    selectedRow: null,
    filterValue: '',
  }}
/>
```

### State Updates

Listen to state changes via `onStateChange` callback:

```tsx
<SurfacesRenderer
  spec={spec}
  initialState={{ data }}
  onStateChange={(path, value) => {
    console.log(`State changed at ${path}:`, value);
  }}
/>
```

### Accessing State in Components

Components use the `useStateValue` hook from json-render to access state:

```tsx
import { useStateValue } from '@json-render/react';

function CustomComponent() {
  const data = useStateValue('/data');
  const filterValue = useStateValue('/filterValue');

  // Component logic
}
```

Note: This is handled automatically by the registry wrappers for catalog components.

## Deployment

### MCP Apps Bundle

Deploy as single-file HTML bundle for MCP integration:

```bash
cd packages/components
pnpm build:apps
```

Output: `dist/apps/json-render-cdn.html` (591KB gzipped)

The bundle includes:
- All catalog components
- Theme and density system
- MCP Bridge integration
- NL generation UI

### Serving the Bundle

**Option 1: FastMCP Server**
```python
from fastmcp import FastMCP

mcp = FastMCP("SurfacesUI")

# Serve static HTML bundle
mcp.add_static_file('/apps/json-render', 'dist/apps/json-render-cdn.html')
```

**Option 2: Static Hosting**
Upload `json-render-cdn.html` to S3, Cloudflare Pages, Netlify, etc.

**Option 3: CDN**
Host on CDN and reference via URL in MCP app configuration.

### Environment Variables

Set these in your deployment environment:

- `BEDROCK_REGION`: AWS region for Bedrock (default: us-east-1)
- `BEDROCK_MODEL_ID`: Model to use (default: anthropic.claude-3-5-sonnet-20241022-v2:0)
- `ANTHROPIC_API_KEY`: Anthropic API key (if using Anthropic provider)
- `OPENAI_API_KEY`: OpenAI API key (if using OpenAI provider)

## Troubleshooting

### Spec Validation Errors

If specs fail validation:

1. Check catalog API for correct prop names and types
2. Verify prop count within 5-8 limit
3. Ensure spec has required `root` and `elements` structure
4. Use `validateSpec()` utility for debugging:

```tsx
import { catalog } from '@surfacesui/components/catalog';

const result = catalog.validateSpec(spec);
if (!result.success) {
  console.error('Validation errors:', result.errors);
}
```

### Context Data Not Appearing

If components don't show data:

1. Verify `initialState.data` is provided to SurfacesRenderer
2. Check data format matches component expectations (Record<string, unknown>[])
3. Ensure registry wrapper correctly accesses state via `useStateValue('/data')`
4. Check browser console for errors

### MCP Actions Not Working

If tool calls fail:

1. Verify bridge passed to SurfacesRenderer: `bridge={bridge}`
2. Check McpBridgeProvider wraps app (if using useMcpBridge hook)
3. Verify action handlers created: `createMcpActionHandlers(bridge)`
4. Check network requests in browser DevTools
5. Verify backend MCP server is running and reachable

### Theme Not Applying

If theme doesn't apply correctly:

1. Verify SurfacesRenderer has `theme` prop set
2. Check CSS custom properties are loaded (inspect element styles)
3. Ensure no conflicting CSS overriding token values
4. For standalone bundles, verify `<body>` has theme classes applied

### Virtual Scrolling Issues

If table performance is poor:

1. Ensure `virtualScrolling: true` in DataTable props
2. Verify container has fixed height (required for virtualizer)
3. Check dataset size - virtual scrolling activates at 20+ rows
4. Avoid unmemoized columns array (causes VirtualRow re-renders)

### Natural Language Generation Not Working

If NL generation fails:

1. Verify backend server is running: `curl http://localhost:8000/health`
2. Check backend logs for LLM API errors
3. Verify LLM provider credentials (AWS, Anthropic, OpenAI)
4. Test with simple prompts first: "Show a table"
5. Check browser console for frontend errors

## Performance Tips

1. **Memoize specs**: Use `useMemo` for static specs to prevent unnecessary re-renders
2. **Lazy load data**: Load large datasets incrementally, not all at once
3. **Enable virtual scrolling**: Always use `virtualScrolling: true` for >100 rows
4. **Debounce filters**: Use `debounceMs` prop on Filter components (150-300ms recommended)
5. **Optimize bundle size**: Import only needed components, tree-shake unused code

## Next Steps

- See [Catalog API](./CATALOG_API.md) for component reference
- See [Registry Extension](./REGISTRY_EXTENSION.md) to add custom components
- Review example apps in `packages/components/src/apps/`
- Check the `server/` directory for backend setup examples
