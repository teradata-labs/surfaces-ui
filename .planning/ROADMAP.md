# Roadmap: SurfacesUI NL-Driven Component Library

## Overview

Transform SurfacesUI from a static component library into an AI-driven, declarative UI generation system through json-render integration. Journey flows from establishing type-safe foundations and decomposing oversized components, through building the catalog-registry-renderer architecture, to enabling natural language-driven UI generation with full MCP Bridge integration and deployment-ready bundles. Each phase validates a critical capability before proceeding to the next layer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Component Decomposition** - Establish json-render packages and decompose SQLResultsDisplay
- [x] **Phase 2: Catalog Definitions** - Define Zod schemas for all SQL results primitives
- [x] **Phase 3: Registry Mappings** - Map catalog entries to React component implementations
- [x] **Phase 4: MCP Bridge Integration** - Bridge json-render actions to MCP tool calls
- [x] **Phase 5: Virtual Scrolling & Performance** - Enable 100K+ row dataset support
- [x] **Phase 6: Theming Integration** - Integrate design tokens with json-render
- [ ] **Phase 7: NL Generation** - Enable prompt-to-UI generation with AI
- [ ] **Phase 8: MCP Apps Deployment** - Build and deploy single-file HTML bundle
- [ ] **Phase 9: Testing & Documentation** - Complete test coverage and documentation

## Phase Details

### Phase 1: Foundation & Component Decomposition
**Goal**: Install json-render packages and decompose SQLResultsDisplay into catalogable primitives that meet 400-line limit
**Depends on**: Nothing (first phase)
**Requirements**: JR-01, JR-02, JR-03, JR-04, JR-05, JR-06, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09
**Success Criteria** (what must be TRUE):
  1. All json-render packages installed and configured in monorepo
  2. Catalog structure defined with Zod for initial primitives
  3. SQLResultsDisplay decomposed into primitives each under 400 lines
  4. Chart primitive renders ECharts with theme integration
  5. DataTable primitive renders with virtual scrolling architecture ready
**Plans**: 6 plans in 4 waves

Plans:
- [x] 01-01-PLAN.md - Install json-render packages and create catalog foundation (Wave 1)
- [x] 01-02-PLAN.md - Extract Chart primitive with ECharts theme integration (Wave 2)
- [x] 01-03-PLAN.md - Extract DataTable primitive with TanStack Virtual (Wave 2)
- [x] 01-04-PLAN.md - Extract Filter and DensityToggle primitives (Wave 2)
- [x] 01-05-PLAN.md - Create TableWithFilters and ChartWithControls molecules (Wave 3)
- [x] 01-06-PLAN.md - Refactor SQLResultsDisplay and update catalog registry (Wave 4)

### Phase 2: Catalog Definitions
**Goal**: Create complete json-render catalog with Zod schemas for all SQL results components
**Depends on**: Phase 1
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08
**Success Criteria** (what must be TRUE):
  1. Every primitive has catalog entry with 5-8 props maximum
  2. Catalog prompt generates coherent AI-consumable descriptions
  3. Zod schemas validate and provide TypeScript inference
  4. Molecule and organism catalog entries compose primitives correctly
  5. AI can understand component purpose from catalog descriptions
**Plans**: 3 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md - Refine primitive schemas and create AI prompt utilities (Wave 1)
- [x] 02-02-PLAN.md - Add molecule catalog entries (TableWithFilters, ChartWithControls) (Wave 2)
- [x] 02-03-PLAN.md - Add organism catalog entry (SQLResultsDisplay) (Wave 2)

### Phase 3: Registry Mappings
**Goal**: Integrate SurfacesRenderer with ThemeProvider and validate catalog-to-component flow with demo app
**Depends on**: Phase 2
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, REG-07, REG-08
**Success Criteria** (what must be TRUE):
  1. Registry maps all catalog entries to React components
  2. Static JSON specs render to working React UIs
  3. ThemeProvider wraps renderer and components inherit CSS variables
  4. Demo app shows catalog-to-component flow working
  5. Type safety enforced between catalog schemas and component props
**Plans**: 5 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md - Create SurfacesRenderer with ThemeProvider integration (Wave 1)
- [x] 03-02-PLAN.md - Create CatalogDemo app with example JSON specs (Wave 2)
- [x] 03-03-PLAN.md - Validate registry mappings with integration tests (Wave 2)
- [x] 03-04-PLAN.md - Fix state binding in registry wrappers (Wave 1, gap closure)
- [x] 03-05-PLAN.md - Add TypeScript types and remove `as any` casts (Wave 2, gap closure)

### Phase 4: MCP Bridge Integration
**Goal**: Connect json-render action system to SurfacesUI MCP Bridge for tool calls
**Depends on**: Phase 3
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria** (what must be TRUE):
  1. Actions defined in catalog bridge to MCP tools via emit handler
  2. execute_sql action triggers MCP tool and returns results
  3. State coordination layer prevents race conditions and duplicates
  4. Async tool results update component state correctly
  5. Registry components receive MCP Bridge context without breaking abstraction
