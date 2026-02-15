# Codebase Structure

**Analysis Date:** 2026-02-15

## Directory Layout

```
surfacesui/ (monorepo root)
├── packages/
│   └── components/              # React component library (Vite + TypeScript + Tailwind)
│       ├── src/
│       │   ├── bridge/          # MCP Bridge abstraction layer
│       │   ├── primitives/      # Base UI components (Radix UI + Tailwind)
│       │   ├── components/      # Feature components (SQL editor, charts, results)
│       │   ├── theme/           # Theming (ThemeProvider, tokens, Tailwind preset)
│       │   ├── lib/             # Utilities (analytics, cn)
│       │   ├── apps/            # Standalone app bundles (HTML entry points)
│       │   ├── test/            # Test configuration and setup
│       │   └── index.ts         # Library barrel export
│       ├── dist/                # Built output (generated, not committed)
│       │   ├── apps/            # Built HTML app bundles
│       │   └── http/            # HTTP-served assets
│       ├── package.json         # Dependencies, build scripts
│       ├── vite.config.ts       # Library build config
│       ├── vite.config.apps.ts  # App bundle build config
│       ├── vitest.config.ts     # Test runner config
│       ├── tsconfig.json        # TypeScript config
│       └── tailwind.config.js   # Tailwind CSS config
├── server/                      # FastMCP Python server
│   ├── src/
│   │   ├── main.py              # MCP server entry point
│   │   ├── tools/
│   │   │   └── sql.py           # SQL execution tool handler
│   │   └── resources/
│   │       └── ui.py            # UI resource registry and content
│   ├── tests/                   # Python tests
│   ├── requirements.txt         # Python dependencies
│   ├── pyproject.toml           # Python project config
│   └── README.md                # Server documentation
├── docs/                        # Documentation
├── .claude/                     # Review agents (UX, Engineering, Testing)
├── .planning/                   # GSD planning documents
│   └── codebase/                # Codebase analysis documents (ARCHITECTURE.md, etc.)
├── CLAUDE.md                    # Project instructions
├── README.md                    # Project overview
├── SECURITY.md                  # Security guidelines
├── pnpm-workspace.yaml          # Workspace config
└── package.json                 # Root workspace config
```

## Directory Purposes

