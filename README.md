# SurfacesUI

**Version:** 0.1.0

Reusable React component library served as self-contained HTML bundles via MCP bridge abstraction, with pluggable backends (Loom, MCP Apps, postMessage).

## Overview

This project provides three packages:

| Package                   | Audience                   | What it does                                                             |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `@surfacesui/components`  | React app authors          | Components + bridges                                                     |
| `@surfacesui/mcp-adapter` | MCP server authors         | Pure functions to register surfaces-ui resources/tools in any MCP server |
| `@surfacesui/server`      | End users / Claude Desktop | Standalone MCP server, `npx`-runnable                                    |

Components communicate through the MCP Bridge pattern, not direct REST calls. Three bridge implementations allow the same components to work across different environments:

| Bridge          | Transport           | Environment            |
| --------------- | ------------------- | ---------------------- |
| `McpBridge`     | postMessage         | iframe / web embedding |
| `McpAppsBridge` | MCP Apps protocol   | Claude Desktop, Cursor |
| `LoomBridge`    | HTTP (gRPC-gateway) | Loom agent framework   |

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0

### Installation

```bash
pnpm install
```

### Build

```bash
# Build all packages (components -> mcp-adapter -> server)
pnpm build

# Build only HTML app bundles
pnpm build:apps
```

### Development

```bash
# Start development mode (watches for changes)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm --filter @surfacesui/components test:coverage
```

**Component Showcase**: During development, you can view all 8 catalog components at:
```
http://localhost:5173/src/apps/showcase.html
```

The showcase provides:
- Live previews of all components (SQLResultsDisplay, TableWithFilters, ChartWithControls, etc.)
- Category filtering (Organism/Molecule/Primitive)
- JSON spec viewer
- Example prompts for natural language generation

Note: The showcase is dev-only and not packaged as an MCP app.

## Using with Claude Desktop

Configure the surfaces-ui MCP server in your Claude Desktop settings:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**rom NPM**

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "npx",
      "args": ["@surfacesui/server"]
    }
  }
}
```

**Local build**

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "node",
      "args": ["/path/to/surfaces-ui/packages/server/dist/index.js"]
    }
  }
}
```

No Python. No pip. No build step. Just `npx`.

## MCP Adapter (Embedding in Your Own Server)

The `@surfacesui/mcp-adapter` package provides pure, framework-agnostic functions
that any MCP server can import to serve surfaces-ui apps as resources:

```ts
import { getSurfacesResources, readSurfacesResource, isSurfacesUri } from '@surfacesui/mcp-adapter';

// Merge into your existing resource list handler
server.setRequestHandler('resources/list', async () => ({
  resources: [...myExistingResources, ...getSurfacesResources()],
}));

server.setRequestHandler('resources/read', async (req) => {
  if (isSurfacesUri(req.params.uri)) {
    return { contents: [readSurfacesResource(req.params.uri)] };
  }
  // ... handle own resources
});
```

No new config entry. No new process. Just a package dependency and a few lines
of glue in the existing resource handlers.

## Connecting to an MCP Server (Loom Example)

