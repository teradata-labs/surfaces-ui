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

### Active

<!-- v1: Prove the NL-driven paradigm with SQL results pattern -->

**json-render Integration:**
- [ ] json-render packages installed and configured
- [ ] Catalog defined for SurfacesUI components
- [ ] Registry mapping catalog to React components
- [ ] Renderer integrated with MCP Bridge
- [ ] Streaming support for progressive UI generation

**SQL Results Decomposition:**
- [ ] Chart primitive (standalone ECharts wrapper, 100K+ row support)
- [ ] DataTable primitive (virtual scrolling for large datasets)
- [ ] Filter primitive (column search/filter)
- [ ] DensityToggle primitive (compact/comfortable/spacious modes)
- [ ] ViewModeToggle primitive (table/chart/both)
- [ ] TableWithFilters molecule (table + filter composed)
- [ ] ChartWithControls molecule (chart + axis configuration)
- [ ] SQLResultsDisplay organism (full SQL results with all features)

**Catalog Definitions:**
- [ ] Each primitive has json-render catalog entry with Zod schema
- [ ] Props designed for NL describability ("what can AI generate?")
- [ ] Pattern catalog with semantic names (MetricCard, DataTable, etc.)
- [ ] Action system integrated with MCP tool calls

**Covalent Design Tokens:**
- [ ] Covalent tokens (@covalent/tokens@11.7.0) as foundation
- [ ] Token-to-Tailwind config mapping
- [ ] Density variants (compact/comfortable/spacious) with token scaling
- [ ] Dark/light theme support from Covalent base
- [ ] Dynamic theme switching in json-render renderer

**NL Generation:**
- [ ] MCP tool for UI generation endpoint
- [ ] Catalog prompt generation (describe components to AI)
- [ ] Example prompts documented for each primitive
- [ ] End-to-end flow: prompt → spec → rendered UI

**MCP Apps Deployment:**
- [ ] json-render app entry point (standalone HTML)
- [ ] UI generation interface (prompt input → result display)
- [ ] State persistence (generated UIs saved/loaded)
- [ ] Bundle size <500KB gzipped verified

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
- Brownfield codebase with existing SQLEditor, MCP Bridge, theme system
- Codebase mapped (`.planning/codebase/` documents available)
- 7 documents: STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS
- Key concern: SQLResultsDisplay is 1772 lines (exceeds 400-line limit) - needs decomposition

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
| json-render over custom DSL | Proven framework from Vercel, cross-platform (React/React Native), no RSC dependency | — Pending |
| SQL results as v1 scope | Smallest proof of concept, already have SQLEditor, validates full stack | — Pending |
| Covalent tokens as foundation | Design system north star, allows evolution without code changes | — Pending |
| MCP Apps deployment only for v1 | Simplest surface, already proven with existing SQLEditor app | — Pending |
| Decompose before adding NL | Component API must be NL-describable, retrofit is harder than design-for-NL-first | — Pending |
| Catalog and component evolve together | Avoid "component works but can't describe it to AI" problem | — Pending |
| "Usable" not "perfect" for v1 | Prove paradigm shift first, polish later once validated | — Pending |

---
*Last updated: 2026-02-15 after initialization*