**packages/components/src/bridge/**
- Purpose: MCP Bridge abstraction for postMessage communication
- Contains: Core bridge class, MCP Apps bridge variant, React hooks, TypeScript types
- Key files:
  - `McpBridge.ts` - Core bridge with request-response pattern, timeouts, stream support
  - `McpAppsBridge.ts` - MCP Apps environment variant (extended openLink support)
  - `McpBridgeProvider.tsx` - React context provider and useMcpBridge hook
  - `hooks.ts` - useMcpTool, useMcpPagination, useMcpStream
  - `types.ts` - McpToolResult, PageResult, McpMessage, McpRenderData, etc.
  - `index.ts` - Barrel export

**packages/components/src/primitives/**
- Purpose: Reusable, unstyled UI building blocks
- Contains: 15+ components from Radix UI (Button, Dialog, Card, Tabs, etc.) + Tailwind styling
- Key files: One .tsx per component (e.g., `button.tsx`, `card.tsx`, `dialog.tsx`)
- Pattern: Each exports component + variants (e.g., buttonVariants for styling other elements)
- No local tests; primitives tested implicitly via component tests

**packages/components/src/components/**
- Purpose: Feature-rich, domain-specific components
- Contains three subdirectories:
  - `sql-editor/` - SQL query editor with CodeMirror input, results display, toolbar
  - `sql-results/` - Reusable results display with table view, charts, filters
  - `charts/` - ECharts wrapper with theme integration

**packages/components/src/components/sql-editor/**
- Purpose: Full-featured SQL editor integrating all layers
- Key files:
  - `SQLEditor.tsx` - Main component; polls get_last_result, manages state persistence
  - `CodeMirrorSQLInput.tsx` - CodeMirror editor with SQL syntax highlighting
  - `SimpleSQLInput.tsx` - Fallback text input (no external editor)
  - `SQLToolbar.tsx` - Execute button, connection selector, view mode toggle
  - `SQLResultsTable.tsx` - Table view of query results with pagination
  - `SQLVisualization.tsx` - Chart rendering (delegates to ECharts component)
  - `types.ts` - SQLEditorProps, SQLResult, etc.
  - `__tests__/` - Unit, a11y, and integration tests

**packages/components/src/components/sql-results/**
- Purpose: Standalone results display (decoupled from SQLEditor)
- Key files:
  - `SQLResultsDisplay.tsx` - Large component (62KB) managing tables, charts, filters
  - `types.ts` - SQLResultsDisplayProps, ChartConfig, etc.
  - `index.ts` - Barrel export with default configs

**packages/components/src/components/charts/**
- Purpose: ECharts wrapper with accessible theming
- Key files:
  - `ECharts.tsx` - React wrapper around echarts.init()
  - `echart-themes.ts` - Light/dark themes, accessible color palettes
  - `index.ts` - Barrel export with theme utilities

**packages/components/src/theme/**
- Purpose: Centralized styling system
- Key files:
  - `ThemeProvider.tsx` - React context; applies theme class to document root
  - `tokens.css` - CSS custom properties for all design tokens (colors, spacing, etc.)
  - `tailwind-preset.ts` - Tailwind config preset referencing CSS variables

**packages/components/src/lib/**
- Purpose: Shared utilities
- Key files:
  - `analytics.ts` - Optional AnalyticsProvider and useAnalytics hook (null if unconfigured)
  - `utils.ts` - cn() function for merging Tailwind classes

**packages/components/src/apps/**
- Purpose: Deployable app bundles for MCP Apps environment
- Contains: HTML template + TSX entry point pairs
- Key files:
  - `sql-editor-cdn.tsx` - Entry point that wires SQLEditor + bridge + theme
  - `sql-editor-cdn.html` - Built output (single-file HTML with inlined JS/CSS)
  - Other .html files - Pre-built stubs (placeholder apps)
- Build process: vite.config.apps.ts builds .html files using vite-plugin-singlefile

**packages/components/src/test/**
- Purpose: Test infrastructure
- Key files:
  - `setup.ts` - Vitest setup (JSDOM environment, mocks)

**server/src/main.py**
- Purpose: MCP server entry point
- Registers: execute_sql tool handler, UI resource handlers, optional HTTP server
- Environment: Configured via env vars (MOCK_MODE, VANTAGE_MCP_MODE, HTTP_PORT, etc.)

**server/src/tools/sql.py**
- Purpose: SQL execution tool implementation
- Modes: Mock data, HTTP proxy to vantage-mcp, stdio subprocess to vantage-mcp

**server/src/resources/ui.py**
- Purpose: UI resource registration and content serving
- Registry: Maps app IDs to metadata and HTML file paths
- Content: Reads built HTML from `packages/components/dist/apps/`

## Key File Locations

**Entry Points:**
- Library: `packages/components/src/index.ts` - Barrel export of all public components
- App (SQLEditor): `packages/components/src/apps/sql-editor-cdn.tsx` - React entry point
- App (HTML): `packages/components/src/apps/sql-editor-cdn.html` - Built output
- Server: `server/src/main.py` - FastMCP server entry point

**Configuration:**
- Components Vite: `packages/components/vite.config.ts` - Library build (ES + CJS)
- Apps Vite: `packages/components/vite.config.apps.ts` - Single-file HTML builds
- TypeScript: `packages/components/tsconfig.json` - ES2022, strict mode, @ alias
- Tests: `packages/components/vitest.config.ts` - JSDOM, coverage
- Tailwind: `packages/components/tailwind.config.js` - Preset from theme/tailwind-preset.ts
- Python: `server/pyproject.toml` - FastMCP, aiohttp dependencies

**Core Logic:**
- Bridge: `packages/components/src/bridge/McpBridge.ts` - Request-response pattern
- SQL Editor: `packages/components/src/components/sql-editor/SQLEditor.tsx` - Main component
- Results Display: `packages/components/src/components/sql-results/SQLResultsDisplay.tsx` - 62KB results UI
- Theme: `packages/components/src/theme/ThemeProvider.tsx` - Context + CSS setup

**Testing:**
- SQL Editor tests: `packages/components/src/components/sql-editor/__tests__/`
  - `SQLEditor.test.tsx` - Unit tests
  - `SQLEditor.a11y.test.tsx` - Accessibility tests (axe-core)
  - `SQLEditor.integration.test.tsx` - Bridge integration tests

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `SQLEditor.tsx`, `McpBridge.ts`)
- Utilities: camelCase (e.g., `analytics.ts`, `utils.ts`)
- Tests: `[ComponentName].[category].test.tsx` (e.g., `SQLEditor.a11y.test.tsx`)
- CSS: lowercase with hyphens (e.g., `tokens.css`, `scroll-area.tsx`)

**Directories:**
- Feature/component folders: lowercase with hyphens (e.g., `sql-editor`, `sql-results`, `theme`)
- Layer folders: lowercase (e.g., `bridge`, `primitives`, `components`, `lib`)

**Exports:**
- Named exports for types: `export interface SQLEditorProps { ... }`
- Named exports for components: `export function SQLEditor(props) { ... }`
- Barrel files: `export { ... } from './File'` at end of index.ts

**Hooks:**
- Custom hooks use `use` prefix: `useMcpTool`, `useMcpPagination`, `useMcpBridge`
- Context hooks: `useTheme`, `useAnalytics`

## Where to Add New Code

**New Feature Component:**
- Create directory: `packages/components/src/components/[feature-name]/`
- Structure:
  ```
  [feature-name]/
  ├── [FeatureName].tsx       # Main component
  ├── [SubComponent].tsx      # Sub-components if needed
  ├── types.ts                # Component-specific types
  ├── hooks.ts                # Component-specific hooks (if any)
  ├── __tests__/
  │   ├── [Feature].test.tsx
  │   ├── [Feature].a11y.test.tsx
  │   └── [Feature].integration.test.tsx
  └── index.ts                # Barrel export
  ```
- Add to `src/index.ts` barrel export
- Must follow atomic design size limits: < 400 lines for individual files

**New Primitive Component:**
- Create: `packages/components/src/primitives/[name].tsx`
- Source: Wrap Radix UI component + Tailwind styling
- Export component + variants
- Add to `src/index.ts`
- Example: `packages/components/src/primitives/button.tsx`

**New Hook (bridge-related):**
- Location: `packages/components/src/bridge/hooks.ts` (append to existing file)
- Pattern: Follow useMcpTool signature; implement mounted ref tracking, cleanup on unmount
- Export in `src/bridge/index.ts`

**New Utility:**
- Location: `packages/components/src/lib/[name].ts`
- Export in `src/lib/utils.ts` or `src/lib/[name].ts`

**New App Bundle:**
- Create: `packages/components/src/apps/[app-name]-cdn.tsx`
- Wire: Bridge + ThemeProvider + main component
- Create HTML: `packages/components/src/apps/[app-name]-cdn.html` (template, build generates output)
- Register in: `server/src/resources/ui.py` UI_APPS registry

**Server Tool:**
- Location: `server/src/tools/[toolname].py`
- Pattern: Async function that handles tool call, returns formatted result
- Register in: `server/src/main.py` list_tools() and call_tool()

**Tests:**
- Co-located in `__tests__/` directory within component folder
- Three-part structure: unit tests, a11y tests (axe-core), integration tests (bridge mocks)
- Example: `packages/components/src/components/sql-editor/__tests__/`

## Special Directories

**packages/components/dist/**
- Purpose: Build output
- Generated: Yes (pnpm build)
- Committed: No (in .gitignore)
- Contains:
  - `index.js`, `index.mjs`, `src/index.d.ts` - Library build outputs
  - `apps/` - Built HTML app bundles
  - `http/` - HTTP-served assets

**packages/components/src/apps/**
- Purpose: MCP Apps entry points
- Generated: No (source files)
- Committed: Yes (these are the entry points for app builds)
- Pattern: One TSX file per app; builds to corresponding single-file HTML

**.claude/agents/**
- Purpose: Review agents for UX, Engineering, Testing phases
- Committed: Yes
- Used by: GSD review phase workflow

**.planning/codebase/**
- Purpose: Codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: By GSD map-codebase command
- Committed: Yes (tracked for history)

---

*Structure analysis: 2026-02-15*
