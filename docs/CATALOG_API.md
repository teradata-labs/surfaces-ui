# Catalog API Reference

Complete reference for SurfacesUI json-render catalog components.

## Overview

The catalog defines 8 AI-specifiable components organized by atomic design:

- **Organisms** (1): SQLResultsDisplay - Complete SQL results with table/chart views
- **Molecules** (2): TableWithFilters, ChartWithControls - Composed multi-feature components
- **Primitives** (5): DataTable, Chart, Filter, DensityToggle, ViewModeToggle - Single-responsibility building blocks

## Component Specifications

### SQLResultsDisplay (Organism)

**Purpose**: Complete SQL query results display with table view, chart view, and export capabilities.

**When to use**: Displaying full SQL query results with visualization and interaction options.

**Props**:
```typescript
{
  sql: string;                                 // SQL query that produced results (optional)
  context: 'web' | 'mcp-apps';                // Execution context (default: 'web')
  projectId: string;                           // Project ID for Teradata link (optional)
  teradataBaseUrl: string;                     // Base URL for Teradata app (optional)
  initialViewMode: 'table' | 'chart';         // Initial view mode (default: 'table')
  tableHeight: number;                         // Table container height in pixels (default: 400)
  chartHeight: number;                         // Chart container height in pixels (default: 400)
}
```

**Example spec**:
```json
{
  "root": "results",
  "elements": {
    "results": {
      "type": "SQLResultsDisplay",
      "props": {
        "sql": "SELECT * FROM sales WHERE year = 2023",
        "context": "web",
        "initialViewMode": "table",
        "tableHeight": 400,
        "chartHeight": 300
      }
    }
  }
}
```

**Example prompts**:
- "Show SQL results with both table and chart views"
- "Display query results as a complete view with export options"
- "Create a full results display with table and visualization"
- "Show the data with table view initially but allow switching to chart"
- "Display complete SQL results with export functionality"

**Context data provided**:
- `data`: Query results in {rows, columns} or {data, columns} format
- `onConfigChange`: Handler for view mode and height changes
- `actions`: Export and copy actions

---

### TableWithFilters (Molecule)

**Purpose**: Data table with integrated search filter and density toggle.

**When to use**: When users need to search, filter, and adjust the density of tabular data.

**Props**:
```typescript
{
  columns: string[];                           // Column names to display (optional, auto-detected)
  height: number;                              // Table height in pixels (default: 400)
  initialDensity: 'compact' | 'comfortable' | 'spacious'; // Initial row density (default: 'comfortable')
  showFilter: boolean;                         // Show search filter (default: true)
  showDensityToggle: boolean;                  // Show density toggle (default: true)
  virtualScrolling: boolean;                   // Enable virtual scrolling (default: true)
}
```

**Example spec**:
```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "TableWithFilters",
      "props": {
        "columns": ["id", "name", "email", "status"],
        "height": 500,
        "initialDensity": "comfortable",
        "showFilter": true,
        "showDensityToggle": true,
        "virtualScrolling": true
      }
    }
  }
}
```

**Example prompts**:
- "Show a filterable table with user data"
- "Display employee records with search and density controls"
- "Create a table I can search and adjust spacing"
- "Show data in a table with search filter and compact mode option"
- "Display records with filtering and density toggle"

**Context data provided**:
- `data`: Array of table rows (Record<string, unknown>[])
- `onRowClick`: Row selection handler (optional)

---

### ChartWithControls (Molecule)

**Purpose**: Chart visualization with interactive axis and type configuration panel.

**When to use**: When users need to adjust chart visualization settings dynamically.

**Props**:
```typescript
{
  columns: string[];                           // Columns for axis selection (optional, auto-detected)
  height: number;                              // Chart height in pixels (default: 400)
  initialChartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap'; // Initial chart type (default: 'bar')
  initialXAxis: string;                        // Initial X-axis column (optional)
  initialYAxis: string;                        // Initial Y-axis column (optional)
  showControls: boolean;                       // Show configuration panel (default: true)
  controlsCollapsed: boolean;                  // Controls collapsed by default (default: false)
}
```

