# SurfacesUI

**Version:** 0.1.0

Reusable React component library served as self-contained HTML bundles via MCP bridge abstraction, with pluggable backends (Loom, MCP Apps, postMessage).

## Overview

This project provides:

- **packages/components** - React component library (TypeScript + Tailwind)
- **server/** - FastMCP Python server that serves HTML apps as MCP resources

Components communicate through the MCP Bridge pattern, not direct REST calls. Three bridge implementations allow the same components to work across different environments:

| Bridge | Transport | Environment |
|--------|-----------|-------------|
| `McpBridge` | postMessage | iframe / web embedding |
| `McpAppsBridge` | MCP Apps protocol | Claude Desktop, Cursor |
| `LoomBridge` | HTTP (gRPC-gateway) | Loom agent framework |

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- Python >= 3.11 (for MCP server, optional)

### Installation

```bash
pnpm install
```

### Build

```bash
# Build the component library
pnpm build

# Build HTML app bundles for MCP serving
pnpm --filter @surfacesui/components build:apps
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

| Tool Name | HTTP Method | Endpoint |
|-----------|-------------|----------|
| `list_agents` | GET | `/v1/agents` |
| `list_sessions` | GET | `/v1/sessions` |
| `list_ui_apps` | GET | `/v1/apps` |
| `list_component_types` | GET | `/v1/apps/component-types` |
| `get_health` | GET | `/health` |
| `get_conversation_history` | GET | `/v1/sessions/{session_id}/history` |
| `get_session` | GET | `/v1/sessions/{session_id}` |
| `create_ui_app` | POST | `/v1/apps` |
| `weave` | POST | `/v1/weave` |
| *(unknown)* | POST | `/v1/weave` (agent-mediated fallback) |

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

### Architecture

```
loom-test.tsx
  └── LoomBridge (http://localhost:5006)
        ├── GET /v1/agents          → Agent cards
        ├── GET /v1/sessions        → Session sidebar
        ├── GET /v1/sessions/{id}/history → Conversation thread
        ├── GET /v1/apps            → UI app list
        ├── POST /v1/weave          → Agent chat
        └── GET /health             → Health badge
```

The LoomBridge supports dynamic path parameters (session_id in URL), configurable agent/session IDs, and falls back to agent-mediated execution for unrecognized tools.

### Creating a Custom Bridge

To connect surfaces-ui to a new backend, implement `BridgeLike`:

```typescript
import type { BridgeLike } from '@surfacesui/components';

class MyBridge implements BridgeLike {
  connect(): void { /* ... */ }
  disconnect(): void { /* ... */ }
  get isConnected(): boolean { /* ... */ }

  async callTool<T>(toolName: string, args?: Record<string, unknown>) {
    // Map toolName to your backend's API
    const response = await fetch(`/api/tools/${toolName}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return { success: true, data: await response.json() as T };
  }

  onDataPush(cb: (data: McpRenderData) => void) { return () => {}; }
  fetchPage<T>(tool: string, args: any) { return this.callTool(tool, args); }
  onStreamChunk(id: number, cb: (chunk: unknown) => void) { return () => {}; }
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

## Using with Claude Desktop

Configure the surfaces-ui Python server in your Claude Desktop settings:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "python",
      "args": ["-m", "src.main"],
      "cwd": "/path/to/surfaces-ui/server",
      "env": {
        "MOCK_MODE": "true"
      }
    }
  }
}
```

### Connecting to vantage-mcp

The Python server can proxy to vantage-mcp in two modes:

**stdio (recommended):** Spawns vantage-mcp as a subprocess, communicates via JSON-RPC over stdin/stdout.

```json
{
  "env": {
    "MOCK_MODE": "false",
    "VANTAGE_MCP_MODE": "stdio",
    "VANTAGE_MCP_BINARY": "/path/to/vantage-mcp",
    "TD_USER": "your-username",
    "TD_PASSWORD": "your-password",
    "TD_HOST": "vantage.example.com"
  }
}
```

**HTTP:** Proxies to a running vantage-mcp HTTP endpoint.

```json
{
  "env": {
    "MOCK_MODE": "false",
    "VANTAGE_MCP_MODE": "http",
    "VANTAGE_MCP_ADDR": "http://localhost:3000"
  }
}
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

## Project Structure

```
surfaces-ui/
├── packages/
│   └── components/
│       └── src/
│           ├── bridge/
│           │   ├── McpBridge.ts          # postMessage bridge (web)
│           │   ├── McpAppsBridge.ts       # MCP Apps bridge (Claude Desktop)
│           │   ├── LoomBridge.ts          # Loom HTTP bridge
│           │   ├── McpBridgeProvider.tsx   # React context + BridgeLike interface
│           │   ├── hooks.ts               # useMcpTool, useMcpPagination, useMcpStream
│           │   └── types.ts               # McpToolResult, PageResult, etc.
│           ├── components/
│           │   ├── sql-editor/            # SQL Editor component
│           │   ├── conversation-viewer/   # Conversation Viewer component
│           │   ├── sql-results/           # Query result display
│           │   └── charts/                # Chart components
│           ├── primitives/                # Button, Card, Badge, Dialog, etc.
│           ├── catalog/                   # json-render NL UI generation
│           ├── apps/                      # HTML bundle entry points
│           │   ├── sql-editor-cdn.tsx      # SQL Editor app (McpAppsBridge)
│           │   ├── json-render-cdn.tsx     # NL Generator app (McpAppsBridge)
│           │   └── loom-test.tsx           # Loom integration dashboard (LoomBridge)
│           └── theme/                     # ThemeProvider + CSS tokens
├── server/                                # FastMCP Python server
│   └── src/
│       ├── main.py                        # Server entry point
│       ├── tools/                         # MCP tools (sql.py)
│       ├── resources/                     # MCP resources (ui.py)
│       └── llm/                           # LLM providers (Bedrock, Anthropic, OpenAI)
└── .claude/
    └── agents/                            # UX, Engineering, Testing review agents
```

## Quality Standards

| Check | Threshold |
|-------|-----------|
| Test coverage (lines) | 60% |
| Test coverage (branches) | 75% |
| Accessibility (axe-core) | 0 violations |
| Bundle size (gzipped) | 650KB per HTML app |
| Component size | <400 lines (atomic design) |
| TypeScript | Strict, zero errors |

CI runs four jobs on every push and PR: **Test & Coverage**, **Lint & Type Check**, **Build & Bundle Analysis**, **Accessibility Check**.

## License

Apache-2.0
