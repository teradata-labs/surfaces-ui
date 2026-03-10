# SURFACESUI MCP KIT — PRIORITIZED ROADMAP
## Current State & Future Vision

**Last Updated:** 2026-03-10
**Status:** Foundation Complete, Core Surfaces In Progress

---

## EXECUTIVE SUMMARY

### What SurfacesUI Is

SurfacesUI is a **React component library and MCP server** that enables Claude Desktop (and other MCP hosts) to display interactive, data-driven UIs through pre-built HTML app bundles.

**Core Value Proposition:**
- Convert MCP tool outputs into rich, interactive visualizations
- Zero-install UI for Claude Desktop users
- Reusable components across different data tools
- Theme-aware, accessible, responsive design

**What It Is NOT:**
- Not a database (delegates to MCP servers)
- Not an AI agent (works with Claude/other LLMs)
- Not a backend framework (components + MCP server only)

---

## CURRENT STATE (PHASE 1 ✅)

### Built & Shipped Components

#### 1. Dashboard Viewer (`dashboard-viewer.html`)
**Status:** ✅ Production Ready
**Bundle Size:** 700KB gzipped
**MCP Tool:** `show_dashboard`

**Features:**
- KPI Cards (StatCard) with trend indicators
- Charts (line, bar, pie, area, scatter, heatmap)
- Responsive grid layout (1-4 columns)
- Chart theme system (10 themes)
- Auto light/dark theme switching
- json-render spec-based rendering

**Usage:**
```typescript
// Claude calls this tool with spec + data
show_dashboard({
  spec: {
    root: "mainBox",
    elements: {
      kpi1: { type: "StatCard", props: { label: "Revenue", value: "$100K", trend: "up" } },
      chart1: { type: "Chart", props: { type: "line", xAxis: "month", yAxis: "revenue" } }
    },
    state: { data: [{ month: "Jan", revenue: 50000 }, ...] }
  },
  title: "Revenue Dashboard"
})
```

#### 2. SQL Editor (`sql-editor-cdn.html`)
**Status:** ✅ Production Ready
**Bundle Size:** 784KB gzipped
**MCP Tool:** `open_sql_editor`

**Features:**
- CodeMirror-based SQL editor
- Syntax highlighting
- Query parameter injection
- Auto-execute support

#### 3. Component Library

**Available Components:**
- **StatCard** - KPI metrics with trend arrows
- **Chart** - 8 chart types via ECharts
- **DataTable** - Virtual scrolling table
- **Box** - Flexbox/grid layout container
- **Heading** - H1-H4 text headings
- **Text** - Markdown-enabled paragraphs
- **Card** - Content card with title/description
- **Divider** - Horizontal/vertical separators
- **FormInput** - Labeled text input
- **FormSelect** - Labeled dropdown
- **Filter** - Search input
- **DensityToggle** - Table density control
- **ViewModeToggle** - Table/chart view switcher

**Molecule Components:**
- **TableWithFilters** - DataTable + Filter + DensityToggle
- **ChartWithControls** - Chart + configuration panel
- **SQLResultsDisplay** - Full SQL results viewer

#### 4. Theme System

**UI Themes:**
- Light mode (default)
- Dark mode
- Teradata branded theme preset
- CSS custom properties for full customization

**Chart Themes (10 total):**
1. High Contrast (Light/Dark)
2. Universal Colorblind Safe (Light/Dark)
3. Ocean Depths (Light/Dark)
4. Natural Elements (Light/Dark)
5. Professional (Light/Dark)

**Auto-Switching:**
- ChartThemeProvider syncs with UI theme
- User selects base theme → auto-applies light/dark variant
- Persisted in localStorage

#### 5. MCP Infrastructure

**Packages:**
- `@surfacesui/components` - React component library
- `@surfacesui/mcp-adapter` - Framework-agnostic MCP resource adapter
- `@surfacesui/server` - Standalone Node.js MCP server

**Communication Protocol:**
- postMessage-based (NOT URL parameters)
- `ui/notifications/tool-input` message format
- Documented in `MCP-APPS-COMMUNICATION.md`

**Resource Serving:**
- Single-file HTML bundles (no external dependencies)
- Served as `ui://` MCP resources
- Auto-discovered from `dist/apps/` directory

---

## PHASE 2: CORE DATA SURFACES (IN PROGRESS 🚧)

### Priority 1: SQL Results Integration

**Goal:** Enable Claude to execute SQL and auto-visualize results

**Components Needed:**

