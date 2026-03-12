# @surfacesui/app-framework

Build custom MCP App UIs for your MCP server in ~5 lines of code. Produces a single self-contained HTML file you can embed in any MCP server (Go, Python, Rust, Node) and serve via the MCP Apps protocol.

## The Problem

You have an MCP server (say, a Go service that exposes tools like `get_org_chart` or `execute_query`) and you want to build a rich UI that Claude Desktop or other MCP hosts can render. Today that means:

1. Setting up a React project with Vite
2. Wiring up `McpAppsBridge` to talk to your server's tools
3. Wrapping everything in `McpBridgeProvider` + `ThemeProvider`
4. Configuring Tailwind, single-file HTML inlining, FOUC prevention
5. Building and copying the HTML into your server for `//go:embed`

That's ~50 lines of boilerplate before you write any UI code.

## The Solution

This package gives you two things:

- **`createMcpApp()`** — one-liner that handles steps 2-3 (bridge + providers + render)
- **`defineAppConfig()`** — Vite preset that handles steps 1 and 4 (build config)

You write your UI component, call `createMcpApp()`, and get a single HTML file out.

## End-to-End Example: Building a UI for a Go MCP Server

### Step 1: Create a UI package alongside your server

```
my-mcp-server/
  cmd/server/main.go       # Your Go MCP server
  ui/                       # New: the UI project
    src/main.tsx
    vite.config.ts
    package.json
```

### Step 2: Set up the UI project

```bash
cd ui
pnpm init
pnpm add @surfacesui/app-framework @surfacesui/components react react-dom
pnpm add -D vite tailwindcss typescript @types/react @types/react-dom
```

### Step 3: Write your UI

```tsx
// ui/src/main.tsx
import { createMcpApp, useMcpTool, Card, CardHeader, CardTitle, CardContent } from '@surfacesui/app-framework';
import '@surfacesui/app-framework/tokens.css';

function OrgChart() {
  // useMcpTool calls your server's "get_org_chart" tool via the MCP Apps bridge
  const { data, loading, error } = useMcpTool('get_org_chart');

  if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Chart</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Render your org chart using data from the tool */}
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </CardContent>
    </Card>
  );
}

// This single call wires up:
// - McpAppsBridge (talks to your server via the MCP Apps protocol)
// - McpBridgeProvider (React context for bridge access)
// - ThemeProvider (light/dark mode, density, design tokens)
// - React rendering into #root
createMcpApp(OrgChart, { name: 'Org Chart' });
```

### Step 4: Add the Vite config

```ts
// ui/vite.config.ts
import { defineAppConfig } from '@surfacesui/app-framework/vite';

export default defineAppConfig({ title: 'Org Chart' });
```

This gives you: Tailwind 4 + React + single-file HTML inlining + auto-generated `index.html` with FOUC prevention. No config to fiddle with.

### Step 5: Build

```bash
cd ui && pnpm vite build
# Output: ui/dist/index.html (single self-contained HTML file, ~700KB gzipped)
```

### Step 6: Embed in your Go server

Copy the built HTML into your Go server and serve it as an MCP App resource:

```go
import "embed"

//go:embed ui/dist/index.html
var orgChartHTML []byte

func RegisterApps(registry *apps.UIResourceRegistry) error {
    _, _, err := registry.CreateApp("org-chart", "Interactive org chart", orgChartHTML)
    return err
}
```

When Claude Desktop (or any MCP host) connects to your server, it discovers the app via `resources/list` and renders the HTML. The UI calls your server's tools through the MCP Apps bridge — no REST APIs, no CORS, no separate web server.

## How It Works

```
┌─────────────────────────────────────────────┐
│  MCP Host (Claude Desktop, etc.)            │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Your HTML App (single file)          │  │
│  │                                       │  │
│  │  createMcpApp(OrgChart)               │  │
│  │    └─ McpAppsBridge                   │  │
│  │         └─ ext-apps SDK               │  │
│  │              ↕ callServerTool()        │  │
│  └───────────────────────────────────────┘  │
│                    ↕                        │
│  MCP Protocol (stdio / SSE / HTTP)          │
└─────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────┐
│  Your MCP Server (Go, Python, Rust, Node)   │
│    tools: get_org_chart, execute_query, ...  │
└─────────────────────────────────────────────┘
```

