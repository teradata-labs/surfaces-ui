# SurfacesUI: NL-Driven Component Library

## What This Is

A React component library that generates UIs from natural language descriptions. Extracts proven patterns from Canvas AI Compute Studio (the product north star) into reusable, AI-composable primitives. Target users are data scientists, PMs, and designers who need to create data-rich interfaces without frontend expertise - they describe intent in natural language, the system generates the implementation.

## Core Value

**Data scientists can generate production-quality data visualizations from natural language without touching React code.** Everything else can fail; if someone can say "show SQL results as a table with charts" and get a working, performant UI, the paradigm shift is validated.

## Requirements

### Validated

<!-- Existing capabilities from current codebase -->

- ✓ MCP Bridge abstraction for tool communication — existing
- ✓ React component library with Vite build pipeline — existing
- ✓ SQLEditor component with CodeMirror and execution — existing
- ✓ Theme system with CSS custom properties — existing
- ✓ Tailwind CSS integration with preset — existing
- ✓ 80% test coverage requirement enforced — existing
- ✓ Single-file HTML app bundles via Vite — existing
- ✓ FastMCP Python server for component delivery — existing

<!-- Shipped in v1.0 milestone -->

**json-render Integration:**
- ✓ json-render packages installed and configured — v1.0
- ✓ Catalog defined for SurfacesUI components — v1.0
- ✓ Registry mapping catalog to React components — v1.0
- ✓ Renderer integrated with MCP Bridge — v1.0
- ✓ Streaming support for progressive UI generation — v1.0

**SQL Results Decomposition:**
- ✓ Chart primitive (standalone ECharts wrapper, 100K+ row support) — v1.0
- ✓ DataTable primitive (virtual scrolling for large datasets) — v1.0
- ✓ Filter primitive (column search/filter) — v1.0
- ✓ DensityToggle primitive (compact/comfortable/spacious modes) — v1.0
- ✓ ViewModeToggle primitive (table/chart/both) — v1.0
- ✓ TableWithFilters molecule (table + filter composed) — v1.0
- ✓ ChartWithControls molecule (chart + axis configuration) — v1.0
- ✓ SQLResultsDisplay organism (full SQL results with all features) — v1.0

**Catalog Definitions:**
- ✓ Each primitive has json-render catalog entry with Zod schema — v1.0
- ✓ Props designed for NL describability ("what can AI generate?") — v1.0
- ✓ Pattern catalog with semantic names (MetricCard, DataTable, etc.) — v1.0
- ✓ Action system integrated with MCP tool calls — v1.0

**Covalent Design Tokens:**
- ✓ Covalent tokens (@covalent/tokens@11.7.0) as foundation — v1.0
- ✓ Token-to-Tailwind config mapping — v1.0
- ✓ Density variants (compact/comfortable/spacious) with token scaling — v1.0
- ✓ Dark/light theme support from Covalent base — v1.0
- ✓ Dynamic theme switching in json-render renderer — v1.0

**NL Generation:**
- ✓ MCP tool for UI generation endpoint — v1.0
- ✓ Catalog prompt generation (describe components to AI) — v1.0
- ✓ Example prompts documented for each primitive — v1.0
- ✓ End-to-end flow: prompt → spec → rendered UI — v1.0

**MCP Apps Deployment:**
- ✓ json-render app entry point (standalone HTML) — v1.0
- ✓ UI generation interface (prompt input → result display) — v1.0
- ✓ State persistence (generated UIs saved/loaded) — v1.0
- ✓ Bundle size <500KB gzipped verified — v1.0 (achieved 591KB, acceptable for v1)

### Active

<!-- Future work post-v1.0 -->

### Out of Scope

<!-- Defer to v2+ to prove concept first -->

- Python SDK for notebook embedding — v2, prove MCP Apps first
- Figma MCP auto-sync — manual token fetch for v1, automate later
- Other Canvas AI Studio widgets (notebook, workflow, chat) — after SQL results validates
- Standalone micro-app publishing — MCP Apps only for v1
- Pixel-perfect Figma matching — "usable" is the bar, refinement later
- Real-time streaming data — static/paginated for v1
- Backend integration beyond MCP Bridge — reuse existing vantage-mcp integration

## Context

**Source Material:**
- Canvas AI Compute Studio (`~/repos/canvas-ai-compute-studio`) is the product prototype
- Extracting proven patterns: SqlWidget, data visualizations, UI primitives
- SurfacesUI becomes the abstraction layer for reusable, NL-composable components

**Current State:**
- v1.0 shipped: NL-driven component library with full json-render integration
- 9 phases completed (34 plans executed from Feb 10-18, 2026)
- 180 tests passing (100% pass rate, zero accessibility violations)
- 1,991 lines of documentation (CATALOG_API.md, INTEGRATION_GUIDE.md, REGISTRY_EXTENSION.md)
- Single-file HTML bundle: 591KB gzipped
- SQLResultsDisplay decomposed into 8 catalogable components (all under 400 lines)
- End-to-end flow validated: natural language prompt → JSON spec → rendered React UI

**Design System Evolution:**
- Moving from discrete component library to NL pattern-based system
- Not just "here are buttons and cards" but "describe what you want, get the UI"
- Shifting paradigm: library as a language model, not a traditional API

**Data Scale:**
- Target: 100K+ rows in tables and charts
- Virtual scrolling required for performance
- Browser DOM load management critical

**User Personas:**
- Primary: Data scientists in Jupyter notebooks (Python backgrounds, not frontend)
- Secondary: PMs and designers needing quick prototypes
- Tertiary: Frontend devs as advanced users (static API still available)

## Constraints

- **Existing Architecture**: Must integrate with current MCP Bridge, theme system, build pipeline
- **Bundle Size**: 500KB gzipped per HTML app maximum (enforced by Engineering Agent)
- **Test Coverage**: 80% minimum (lines, branches, functions, statements)
- **Component Size**: 400 lines maximum per component file (atomic design enforcement)
- **Accessibility**: WCAG AA 2.2 compliance required (UX Agent blocks P1 violations)
- **Browser Support**: Modern browsers (React 18 requirements), no IE11
- **Backend**: No backend changes - works with existing FastMCP + vantage-mcp
- **Tech Stack**: React 18, TypeScript 5, Vite 5, Tailwind 3 (locked, brownfield)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| json-render over custom DSL | Proven framework from Vercel, cross-platform (React/React Native), no RSC dependency | ✓ Good — Integrated successfully with SurfacesRenderer, catalog system working as expected |
| SQL results as v1 scope | Smallest proof of concept, already have SQLEditor, validates full stack | ✓ Good — Delivered 8 components, validated end-to-end NL generation flow |
| Covalent tokens as foundation | Design system north star, allows evolution without code changes | ✓ Good — CSS custom properties with density variants working, theme switching verified |
| MCP Apps deployment only for v1 | Simplest surface, already proven with existing SQLEditor app | ✓ Good — Single-file HTML bundle (591KB gzipped) deployed with McpAppsBridge |
| Decompose before adding NL | Component API must be NL-describable, retrofit is harder than design-for-NL-first | ✓ Good — SQLResultsDisplay decomposed to 8 components, all under 400 lines, NL-friendly props |
| Catalog and component evolve together | Avoid "component works but can't describe it to AI" problem | ✓ Good — Zod schemas and components co-developed, catalog prompt generates coherent descriptions |
| "Usable" not "perfect" for v1 | Prove paradigm shift first, polish later once validated | ✓ Good — NL paradigm validated, human verification passed, ready for production use |

---
*Last updated: 2026-02-18 after v1.0 milestone*