There are three ways to use surfaces-ui with an MCP server. We use
[Loom](https://github.com/teradata-labs/loom) as the running example since
it's a Go-based agent framework with its own MCP layer (`loom-mcp`).

### Option 1: Side-by-side MCP servers (simplest)

Run `@surfacesui/server` alongside your existing MCP server. Claude Desktop
and other MCP clients support multiple servers simultaneously.

```json
{
  "mcpServers": {
    "loom": {
      "command": "/path/to/loom-mcp",
      "args": ["--grpc-addr", "localhost:60051"]
    },
    "surfaces-ui": {
      "command": "npx",
      "args": ["@surfacesui/server"]
    }
  }
}
```

The MCP client sees Loom's tools/resources and surfaces-ui's HTML apps as a
combined set. No code changes to either server. This is the recommended
starting point.

### Option 2: Embed the adapter in a Node.js MCP server

If your MCP server is written in Node.js/TypeScript, import
`@surfacesui/mcp-adapter` directly (see [MCP Adapter](#mcp-adapter-embedding-in-your-own-server) above).

### Option 3: Vendor the HTML bundles (Go, Rust, Python, etc.)

For non-Node servers like Loom (Go), vendor the pre-built HTML bundles and
serve them as MCP resources from your own codebase:

```bash
# Download the HTML bundles from the published npm package
npm pack @surfacesui/mcp-adapter --pack-destination /tmp
tar -xzf /tmp/surfacesui-mcp-adapter-*.tgz -C /tmp
ls /tmp/package/apps/
#   sql-editor-cdn.html
#   json-render-cdn.html
```

Then register them in your server's resource handlers. In Loom's Go codebase,
for example, you would embed the HTML files and register them in the
`UIResourceRegistry`:

```go
import "embed"

//go:embed html/sql-editor-cdn.html
var sqlEditorHTML []byte

//go:embed html/json-render-cdn.html
var jsonRenderHTML []byte

func RegisterSurfacesApps(registry *apps.UIResourceRegistry) error {
    entries := []struct {
        name, desc string
        html       []byte
    }{
        {"sql-editor", "Interactive SQL editor with query execution", sqlEditorHTML},
        {"json-render", "Natural language UI generator", jsonRenderHTML},
    }
    for _, e := range entries {
        if _, _, err := registry.CreateApp(e.name, e.desc, e.html); err != nil {
            return fmt.Errorf("register %s: %w", e.name, err)
        }
    }
    return nil
}
```

The apps then appear in `loom-mcp`'s `resources/list` alongside Loom's own
built-in apps (conversation-viewer, data-chart, etc.) and any dynamic apps
created by agents.

### Option 4: LoomBridge (client-side, no MCP server needed)

If you're building a web app that talks directly to a running Loom server,
use the `LoomBridge` from `@surfacesui/components`. This bypasses MCP
entirely and connects over Loom's HTTP/gRPC-gateway API:

```tsx
import { LoomBridge, McpBridgeProvider, ConversationViewer } from '@surfacesui/components';

const bridge = new LoomBridge({ loomUrl: 'http://localhost:5006' });
bridge.connect();

function App() {
  return (
    <McpBridgeProvider bridge={bridge}>
      <ConversationViewer />
    </McpBridgeProvider>
  );
}
```

The `LoomBridge` maps component tool calls to Loom REST endpoints
automatically:

| Tool Call                  | Maps To                           |
| -------------------------- | --------------------------------- |
| `list_agents`              | `GET /v1/agents`                  |
| `list_sessions`            | `GET /v1/sessions`                |
| `get_conversation_history` | `GET /v1/sessions/{id}/history`   |
| `weave`                    | `POST /v1/weave`                  |
| _(any unknown tool)_       | `POST /v1/weave` (agent-mediated) |

See the [Loom Integration Test](#loom-integration-test) section below for a
full working example.

## Bridge Architecture

All components use a `BridgeLike` interface for tool calls. The bridge is injected via React context (`McpBridgeProvider`), so components are backend-agnostic:

```tsx
// Components call tools the same way regardless of bridge:
const { bridge } = useMcpBridge();
const result = await bridge.callTool('list_agents');
```

### McpBridge (postMessage)

For web-based MCP hosts that embed components in iframes. The parent window relays tool calls to the MCP server.

### McpAppsBridge (MCP Apps protocol)

For native MCP Apps environments like Claude Desktop. Uses `@modelcontextprotocol/ext-apps` for communication. Includes tool name mapping for vantage-mcp conventions (`execute_sql` -> `teradata_execute_sql`).

### LoomBridge (HTTP / gRPC-gateway)

For connecting directly to a running [Loom](https://github.com/teradata-labs/loom) server. Maps tool calls to Loom's REST API endpoints:

| Tool Name                  | HTTP Method | Endpoint                              |
| -------------------------- | ----------- | ------------------------------------- |
| `list_agents`              | GET         | `/v1/agents`                          |
| `list_sessions`            | GET         | `/v1/sessions`                        |
| `list_ui_apps`             | GET         | `/v1/apps`                            |
| `list_component_types`     | GET         | `/v1/apps/component-types`            |
| `get_health`               | GET         | `/health`                             |
| `get_conversation_history` | GET         | `/v1/sessions/{session_id}/history`   |
| `get_session`              | GET         | `/v1/sessions/{session_id}`           |
| `create_ui_app`            | POST        | `/v1/apps`                            |
| `weave`                    | POST        | `/v1/weave`                           |
| _(unknown)_                | POST        | `/v1/weave` (agent-mediated fallback) |

Unknown tool calls are automatically routed through Loom's Weave endpoint, which delegates to an agent.

## Loom Integration Test

The `loom-test` app is a live integration dashboard that connects surfaces-ui components to a running Loom server. It demonstrates the bridge abstraction working with a non-vantage-mcp backend.

### Running

Start a Loom server (default: gRPC on `:60051`, HTTP on `:5006`), then:

```bash
pnpm dev
# Open http://localhost:5173/src/apps/loom-test.html
```

### What It Shows

The dashboard has four sections, all fetching live data from Loom via `LoomBridge`:

**Agents** - Cards for each running Loom agent (guide, weaver, etc.) with status badges and session counts. Click to select an agent for the chat panel.

**Chat** - Send messages to the selected agent via Loom's `/v1/weave` endpoint. Responses include cost tracking. Session ID is captured for conversation continuity.

**Conversation Viewer** - Browse all Loom sessions in a sidebar, click one to load its full message history. Messages are rendered with role-based styling (user, assistant, tool) and timestamps. Long messages collapse with a "show more" toggle.

**UI Apps** - Lists all UI apps registered in Loom (conversation-viewer, data-chart, data-quality-dashboard, explain-plan-visualizer, plus any dynamic apps created by agents).

### Creating a Custom Bridge

To connect surfaces-ui to a new backend, implement `BridgeLike`:

```typescript
import type { BridgeLike } from '@surfacesui/components';

class MyBridge implements BridgeLike {
  connect(): void {
    /* ... */
  }
  disconnect(): void {
    /* ... */
  }
  get isConnected(): boolean {
    /* ... */
  }

  async callTool<T>(toolName: string, args?: Record<string, unknown>) {
    // Map toolName to your backend's API
    const response = await fetch(`/api/tools/${toolName}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return { success: true, data: (await response.json()) as T };
  }

  onDataPush(cb: (data: McpRenderData) => void) {
    return () => {};
  }
  fetchPage<T>(tool: string, args: any) {
    return this.callTool(tool, args);
  }
  onStreamChunk(id: number, cb: (chunk: unknown) => void) {
    return () => {};
  }
  startStream<T>(tool: string, args?: any) {
    return { id: 1, result: this.callTool<T>(tool, args) };
  }
  cancelStream(id: number): void {}
}
```

Then wrap your components:

```tsx
<McpBridgeProvider bridge={new MyBridge()}>
  <ConversationViewer />
</McpBridgeProvider>
```

## Components

### SQLEditor

Interactive SQL editor with CodeMirror, query execution, and result visualization.

```tsx
<McpBridgeProvider bridge={bridge}>
  <SQLEditor initialCode="SELECT * FROM users LIMIT 10" title="SQL Editor" />
</McpBridgeProvider>
```

### ConversationViewer

Displays Loom agent conversation history with a session sidebar and threaded message view.

```tsx
<McpBridgeProvider bridge={bridge}>
  <ConversationViewer initialSessionId="sess_abc123" />
</McpBridgeProvider>
```

Fetches data via two tool calls:

- `list_sessions` - populates the session sidebar
- `get_conversation_history` (with `session_id`, `limit`) - loads the message thread

### NLGenerator

Natural language UI generator powered by json-render. Generates interactive UI from text prompts.

```tsx
<McpBridgeProvider bridge={bridge}>
  <ThemeProvider>
    <NLGenerator
      renderSpec={(spec) => <SurfacesRenderer spec={spec} bridge={bridge} />}
      showExamples={true}
    />
  </ThemeProvider>
</McpBridgeProvider>
```

## Figma Design Tokens Integration

surfaces-ui includes utilities to convert Figma design tokens into CSS custom properties compatible with the component library's theming system.

### Export from Figma

**Via Figma REST API:**
```bash
curl -H "X-Figma-Token: YOUR_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/variables/local" > tokens.json
```

**Via Tokens Studio plugin:**
Export tokens as JSON from the Tokens Studio plugin settings.

### Convert to surfaces-ui CSS

```bash
cd packages/components
pnpm figma-tokens tokens.json theme.css
```

Output:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 217 33% 17%;
}

.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
}
```

### Programmatic Usage

```typescript
import {
  mapFigmaTokensToSurfaces,
  generateSurfacesCSS
} from '@surfacesui/components';

const figmaTokens = { /* ... */ };
const tokens = mapFigmaTokensToSurfaces(figmaTokens);
const css = generateSurfacesCSS(tokens);
```

**Supported Formats:**
- Design Tokens Community Group (DTCG)
- Figma Variables export
- Tokens Studio plugin export

For detailed documentation and examples, see [FIGMA_TOKENS.md](packages/components/docs/FIGMA_TOKENS.md).

## Theming

surfaces-ui components use CSS custom properties for theming. The default theme (`tokens.css`) provides:

- **Semantic colors:** Background, foreground, primary, secondary, accent, success, warning, destructive
- **WCAG 2.1 AA compliant:** All color combinations meet or exceed 4.5:1 contrast ratio
- **Light and dark mode:** Automatic theme switching via `.dark` class
- **Customizable:** Override CSS custom properties or generate from design tokens

### Custom Themes

Generate a custom theme from Figma design tokens:

```bash
cd packages/components
pnpm figma-tokens your-tokens.json custom-theme.css
```

See [FIGMA_TOKENS.md](packages/components/docs/FIGMA_TOKENS.md) for details on token formats and customization.

## Project Structure

```
surfaces-ui/
├── packages/
│   ├── components/                    # React component library
│   │   └── src/
│   │       ├── bridge/                # MCP bridge implementations
│   │       │   ├── McpBridge.ts       # postMessage bridge (web)
│   │       │   ├── McpAppsBridge.ts   # MCP Apps bridge (Claude Desktop)
│   │       │   ├── LoomBridge.ts      # Loom HTTP bridge
│   │       │   ├── McpBridgeProvider.tsx
│   │       │   ├── hooks.ts           # useMcpTool, useMcpPagination, useMcpStream
│   │       │   └── types.ts
│   │       ├── components/            # SQL Editor, Conversation Viewer, etc.
│   │       ├── primitives/            # Button, Card, Badge, Dialog, etc.
│   │       ├── catalog/               # json-render NL UI generation
│   │       ├── apps/                  # HTML bundle entry points
│   │       └── theme/                 # ThemeProvider + CSS tokens
│   ├── mcp-adapter/                   # Framework-agnostic MCP adapter
│   │   ├── src/
│   │   │   ├── registry.ts            # App metadata (single source of truth)
│   │   │   ├── resources.ts           # Resource list + content reader
│   │   │   ├── types.ts               # SurfacesResource, SurfacesResourceContent
│   │   │   └── index.ts               # Public API
│   │   ├── scripts/copy-apps.js       # Copies HTML bundles from components
│   │   └── apps/                      # Copied HTML bundles (build artifact)
│   └── server/                        # Standalone Node.js MCP server
│       └── src/
│           └── index.ts               # MCP server using @surfacesui/mcp-adapter
└── .claude/
    └── agents/                        # UX, Engineering, Testing review agents
```

## Quality Standards

| Check                    | Threshold                  |
| ------------------------ | -------------------------- |
| Test coverage (lines)    | 60%                        |
| Test coverage (branches) | 75%                        |
| Accessibility (axe-core) | 0 violations               |
| Bundle size (gzipped)    | 700KB per HTML app         |
| Component size           | <400 lines (atomic design) |
| TypeScript               | Strict, zero errors        |

CI runs four jobs on every push and PR: **Test & Coverage**, **Lint & Type Check**, **Build & Bundle Analysis**, **Accessibility Check**.

## License

Apache-2.0