#### 2.1 Enhanced DataTable
**Status:** Partially exists
**Current:** Basic virtual scrolling table
**Needed:**
- Column sorting
- Multi-column filtering
- Inline summary statistics (sum, avg, min, max)
- CSV/JSON export
- Column visibility toggle
- Resizable columns

**Estimated Effort:** 2 weeks

#### 2.2 Auto-Dashboard Generator
**Status:** Not started
**Purpose:** Automatically create dashboard specs from SQL results

**Features:**
- Detect numeric columns → suggest Chart
- Detect categorical + numeric → suggest bar/pie
- Detect time series → suggest line chart
- Calculate aggregates → suggest StatCard
- Multi-chart layouts for complex queries

**Estimated Effort:** 2 weeks

#### 2.3 Query History & Caching
**Status:** Not started
**Purpose:** Store and reuse query results

**Features:**
- In-memory result cache (last 10 queries)
- Reference by `queryId` instead of inline data
- Refresh button to re-run query
- Query history sidebar

**Estimated Effort:** 1 week

**Total Phase 2.1 Effort:** 5 weeks

---

### Priority 2: Advanced Visualizations

**Goal:** Expand beyond basic charts

#### 2.4 Heatmap Component
**Status:** Partially exists (basic support)
**Needed:**
- Correlation matrices
- Time-based heatmaps
- Custom color scales
- Zoom/pan support

**Estimated Effort:** 1 week

#### 2.5 Metric Comparison Cards
**Status:** Not started
**Purpose:** Side-by-side metric comparison

**Features:**
- Sparkline trends
- Variance indicators
- Period-over-period comparison
- Conditional formatting

**Estimated Effort:** 1 week

#### 2.6 Data Profile Dashboard
**Status:** Not started
**Purpose:** Automated data quality overview

**Features:**
- Column type detection
- Null rate visualization
- Cardinality counts
- Distribution histograms
- Outlier detection

**Estimated Effort:** 2 weeks

**Total Phase 2.2 Effort:** 4 weeks

**PHASE 2 TOTAL:** 9 weeks

---

## PHASE 3: ENTERPRISE SURFACES (PLANNED 📋)

### Priority 3: Transparency & Trust

#### 3.1 SQL Transparency Surface
**Status:** Concept only
**Purpose:** Show AI → SQL translation clearly

**Features:**
- Natural language intent panel
- Generated SQL editor (read-only or editable)
- Schema grounding indicators
- Confidence scoring
- Alternative query suggestions
- Execution plan preview

**Estimated Effort:** 3 weeks

#### 3.2 Execution Monitor
**Status:** Not started
**Purpose:** Real-time query execution tracking

**Features:**
- Status timeline
- Progress indicators
- Resource usage (CPU, memory, I/O)
- Cost estimates
- Cancel/retry controls
- Execution logs panel

**Estimated Effort:** 2 weeks

#### 3.3 Lineage Viewer
**Status:** Concept only
**Purpose:** Data lineage visualization

**Features:**
- Table → Query → Dashboard relationships
- Column-level lineage tracking
- Impact analysis (what breaks if this changes?)
- Dependency graph visualization

**Estimated Effort:** 4 weeks

**PHASE 3 TOTAL:** 9 weeks

---

## PHASE 4: AGENTIC SURFACES (FUTURE 🔮)

### Vision Only - No Concrete Plans

#### 4.1 Agent Plan Viewer
**Purpose:** Visualize multi-step agent execution plans

**Features:**
- Tree view of planned steps
- Tool call preview
- Edit/approve nodes before execution
- Branching logic visualization
- Cost/time estimates per step

#### 4.2 Workflow Canvas
**Purpose:** Visual DAG-based workflow composer

**Features:**
- Drag-and-drop node creation
- Connect data sources to transformations
- Preview intermediate results
- Version control integration
- Collaboration features

#### 4.3 Artifact Registry
**Purpose:** Saved queries, dashboards, and workflows

**Features:**
- Search across all artifacts
- Version history
- Sharing & permissions
- Template library
- Usage analytics

#### 4.4 Insight Generator
**Purpose:** Executive summary auto-generation

**Features:**
- AI-generated narrative summaries
- Key metric highlights
- Statistical anomalies
- Trend detection
- Confidence scoring

**Note:** Phase 4 components are aspirational and depend on:
- Agent orchestration framework (not built)
- Multi-step planning system (not built)
- Artifact persistence layer (not built)
- User authentication system (not built)

**Earliest Start Date:** Q3 2026 (after Phase 2 & 3 complete)

