# Project Research Summary

**Project:** SurfacesUI json-render Integration
**Domain:** Natural Language-Driven React Component Library
**Researched:** 2026-02-15
**Confidence:** HIGH

## Executive Summary

json-render integration transforms SurfacesUI from a static component library into an AI-driven, declarative UI generation system. Research reveals this requires a three-layer architecture: catalog (Zod schemas defining AI-visible component APIs), registry (mapping catalog to React components), and renderer (transforming JSON specs into React trees). The core insight is that NL-driven systems fundamentally differ from static libraries in requiring catalog-based security constraints, real-time iterative refinement, and performance-first architecture for 100K+ row datasets.

The recommended approach is additive and preserves SurfacesUI's existing strengths: MCP Bridge for tool calls, CSS custom properties for theming, and Vite build pipeline. Critical additions are @json-render/core + @json-render/react for the rendering engine, Zod 4.x for catalog schemas, and @tanstack/react-virtual for large dataset virtualization. The existing zero-runtime styling approach (Tailwind + CSS vars) must be preserved - adding runtime CSS engines would break the 500KB bundle limit and destroy performance.

Key risks center on schema complexity (overly complex catalogs cause AI generation failures 40-60% of the time), validation performance (Zod validation at render time can add 100-500ms), and state synchronization between json-render specs and MCP Bridge tool calls. These are mitigable through disciplined catalog design (5-8 props max, semantic patterns not raw props), validation caching, and a clear registry abstraction layer that bridges emit() actions to useMcpTool hooks.

## Key Findings

### Recommended Stack

The stack addition is minimal and focused. SurfacesUI's existing React 18 + TypeScript 5 + Vite 5 foundation is compatible. Research identified three required packages and one critical decision point around styling.

**Core technologies:**
- **@json-render/core + @json-render/react** (v0.5.x+): Guardrailed AI UI generation with catalog-based security, streaming support, and framework-agnostic core. Adds ~20KB gzipped. Prevents code injection by constraining AI to pre-approved component catalog.
- **Zod** (v4.3.6): TypeScript-first schema validation required by json-render. Provides runtime validation + type inference for catalog definitions. Adds ~15KB gzipped. v4 is 7x faster than v3, critical for performance.
- **@tanstack/react-virtual** (v3.13.18): Headless virtualization for 100K+ row datasets. Headless design provides full styling control, essential for Tailwind integration. Adds ~12KB gzipped. 60FPS scrolling validated in production.

**Critical decision - styling strategy:**
NO runtime CSS engines (UnoCSS, styled-components, emotion). SurfacesUI already uses CSS custom properties for theming. json-render catalogs reference these via enum props (variant: z.enum(['default', 'destructive'])). Runtime CSS would add 50-80KB and break the 500KB limit. Predefined variants cover all V1 use cases (SQL results: Chart, DataTable, Filter).

**Total bundle impact:** ~50KB gzipped (within 500KB limit).

### Expected Features

NL-driven component generation differs from static libraries in three fundamental ways: declarative intent vs imperative code, catalog-based security vs open-ended generation, and real-time iterative refinement vs one-shot outputs. Data scientists expect high-density information visualization with user-adjustable density, not marketing layouts.

**Must have (table stakes):**
- **Declarative Component Catalog** - Pre-approved component registry with JSON schema. Security foundation that prevents code injection and enables whitelisting. AI can only reference catalog components.
- **Real-Time Preview** - Live rendering as generation happens. Users need immediate visual feedback, not wait-and-reveal patterns. Streaming updates critical for UX.
- **Iterative Refinement** - Conversation history + context preservation. Single-shot generation rarely succeeds (LLMs have 8.2% hallucination rate). Users expect "then make X compact" follow-ups.
- **Large Dataset Support (100K+ rows)** - Data scientists work with real datasets, not toy examples. Requires virtualization (TanStack Virtual) and server-side pagination. Non-negotiable for credibility.
- **User-Adjustable Density** - compact/comfortable/spacious modes. Critical for data-heavy UIs. Simple CSS custom properties implementation.
- **Theme Integration** - Components must respect Covalent design tokens. No hardcoded colors. Design token mapping from NL intent to theme variables.
- **Error Recovery** - LLMs hallucinate. System must validate before render: verify component IDs exist in catalog, reject unknown types, provide fallback UI.

