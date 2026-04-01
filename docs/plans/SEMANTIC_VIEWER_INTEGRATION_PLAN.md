# SurfacesUI - Dashboard Viewer & Data Visualization Plan
## Current State & Future Roadmap

**Project:** Interactive Dashboard & Data Visualization Components for MCP
**Last Updated:** 2026-03-10
**Status:** Phase 1 Complete - Foundation Ready

---

## EXECUTIVE SUMMARY

### What We've Built (Phase 1 - COMPLETE ✅)

A working **Dashboard Viewer** MCP app that displays interactive dashboards with:
- **KPI Cards** - Full-width stat cards with trends (up/down/neutral)
- **Charts** - Line, bar, pie, area, scatter charts with ECharts
- **Chart Themes** - 10 accessible color themes with auto light/dark switching
- **Responsive Layout** - Auto-adapts from 1-4 columns based on screen size
- **Theme Integration** - Unified UI theme (light/dark) with chart theme sync
- **MCP Communication** - Reliable postMessage-based data transfer

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│         Claude Desktop (MCP Host)                             │
│  • Calls show_dashboard tool with spec + data                │
│  • Opens ui://dashboard-viewer in sandboxed iframe           │
└──────────────────────────────────────────────────────────────┘
                         ↕ postMessage (ui/notifications/tool-input)
┌──────────────────────────────────────────────────────────────┐
│     Dashboard Viewer (React + json-render)                    │
│  • Receives spec via postMessage                              │
│  • Renders StatCard, Chart, Box, Heading components          │
│  • ChartThemeProvider - auto light/dark theme switching      │
│  • Responsive grid layout (1-4 columns)                       │
└──────────────────────────────────────────────────────────────┘
                         ↕ json-render registry
