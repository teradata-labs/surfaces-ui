# SurfacesUI - Session Instructions for Claude

## Project Overview

Reusable React component library served as pre-built HTML bundles via a FastMCP Python server using the MCP-UI Apps protocol. Components are extracted from `canvas-ai-compute-studio` and decoupled from its backend.

## Architecture

- **packages/components/** - React component library (Vite + TypeScript + Tailwind)
- **server/** - FastMCP Python server that serves components as MCP UI resources
- **.claude/agents/** - UX, Engineering, and Testing review agents

## Key Patterns

### MCP Bridge (NOT direct API calls)
Components NEVER call REST APIs directly. All data flows through the MCP Bridge:
```tsx
// CORRECT
const { data, loading } = useMcpTool('execute_sql', { query, connectionId });

// WRONG - never do this
const response = await fetch('/api/v1/query', ...);
```

### Theming
- All colors via CSS custom properties (`--background`, `--foreground`, etc.)
- NEVER hardcode colors. Use Tailwind semantic tokens or CSS vars.
- Dark mode via `class` strategy on document root
- WCAG utility classes: `text-error-accessible`, `text-warning-accessible`, etc.

### Analytics
- Optional via `useAnalytics()` hook
- Returns null if no provider configured
- Always use optional chaining: `analytics?.trackEvent('name')`

### Branding
- No hardcoded Teradata/Terry references in components
- Branding elements (icons, names) are configurable via props/slots
- Teradata theme is a preset consumers can opt into

## Quality Gates

**Nothing ships with open P0 or P1 issues.**

| Severity | Definition | Blocks? |
|----------|-----------|---------|
| P0 | Crash, data loss, security, complete feature failure | YES |
| P1 | Major feature broken (no workaround), WCAG failure, broken MCP comms | YES |
| P2 | Degraded feature (workaround exists), minor styling | No |
| P3 | Cosmetic, polish, code style | No |

### Review Pipeline
Every component must pass all 3 agents:
1. **UX Agent** - WCAG AA 2.2, Teradata UX principles, atomic design (<400 lines)
2. **Engineering Agent** - Strict TypeScript, MCP correctness, perf, security, <500KB bundle
3. **Testing Agent** - 80% coverage, axe-core, bridge mocks, theme tests

## Component Size Rules (Atomic Design)

- **Atoms** (<50 lines): Buttons, icons, badges, inputs
- **Molecules** (50-150 lines): Search bars, form groups, status indicators
- **Organisms** (150-400 lines): Panels, editors, browsers
- **>400 lines**: MUST be decomposed with specific split recommendations

## Commands

```bash
# Development
pnpm install
pnpm dev

# Build
pnpm build                    # Library build
pnpm --filter @surfacesui/components build:apps  # HTML app bundles

# Test
pnpm test
pnpm --filter @surfacesui/components test:coverage

# Python server
cd server && pip install -r requirements.txt
python -m src.main
```

## File Structure Convention

Each component lives in its own directory with co-located tests:
```
src/components/[name]/
├── index.ts                       # Barrel export
├── [Name].tsx                     # Main component
├── [SubComponent].tsx             # Sub-components
├── [Name].test.tsx                # Unit tests
├── [Name].a11y.test.tsx           # Accessibility tests
├── [Name].integration.test.tsx    # Bridge integration tests
├── types.ts                       # Component-specific types
└── hooks.ts                       # Component-specific hooks
```

## Never Forget

- Components communicate via MCP Bridge, not REST
- All styling through CSS custom properties + Tailwind tokens
- 400-line component limit enforced by all agents
- 80% test coverage minimum
- axe-core 0 violations required
- Bundle size <500KB gzipped per HTML app
- Branding is always configurable, never hardcoded