**Example spec**:
```json
{
  "root": "chart",
  "elements": {
    "chart": {
      "type": "ChartWithControls",
      "props": {
        "height": 400,
        "initialChartType": "line",
        "initialXAxis": "date",
        "initialYAxis": "revenue",
        "showControls": true,
        "controlsCollapsed": false
      }
    }
  }
}
```

**Example prompts**:
- "Show a line chart with axis controls"
- "Display revenue over time with adjustable settings"
- "Create a bar chart where I can change what's plotted"
- "Show data visualization with chart type and axis options"
- "Display chart with configuration panel for customization"

**Context data provided**:
- `data`: Array of data points (Record<string, unknown>[])
- `onConfigChange`: Handler for chart configuration changes

---

### DataTable (Primitive)

**Purpose**: Virtualized data table for large datasets with sorting and search.

**When to use**: Detailed row-by-row data inspection, especially for large datasets.

**Props**:
```typescript
{
  columns: string[];                           // Column names (optional, auto-detected)
  height: number;                              // Container height in pixels (default: 400)
  density: 'compact' | 'comfortable' | 'spacious'; // Row density (default: 'comfortable')
  virtualScrolling: boolean;                   // Enable virtual scrolling (default: true)
  showRowNumbers: boolean;                     // Show row number column (default: false)
}
```

**Performance**: Optimized for 100K+ rows using TanStack Virtual with dynamic overscan (5 for <1K rows, 10 for 1K-50K rows, 15 for 50K+ rows).

**Example spec**:
```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "DataTable",
      "props": {
        "columns": ["id", "name", "value"],
        "height": 400,
        "density": "comfortable",
        "virtualScrolling": true,
        "showRowNumbers": false
      }
    }
  }
}
```

**Example prompts**:
- "Show data in a table"
- "Display records in tabular format"
- "Create a data table with compact rows"
- "Show the data with row numbers"
- "Display large dataset in a virtualized table"

**Context data provided**:
- `data`: Array of table rows (Record<string, unknown>[])
- `onRowClick`: Row selection handler (optional)

---

### Chart (Primitive)

**Purpose**: ECharts-based visualization supporting multiple chart types with theme integration.

**When to use**: Visualizing trends, comparisons, distributions, and patterns in data.

**Props**:
```typescript
{
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'heatmap' | 'stacked-bar' | 'combo'; // Chart type (default: 'bar')
  xAxis: string;                               // Column name for X-axis (optional)
  yAxis: string;                               // Column name for Y-axis (optional)
  theme: string;                               // ECharts theme name (optional)
  height: number;                              // Chart height in pixels (default: 400)
  showDataLabels: boolean;                     // Show values on chart elements (default: false)
}
```

**Example spec**:
```json
{
  "root": "chart",
  "elements": {
    "chart": {
      "type": "Chart",
      "props": {
        "type": "bar",
        "xAxis": "month",
        "yAxis": "sales",
        "height": 300,
        "showDataLabels": true
      }
    }
  }
}
```

**Example prompts**:
- "Show a bar chart of monthly sales"
- "Display revenue as a line chart"
- "Create a pie chart showing distribution"
- "Visualize the data as a scatter plot"
- "Show trends with a chart"

**Context data provided**:
- `data`: Array of data points (Record<string, unknown>[])

---

### Filter (Primitive)

**Purpose**: Column-specific search/filter input with debouncing.

**When to use**: Adding search capability to tables or lists.

**Props**:
```typescript
{
  placeholder: string;                         // Placeholder text (default: 'Search...')
  debounceMs: number;                          // Debounce delay in ms (default: 0)
  ariaLabel: string;                           // Accessibility label (default: 'Search filter')
}
```

**Example spec**:
```json
{
  "root": "filter",
  "elements": {
    "filter": {
      "type": "Filter",
      "props": {
        "placeholder": "Search records...",
        "debounceMs": 300,
        "ariaLabel": "Filter table data"
      }
    }
  }
}
```

**Example prompts**:
- "Add a search filter"
- "Show a search box with debouncing"
- "Create a filter input for the table"

**Context data provided**:
- `value`: Current filter value (controlled by parent)
- `onChange`: Handler for filter changes

---

### DensityToggle (Primitive)

**Purpose**: Switch between compact, comfortable, and spacious display densities.

**When to use**: Allowing users to adjust row spacing in tables or lists.