**Should have (competitive):**
- **Progressive Disclosure** - Reveals complexity only when needed. Reduces cognitive load for data scientists. 2026 UX trend.
- **Explainability on Demand** - "Why did you generate this UI?" Builds trust through transparency. EU AI Act requires this by Aug 2026.
- **Data-Driven Defaults** - Analyze dataset, recommend visualization automatically (time series → line chart). Reduces NL specification burden.
- **Granular Control Post-Generation** - Select element, describe change without regenerating entire UI. Motiff AI pattern.

**Defer (v2+):**
- **Multi-Modal Input** - Combine NL text with screenshots. High complexity, text-only sufficient for V1.
- **Version History & Rollback** - Important for production but not MVP validation. Can iterate without this initially.
- **Component Learning System** - Learns user preferences over time. Requires usage data, premature for V1.
- **Cross-Platform Consistency** - A2UI promise (React, Flutter, SwiftUI). SurfacesUI targets web-first MCP Apps.

**Anti-features (explicitly avoid):**
- **Full UI Code Generation** (JSX/HTML output) - Security risk (code injection, XSS). Use declarative JSON only.
- **Unlimited Component Flexibility** - "Generate any UI" leads to hallucinations and security holes. Fixed catalog with finite building blocks.
- **Black Box Generation** - "AI magic" destroys trust. Always provide reasoning: "I chose table because you said 'show all rows'."
- **Automatic Code Push** - Generated code needs review before merge. Preview + manual approval only.

### Architecture Approach

The architecture is a three-layer declarative generative UI system that preserves SurfacesUI's existing patterns. Catalog layer (framework-agnostic, @json-render/core) defines AI-describable component schemas using Zod. Registry layer (custom) maps catalog definitions to existing React components and bridges json-render's emit() system to SurfacesUI's MCP Bridge pattern. Renderer layer (@json-render/react) transforms flat JSON specs into React trees with visibility evaluation and dynamic prop resolution.

**Major components:**
1. **Catalog Module** (src/json-render/catalog.ts) - Defines what AI can generate using defineCatalog(). One Zod schema per SurfacesUI component. Action definitions for MCP Bridge tool calls. Rich descriptions guide AI generation.
2. **Registry Module** (src/json-render/registry.ts) - Implements defineRegistry() to map catalog to React components. Wraps SurfacesUI components to handle emit() → useMcpTool bridge. Injects ThemeProvider context. Type-safe validation of catalog schemas.
3. **Renderer Wrapper** (src/json-render/Renderer.tsx) - Wraps @json-render/react Renderer with SurfacesUI context (ThemeProvider, MCP Bridge). Handles error boundaries and loading states. Manages state updates that trigger re-evaluation.
4. **MCP Bridge Integration** (src/bridge/useJsonRenderAction.ts) - New hook that bridges json-render actions to existing useMcpTool pattern. Coordinates loading states and result handling. Single source of truth for state synchronization.

**Integration touchpoints:**
- Theme System: No changes needed. Renderer wraps with ThemeProvider, components inherit CSS custom properties automatically.
- MCP Bridge: Components need action callback props (onExecute, onSave) to bridge emit() → MCP tools. Registry wraps useMcpTool hooks.
- Build Pipeline: Add dependencies to package.json, export catalog/registry/renderer from src/index.ts, create generative-ui.html app bundle.
- Analytics: Registry wrappers inject useAnalytics() to track generative UI actions.