**Plans**: 3 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md - Create action bridge layer with execute_sql action (Wave 1)
- [x] 04-02-PLAN.md - Update SurfacesRenderer with McpBridgeProvider integration (Wave 2)
- [x] 04-03-PLAN.md - Create integration tests for MCP action flow (Wave 3)

### Phase 5: Virtual Scrolling & Performance
**Goal**: Optimize DataTable for 100K+ row datasets with dynamic overscan, ARIA accessibility, and verified performance
**Depends on**: Phase 4
**Requirements**: VIRT-01, VIRT-02, VIRT-03, VIRT-04, VIRT-05
**Success Criteria** (what must be TRUE):
  1. TanStack Virtual installed and integrated with DataTable
  2. User can scroll through 100K+ rows at 60FPS
  3. Variable-height rows work with row height estimation
  4. Memory usage stays stable with large datasets
  5. Registry integration preserves virtual scrolling through catalog specs
**Plans**: 2 plans in 2 waves

Plans:
- [x] 05-01-PLAN.md - Performance optimization with dynamic overscan and ARIA accessibility (Wave 1)
- [x] 05-02-PLAN.md - Performance testing with 100K+ row validation (Wave 2)

### Phase 6: Theming Integration
**Goal**: Add density variants and theme switching to json-render components using existing token system
**Depends on**: Phase 5
**Requirements**: THEME-03, THEME-04, THEME-05, THEME-06 (THEME-01, THEME-02 skipped per user decision)
**Success Criteria** (what must be TRUE):
  1. Density variants work via CSS custom property scaling (compact 0.8x, spacious 1.2x)
  2. Dark and light themes switch without page reload (already working, verified)
  3. json-render renderer passes density context to ThemeProvider
  4. Zero-runtime styling preserved (no CSS-in-JS libraries added)
  5. FOUC prevented on page load via inline script
**Plans**: 3 plans in 3 waves

Plans:
- [x] 06-01-PLAN.md - Create density CSS tokens and FOUC prevention (Wave 1)
- [x] 06-02-PLAN.md - Enhance ThemeProvider with density support (Wave 2)
- [x] 06-03-PLAN.md - Add density integration tests and verify zero-runtime (Wave 3)

### Phase 7: NL Generation
**Goal**: Enable end-to-end natural language to rendered UI generation flow
**Depends on**: Phase 6
**Requirements**: NL-01, NL-02, NL-03, NL-04, NL-05, NL-06, NL-07
**Success Criteria** (what must be TRUE):
  1. User can submit natural language prompt and receive UI spec
  2. AI model generates valid specs constrained by catalog
  3. Invalid specs caught by validation before render with graceful errors
  4. Streaming compilation shows progressive UI updates
  5. Example prompts documented for each primitive work correctly
**Plans**: 5 plans in 3 waves

Plans:
- [ ] 07-01-PLAN.md - Create generate_ui MCP tool with Anthropic Claude integration (Wave 1)
- [ ] 07-02-PLAN.md - Create validation layer and fallback UI for invalid specs (Wave 1)
- [ ] 07-03-PLAN.md - Add streaming client and explainability (Wave 2)
- [ ] 07-04-PLAN.md - Document example prompts for all components (Wave 2)
- [ ] 07-05-PLAN.md - Create NLGenerator component and integration tests (Wave 3)

### Phase 8: MCP Apps Deployment
**Goal**: Build production-ready single-file HTML bundle for MCP Apps distribution
**Depends on**: Phase 7
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06
**Success Criteria** (what must be TRUE):
  1. json-render app entry point exists with UI generation interface
  2. User can input prompt and see result display in browser
  3. McpAppsBridge handles postMessage communication correctly
  4. ThemeProvider wraps renderer for theme support
  5. Bundle size verified under 500KB gzipped
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 9: Testing & Documentation
**Goal**: Complete test coverage and documentation for production readiness
**Depends on**: Phase 8
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, DOC-01, DOC-02, DOC-03, DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. 80% test coverage achieved across catalog, registry, and integration
  2. Accessibility tests pass with zero axe-core violations
  3. Performance tests validate 100K+ row handling
  4. Catalog API documented with props and descriptions
  5. Integration guide exists for existing SurfacesUI consumers
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Component Decomposition | 6/6 | Complete | 2026-02-16 |
| 2. Catalog Definitions | 3/3 | Complete | 2026-02-16 |
| 3. Registry Mappings | 5/5 | Complete | 2026-02-17 |
| 4. MCP Bridge Integration | 3/3 | Complete | 2026-02-17 |
| 5. Virtual Scrolling & Performance | 2/2 | Complete | 2026-02-17 |
| 6. Theming Integration | 3/3 | Complete | 2026-02-17 |
| 7. NL Generation | 5/5 | Complete | 2026-02-17 |
| 8. MCP Apps Deployment | 0/TBD | Not started | - |
| 9. Testing & Documentation | 0/TBD | Not started | - |
