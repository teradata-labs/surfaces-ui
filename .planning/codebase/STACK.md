# Technology Stack

**Analysis Date:** 2026-02-15

## Languages

**Primary:**
- TypeScript 5.0+ - React component library and type-safe development
- Python 3.11+ - FastMCP server backend for component delivery

**Secondary:**
- JavaScript (JSX) - React component development
- CSS - Tailwind-based styling and custom CSS properties

## Runtime

**Frontend Environment:**
- Node.js 18+ (per `package.json` engines)
- Browser (React 18/19)

**Backend Environment:**
- Python 3.11+
- Async runtime via `asyncio` (Python standard library)

**Package Manager:**
- pnpm 10.11.0 - Primary monorepo package manager (workspace in root)
- pip/uv - Python dependency management

## Frameworks

**Frontend Core:**
- React 18.3.1 - UI component library (peer dependency)
- Vite 5.0+ - Build tool and development server
- TypeScript 5.0+ - Type checking and compilation
- Tailwind CSS 3.4.0 - Utility-first styling
- Class Variance Authority (CVA) 0.7.0 - Component variant management

**Frontend UI Libraries:**
- @radix-ui components (dialogs, labels, scroll-area, select, separator, tabs, tooltip) - Headless, accessible primitives
- Lucide React 0.460.0 - Icon library
- ECharts 5.5.0 - Charting and visualization
- CodeMirror 6.39.13 + @uiw/react-codemirror 4.25.4 - Code editor
- Prism.js 1.30.0 - Syntax highlighting
- React Simple Code Editor 0.14.1 - Lightweight code editing

**Testing:**
- Vitest 1.0+ - Unit/integration testing framework
- Testing Library (@testing-library/react 14.0, @testing-library/jest-dom 6.0) - Component testing utilities
- jest-axe 10.0.0 - Accessibility testing
- axe-core 4.10.0 - A11y violation detection

**Build & Dev Tools:**
- Vite plugin suite:
  - @vitejs/plugin-react-swc 3.0+ - SWC-based React fast refresh
  - vite-plugin-dts 3.6+ - TypeScript declaration file generation
  - vite-plugin-singlefile 2.3.0/0.13.5 - Single-file HTML bundle output
- Prettier 3.7.0 - Code formatting
- prettier-plugin-tailwindcss 0.7.0 - Tailwind class sorting
- ESLint - Code linting (configured but config file not detected in root)
- Rimraf 6.0.1 - Cross-platform file deletion

**Backend Framework:**
- FastMCP via Python `mcp` package 1.0+ - MCP server implementation
- aiohttp 3.9+ - Async HTTP server for serving UI apps
- httpx 0.25+ - Async HTTP client for proxying to vantage-mcp

## Key Dependencies

**Critical (Direct Usage):**
- `@modelcontextprotocol/ext-apps` 1.0.1 - MCP Apps protocol for UI resource serving
- `mcp` 1.0+ - Model Context Protocol SDK
- `pydantic` 2.0+ - Python data validation (FastMCP dependency)
- `aiohttp` 3.9+ - Async HTTP server core
- `httpx` 0.25+ - Async HTTP client for backend proxying
- `tailwind-merge` 2.6.0 - Merge conflicting Tailwind classes
- `clsx` 2.1.0 - Conditional className utility

**Styling & Theming:**
- `tailwindcss` 3.4.0 - CSS framework
- `tailwindcss-animate` 1.0.7 - Animation utilities
- `@tailwindcss/typography` 0.5.19 - Typography plugin
- `autoprefixer` 10.4+ - CSS vendor prefix addition
- `postcss` 8.4+ - CSS transformation

## Configuration Files

**Frontend Config:**
- `packages/components/tsconfig.json` - TypeScript config (ES2022 target, JSX React)
- `packages/components/vite.config.ts` - Library build config
- `packages/components/vite.config.apps.ts` - HTML app bundle config (single-file output)
- `packages/components/vite.config.http.ts` - HTTP server config
- `packages/components/vitest.config.ts` - Test runner config (jsdom environment, 80% coverage thresholds)
- `.prettierrc` - Prettier formatting rules (semi, singleQuote, trailingComma, tailwindcss plugin)
- `pnpm-workspace.yaml` - Monorepo workspace configuration

**Backend Config:**
- `server/pyproject.toml` - Python project metadata and dependencies (hatchling build)
- `server/requirements.txt` - Python dependency list (simplified)
- `server/.env.example` - Environment variable template (no actual secrets stored)

## Environment Configuration

**Frontend:**
- No environment file required for build
- Runtime uses MCP Bridge postMessage for data communication (no REST endpoints)

**Backend (.env required for server/):**
- `TD_USER`, `TD_PASSWORD`, `TD_HOST` - Teradata connection credentials
- `TD_LOGMECH` - Teradata logon mechanism (optional, default: TD2)
- `HTTP_PORT` - Server port (default: 3000)
- `MOCK_MODE` - Enable mock SQL results (default: true)
- `VANTAGE_MCP_MODE` - Communication mode with vantage-mcp ("stdio" or "http")
- `VANTAGE_MCP_BINARY` - Path to vantage-mcp binary (stdio mode)
- `VANTAGE_MCP_ADDR` - HTTP endpoint for vantage-mcp (http mode)
- `LOG_LEVEL` - Logging verbosity (default: info)
- `HTTP_ONLY` - Run HTTP server without MCP stdio (default: false)

## Build Output

**Frontend Library:**
- ES Module: `dist/index.mjs`
- CommonJS: `dist/index.js`
- TypeScript declarations: `dist/src/index.d.ts`
- CSS tokens: `src/theme/tokens.css` (exported)
- Tailwind preset: `src/theme/tailwind-preset.ts` (exported)

**Frontend Apps (Single-file bundles):**
- `dist/apps/sql-editor.html` - Self-contained HTML bundle with inline CSS/JS
- Generated via `vite build --config vite.config.apps.ts`

**Backend:**
- FastMCP server runs directly from `src/main.py`
- HTTP server on configured port for HTML app serving
- MCP stdio for tool/resource protocol

## Platform Requirements

**Development:**
- Node 18+
- Python 3.11+
- pnpm 10.11.0
- Any modern OS (macOS, Linux, Windows via WSL)

**Production:**
- Node 18+ for frontend consumers
- Python 3.11+ for FastMCP server
- Browser support: Modern browsers (React 18 requirements)
- MCP-compatible host environment (Claude, other MCP clients)

## Code Organization

**Frontend (Monorepo):**
```
packages/components/
├── src/
│   ├── bridge/          # MCP Bridge implementation
│   ├── components/      # React component library
│   ├── primitives/      # Radix UI wrapper primitives
│   ├── theme/           # CSS tokens and Tailwind preset
│   ├── lib/             # Utilities (cn, analytics)
│   ├── apps/            # Standalone app entry points
│   └── test/            # Test setup and fixtures
├── dist/                # Built output (gitignored)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

**Backend:**
```
server/
├── src/
│   ├── main.py          # FastMCP server and HTTP routes
│   ├── tools/           # MCP tool implementations (SQL execution)
│   └── resources/       # MCP resource handlers (UI apps)
├── tests/               # pytest test suite
├── pyproject.toml
├── requirements.txt
└── .env.example
```

---

*Stack analysis: 2026-02-15*