**Key patterns:**
- **Flat Spec Structure**: root ID + elements map (not nested JSON) for performance and streaming. O(1) element lookup.
- **Visibility-First Conditionals**: Use json-render's visibility conditions ($state, $cond) rather than React conditional rendering. Declarative logic easier for AI.
- **Theme-Aware Catalog**: Enum props for variants/colors that match existing Tailwind classes. Constrains AI to valid theme values.
- **Registry as Bridge Layer**: Registry handles all translation (emit → useMcpTool), inner components stay pure without MCP awareness.

### Critical Pitfalls

Research identified 15 pitfalls across critical, moderate, and minor severity. Top 5 that could cause rewrites or major architectural debt:

1. **Schema Explosion Without Describability Strategy** - Defining comprehensive Zod schemas with 100+ props per component. AI fails to generate correct JSON 40-60% of the time because schema too complex. Prevention: 5-8 props max per component, semantic patterns not raw props, test describability ("can you explain this in one sentence?"). Detect: validation errors >10%, catalog prompts >2000 tokens per component. Must address in Phase 1 (Catalog Definition).

2. **Runtime Validation Performance Death Spiral** - Zod validation on every component render creates 100-500ms overhead with nested components. Browser freezes, memory pressure. Prevention: Validate once on spec creation (cache by hash), upgrade to Zod v4 (7x faster), split validation layers (strict during generation, minimal during render). Detect: React DevTools shows >100ms in json-render components, frame drops. Address in Phase 2 after MVP proves value.

3. **Theming System Runtime CSS Bloat** - Dynamic theme switching with runtime CSS-in-JS exceeds 500KB bundle limit, causes 200-300ms theme switch delays. Prevention: Stick with zero-runtime approach (CSS custom properties + Tailwind). SurfacesUI already has this - DO NOT break it. Predefine all theme combinations at build time. Must preserve in Phase 1 (Foundation).

4. **Action System State Synchronization Hell** - json-render actions trigger MCP tool calls but state updates don't sync back to spec state. Users see stale data, duplicate requests, race conditions. Prevention: Single source of truth (MCP Bridge state feeds spec state), registry wraps MCP hooks with state coordination, action IDs for correlation. Critical for Phase 2 (MCP Integration).

5. **Large Dataset Performance Collapse** - AI generates tables for 100K+ rows without virtualization. Browser renders all DOM nodes at once, causing 10-30 second freezes or crashes. Prevention: Catalog-level constraints (max 1000 items per array), virtualization as default (TanStack Virtual), ECharts sampling (10K point limit). Address in Phase 1 (Component Decomposition) - SQLResultsDisplay already violates this (1772 lines, no virtualization).

**Additional moderate pitfalls:**
- Component size violations break NL describability (SQLResultsDisplay 1772 lines too large to catalog effectively)
- Token cost explosion from verbose schemas (10K-20K tokens per generation)
- ECharts bundle size exceeds 500KB without modular imports
- Missing type safety across layers (catalog and component props diverge)
- Testing strategy gap (no integration tests for "AI generates → spec validates → component renders")

## Implications for Roadmap

Based on combined research, the architecture requires sequential phases due to tight coupling. Parallelization not possible - each phase depends on previous foundation being stable. Critical path flows from catalog definition through registry integration to complex components and dynamic features.

### Phase 1: Catalog Foundation & Component Decomposition
**Rationale:** Establishes type-safe catalog schemas and addresses existing component size violations before attempting integration. Cannot build registry without knowing what to map. Must decompose SQLResultsDisplay (1772 lines) before cataloging - overly large components create overly complex catalog descriptions that AI cannot generate reliably.

**Delivers:**
- Catalog schemas for 5-10 core primitives (Button, Card, Badge, StatCard, LayoutContainer)
- Type definitions inferred from Zod schemas
- SQLResultsDisplay decomposed into <400 line components (SQLTable, ChartRenderer, ResultsView)
- Validation that catalog.prompt() generates coherent system prompts
- Foundation that proves json-render integration feasibility