**Props**:
```typescript
{
  value: 'compact' | 'comfortable' | 'spacious'; // Current density (default: 'comfortable')
  showLabels: boolean;                         // Show text labels (default: false)
}
```

**Example spec**:
```json
{
  "root": "toggle",
  "elements": {
    "toggle": {
      "type": "DensityToggle",
      "props": {
        "value": "comfortable",
        "showLabels": false
      }
    }
  }
}
```

**Example prompts**:
- "Add a density toggle"
- "Show compact/comfortable/spacious options"
- "Let users adjust row spacing"

**Context data provided**:
- `onChange`: Handler for density changes (controlled by parent)

---

### ViewModeToggle (Primitive)

**Purpose**: Switch between table and chart view modes.

**When to use**: Providing multiple visualization options for the same data.

**Props**:
```typescript
{
  modes: ('table' | 'chart')[]; // Available view modes (default: ['table', 'chart'])
  activeMode: 'table' | 'chart'; // Currently active mode (default: 'table')
  showLabels: boolean;           // Show text labels (default: true)
}
```

**Example spec**:
```json
{
  "root": "toggle",
  "elements": {
    "toggle": {
      "type": "ViewModeToggle",
      "props": {
        "modes": ["table", "chart"],
        "activeMode": "table",
        "showLabels": true
      }
    }
  }
}
```

**Example prompts**:
- "Add a view mode toggle"
- "Show table/chart switcher"
- "Let users switch between table and chart views"

**Context data provided**:
- `onModeChange`: Handler for mode changes (controlled by parent)

---

## Catalog Constraints

### Prop Count Limits

Each component limited to 5-8 props for AI describability (json-render constraint):

| Component | Props | Status |
|-----------|-------|--------|
| DataTable | 5 | ✓ Within limit |
| Chart | 6 | ✓ Within limit |
| Filter | 3 | ✓ Within limit |
| DensityToggle | 2 | ✓ Within limit |
| ViewModeToggle | 3 | ✓ Within limit |
| TableWithFilters | 6 | ✓ Within limit |
| ChartWithControls | 7 | ✓ Within limit |
| SQLResultsDisplay | 7 | ✓ Within limit |

### Context Data vs Props

Components receive data from two sources:

1. **AI-specifiable props**: Configuration values the AI can set (defined in catalog schema)
2. **Context data**: Runtime data provided by application (rows, callbacks, state)

**Why this matters**: AI generates props only. Context data comes from your application via SurfacesRenderer.

**Example**:
```tsx
// AI generates this spec:
const spec = {
  root: 'table',
  elements: {
    table: {
      type: 'DataTable',
      props: { columns: ['id', 'name'], height: 400 }, // AI-specifiable
    },
  },
};

// Your app provides context data:
<SurfacesRenderer
  spec={spec}
  initialState={{
    data: queryResults, // Context data (not AI-specifiable)
  }}
/>
```

### Spec Structure

All json-render specs require this structure:

```json
{
  "root": "elementId",
  "elements": {
    "elementId": {
      "type": "ComponentType",
      "props": { /* component props */ }
    }
  }
}
```

The `root` field specifies which element in the `elements` object is the top-level component.

## Design Tokens

All components use CSS custom properties for theming:

- `--background`, `--foreground` - Base colors
- `--primary`, `--secondary` - Accent colors
- `--border`, `--input` - UI element colors
- `--spacing-*` - Spacing scale (affected by density)
- `--font-*` - Typography scale

Density variants scale spacing via CSS custom properties (0.8x compact, 1.0x comfortable, 1.2x spacious).

## Actions

Components can trigger actions via the ActionProvider:

- **export_csv**: Export current data to CSV file
  - Params: `{ filename: string }` (default: 'export.csv')

- **copy_json**: Copy data as JSON to clipboard
  - Params: `{}`

- **execute_sql**: Execute SQL query via MCP Bridge
  - Params: `{ query: string, connection_id?: string }`
  - Note: Requires bridge prop on SurfacesRenderer

## Next Steps

- See [Integration Guide](./INTEGRATION_GUIDE.md) for usage in your application
- See [Registry Extension](./REGISTRY_EXTENSION.md) to add custom components
