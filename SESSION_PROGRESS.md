# Session Progress - SurfacesUI Component Library

## Status: In Progress (Foundation Complete, Component Extraction Pending)

## What This Project Is

A standalone repo that extracts reusable React components from `canvas-ai-compute-studio` and serves them as pre-built HTML bundles via a FastMCP Python server using the MCP-UI Apps protocol. Components communicate with the server via MCP tool calls (postMessage bridge), not REST APIs.

## Full Plan

The complete implementation plan is at:
**`$HOME/.claude/plans/pure-stirring-whisper.md`**

This plan covers:
- Architecture (repo structure, component list, data flow)
- Phase 1: Foundation (theme, bridge, primitives, analytics)
- Phase 2: Component extraction (9 components, ordered by coupling)
- Phase 3: FastMCP Python server
- Phase 4: Build configuration
- Phase 5: Quality agent pipeline (UX, Engineering, Testing agents)

## Completed (Tasks #1-5, #17)

### Repo scaffolding
- `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierrc`
- `packages/components/package.json`, `tsconfig.json`, `vite.config.ts`, `vite.config.apps.ts`
- `postcss.config.js`, `vitest.config.ts`, `tailwind.config.ts`
- `CLAUDE.md` (session instructions for the new repo)

### Theme system (3 files)
- `src/theme/tokens.css` - CSS custom properties (light/dark), WCAG utility classes
- `src/theme/tailwind-preset.ts` - Tailwind preset with Covalent brand palette
- `src/theme/ThemeProvider.tsx` - React context, dark mode toggle, system preference

### MCP Bridge (5 files)
- `src/bridge/types.ts` - McpToolResult, PageResult, McpRenderData, McpBridgeConfig
- `src/bridge/McpBridge.ts` - Core bridge class (postMessage, tool calls, pagination, streaming)
- `src/bridge/McpBridgeProvider.tsx` - React context provider
- `src/bridge/hooks.ts` - useMcpTool, useMcpPagination, useMcpStream
- `src/bridge/index.ts` - Barrel exports

### shadcn/ui primitives (14 files)
- `src/lib/utils.ts` - cn() utility
- `src/primitives/` - button, card, badge, dialog, scroll-area, tabs, label, input, separator, alert, select, tooltip, textarea

### Analytics
- `src/lib/analytics.ts` - AnalyticsProvider, useAnalytics hook

### CI Pipeline
- `.github/workflows/component-quality.yml` - Build, test, lint, a11y, bundle size checks

### Barrel exports
- `src/index.ts` - All public exports

### Test setup
- `src/test/setup.ts` - Testing Library + jest-dom

## NOT Completed (Hit Rate Limits)

### Task #6: Agent configs (.claude/agents/)
Need to create 3 files with full review checklists:
- `.claude/agents/ux-reviewer.md` - WCAG AA 2.2, Teradata UX principles, atomic design
- `.claude/agents/engineering-reviewer.md` - TypeScript strict, MCP correctness, perf, security
- `.claude/agents/test-writer.md` - 80% coverage, axe-core, bridge mocks, theme tests

Full content specs are in the plan file (Phase 5, sections 5.2-5.4).

### Task #16: FastMCP Python server
Need to create the entire `server/` directory:
- `server/pyproject.toml`, `server/requirements.txt`
- `server/src/main.py` - FastMCP entry point
- `server/src/tools/sql_tools.py` - execute_sql, fetch_results_page, generate_sql, etc.
- `server/src/tools/file_tools.py` - list_files, create_folder, upload_file, etc.
- `server/src/tools/agent_tools.py` - list_agents, get_agent, run_agent, etc.
- `server/src/tools/data_tools.py` - list_databases, list_tables, send_message, etc.
- `server/src/services/teradata.py` - TeradataService class
- `server/src/services/agents.py` - AgentsService class
- `server/src/resources/widgets.py` - UI resource registration