**Addresses:**
- Declarative Component Catalog (table stakes feature)
- Schema explosion pitfall (limit to 5-8 props per component, test describability)
- Component size violations (decompose before cataloging)
- Theme integration foundation (enum props matching Tailwind variants)

**Avoids:**
- Schema complexity causing 40-60% AI generation failures
- Breaking zero-runtime styling approach
- Cataloging components that are too large to describe effectively

**Research Flag:** Standard patterns. json-render documentation comprehensive, Zod patterns well-established. Skip deeper research.

---

### Phase 2: Registry + Renderer Integration
**Rationale:** Creates the mapping layer between abstract catalog and concrete React components. Validates that specs render correctly with theme applied before adding MCP Bridge complexity. Provides visual feedback for catalog correctness. Must work in isolation before risking existing MCP Bridge system.

**Delivers:**
- Registry implementing defineRegistry() for Phase 1 components
- Renderer wrapper with ThemeProvider integration
- Demo app (generative-ui-demo.tsx) showing static spec → rendered UI
- Proof that existing components work through registry abstraction
- Foundation for action system in Phase 3

**Uses:**
- @json-render/react Renderer component
- Existing ThemeProvider (no changes needed)
- Phase 1 catalog schemas

**Implements:**
- Real-Time Preview (table stakes feature)
- Theme-aware rendering with CSS custom properties
- Registry as bridge layer architecture pattern
- Flat spec structure (root ID + elements map)

**Avoids:**
- Runtime CSS bloat (preserves zero-runtime pattern)
- Breaking existing theme system
- Premature MCP Bridge integration

**Research Flag:** Standard patterns. Component registry patterns well-documented (shadcn, CopilotKit examples). Skip deeper research.

---

### Phase 3: Action System & MCP Bridge Integration
**Rationale:** Most complex integration point. Bridges two state management systems (json-render specs + MCP Bridge). Requires stable renderer and catalog to debug effectively. Touches existing MCP Bridge code (risk of breaking working components if done earlier). Single source of truth pattern critical for preventing state synchronization hell.

**Delivers:**
- Catalog action definitions for MCP tools (execute_sql, save_results, etc.)
- useJsonRenderAction hook (emit → useMcpTool bridge)
- Registry wrappers for MCP-aware components
- State coordination layer (MCP results → spec state updates)
- Error handling for failed actions

**Uses:**
- Phase 2 stable renderer
- Existing MCP Bridge (src/bridge/)
- useMcpTool hooks

**Implements:**
- Iterative Refinement (table stakes feature) - actions enable UI updates based on data
- Error Recovery (table stakes feature) - failed actions handled gracefully
- Registry wraps MCP hooks architecture pattern

**Avoids:**
- State synchronization hell (single source of truth)
- Action system race conditions (correlation IDs)
- Mixing MCP Bridge patterns (clear boundary in registry)

**Research Flag:** NEEDS RESEARCH. Complex integration between two systems. MCP Bridge + json-render interaction patterns not well-documented. Plan for /gsd:research-phase during roadmap creation.

---

### Phase 4: Complex Components & Large Datasets
**Rationale:** Extends catalog to organism-level components with rich interactions. SQLEditor, Charts, and SQLResultsDisplay (post-decomposition) require careful catalog design and registry wrappers. Large dataset handling is table stakes for credibility with data scientists. Easier to debug complex components after simpler ones working.

**Delivers:**
- Catalog schemas for SQLEditor, ECharts, SQLResultsDisplay
- Registry wrappers for complex components (emit → MCP Bridge)
- Virtualization integration (TanStack Virtual for 100K+ rows)
- Example specs demonstrating common patterns (dashboard, data explorer)
- ECharts bundle optimization (modular imports, <500KB)

**Uses:**
- @tanstack/react-virtual for virtualization
- Modular ECharts imports (from echarts/core)
- Phase 3 action system for data loading