┌──────────────────────────────────────────────────────────────┐
│     UI Component Registry                                     │
│  • StatCard - KPI metrics with trend indicators              │
│  • Chart - ECharts wrapper with 8 chart types                │
│  • Box - Flexbox/grid layout container                        │
│  • Heading - H1-H4 headings                                   │
│  • Text, Card, FormInput, FormSelect (ready to use)          │
└──────────────────────────────────────────────────────────────┘
```

---

## CURRENT STATE (2026-03-10)

### ✅ Implemented Features

#### 1. Dashboard Viewer App
- **Location:** `packages/components/src/apps/dashboard-viewer.tsx`
- **Bundle:** `packages/mcp-adapter/apps/dashboard-viewer.html` (700KB gzipped)
- **MCP Tool:** `show_dashboard` in `packages/server/src/index.ts`

**Key Features:**
- Receives dashboard spec via `ui/notifications/tool-input` postMessage
- Renders json-render specs with component registry
- Chart theme selection (5 base themes × 2 variants = 10 total)
- Auto light/dark theme switching
- Full-width KPI cards
- Responsive grid layout
- FAB debug panel (toggleable bug icon)

#### 2. Chart Theme System
- **Location:** `packages/components/src/theme/chart-themes.ts`
- **Provider:** `packages/components/src/theme/ChartThemeProvider.tsx`
- **Selector:** `packages/components/src/apps/ChartThemeSelector.tsx`

**Available Themes:**
1. **High Contrast** - Maximum contrast for accessibility
2. **Universal (Colorblind Safe)** - Okabe-Ito palette
3. **Ocean Depths** - Blue monochromatic scale
4. **Natural Elements** - Earth tones
5. **Professional** - Modern corporate palette

**Auto-Switching:**
- User selects base theme (e.g., "Ocean Depths")
- ChartThemeProvider detects UI theme (light/dark)
- Automatically applies correct variant (oceanDepthsLight/oceanDepthsDark)
- Persists preference in localStorage

#### 3. Component Registry
- **Location:** `packages/components/src/catalog/ui-registry.tsx`
- **Dashboard-Specific:** `packages/components/src/apps/dashboard-registry.tsx`

**Available Components:**
- **StatCard** - KPI metric display with trend indicator
- **Chart** - 8 chart types (bar, line, pie, area, scatter, heatmap, stacked-bar, combo)
- **Box** - Layout container (flexbox/grid)
- **Heading** - H1-H4 text headings
- **Text** - Body paragraphs with markdown support
- **Card** - Content card with optional title/description
- **Divider** - Horizontal/vertical separator
- **FormInput** - Text input with label
- **FormSelect** - Dropdown select with label

#### 4. MCP Communication Protocol
- **Documentation:** `MCP-APPS-COMMUNICATION.md`

**Critical Discovery:**
- URL parameters and hash fragments are **stripped by Claude Desktop**
- Data must be passed via **postMessage only**
- Format: `ui/notifications/tool-input` with `params.arguments.*`

**Working Example:**
```typescript
// In dashboard-viewer.tsx
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.method === 'ui/notifications/tool-input') {
    const spec = event.data.params.arguments.spec;
    setSpec(spec);
  }
});
```

**Server Tool Handler:**
```typescript
// In packages/server/src/index.ts
if (name === "show_dashboard") {
  return {
    _meta: {
      ui: {
        resourceUri: "ui://dashboard-viewer",
      },
    },
    content: [
      { type: "text", text: title ? `Opening dashboard: ${title}` : "Opening dashboard..." },
    ],
  };
}
```

Claude Desktop automatically extracts `args.spec` and sends it via postMessage.

#### 5. Spec Format
```typescript
{
  root: "mainBox",
  elements: {
    mainBox: {
      type: "Box",
      props: { gap: 24, direction: "column" },
      children: ["heading", "statsRow", "chartBox"]
    },
    heading: {
      type: "Heading",
      props: { text: "Dashboard Title", level: 2 }
    },
    statsRow: {
      type: "Box",
      props: { gap: 16, direction: "row" },
      children: ["kpi1", "kpi2", "kpi3"]
    },
    kpi1: {
      type: "StatCard",
      props: {
        label: "Total Revenue",
        value: "$284,500",
        change: "+18%",
        trend: "up"
      }
    },
    chartBox: {
      type: "Chart",
      props: {
        type: "line",
        xAxis: "month",      // CRITICAL: Use xAxis/yAxis, NOT xKey/yKey
        yAxis: "revenue",
        height: 300
      }
    }
  },
  state: {
    data: [
      { month: "Jan", revenue: 50000, users: 1200 },
      { month: "Feb", revenue: 55000, users: 1350 },
      // ... more data
    ]
  }
}
```

---

## KNOWN ISSUES & FIXES

### ✅ Fixed Issues

1. **Chart Theme Not Applying**
   - **Problem:** Charts were re-rendering but colors weren't changing
   - **Root Cause:** `generateChartOption()` was hardcoding colors, overriding theme
   - **Fix:** Removed `itemStyle: { color: ... }` from chart options
   - **Result:** ECharts now uses theme color palette automatically

2. **Duplicate Data Across Charts**
   - **Problem:** All charts showed the same data (revenue chart data)
   - **Root Cause:** Server tool description said to use `xKey`/`yKey`, but schema expects `xAxis`/`yAxis`
   - **Fix:**
     - Updated server tool description to specify `xAxis`/`yAxis`
     - Added backwards compatibility in dashboard registry to accept both
   - **Result:** Each chart now displays its specified data column

3. **Duplicate Theme Names in Selector**
   - **Problem:** Dropdown showed "High Contrast", "High Contrast", "High Contrast Light", "High Contrast Dark"
   - **Root Cause:** Theme selector was showing all variants instead of base themes only
   - **Fix:** Simplified selector to show 5 base themes, auto-switch light/dark
   - **Result:** Clean dropdown with 5 unique options

4. **Debug Panel Blocking Content**
   - **Problem:** Fixed debug panel at top blocked dashboard content
   - **Fix:** Converted to FAB (floating action button) in bottom-right
   - **Result:** Toggle-able debug panel that doesn't interfere with content

### ⚠️ Current Limitations

1. **Single Chart Per Element**
   - Charts cannot be grouped or compared side-by-side easily
   - **Workaround:** Use Box with `direction: "row"` and multiple Chart children

2. **No Chart Interactivity**
   - Charts are read-only visualizations
   - No drill-down, filtering, or data exploration
   - **Future:** Add chart click handlers with MCP tool calls

3. **Static Data Only**
   - Dashboard displays snapshot data from spec
   - No live updates or data refresh
   - **Future:** Add polling or websocket support for real-time updates

4. **Limited Layout Control**
   - Responsive layout is automatic (1-4 columns)
   - Cannot manually control card placement
   - **Future:** Add grid template areas for custom layouts

---

## PHASE 2 - SQL RESULTS INTEGRATION (PLANNED)

### Goal
Enable Claude to execute SQL queries and automatically visualize results in dashboards.

### Proposed Architecture

```
User: "Show me revenue by month from the sales database"
                         ↓
