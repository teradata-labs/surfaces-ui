# Requirements: SurfacesUI NL-Driven Component Library

**Defined:** 2026-02-15
**Core Value:** Data scientists can generate production-quality data visualizations from natural language without touching React code.

## v1 Requirements

Requirements for json-render integration with SQL results pattern proof of concept.

### json-render Foundation

- [ ] **JR-01**: Install and configure json-render packages (@json-render/core, @json-render/react)
- [ ] **JR-02**: Define catalog with Zod schemas for all SQL results primitives
- [ ] **JR-03**: Build registry mapping catalog entries to React component implementations
- [ ] **JR-04**: Integrate renderer with React root and MCP Bridge provider
- [ ] **JR-05**: Generate catalog prompt for AI consumption (describe components)
- [ ] **JR-06**: Enforce 5-8 props maximum per catalog component for AI describability

### Component Decomposition

- [ ] **COMP-01**: Decompose SQLResultsDisplay (1772 lines) into primitives (<400 lines each)
- [ ] **COMP-02**: Extract Chart primitive (standalone ECharts wrapper with theme integration)
- [ ] **COMP-03**: Extract DataTable primitive (virtual scrolling ready)
- [ ] **COMP-04**: Extract Filter primitive (column search/filter)
- [ ] **COMP-05**: Extract DensityToggle primitive (compact/comfortable/spacious)
- [ ] **COMP-06**: Extract ViewModeToggle primitive (table/chart/both)
- [ ] **COMP-07**: Create TableWithFilters molecule (compose table + filter)
- [ ] **COMP-08**: Create ChartWithControls molecule (compose chart + axis config)
- [ ] **COMP-09**: Preserve SQLResultsDisplay organism as composition of primitives

### Catalog Definitions

- [ ] **CAT-01**: Chart catalog entry with Zod schema (chartType, data, xAxis, yAxis, theme)
- [ ] **CAT-02**: DataTable catalog entry with Zod schema (columns, data, pageSize, density)
- [ ] **CAT-03**: Filter catalog entry with Zod schema (columnKey, filterType, value)
- [ ] **CAT-04**: DensityToggle catalog entry with Zod schema (density: compact/comfortable/spacious)
- [ ] **CAT-05**: ViewModeToggle catalog entry with Zod schema (mode: table/chart/both)
- [ ] **CAT-06**: TableWithFilters molecule catalog entry
- [ ] **CAT-07**: ChartWithControls molecule catalog entry
- [ ] **CAT-08**: SQLResultsDisplay organism catalog entry (full composition)

### Registry Mappings

- [ ] **REG-01**: Map Chart catalog → Chart React component with props validation
- [ ] **REG-02**: Map DataTable catalog → DataTable React component with virtual scrolling
- [ ] **REG-03**: Map Filter catalog → Filter React component with onChange handler
- [ ] **REG-04**: Map DensityToggle catalog → DensityToggle React component
- [ ] **REG-05**: Map ViewModeToggle catalog → ViewModeToggle React component
- [ ] **REG-06**: Map TableWithFilters catalog → molecule composition
- [ ] **REG-07**: Map ChartWithControls catalog → molecule composition
- [ ] **REG-08**: Map SQLResultsDisplay catalog → organism composition

### MCP Bridge Integration

- [ ] **MCP-01**: Create action system bridging json-render emit() to MCP Bridge callTool()
- [ ] **MCP-02**: Map execute_sql action to MCP tool call
- [ ] **MCP-03**: Implement state coordination layer (single source of truth)
- [ ] **MCP-04**: Handle async tool results in registry action handlers
- [ ] **MCP-05**: Pass MCP Bridge instance to registry components via context

### Virtual Scrolling

- [ ] **VIRT-01**: Install @tanstack/react-virtual for large dataset support
- [ ] **VIRT-02**: Integrate virtual scrolling in DataTable primitive
- [ ] **VIRT-03**: Test performance with 100K+ row datasets
- [ ] **VIRT-04**: Configure row height estimation for variable-height rows
- [ ] **VIRT-05**: Optimize render performance (60FPS target)

### Theming Integration