**Implements:**
- Large Dataset Support (table stakes feature)
- Data-Driven Defaults (competitive feature) - analyze dataset shape, recommend visualization
- User-Adjustable Density (table stakes feature)

**Avoids:**
- Performance collapse with 100K+ rows (virtualization as default)
- ECharts bundle size violation (modular imports only)
- Complex component edge cases breaking simpler patterns

**Research Flag:** Partial research needed. Virtualization patterns well-documented, but ECharts + json-render integration may need exploration. Consider /gsd:research-phase for visualization component patterns.

---

### Phase 5: Dynamic Features & Polish
**Rationale:** Most complex feature set. Depends on all previous layers working correctly. Visibility conditions, dynamic props, and state-driven reactivity have most potential for subtle bugs. Production features (explainability, version history) require stable foundation.

**Delivers:**
- State management integration (useState → spec state)
- Visibility evaluation in renderer ($state, $cond expressions)
- Dynamic prop resolution ($cond, $state in prop values)
- Progressive disclosure patterns
- Explainability system ("Why this UI?" reasoning)
- Example specs using visibility/dynamic props

**Uses:**
- Phase 4 complex components
- json-render visibility conditions
- Spec state system ($path references)

**Implements:**
- Progressive Disclosure (competitive feature)
- Explainability on Demand (competitive feature)
- Granular Control Post-Generation (competitive feature)
- Visibility-first conditionals pattern

**Avoids:**
- Complex logic in visibility conditions (compute in registry, expose as boolean flags)
- Streaming state management complexity (stable IDs, cleanup patterns)
- Unclear failure modes (custom error messages, error boundaries)

**Research Flag:** Standard patterns. json-render visibility/dynamic features documented. Streaming patterns may need validation testing. Skip formal research, rely on documentation.

---

### Phase 6: Build Pipeline & Distribution
**Rationale:** No point optimizing build until features complete. All previous phases must be stable. Lowest risk phase (build config only, no runtime changes). Enables distribution to MCP Apps ecosystem.

