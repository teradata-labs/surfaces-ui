# Domain Pitfalls: NL-Driven Component Generation

**Domain:** Natural language-driven UI generation with json-render + existing component libraries
**Researched:** 2026-02-15
**Confidence:** HIGH (official docs + real-world case studies + verified patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, performance collapse, or major architectural debt.

### Pitfall 1: Schema Explosion Without Describability Strategy

**What goes wrong:** Teams define comprehensive Zod schemas for every component prop variant, creating catalogs with 100+ props per component. AI models struggle to generate correct JSON because the schema is too complex to fit in context window or reason about reliably.

**Why it happens:**
- Starting from existing component APIs designed for developers, not AI
- "Complete coverage" mentality: exposing every prop, variant, and edge case
- Not asking "can AI describe this?" during schema design
- Retrofitting existing components without simplification

**Consequences:**
- AI generates invalid specs 40-60% of the time (requires regeneration)
- Token costs explode from verbose schemas in system prompts
- Users get frustrated with constant generation failures
- Components work perfectly in static code but fail in NL context

**Prevention:**
1. **Design catalog AND component together** - don't retrofit
2. **Start with semantic patterns**, not raw props: "MetricCard" not "Card with specific className and 12 props"
3. **Limit prop surface area**: 5-8 props per component maximum in catalog
4. **Use enums aggressively**: `variant: z.enum(['default', 'destructive'])` not `className: z.string()`
5. **Test describability early**: Can you explain this component to a human in one sentence?

**Detection:**
- Schema validation errors >10% of generation attempts
- Catalog prompt >2000 tokens per component
- AI generates correct structure but wrong semantic meaning
- Need to add 50+ examples for AI to "get it"

**Which phase:** Phase 1 (Catalog Definition). Cannot defer - wrong foundation breaks everything.

---

### Pitfall 2: Runtime Validation Performance Death Spiral

**What goes wrong:** Every AI-generated component render triggers full Zod schema validation on every prop. With nested components and complex schemas, validation overhead becomes 100-500ms per component tree, making the UI laggy or unusable.

**Why it happens:**
- json-render validates specs at render time to ensure safety
- Zod v3 is 40x slower than optimized validators like ArkType
- No caching of validation results for identical specs
- Validating entire spec tree on every state change
- 500K+ validations in production scenarios cause 2-second delays

**Consequences:**
- Initial UI generation takes 2-5 seconds (users think it failed)
- Interactions feel sluggish (200-500ms lag on clicks)
- 100K+ row data tables trigger continuous re-validation
- Memory pressure from validation object graphs
- Server OOM crashes in high-traffic scenarios

**Prevention:**
1. **Upgrade to Zod v4**: 7x faster array parsing, 57% smaller bundle
2. **Validate once on spec creation**, not every render: cache validation results by spec hash
3. **Split validation layers**:
   - Strict validation during generation (AI output)
   - Minimal validation during render (assume valid)
4. **Use discriminated unions** for complex schemas: faster type checking
5. **Consider alternatives**: ArkType (3-4x faster) or custom validators for hot paths

**Detection:**
- React DevTools Profiler shows >100ms in json-render components
- Zod appears in performance flame graphs
- Frame drops during UI updates (not hitting 60fps)
- Memory climbing during interactions

**Which phase:** Phase 2 (Performance Optimization). Can defer to after MVP but becomes P0 blocker with real data.

---

### Pitfall 3: Theming System Runtime CSS Bloat

**What goes wrong:** Dynamic theme switching in json-render generates runtime CSS for every component variant and theme combination. Bundle size explodes beyond 500KB limit, or runtime CSS injection causes layout thrashing and 200-300ms delays on theme changes.

**Consequences:**
- Bundle size exceeds 500KB gzipped (Engineering Agent blocks)
- Theme switches take 500ms-2s (users see flash of unstyled content)
- CSS-in-JS libraries add 15-45KB + runtime overhead
- Mobile performance degrades significantly
- Layout thrashing causes janky animations

**Why it happens:**
- Using runtime CSS-in-JS for theme flexibility (emotion, styled-components)
- Not leveraging CSS custom properties effectively
- Generating Tailwind classes dynamically (defeats purging)
- Sending full theme tokens to every component in catalog
- No build-time CSS generation strategy

**Prevention:**
1. **Zero-runtime approach**: Use CSS custom properties + Tailwind preset (SurfacesUI current pattern)
2. **Covalent tokens via CSS vars only**: `var(--cds-layer-01)` not runtime JS objects
3. **Predefine all theme combinations** in CSS at build time
4. **ThemeProvider strategy**: Apply theme class to root, components use vars
5. **If runtime needed**: Use compiled/linaria (<1KB) not emotion/styled-components (15KB+)
6. **No dynamic Tailwind generation**: Use fixed utility classes from preset

**Detection:**
- Bundle includes emotion/styled-components/styled-jsx
- CSS file size >100KB
- `<style>` tags injected dynamically during render
- Theme switch triggers layout reflow (DevTools Performance tab)
- Bundle size approaching or exceeding 500KB

**Which phase:** Phase 1 (Foundation). SurfacesUI already has zero-runtime pattern - DO NOT break it.

---

### Pitfall 4: Action System State Synchronization Hell

**What goes wrong:** json-render actions trigger MCP tool calls, but state updates from tools don't sync back to json-render spec state. Users see stale data, duplicate requests, or race conditions where UI shows success but data is outdated.

**Why it happens:**
- Treating json-render state and MCP Bridge state as separate systems
- No bidirectional binding between spec `$path` and MCP responses
- Async tool calls complete but spec state not updated
- Multiple components calling same tool with different state assumptions
- No coordination layer between json-render registry and MCP hooks

**Consequences:**
- SQL query executes but results don't appear in generated UI
- User clicks "Refresh" multiple times (race conditions)
- State diverges: spec says "loading=false" but MCP hook still pending
- Memory leaks from abandoned promise handlers
- Data loss when spec regenerates before tool response

**Prevention:**
1. **Single source of truth**: MCP Bridge state feeds into json-render spec state
2. **Registry wraps MCP hooks**:
   ```typescript
   SQLEditor: ({ props, emit }) => {
     const { data, loading } = useMcpTool('execute_sql', props);
     useEffect(() => {
       if (data) emit('update_state', { path: '$results', value: data });
     }, [data]);
   }
   ```
3. **Coordinated loading states**: Use spec state for UI, MCP hooks for data fetching
4. **Action IDs for correlation**: Track which action triggered which tool call
5. **Cleanup on spec changes**: Cancel pending MCP requests when spec regenerates

**Detection:**
- User reports "data doesn't update after clicking button"
- Network tab shows successful responses but UI unchanged
- Console warnings about state updates on unmounted components
- Multiple identical tool calls in quick succession
- Memory usage grows over session

**Which phase:** Phase 2 (MCP Integration). Critical for usability but can MVP without actions first.

---

### Pitfall 5: Large Dataset Performance Collapse

**What goes wrong:** AI generates tables/charts for 100K+ row datasets. Without virtualization, browser renders all 100K DOM nodes at once, causing 10-30 second freezes, memory exhaustion, or browser tab crashes.

**Why it happens:**
- Catalog allows unbounded data arrays in component props
- No virtualization strategy in registry implementations
- ECharts with full dataset (not sampling/aggregation)
- React renders full list before virtual scrolling kicks in
- AI doesn't know to request pagination/windowing

**Consequences:**
- Browser freezes for 10-30 seconds on large result sets
- Mobile devices crash entirely (memory limit)
- Users think app is broken, close tab
- 100K+ DOM nodes consume 500MB-1GB memory
- Virtual scrolling libraries have detached element memory leaks (143MB for 2000 rows)

**Prevention:**
1. **Catalog-level constraints**: `data: z.array(z.unknown()).max(1000)` forces pagination
2. **Virtualization as default**:
   - DataTable: react-window or TanStack Virtual
   - Charts: ECharts sampling (10K point limit)
3. **Progressive loading in actions**:
   ```typescript
   list_items: {
     params: z.object({
       offset: z.number(),
       limit: z.number().max(100)
     })
   }
   ```
4. **AI guidance in descriptions**: "Displays up to 1000 rows with pagination for larger datasets"
5. **Overscan tuning**: `overscanRowCount={5}` (not 50) to minimize memory
6. **Cleanup on unmount**: Ensure virtual scrollers release detached DOM elements

**Detection:**
- DevTools Performance: Long Task warnings (>50ms)
- Memory Profiler: Detached HTMLDivElements growing over time
- Browser unresponsive during initial render
- Heap snapshots show 100K+ DOM nodes
- Mobile devices crash or kill tab

**Which phase:** Phase 1 (Component Decomposition). SQLResultsDisplay already violates this (1772 lines, no virtualization).

---

## Moderate Pitfalls

Significant issues but with viable workarounds.

### Pitfall 6: Component Size Violations Break NL Describability

**What goes wrong:** Existing component like SQLResultsDisplay (1772 lines) has too many features packed together. When mapping to catalog, description becomes paragraph-length and AI can't generate it reliably.

**Why it happens:**
- Brownfield integration: existing components not designed for NL
- "Kitchen sink" components that do everything
- No atomic decomposition before cataloging
- Fear of over-fragmenting codebase

**Prevention:**
1. **Enforce 400-line limit BEFORE cataloging**
2. **One feature = one component** in catalog:
   - `<SQLTable>` with filtering/sorting
   - `<ChartRenderer>` with type/theme
   - `<ResultsView>` as coordinator
3. **Test decomposition**: Can you describe each piece in <20 words?
4. **Use composition patterns**: AI generates tree of small components, not monolith

**Detection:**
- Component >400 lines
- Catalog description >3 sentences
- AI generates wrong component 50%+ of time despite correct schema
- Need 10+ examples for one component

**Which phase:** Phase 1 (Foundation). MUST decompose SQLResultsDisplay first.

---

### Pitfall 7: Token Cost Explosion from Verbose Schemas

**What goes wrong:** Every UI generation sends full catalog to LLM as system prompt. With 50 components and verbose schemas, prompt is 10K-20K tokens. At $5/million input + $15/million output, generating 1000 UIs costs $150-300.

**Why it happens:**
- Including all components in every generation prompt
- Detailed prop descriptions and examples
- No catalog filtering based on user intent
- Documentation strings embedded in schemas

**Prevention:**
1. **Selective catalog injection**: Analyze user prompt, include only relevant components
2. **Tiered catalogs**:
   - Core (10 components, always included)
   - Domain-specific (SQL, charts, forms - conditional)
3. **Compressed descriptions**: "Table with sorting" not "A comprehensive data table component that supports sorting, filtering, pagination, and custom renderers"
4. **Reference docs externally**: Link to full docs instead of embedding in prompt
5. **Prompt caching**: Use Anthropic prompt caching (90% savings on repeated catalog)

**Detection:**
- LLM costs >$100/month for <1000 generations
- System prompts >5000 tokens
- Most generated UIs use <20% of catalog
- Latency >5 seconds due to large context

**Which phase:** Phase 3 (Optimization). Not critical for MVP but becomes expensive at scale.

---

### Pitfall 8: ECharts Bundle Size Violation

**What goes wrong:** Full ECharts import is 1MB+ unbundled. Even with tree-shaking, including 8 chart types + 10 themes exceeds 500KB gzipped limit for single-file HTML apps.

**Why it happens:**
- Importing from `echarts` instead of `echarts/core`
- Including all chart types "just in case"
- All themes bundled even though dynamic theme uses CSS vars
- Tree-shaking not configured correctly in Vite

**Prevention:**
1. **Modular imports**:
   ```typescript
   import * as echarts from 'echarts/core';
   import { BarChart, LineChart } from 'echarts/charts';
   import { CanvasRenderer } from 'echarts/renderers';
   echarts.use([BarChart, LineChart, CanvasRenderer]);
   ```
2. **Lazy load charts**: Only load chart types when AI generates them
3. **Theme via CSS vars**: No bundled themes, read from `getComputedStyle()`
4. **Sampling for large datasets**: Don't render 100K points, sample to 10K
5. **Consider lighter alternatives**: Recharts (50KB) if ECharts too large

**Detection:**
- `pnpm build:apps` output shows >500KB gzipped
- Bundle analysis shows echarts >300KB
- `import 'echarts'` or `import * as echarts from 'echarts'` in code

**Which phase:** Phase 1 (Component Decomposition). Address during Chart primitive extraction.

---

### Pitfall 9: Missing Type Safety Across Layers

**What goes wrong:** Catalog defines `value: z.number()` but component accepts `string | number`. Runtime errors occur when AI generates valid schema but component can't handle it.

**Why it happens:**
- Catalog schema and component props diverge over time
- TypeScript types not derived from Zod schemas
- Registry mapping doesn't enforce type alignment
- No automated testing of schema-component contract

**Prevention:**
1. **Derive TypeScript from Zod**:
   ```typescript
   const ButtonSchema = z.object({ variant: z.enum([...]) });
   type ButtonProps = z.infer<typeof ButtonSchema>;
   ```
2. **Registry enforces types**:
   ```typescript
   defineRegistry<typeof catalog>(catalog, {
     Button: ({ props }: { props: z.infer<typeof catalog.components.Button.props> }) => ...
   });
   ```
3. **Integration tests**: Generate spec → validate → render → assert output
4. **Schema validation gates**: CI fails if component props don't match catalog

**Detection:**
- Runtime errors: "Expected number, got string"
- TypeScript errors during registry definition (ignored with `any`)
- Components work with manual props but fail with generated specs
- Defensive type coercion everywhere

**Which phase:** Phase 1 (Foundation). Type safety is architectural, can't retrofit.

---

### Pitfall 10: Testing Strategy Gap for Dynamic UIs

**What goes wrong:** Team writes unit tests for components and catalog schemas separately. No integration tests for "AI generates prompt → spec validates → component renders correctly". Bugs only found in production.

**Why it happens:**
- Testing components in isolation (Storybook patterns)
- Assuming schema validation = correctness
- No "golden path" tests for common NL patterns
- E2E tests don't include AI generation step

**Prevention:**
1. **Pattern-based integration tests**:
   ```typescript
   test('generates SQL results view from NL', async () => {
     const spec = await generateUI("Show query results as table with charts");
     render(<Renderer spec={spec} registry={registry} />);
     expect(screen.getByRole('table')).toBeInTheDocument();
     expect(screen.getByRole('img', { name: /chart/i })).toBeInTheDocument();
   });
   ```
2. **Snapshot tests for common specs**: Store validated specs as fixtures
3. **Contract tests**: Catalog schema + component rendering for every component
4. **Describability tests**: Can GPT-4 generate valid spec from description?

**Detection:**
- Test coverage >80% but production errors on AI-generated UIs
- Manual QA required for every new component
- Bugs filed: "Works in Storybook but fails when generated"

**Which phase:** Phase 2 (Integration). Can defer but becomes painful without it.

---

## Minor Pitfalls

Cosmetic or process issues with lower impact.

### Pitfall 11: Accessibility Regressions in Generated UIs

**What goes wrong:** Static components pass WCAG AA, but AI-generated compositions violate accessibility (missing labels, wrong heading hierarchy, bad color contrast).

**Why it happens:**
- Catalog doesn't guide AI on a11y requirements
- Components assume parent provides labels
- AI composes valid components in inaccessible ways
- No automated a11y testing on generated specs

**Prevention:**
1. **A11y in catalog descriptions**: "Button requires aria-label or text children"
2. **Composition validation**: Schema requires accessible patterns
3. **Automated axe-core tests** on generated UIs
4. **A11y examples in prompt**: Show correct patterns

**Detection:**
- axe-core violations on generated UIs
- Screen reader testing fails
- Color contrast checker flags issues

**Which phase:** Phase 2 (Quality Gates). Important but can be iterative.

---

### Pitfall 12: Hardcoded Theme Values Break Dark Mode

**What goes wrong:** Existing components have hardcoded colors like `#6b7280`. AI generates specs that work in light mode but break in dark mode because theme tokens not used.

**Why it happens:**
- Existing tech debt (CONCERNS.md flags this in SQLResultsDisplay)
- Components use Tailwind classes not CSS vars
- Registry doesn't inject theme context
- Catalog props don't expose theme variants

**Prevention:**
1. **Audit before cataloging**: Fix hardcoded colors first
2. **ThemeProvider wraps renderer**: All components get theme context
3. **Use CSS vars exclusively**: `getComputedStyle()` for dynamic values
4. **Test both themes**: CI runs specs in light + dark

**Detection:**
- Dark mode broken in generated UIs
- DevTools shows `color: #6b7280` instead of `color: var(--foreground)`
- Theme switching doesn't update generated components

**Which phase:** Phase 1 (Foundation). Already flagged in CONCERNS.md (P2).

---

### Pitfall 13: Deprecated Browser APIs in Legacy Components

**What goes wrong:** Components use `prompt()`, `alert()`, or `document.execCommand('copy')`. AI generates specs that trigger these, creating poor UX and deprecation warnings.

**Why it happens:**
- Legacy code debt (CONCERNS.md documents this in SQLResultsDisplay)
- No modernization pass before cataloging

**Prevention:**
1. **Modernize first**: Replace with Dialog components and Clipboard API
2. **Remove from catalog**: Don't expose broken patterns to AI

**Detection:**
- Console warnings about deprecated APIs
- User reports: "Modal dialogs are ugly"

**Which phase:** Phase 1 (Foundation). Fix before cataloging per CONCERNS.md.

---

### Pitfall 14: Streaming State Management Complexity

**What goes wrong:** AI streams specs via JSONL. Components mount/unmount as spec updates. State resets, event listeners duplicate, memory leaks from incomplete cleanup.

**Why it happens:**
- SpecStreamCompiler updates spec every chunk
- React re-mounts components during structural changes
- No stable component IDs across stream updates
- State stored in component local state (lost on unmount)

**Prevention:**
1. **Stable IDs in spec**: Component keys remain constant during streaming
2. **Hoist state to spec**: Use `$path` state system, not local state
3. **Cleanup patterns**: useEffect return cleanup for all subscriptions
4. **Test streaming**: Simulate chunked updates in tests

**Detection:**
- Memory leaks during streaming
- Event handlers fire multiple times
- State resets mid-stream
- Components flicker during progressive render

**Which phase:** Phase 2 (Streaming Support). Optional for MVP (can render complete specs first).

---

### Pitfall 15: Unclear Failure Modes for Invalid Specs

**What goes wrong:** AI generates spec with subtle error (wrong type, missing required field). Validation fails but error message unhelpful: "Expected object, got undefined at path.to.thing". User sees blank screen or generic error.

**Why it happens:**
- Zod error messages not user-friendly
- No fallback UI for validation failures
- Errors not sent back to AI for correction
- No "retry with feedback" mechanism

**Prevention:**
1. **Custom error messages** in schemas: `.describe("Button variant (default, destructive, outline)")`
2. **Error boundaries**: Show validation errors in UI, don't crash
3. **Validation feedback loop**: Send errors to LLM: "Fix: Button.variant must be 'default' or 'destructive', got 'primary'"
4. **Graceful degradation**: Render partial spec if some components invalid

**Detection:**
- Users see blank screen on generation errors
- Support tickets: "UI generation failed but I don't know why"
- No actionable error messages in UI

**Which phase:** Phase 3 (Polish). Improves UX but not critical for initial validation.

---

## Phase-Specific Warnings

Pitfalls that emerge during specific implementation phases.

| Phase | Focus | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1: Foundation | Catalog definition + decomposition | Schema explosion (#1), component size violations (#6), theme breaking (#12) | Start with 5 components, test describability, enforce 400-line limit |
| Phase 2: MCP Integration | Action system + state sync | State synchronization hell (#4), validation performance (#2) | Single source of truth pattern, validation caching |
| Phase 3: Theming | Dynamic tokens + dark mode | Runtime CSS bloat (#3), hardcoded colors (#12) | Stick with zero-runtime pattern, audit before cataloging |
| Phase 4: Performance | Large datasets + virtualization | Performance collapse (#5), ECharts bundle size (#8) | Virtualization as default, modular ECharts imports |
| Phase 5: Production | Testing + monitoring | Testing strategy gap (#10), missing type safety (#9) | Pattern-based integration tests, derive types from Zod |

---

## Cross-Cutting Red Flags

**Architecture Smell:** If you find yourself...
- Writing 100+ line catalog descriptions → Schema too complex (#1)
- Adding `.catch(() => {})` everywhere → State sync broken (#4)
- Seeing "Performance: Long Task" warnings → Missing virtualization (#5)
- Manually testing every generated UI → No integration tests (#10)
- Hitting bundle size limit → ECharts not tree-shaken (#8)

**Process Smell:** If team is...
- Cataloging components before decomposing → Will hit size violations (#6)
- Retrofitting without a11y/theme audit → Breaking dark mode (#12)
- Skipping type derivation from schemas → Runtime type errors (#9)
- Not measuring token costs → Cost explosion at scale (#7)

**User Signal:** If users report...
- "UI takes forever to load" → Validation overhead (#2) or large datasets (#5)
- "Generate button doesn't work" → Schema too complex (#1)
- "Data doesn't update" → State synchronization (#4)
- "Dark mode is broken" → Hardcoded colors (#12)

---

## Pre-Implementation Checklist

Before starting json-render integration, verify:

- [ ] All components <400 lines (decompose SQLResultsDisplay first)
- [ ] No hardcoded colors (audit per CONCERNS.md)
- [ ] Deprecated APIs replaced (prompt/alert/execCommand)
- [ ] ECharts using modular imports
- [ ] Theme system is zero-runtime (don't add CSS-in-JS)
- [ ] Virtualization strategy defined for large datasets
- [ ] Type derivation from Zod schemas planned
- [ ] Integration test strategy documented
- [ ] Token cost monitoring in place
- [ ] Bundle size CI check configured (<500KB gzipped)

---

## Sources & Confidence Assessment

| Finding | Source | Confidence |
|---------|--------|------------|
| Schema complexity breaks AI generation | [Generative UI Platforms Comparison 2026](https://quickleap.io/blog/generative-ui-platforms-comparison-2026), [A2UI vs json-render Analysis](https://dipjyotimetia.medium.com/vercels-json-render-vs-google-s-a2ui-the-head-to-head-6f213cf1a23b) | HIGH |
| Zod performance overhead (40x slower) | [Zod vs Valibot vs ArkType 2026](https://pockit.tools/blog/zod-valibot-arktype-comparison-2026/), [Why is Zod so slow?](https://blog.logrocket.com/why-zod-slow/) | HIGH |
| CSS-in-JS runtime costs (15-45KB) | [React & CSS in 2026](https://medium.com/@imranmsa93/react-css-in-2026-best-styling-approaches-compared-d5e99a771753), [CSS-in-JS Performance](https://www.infoq.com/news/2020/01/css-cssinjs-performance-cost/) | HIGH |
| Token costs ($5/$15 per million) | [LLM Cost Per Token 2026](https://www.silicondata.com/llm-cost-per-token), [LLM Pricing Comparison](https://www.cloudidr.com/blog/llm-pricing-comparison-2026) | HIGH |
| Virtual scrolling memory leaks | [TanStack Virtual Memory Leak](https://github.com/TanStack/virtual/issues/196), [React Large Datasets](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react) | MEDIUM |
| ECharts tree-shaking issues | [ECharts Import Guide](https://apache.github.io/echarts-handbook/en/basics/import/), [ECharts Bundle Size](https://hugocxl.github.io/react-echarts/docs/bundle-size) | HIGH |
| Natural language describability challenges | [Natural Language Interfaces 2026](https://aijourn.com/natural-language-interfaces-why-2026-turns-everyone-into-a-system-designer-and-why-expertise-still-matters/), [Semantic Guidance for UI Generation](https://arxiv.org/html/2601.19171) | MEDIUM |
| Component decomposition principles | [Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/), [Atomic Design for Developers](https://benjaminwfox.com/blog/tech/atomic-design-for-developers) | HIGH |
| State management race conditions | [React Router Race Conditions](https://reactrouter.com/explanation/race-conditions), [Fixing Race Conditions in React](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect) | HIGH |
| Testing AI-generated UIs | [TestSprite Schema Validation](https://www.testsprite.com/use-cases/en/the-best-schema-checker-tools), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs/) | MEDIUM |

**Overall Confidence:** HIGH - Critical pitfalls backed by official documentation and real-world case studies. SurfacesUI-specific issues verified from CONCERNS.md codebase audit.

---

**Last Updated:** 2026-02-15
**Status:** Ready for roadmap integration