- [ ] **THEME-01**: Fetch Covalent tokens (@covalent/tokens@11.7.0)
- [ ] **THEME-02**: Map Covalent tokens to SurfacesUI CSS custom properties
- [ ] **THEME-03**: Create density variants using token scaling (compact: 0.8x, spacious: 1.2x)
- [ ] **THEME-04**: Implement dark/light theme switching from Covalent base
- [ ] **THEME-05**: Inject theme context through json-render renderer to registry
- [ ] **THEME-06**: Preserve zero-runtime styling (no CSS-in-JS libraries)

### NL Generation

- [ ] **NL-01**: Create MCP tool endpoint for UI generation (input: prompt, output: spec)
- [ ] **NL-02**: Integrate AI model with catalog prompt for constrained generation
- [ ] **NL-03**: Implement spec validation before rendering (catch hallucinations)
- [ ] **NL-04**: Add error recovery for invalid specs (graceful degradation)
- [ ] **NL-05**: Support streaming spec compilation (progressive UI updates)
- [ ] **NL-06**: Document example prompts for each primitive and pattern
- [ ] **NL-07**: Add basic explainability ("why this component?")

### MCP Apps Deployment

- [ ] **DEPLOY-01**: Create json-render app entry point (packages/components/src/apps/json-render-app.tsx)
- [ ] **DEPLOY-02**: Build UI generation interface (prompt input + result display)
- [ ] **DEPLOY-03**: Integrate McpAppsBridge for postMessage communication
- [ ] **DEPLOY-04**: Wrap renderer in ThemeProvider for theme support
- [ ] **DEPLOY-05**: Build single-file HTML bundle for MCP Apps
- [ ] **DEPLOY-06**: Verify bundle size <500KB gzipped

### Testing

- [ ] **TEST-01**: Unit tests for catalog validation (Zod schemas)
- [ ] **TEST-02**: Integration tests for registry mappings (catalog → component)
- [ ] **TEST-03**: E2E tests for NL generation flow (prompt → spec → rendered UI)
- [ ] **TEST-04**: Performance tests for 100K+ row datasets (virtual scrolling)
- [ ] **TEST-05**: Accessibility tests for generated UIs (axe-core)
- [ ] **TEST-06**: Bundle size verification tests (enforce <500KB)
- [ ] **TEST-07**: Theme switching tests (dark/light mode)

### Documentation

- [ ] **DOC-01**: Document catalog API for each component (props, descriptions)
- [ ] **DOC-02**: Create example prompts library (3-5 examples per primitive)
- [ ] **DOC-03**: Document registry extension pattern (how to add new components)
- [ ] **DOC-04**: Write integration guide for existing SurfacesUI consumers
- [ ] **DOC-05**: Document MCP action system (how to add tool calls)

## v2 Requirements

Deferred to future releases after v1 validates the concept.

### Python SDK
- **PY-01**: Python package for notebook embedding
- **PY-02**: Jupyter widget integration
- **PY-03**: DataFrame to UI spec conversion
- **PY-04**: Local server for UI generation

### Advanced Features
- **ADV-01**: Figma MCP auto-sync for design tokens
- **ADV-02**: Version history and rollback for generated UIs
- **ADV-03**: Component learning system (improve AI from usage data)
- **ADV-04**: Multi-modal input (text + screenshots)
- **ADV-05**: Granular post-generation controls (edit specific props)

### Additional Widgets
- **WIDGET-01**: Notebook widget pattern from Canvas AI Studio
- **WIDGET-02**: Workflow widget pattern from Canvas AI Studio
- **WIDGET-03**: Chat interface pattern from Canvas AI Studio
- **WIDGET-04**: Data browser pattern from Canvas AI Studio

### Publishing
- **PUB-01**: Standalone micro-app export (publishable HTML)
- **PUB-02**: Shareable UI link generation
- **PUB-03**: Embed code generation for external sites

## Out of Scope

Explicitly excluded to maintain v1 focus.

| Feature | Reason |
|---------|--------|
| Real-time streaming data | Static/paginated datasets sufficient for v1 proof of concept |
| Pixel-perfect Figma matching | "Usable" is the bar for v1, visual polish deferred to v2 |
| Backend API changes | Works with existing FastMCP + vantage-mcp integration |
| IE11 support | Modern browsers only (React 18 requirements) |
| Custom AI model training | Use existing LLMs (GPT-4, Claude) with catalog prompt |
| Native mobile apps | MCP Apps only for v1, React Native v2+ |
| Collaborative editing | Single-user generation for v1 |
| Advanced error handling UX | Basic validation sufficient for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (To be populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 61 ⚠️

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after initial definition*