---

## DEFERRED/OUT OF SCOPE

### Explicitly Not Building

#### Database Connections
**Reason:** MCP servers handle this
**Alternative:** Work with existing MCP servers (vantage-mcp, postgres-mcp, etc.)

#### AI Agent Framework
**Reason:** Claude Desktop provides this
**Alternative:** Focus on UI components that work with any LLM

#### Backend API
**Reason:** MCP protocol handles communication
**Alternative:** Build MCP tools, not REST endpoints

#### User Authentication
**Reason:** Host applications handle this
**Alternative:** Rely on Claude Desktop, IDE, or web app auth

#### Real-time Collaboration
**Reason:** Massive scope increase
**Alternative:** Single-user experiences only

#### Mobile Apps
**Reason:** MCP hosts are desktop-first
**Alternative:** Responsive web design for tablet support

---

## DESIGN PRINCIPLES

### Non-Negotiable Requirements

1. **MCP Protocol Compliance**
   - All components work via MCP resource serving
   - postMessage-based communication only
   - No URL parameter dependencies

2. **Zero External Dependencies**
   - Single-file HTML bundles
   - All assets inlined (no CDN links)
   - Works in sandboxed iframes

3. **Theme Consistency**
   - Respect host application theme (light/dark)
   - CSS custom properties for all colors
   - No hardcoded color values

4. **Accessibility (WCAG AA)**
   - Keyboard navigation support
   - Screen reader friendly
   - High contrast mode
   - Focus indicators

5. **Performance Targets**
   - Bundle size < 1MB gzipped
   - Initial render < 1 second
   - 60fps interactions
   - Virtual scrolling for large datasets

6. **Code Quality**
   - TypeScript strict mode
   - ESLint + security plugin
   - 80%+ test coverage
   - No P0/P1 bugs in production

### Nice-to-Have Features

- CSV/JSON export
- Keyboard shortcuts
- Print-friendly layouts
- Offline support
- Progressive enhancement

---

## TECHNICAL ARCHITECTURE

### Package Structure

```
packages/
├── components/          # React component library
│   ├── src/
│   │   ├── apps/       # MCP app bundles (dashboard-viewer, sql-editor, etc.)
│   │   ├── catalog/    # json-render component registry
│   │   ├── theme/      # Theme providers and CSS variables
│   │   ├── primitives/ # Base components (Chart, DataTable, etc.)
│   │   ├── molecules/  # Composed components
│   │   └── bridge/     # MCP communication bridge
│   └── dist/
│       └── apps/       # Built HTML bundles
├── mcp-adapter/         # Framework-agnostic MCP adapter
│   ├── src/
│   │   ├── registry.ts # Resource registration
│   │   └── resources.ts# Resource reading/serving
│   └── apps/           # Copied HTML bundles
└── server/             # Standalone Node.js MCP server
    └── src/
        └── index.ts    # Tool definitions + resource serving
```

### Build Pipeline

```bash
# 1. Build React components
pnpm --filter @surfacesui/components build

# 2. Build MCP app bundles (single-file HTML)
pnpm --filter @surfacesui/components build:apps

# 3. Copy bundles to mcp-adapter
pnpm --filter @surfacesui/mcp-adapter build

# 4. Build standalone server
pnpm --filter @surfacesui/server build

# 5. Publish to npm (optional)
pnpm publish -r
```

### Claude Desktop Integration