Claude Desktop executes:
1. execute_sql("SELECT month, SUM(revenue) FROM sales GROUP BY month")
2. show_dashboard(spec={...}, data=results)
                         ↓
Dashboard Viewer displays chart with live query results
```

### Required Components

#### 1. SQL Execution Tool
```typescript
// In packages/server/src/index.ts
{
  name: "execute_sql",
  description: "Execute SQL query and return results",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SQL query to execute" },
      connectionId: { type: "string", description: "Optional connection ID" },
    },
    required: ["query"],
  },
}
```

#### 2. Auto-Dashboard Generation
Claude should automatically:
1. Detect numeric columns → suggest Chart
2. Detect categorical + numeric → suggest bar/pie chart
3. Detect time series → suggest line chart
4. Calculate aggregates → suggest StatCard

#### 3. Query History & Caching
- Store last N query results in memory
- Allow dashboard to reference `queryId` instead of inline data
- Enable refresh button to re-run query

### Implementation Steps

**2.1. Database Adapter Interface** (1 week)
- Abstract SQL execution behind interface
- Support PostgreSQL, MySQL, SQLite initially
- Connection pool management
- Error handling & timeout

**2.2. SQL Results Component** (1 week)
- Already exists: `SQLResultsDisplay.tsx`
- Integrate with dashboard viewer
- Add export functionality (CSV, JSON)

**2.3. Auto-Spec Generation** (1 week)
- Analyze query results schema
- Generate appropriate dashboard spec
- Suggest chart types based on data types

**2.4. Testing** (3 days)
- Test with multiple databases
- Performance testing with large results
- Error handling edge cases

---

## PHASE 3 - ADVANCED VISUALIZATIONS (PLANNED)

### Goal
Expand beyond basic charts to specialized data visualizations.

### Proposed Components

#### 1. Data Table with Sorting/Filtering
- **Component:** `DataTable` (already exists)
- **Features:**
  - Virtual scrolling for large datasets
  - Column sorting
  - Search/filter
  - Density toggle (compact/comfortable/spacious)

#### 2. Metric Comparisons
- **Component:** `ComparisonCard`
- **Features:**
  - Side-by-side metric comparison
  - Sparklines for trends
  - Variance indicators

#### 3. Heatmaps
- **Component:** `Heatmap`
- **Features:**
  - Correlation matrices
  - Time-based heatmaps
  - Custom color scales

#### 4. Geo Maps
- **Component:** `GeoChart`
- **Features:**
  - Choropleth maps
  - Bubble maps
  - Custom region highlighting

### Implementation Estimate
- 2 weeks per component
- Total: 8 weeks for all advanced visualizations

---

## PHASE 4 - SEMANTIC ANALYSIS (FUTURE)

### Goal
Intelligent database insights and recommendations.

### Features (Vision Only)

#### 1. Schema Explorer
- Interactive database schema visualization
- Table relationships
- Column statistics
- Usage patterns

#### 2. Query Recommendations
- Suggest optimizations for slow queries
- Identify missing indexes
- Recommend materialized views

#### 3. Data Quality Monitoring
- Detect anomalies
- Track data freshness
- Validate constraints

#### 4. Automated Insights
- Trend detection
- Outlier identification
- Correlation discovery

**Note:** This phase is aspirational and depends on Phase 2/3 completion.

---

## TECHNICAL DOCUMENTATION

### File Structure

```
packages/
├── components/
│   ├── src/
│   │   ├── apps/
│   │   │   ├── dashboard-viewer.tsx         # Main dashboard app
│   │   │   ├── dashboard-registry.tsx       # Dashboard-specific registry
│   │   │   ├── ChartThemeSelector.tsx       # Theme dropdown
│   │   │   ├── ChartWithTheme.tsx           # Theme-aware chart wrapper
│   │   │   ├── MCPDebugPanel.tsx            # FAB debug panel
│   │   │   └── ThemeToggle.tsx              # Light/dark mode toggle
│   │   ├── catalog/
│   │   │   ├── ui-registry.tsx              # Base component registry
│   │   │   ├── ui-schema.ts                 # Zod schemas for components
│   │   │   └── schema.ts                    # Data-viz schemas
│   │   ├── theme/
│   │   │   ├── chart-themes.ts              # 10 ECharts themes
│   │   │   ├── ChartThemeProvider.tsx       # Chart theme context
│   │   │   └── ThemeProvider.tsx            # UI theme context
│   │   ├── primitives/
│   │   │   └── chart/
│   │   │       ├── Chart.tsx                # ECharts wrapper
│   │   │       ├── types.ts                 # Chart prop types
│   │   │       └── utils.ts                 # Chart option generation
│   │   └── bridge/
│   │       ├── McpAppsBridge.ts             # MCP tool call bridge
│   │       └── McpBridgeProvider.tsx        # Bridge context
│   └── dist/
│       └── apps/
│           └── dashboard-viewer.html        # 700KB gzipped bundle
├── mcp-adapter/
│   ├── src/
│   │   ├── registry.ts                      # Resource registration
│   │   └── resources.ts                     # Resource reading
│   └── apps/
│       └── dashboard-viewer.html            # Copied from components/dist
└── server/
    └── src/
        └── index.ts                          # MCP server with show_dashboard tool
