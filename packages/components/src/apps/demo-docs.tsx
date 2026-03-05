/**
 * Documentation Demo App
 *
 * Displays DEMOS.md content with markdown rendering
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeWrapper } from './ThemeWrapper';
import { MarkdownViewer } from './MarkdownViewer';
import '../theme/tokens.css';

// DEMOS.md content
const DEMOS_CONTENT = `# SurfacesUI Demos

Interactive demonstrations showcasing SurfacesUI components, styling utilities, and MCP integration capabilities.

## Available Demos

### MCP Apps (Production)

These apps are bundled as single-file HTML and served via the MCP protocol.

#### 1. SQL Editor
**File:** \`sql-editor-cdn.html\`
**Access:** http://localhost:3457/sql-editor (when MCP server running)

Full-featured SQL editor with:
- CodeMirror syntax highlighting
- Query execution via MCP bridge
- Results display with table/chart views
- Export functionality
- Theme support

**Key Components:**
- \`SQLEditor\` - Main editor component
- \`CodeMirrorSQLInput\` - SQL input with syntax highlighting
- \`SQLResultsDisplay\` - Organism for displaying query results

#### 2. JSON Render
**File:** \`json-render-cdn.html\`
**Access:** http://localhost:3457/json-render (when MCP server running)

Natural language UI generator:
- Generates UI from text descriptions
- Live preview of rendered components
- JSON spec viewer
- Sample data generation
- Theme switching

**Key Components:**
- \`NLGenerator\` - Natural language input processor
- \`SurfacesRenderer\` - Renders components from JSON specs

---

### Development Demos

These demos are available during development via \`pnpm dev\`.

#### 3. Component Showcase
**File:** \`src/apps/showcase.tsx\`
**Access:** http://localhost:5173/src/apps/showcase.html

Browse all 8 catalog components:
- **Organisms:** SQLResultsDisplay
- **Molecules:** TableWithFilters, ChartWithControls
- **Primitives:** DataTable, Chart, Filter, DensityToggle, ViewModeToggle

Features:
- Interactive component browser
- Category filtering (Organism, Molecule, Primitive)
- Live component previews
- JSON specification viewer
- Usage examples with natural language prompts
- Collapsible sidebar navigation

**Usage:**
\`\`\`bash
pnpm dev
# Navigate to http://localhost:5173/src/apps/showcase.html
\`\`\`

#### 4. Kitchen Sink
**File:** \`src/apps/kitchen-sink.tsx\`
**Access:** http://localhost:5173/src/apps/kitchen-sink.html

Comprehensive showcase of all SurfacesUI primitives and molecules (16 sections):
- Action Ribbon, Alerts, Badge, Buttons
- Checkbox, Chips, Circular Progress, Code Snippet
- Dialog, Divider, Empty State, Form Field
- Icon Button, Progress Bar, Radio, Switch

Features:
- Scroll-to-section navigation
- Dark mode showcase
- Collapsible sidebar navigation
- Live component examples

**Usage:**
\`\`\`bash
pnpm dev
# Navigate to http://localhost:5173/src/apps/kitchen-sink.html
\`\`\`

#### 5. Spacing Utilities
**File:** \`src/apps/demo-spacing.tsx\`
**Access:** http://localhost:5173/src/apps/demo-spacing.html

Comprehensive demonstration of Tailwind v4 spacing utilities:
- Padding (p-*, px-*, py-*, pt-*, pr-*, pb-*, pl-*)
- Margin (m-*, mx-*, my-*, negative margins, auto margins)
- Gap (gap-*, gap-x-*, gap-y-* for flexbox/grid)
- Space Between (space-x-*, space-y-*)
- Responsive spacing examples

Features:
- Visual examples with measurements
- Debugging info showing CSS variable calculations
- Responsive breakpoint demonstrations

#### 6. Catalog Components
**File:** \`src/apps/catalog-demo.tsx\`
**Access:** http://localhost:5173/src/apps/catalog-demo.html

Interactive demo for catalog-to-component rendering:
- Component selector (Chart, DataTable, TableWithFilters, SQLResultsDisplay)
- Live component rendering
- JSON specification viewer

#### 7. Loom Integration
**File:** \`src/apps/demo-loom.tsx\`
**Access:** http://localhost:5173/src/apps/demo-loom.html

Dashboard demonstrating LoomBridge integration:
- Bridge abstraction with non-vantage-mcp backend
- Live data from Loom server (agents, sessions, UI apps)
- Agent chat via Weave RPC
- Health monitoring

**Prerequisites:** Loom server running on http://localhost:5006

---

## Quick Start

### Running MCP Apps

1. **Start the MCP server:**
   \`\`\`bash
   pnpm --filter @surfacesui/server start
   # Or: npx @surfacesui/server
   \`\`\`

2. **Access apps:**
   - SQL Editor: http://localhost:3457/sql-editor
   - JSON Render: http://localhost:3457/json-render

### Running Development Demos

1. **Start the dev server:**
   \`\`\`bash
   pnpm dev
   \`\`\`

2. **Access demos at:**
   - Component Showcase: http://localhost:5173/src/apps/showcase.html
   - Kitchen Sink: http://localhost:5173/src/apps/kitchen-sink.html
   - Spacing Utilities: http://localhost:5173/src/apps/demo-spacing.html
   - Catalog Components: http://localhost:5173/src/apps/catalog-demo.html
   - Loom Integration: http://localhost:5173/src/apps/demo-loom.html

### Building Apps

Build production-ready single-file HTML apps:

\`\`\`bash
# Build all MCP apps
pnpm build:apps

# Output: packages/mcp-adapter/apps/*.html
\`\`\`

---

## Demo Features

All demos include:
- ✅ **Unified Navigation** - Sidebar with logo, version, and demo links
- ✅ **Theme Switching** - Light/dark mode toggle in header
- ✅ **GitHub Link** - Quick access to repository
- ✅ **Responsive Design** - Mobile-friendly layouts
- ✅ **Collapsible Sections** - For demos with multiple views

---

## Component Architecture

### MCP Bridge Pattern

All components use the MCP Bridge for data access (never direct REST APIs):

\`\`\`tsx
// CORRECT
const { data, loading } = useMcpTool('execute_sql', { query, connectionId });

// WRONG - never do this
const response = await fetch('/api/v1/query', ...);
\`\`\`

### Theme System

All styling uses CSS custom properties and Tailwind semantic tokens:
- Colors: \`--background\`, \`--foreground\`, \`--primary\`, etc.
- Border: \`--border\` (automatically applied via \`borderColor.DEFAULT\`)
- Dark mode: \`class\` strategy on document root

### Bundle Sizes

Production MCP apps (gzipped):
- **sql-editor-cdn.html**: ~780 KB (includes CodeMirror + React 19)
- **json-render-cdn.html**: ~674 KB (includes React 19 + renderer)

Target: ~700KB per app with full React + component library.

---

## Resources

- **GitHub:** https://github.com/teradata-labs/surfaces-ui
- **Project README:** [README.md](../../README.md)
- **Testing Guide:** [TESTING_GUIDE.md](../../TESTING_GUIDE.md)
- **JSON Render Testing:** [TEST_JSON_RENDER.md](../../TEST_JSON_RENDER.md)
`;

function DemoDocs() {
  return <MarkdownViewer content={DEMOS_CONTENT} />;
}

// Mount application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ThemeWrapper
      title="Demo Documentation"
      description="Complete guide to all available demos"
      showDemoNav={true}
      currentDemo="docs"
      maxWidth="max-w-[800px]"
    >
      <DemoDocs />
    </ThemeWrapper>
  );
}