**Config:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "npx",
      "args": ["@surfacesui/server"]
    }
  }
}
```

---

## SUCCESS METRICS

### Phase 1 (COMPLETE ✅)
- [x] Dashboard viewer working in Claude Desktop
- [x] Chart themes functional
- [x] MCP communication protocol documented
- [x] Component library published to npm
- [x] Bundle size < 1MB gzipped

### Phase 2 (IN PROGRESS 🚧)
- [ ] SQL results auto-visualized as dashboards
- [ ] DataTable with sorting/filtering
- [ ] Query history and caching
- [ ] Heatmap and comparison cards
- [ ] Data profile dashboard

### Phase 3 (PLANNED 📋)
- [ ] SQL transparency surface shipped
- [ ] Execution monitor functional
- [ ] Lineage viewer prototype
- [ ] Enterprise customers using in production

### Phase 4 (FUTURE 🔮)
- [ ] Agent plan viewer concept validated
- [ ] Workflow canvas prototype
- [ ] Artifact registry MVP
- [ ] Insight generator demo

---

## RISK ASSESSMENT

### High Risk
1. **MCP Protocol Changes** - Anthropic may update MCP spec
   - **Mitigation:** Monitor MCP SDK releases, version lock
2. **Performance at Scale** - Large datasets may cause UI slowdown
   - **Mitigation:** Virtual scrolling, pagination, streaming

### Medium Risk
1. **Browser Compatibility** - Different hosts may use different engines
   - **Mitigation:** Test on Chrome, Firefox, Safari, Edge
2. **Theme Conflicts** - Host apps may override CSS
   - **Mitigation:** Shadow DOM, CSS modules, strict scoping

### Low Risk
1. **Bundle Size Growth** - Adding features may bloat bundles
   - **Mitigation:** Code splitting, lazy loading, tree shaking
2. **Accessibility Issues** - Complex visualizations may be hard to navigate
   - **Mitigation:** ARIA labels, keyboard support, screen reader testing

---

## TIMELINE SUMMARY

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 1: Foundation | 2 weeks | Jan 2026 | Feb 2026 | ✅ Complete |
| Phase 2: Core Data | 9 weeks | Mar 2026 | May 2026 | 🚧 In Progress |
| Phase 3: Enterprise | 9 weeks | May 2026 | Jul 2026 | 📋 Planned |
| Phase 4: Agentic | TBD | Q3 2026+ | - | 🔮 Future |

**Current Focus:** Phase 2 - SQL Results Integration

---

## DECISION LOG

### 2026-03-10: Chart Theme Architecture
**Decision:** Use ChartThemeProvider for auto light/dark switching
**Rationale:** Users expect chart colors to sync with UI theme
**Alternative Considered:** Manual theme selection only
**Outcome:** Shipped in dashboard-viewer

### 2026-03-10: MCP Communication Protocol
**Decision:** Use postMessage only, not URL parameters
**Rationale:** Claude Desktop strips query params and hash
**Alternative Considered:** Base64-encoded URL fragments
**Outcome:** Documented in MCP-APPS-COMMUNICATION.md

### 2026-03-10: Component Size Limits
**Decision:** Keep components under 400 lines
**Rationale:** Atomic design principles, testability
**Alternative Considered:** No size limits
**Outcome:** Enforced by UX review agent

### 2026-02-15: json-render vs Custom DSL
**Decision:** Use json-render for dashboard specs
**Rationale:** Mature library, good DX, extensible
**Alternative Considered:** Custom YAML/JSON DSL
**Outcome:** Dashboard viewer uses json-render

### 2026-01-10: React vs Svelte
**Decision:** React for component library
**Rationale:** Better MCP ecosystem support, larger community
**Alternative Considered:** Svelte, Vue, Web Components
**Outcome:** All components built in React

---

## APPENDIX: COMPONENT CATALOG

### Shipped Components (Phase 1)

| Component | Type | Props | Use Case |
|-----------|------|-------|----------|
| StatCard | Atom | label, value, change, trend | KPI metrics |
| Chart | Organism | type, xAxis, yAxis, data, theme | Data visualization |
| DataTable | Organism | data, columns, height, density | Tabular data |
| Box | Molecule | direction, gap, columns, padding | Layout |
| Heading | Atom | text, level, align | Section titles |
| Text | Atom | content, size, muted, align | Body text |
| Card | Molecule | title, description, variant | Content grouping |
| Divider | Atom | orientation, label | Section separation |
| FormInput | Molecule | label, name, type, required | Form input |
| FormSelect | Molecule | label, name, options | Dropdown |

### Planned Components (Phase 2)

| Component | Type | Status | Target |
|-----------|------|--------|--------|
| HeatmapChart | Organism | Not started | Phase 2.2 |
| ComparisonCard | Molecule | Not started | Phase 2.2 |
| ProfileDashboard | Page | Not started | Phase 2.2 |
| QueryHistory | Organism | Not started | Phase 2.1 |
| ExportButton | Atom | Not started | Phase 2.1 |

### Future Components (Phase 3+)

| Component | Type | Status | Target |
|-----------|------|--------|--------|
| SQLTransparency | Page | Concept | Phase 3 |
| ExecutionMonitor | Organism | Concept | Phase 3 |
| LineageGraph | Organism | Concept | Phase 3 |
| PlanViewer | Page | Vision | Phase 4 |
| WorkflowCanvas | Page | Vision | Phase 4 |

---

**Last Updated:** 2026-03-10
**Next Review:** End of Phase 2 (May 2026)
**Owner:** SurfacesUI Team
**Status:** Foundation Complete, Building Core Data Surfaces