```

### Build Process

```bash
# 1. Build component library
cd packages/components
pnpm build

# 2. Build dashboard viewer HTML bundle
pnpm build:apps
# → Creates dist/apps/dashboard-viewer.html (single-file HTML bundle)

# 3. Copy to mcp-adapter
cd ../mcp-adapter
pnpm build
# → Runs prebuild hook which copies HTML to apps/

# 4. Build server
cd ../server
pnpm build
# → TypeScript compilation

# 5. Run server (for Claude Desktop)
cd ../../
pnpm --filter @surfacesui/server start
```

### Adding to Claude Desktop

**Config:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "surfaces-ui": {
      "command": "npx",
      "args": ["@surfacesui/server"],
      "env": {}
    }
  }
}
```

**Restart Claude Desktop** to pick up changes.

### Creating a Dashboard

**Prompt to Claude:**
```
Create a dashboard showing:
- Total revenue KPI card with +18% trend
- Revenue by month line chart
- Active users bar chart
Use this data: [paste data array]
```

**Claude will call:**
```typescript
show_dashboard({
  spec: {
    root: "mainBox",
    elements: { /* ... */ },
    state: { data: [ /* ... */ ] }
  },
  title: "Revenue Dashboard"
})
```

---

## TESTING & DEBUGGING

### Debug Panel Usage

**Enable:** Set `ENABLE_DEBUG = true` in `dashboard-viewer.tsx`

**Features:**
- Click green bug FAB in bottom-right corner
- View all postMessage events
- Check URL, hash, and message structure
- Real-time logging of chart initialization