Full content specs are in the plan file (Phase 3).

### Tasks #7-9: First 3 component extractions
These need to be extracted from canvas-ai-compute-studio:

**#7 NavigationRail** (simplest, 94 lines)
- Source: `canvas-ai-compute-studio/frontend/src/components/sidebar/NavigationRail.tsx`
- Target: `src/components/navigation-rail/`
- Key changes: Replace usePendo with useAnalytics, use semantic tokens

**#8 SQLAITrigger** (84 lines)
- Source: `canvas-ai-compute-studio/frontend/src/components/notebook/SQLAITrigger.tsx`
- Target: `src/components/sql-ai-trigger/`
- Key changes: Configurable icon/brandName props, replace TerryIcon

**#9 ChatWelcome** (308 lines)
- Source: `canvas-ai-compute-studio/frontend/src/components/ChatWelcome.tsx`
- Target: `src/components/chat-welcome/`
- Key changes: Replace localStorage with props, configurable suggestions

### Tasks #10-15: Remaining component extractions

**#10 TerryChatPanel** (480 lines, LOW-MODERATE coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/TerryChatPanel.tsx`
- Also extract: ChatMessages, ChatInput sub-components
- Replace API calls with MCP bridge streaming

**#11 FileBrowser** (782 lines, MODERATE coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/sidebar/FileBrowser.tsx`
- Replace REST file CRUD with MCP tool calls

**#12 AgentsPanel** (364 lines, MODERATE coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/sidebar/AgentsPanel.tsx`
- Replace loomAgentsService with useMcpPagination

**#13 AgentDetailView** (751 lines, HIGH coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/agents/AgentDetailView.tsx`
- Also extract: AgentPlayground, YAMLEditor
- Replace loomAgentsService with MCP tool calls

**#14 SQLEditor** (917 lines, HIGH coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/SQLEditor.tsx`
- Also extract: MonacoCodeEditor, SQLResultsDisplay, SQLAIAssistant, PublishSQLDialog
- Replace all API calls with MCP bridge, use streaming for query execution

**#15 DataBrowserPanel** (998 lines, HIGH coupling)
- Source: `canvas-ai-compute-studio/frontend/src/components/sidebar/DataBrowserPanel.tsx`
- Also extract: ConnectionSelector, SchemaViewerModal, TableContextMenu
- Replace database/connection APIs with MCP tools

## How to Resume

1. Open a new Claude Code session in `$HOME/repos/surfaces-ui`
2. The CLAUDE.md in that repo has all project conventions
3. The full plan is at `$HOME/.claude/plans/pure-stirring-whisper.md`
4. Start with the incomplete tasks listed above (agent configs, server, component extractions)
5. Each component must go through the quality gate: UX review -> Engineering review -> Testing -> Approval
6. Nothing ships with P0 or P1 findings

## Key Reference Files

| What | Where |
|------|-------|
| Full plan | `$HOME/.claude/plans/pure-stirring-whisper.md` |
| New repo CLAUDE.md | `$HOME/repos/surfaces-ui/CLAUDE.md` |
| Source components | `$HOME/repos/canvas-ai-compute-studio/frontend/src/components/` |
| Source services | `$HOME/repos/canvas-ai-compute-studio/frontend/src/services/` |
| Source CSS tokens | `$HOME/repos/canvas-ai-compute-studio/frontend/src/index.css` |
| MCP-UI reference | `$HOME/repos/mcp-ui/` |
| MCP Apps adapter | `$HOME/repos/mcp-ui/sdks/typescript/server/src/adapters/mcp-apps/` |
| MCP Apps example | `$HOME/repos/mcp-ui/examples/mcp-apps-demo/src/index.ts` |

## Dependencies Not Yet Installed

Run `pnpm install` in the repo root after resuming. The packages are defined in `packages/components/package.json` but haven't been installed yet since `pnpm install` wasn't run.