**Delivers:**
- Vite config updates to export catalog/registry/renderer
- Build script: pnpm build:catalog (generates catalog.json for AI)
- MCP Apps compatible bundle (generative-ui.html)
- TypeScript type exports (dist/json-render/*.d.ts)
- Bundle size validation (<500KB gzipped)

**Uses:**
- Existing Vite build pipeline
- Phase 5 complete feature set

**Implements:**
- Distribution as consumable library
- MCP Apps integration
- Type safety for consumers

**Avoids:**
- Build optimization premature to feature completion
- Bundle size violations (verify <500KB)
- Type generation issues (validate exports)

**Research Flag:** Standard patterns. Vite library builds well-documented. Skip research.

---

### Phase Ordering Rationale

Sequential execution required due to tight coupling:
- **Catalog first**: Can't build registry without schemas. Type-safe foundation for all subsequent work. No dependencies on existing code (purely additive). Validates json-render integration feasibility before major changes.
- **Registry second**: Needs catalog schemas to map. Validates theme integration before MCP Bridge risk. Visual feedback proves catalog correctness. Touching MCP Bridge too early risks breaking existing components.
- **Actions third**: Requires stable renderer to debug state sync issues. Most complex integration point. Creates clear abstraction boundary (emit → useMcpTool) for subsequent components.
- **Complex components fourth**: SQLEditor, Charts need working action system for data loading. More edge cases, easier to debug with simpler patterns validated. Large dataset handling proves system handles real workloads.
- **Dynamic features fifth**: Visibility/state reactivity depend on all previous layers. Most subtle bugs. Production polish requires stable foundation.
- **Build pipeline last**: Features must be complete before optimizing distribution. Low-risk changes (config only). Enables ecosystem distribution.

**Dependency chain:** Phase 1 → Phase 2 (needs catalog) → Phase 3 (needs renderer) → Phase 4 (needs actions) → Phase 5 (needs complex components) → Phase 6 (needs complete features)

**Risk mitigation:**
- Phases 1-2 are experimental (no changes to existing code, can be feature-branched)
- Phase 3 touches MCP Bridge (create feature branch, extensive testing before merge)
- Phases 4-5 are iterative (can ship subset of components/features, not all-or-nothing)
- Phase 6 is low-risk (build config only, no runtime behavior changes)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Action System):** Complex integration between json-render emit() and MCP Bridge useMcpTool. State synchronization patterns between two systems not well-documented. Recommend /gsd:research-phase to explore coordination patterns, race condition handling, and error recovery strategies.
- **Phase 4 (Visualization):** ECharts + json-render catalog design may need exploration. How to describe chart configurations in NL-friendly way? Consider /gsd:research-phase for visualization component patterns if team unfamiliar with ECharts API design.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Catalog):** json-render documentation comprehensive. Zod schema patterns well-established. Atomic design decomposition principles documented.
- **Phase 2 (Registry/Renderer):** Component registry patterns documented (shadcn, CopilotKit). React context integration standard.
- **Phase 5 (Dynamic Features):** json-render visibility/dynamic features documented in official guides. Standard React patterns.
- **Phase 6 (Build):** Vite library builds well-documented. Standard tooling configuration.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core packages (@json-render, Zod, TanStack Virtual) confirmed from official docs and npm registry. Versions validated. Zero-runtime styling decision backed by bundle size analysis and project constraints. Only medium confidence on exact @json-render versions (need npm view verification during implementation). |
| Features | HIGH | Table stakes features validated across multiple sources (A2UI spec, generative UI frameworks guide, v0 case studies). User expectations for NL-driven systems well-documented. Anti-features backed by security best practices and real-world failures (v0 code generation issues). |
| Architecture | HIGH | json-render three-layer architecture documented in official guides. MCP Bridge integration patterns validated in MCP-UI docs. Component registry patterns established (shadcn, CopilotKit examples). Build order derived from dependency analysis of SurfacesUI codebase. |
| Pitfalls | HIGH | Critical pitfalls backed by official documentation (Zod performance issues, schema complexity failures, state sync patterns). SurfacesUI-specific issues verified from CONCERNS.md codebase audit (SQLResultsDisplay size, hardcoded colors, deprecated APIs). Real-world case studies (v0, Grafana performance improvements). |

**Overall confidence:** HIGH

Research synthesized from official documentation (json-render, Zod, TanStack Virtual, MCP-UI), industry case studies (Vercel v0, Grafana 12.2 performance), and codebase-specific analysis (CONCERNS.md audit, CLAUDE.md quality gates). Core architectural decisions validated across multiple independent sources.

### Gaps to Address

**During Phase 1 (Catalog Definition):**
- **SQLResultsDisplay decomposition strategy**: Component is 1772 lines. Research recommends <400 line limit for NL describability. Need to determine split points: SQLTable + ChartRenderer + ResultsView coordinator? Or different grouping? Validate decomposition preserves all functionality before cataloging.
- **Exact json-render versions**: Official docs reference 0.5.x but exact patch version not verified via npm registry search. Run `npm view @json-render/core version` and `npm view @json-render/react version` during implementation to confirm latest stable.

**During Phase 3 (MCP Integration):**
- **State synchronization patterns**: How to coordinate MCP tool responses with json-render spec state updates? Need to design coordination layer during planning. Consider /gsd:research-phase to explore race condition handling, action correlation IDs, and cleanup patterns.
- **Error propagation strategy**: When MCP tool fails, how does error surface in generated UI? Registry handles translation but error presentation patterns need design. Test with failure scenarios during phase planning.

**During Phase 4 (Complex Components):**
- **ECharts catalog design**: How to make chart configurations NL-describable? Full ECharts API is massive. Need to identify semantic patterns ("line chart with time axis") rather than raw configuration objects. Validate describability with sample prompts during planning.
- **Virtualization integration testing**: TanStack Virtual + json-render registry wrappers need validation with real 100K+ row datasets. Simulate production data volumes during testing to catch memory leaks and performance issues early.

**Cross-cutting:**
- **Token cost monitoring**: No research found on actual costs for SurfacesUI-scale catalogs (10-50 components). Set up monitoring early in Phase 1 to track per-generation costs. Anthropic prompt caching can provide 90% savings if catalog stays stable - validate this assumption.
- **Bundle size tracking**: Engineering Agent enforces <500KB gzipped. Set up CI check in Phase 1 to monitor cumulative impact of json-render + Zod + TanStack Virtual (~50KB) plus existing SQLEditor (~300KB). Red flag if approaching 450KB (buffer for future additions).

## Sources

### Primary (HIGH confidence)
- [json-render Official Documentation](https://json-render.dev/) - Core architecture, catalog/registry/renderer patterns
- [json-render GitHub Repository](https://github.com/vercel-labs/json-render) - Official examples, integration guides
- [Zod Official Documentation](https://zod.dev/) - Schema validation patterns, v4 performance improvements
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest) - Headless virtualization patterns
- [MCP-UI Custom Component Libraries](https://mcpui.dev/guide/client/custom-component-libraries) - Component library integration patterns
- [A2UI Specification v0.8](https://a2ui.org/specification/v0.8-a2ui/) - Declarative UI generation protocol
- [Google A2UI GitHub](https://github.com/google/A2UI) - Reference implementation patterns

### Secondary (MEDIUM confidence)
- [The Complete Guide to Generative UI Frameworks in 2026](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc) - Ecosystem comparison, feature landscape
- [Natural Language AI-Powered Smart UI](https://www.codemag.com/Article/2507031/Natural-Language-AI-Powered-Smart-UI) - Table stakes features, user expectations
- [CopilotKit Generative UI Guide](https://www.copilotkit.ai/generative-ui) - Architecture patterns, best practices
- [Zod vs Valibot vs ArkType 2026](https://pockit.tools/blog/zod-valibot-arktype-comparison-2026/) - Performance comparisons (Zod 40x slower than ArkType)
- [React Virtualization Showdown: TanStack vs react-window](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83) - Performance validation
- [Vercel v0 Review 2026](https://www.taskade.com/blog/v0-review) - Real-world case study, anti-patterns
- [Progressive Disclosure Matters](https://aipositive.substack.com/p/progressive-disclosure-matters) - 2026 UX trends for AI interfaces

### Tertiary (MEDIUM confidence, validated across multiple sources)
- [React & CSS in 2026: Best Styling Approaches](https://medium.com/@imranmsa93/react-css-in-2026-best-styling-approaches-compared-d5e99a771753) - Runtime CSS overhead analysis (15-45KB)
- [LLM Pricing Comparison 2026](https://www.cloudidr.com/blog/llm-pricing-comparison-2026) - Token cost data ($5/$15 per million)
- [Why is Zod so slow?](https://blog.logrocket.com/why-zod-slow/) - Validation performance pitfalls
- [Understanding LLM Hallucinations](https://kili-technology.com/blog/understanding-llm-hallucinations-and-how-to-mitigate-them) - 8.2% hallucination rate baseline
- [Explainable AI UI Design](https://www.eleken.co/blog-posts/explainable-ai-ui-design-xai) - EU AI Act transparency requirements
- [ECharts Import Guide](https://apache.github.io/echarts-handbook/en/basics/import/) - Modular import patterns, tree-shaking

**SurfacesUI Codebase Analysis:**
- CLAUDE.md - Quality gates, component size limits, MCP Bridge patterns, theming system
- CONCERNS.md - SQLResultsDisplay size violations (1772 lines), hardcoded colors, deprecated APIs
- .planning/decisions/monaco-editor.md - Existing editor strategy

---

*Research completed: 2026-02-15*
*Ready for roadmap: yes*