**Typical Debug Output:**
```
[08:30:15] 🚀 MCP App Mounted
[08:30:15] URL: https://[hash].claudemcpcontent.com/mcp_apps?resource-src=https://assets.claude.ai
[08:30:15] Hash: (empty)
[08:30:16] 📨 Message from: https://assets.claude.ai
[08:30:16]    Keys: method, params, jsonrpc
[08:30:16]    Method: ui/notifications/tool-input
[08:30:16]    Data: {"method":"ui/notifications/tool-input","params":{"arguments":{"spec":{...
[08:30:16] [DashboardViewer] Received spec via tool-input notification
[08:30:16] [Chart] Initializing with theme: oceanDepthsDark
[08:30:16] [Chart] ECharts instance created
```

### Common Issues

**1. Charts Not Appearing**
- Check debug panel for `[Chart] Initializing with theme`
- Verify data exists in spec.state.data
- Ensure xAxis/yAxis match data columns

**2. Theme Not Changing**
- Check `[Chart] Initializing with theme: [new theme]`
- Verify theme is registered (check available themes in logs)
- Hard refresh if cache issue

**3. Duplicate Data**
- Verify each Chart element has unique xAxis/yAxis props
- Check tool description in server/src/index.ts
- Use debug panel to inspect spec structure

**4. Layout Issues**
- Verify Box components have correct `direction` prop
- Check gap values (should be 16-24px)
- Use browser DevTools to inspect grid layout

---

## QUALITY STANDARDS

### Performance Targets
- Dashboard load time: < 1 second
- Chart render time: < 500ms per chart
- Theme switch: < 200ms
- Bundle size: < 800KB gzipped

### Accessibility
- WCAG AA 2.2 compliance
- Keyboard navigation support
- Screen reader friendly
- High contrast themes available

### Browser Support
- Chrome 90+ (primary)
- Firefox 88+
- Safari 14+
- Edge 90+

### Code Quality
- TypeScript strict mode
- ESLint with security plugin
- 80%+ test coverage
- No P0/P1 bugs in production

---

## ROADMAP SUMMARY

### ✅ Phase 1: Foundation (COMPLETE)
- Dashboard viewer app
- Chart theme system
- Component registry
- MCP communication protocol
- **Timeline:** 2 weeks (actual)

### 🚧 Phase 2: SQL Integration (PLANNED)
- Database adapters
- Auto-dashboard generation
- Query history & caching
- **Timeline:** 3-4 weeks (estimated)

### 📋 Phase 3: Advanced Visualizations (PLANNED)
- Data tables with filtering
- Metric comparisons
- Heatmaps & geo maps
- **Timeline:** 8 weeks (estimated)

### 🔮 Phase 4: Semantic Analysis (FUTURE)
- Schema exploration
- Query recommendations
- Data quality monitoring
- Automated insights
- **Timeline:** TBD (research phase)

---

## APPENDIX: KEY LEARNINGS

### MCP Apps Communication
1. **URL parameters don't work** - Stripped by Claude Desktop
2. **postMessage is the only way** - Use `ui/notifications/tool-input`
3. **Debug panels are essential** - No DevTools in Claude Desktop
4. **Cache is aggressive** - Restart Claude Desktop after rebuilds

### Chart Theming
1. **Don't hardcode colors** - Let ECharts use theme palette
2. **Re-init on theme change** - Dispose old instance, create new
3. **Trigger re-render after init** - Use state counter to force option update
4. **Auto light/dark switching** - Users expect theme sync with UI

### Component Design
1. **Full-width KPI cards** - Use `col-span-full` class
2. **Responsive grids** - Auto-adapt based on screen size
3. **Larger gaps** - 24px feels better than 16px
4. **Consistent borders** - Use `border-border` color

### Documentation
1. **Screenshots are critical** - Show working examples
2. **Troubleshooting sections** - Document common issues
3. **Code examples** - Show actual working code, not pseudo-code
4. **Version history** - Track what changed and why

---

**Last Updated:** 2026-03-10
**Status:** Phase 1 Complete ✅ | Phase 2 Planning 📋
**Next Review:** After Phase 2 implementation begins