The `McpAppsBridge` (created automatically by `createMcpApp`) uses the `@modelcontextprotocol/ext-apps` SDK to communicate with the host. When your UI calls `useMcpTool('get_org_chart')`, it sends a `callServerTool` request through the host back to your MCP server.

## Calling Your Server's Tools

The framework re-exports bridge hooks from `@surfacesui/components`:

```tsx
import { useMcpTool, useMcpPagination, useMcpStream, useMcpBridge } from '@surfacesui/app-framework';

// Simple tool call with auto-fetch
const { data, loading, error, refetch } = useMcpTool('get_org_chart', { department: 'eng' });

// Paginated data
const { data, page, pageCount, nextPage, prevPage } = useMcpPagination('list_employees', 20);

// Streaming results
const { chunks, isStreaming, start, stop } = useMcpStream('stream_logs');

// Direct bridge access for imperative calls
const { bridge } = useMcpBridge();
const result = await bridge.callTool('execute_query', { sql: 'SELECT ...' });
```

## Dev Mode: Live Iteration with Your Server

During development, use the dev proxy to connect your UI to a running MCP server:

```ts
// ui/vite.config.ts
import { defineAppConfig } from '@surfacesui/app-framework/vite';

export default defineAppConfig({
  title: 'Org Chart',
  devProxy: {
    // Option A: auto-spawn your server
    command: 'go run ./cmd/server',
    transport: 'stdio',

    // Option B: connect to an already-running server
    // mcpUrl: 'http://localhost:3000',
    // transport: 'streamable-http',
  },
});
```

Then `pnpm vite` gives you hot-reloading UI development with real tool calls hitting your actual MCP server.

## API Reference

### `createMcpApp(Component, options?)`

Bootstraps a React component as an MCP App.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `'McpApp'` | App name for the ext-apps SDK |
| `rootId` | `string` | `'root'` | DOM element ID to mount into |
| `theme.mode` | `'light' \| 'dark' \| 'system'` | `'system'` | Theme mode |
| `theme.persistTheme` | `boolean` | `false` | Save theme choice to localStorage |
| `theme.density` | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | UI density |
| `theme.tokenOverrides` | `Record<string, string>` | — | CSS custom property overrides |
| `bridge` | `BridgeLike` | auto-created | Custom bridge instance |

Returns `{ unmount }` for cleanup.

### `defineAppConfig(options?)`

Creates a Vite config that produces a single-file HTML bundle.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entry` | `string` | `'./src/main.tsx'` | Entry file path |
| `outDir` | `string` | `'dist'` | Output directory |
| `title` | `string` | `'MCP App'` | HTML page title |
| `plugins` | `Plugin[]` | `[]` | Additional Vite plugins |
| `vite` | `Partial<UserConfig>` | `{}` | Override/extend Vite config |
| `devProxy.command` | `string` | — | Shell command to spawn MCP server |
| `devProxy.mcpUrl` | `string` | — | URL of running MCP server |
| `devProxy.transport` | `'stdio' \| 'sse' \| 'streamable-http'` | `'stdio'` | Transport type |

Internally composes: `@tailwindcss/vite` + `@vitejs/plugin-react-swc` + `vite-plugin-singlefile` + auto-generated `index.html` with FOUC prevention.

## Available Components

The package re-exports commonly used primitives from `@surfacesui/components`:

**Primitives**: `Button`, `Card`, `Badge`, `Alert`, `Dialog`, `Tabs`, `Input`, `Label`, `Switch`, `Checkbox`, `RadioGroup`, `Progress`, `ScrollArea`, `Separator`

**Utility**: `cn` (Tailwind className merge helper)

**Theme**: `ThemeProvider`, `useTheme`

For heavy/specialized components (SQLEditor, ECharts, catalog), import directly from `@surfacesui/components`.

## Package Exports

| Import path | What you get |
|-------------|--------------|
| `@surfacesui/app-framework` | `createMcpApp`, bridge hooks, components, theme |
| `@surfacesui/app-framework/vite` | `defineAppConfig` (build preset) |
| `@surfacesui/app-framework/tokens.css` | Design tokens (import in your entry file) |

## Examples

See [`examples/hello-world/`](./examples/hello-world/) for a minimal working app.
