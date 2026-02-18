# Natural Language UI Generation - Example Prompts

This guide shows how to describe UIs in natural language for AI generation.
The AI understands the SurfacesUI component catalog and generates valid
json-render specifications from your descriptions.

> **Note:** Before using UI generation, configure your LLM provider.
> See [LLM Provider Setup Guide](./llm-providers.md).

## Quick Start

Simple prompts work well:

| Prompt | Generated Component |
|--------|---------------------|
| "Show a table of users" | DataTable |
| "Display sales in a bar chart" | Chart (type: bar) |
| "Let me filter and view customer data" | TableWithFilters |
| "Show query results with table and chart options" | SQLResultsDisplay |

## Component Examples

### Primitives

#### Chart

Use Chart for data visualization - trends, comparisons, distributions.

**Example prompts:**
- "Show monthly revenue as a line chart"
- "Create a bar chart comparing product sales by category"
- "Display market share as a pie chart"
- "Scatter plot of price vs quantity"
- "Area chart showing cumulative totals over time"

**Prompt tips:**
- Mention chart type: bar, line, pie, scatter, area, heatmap
- Specify axes: "revenue on Y axis, month on X axis"
- Request labels: "show values on each bar"

**Generated spec example:**
```json
{
  "root": "chart",
  "elements": {
    "chart": {
      "type": "Chart",
      "props": {
        "type": "line",
        "xAxis": "month",
        "yAxis": "revenue",
        "height": 400,
        "showDataLabels": true
      }
    }
  }
}
```

#### DataTable

Use DataTable for detailed row-by-row data inspection.

**Example prompts:**
- "Show all user records in a table"
- "Display order details with compact rows"
- "Table of products with row numbers"
- "Large dataset table (use virtual scrolling)"

**Prompt tips:**
- Specify columns: "columns: id, name, email, status"
- Mention density: "compact rows" or "spacious layout"
- Large data: "with virtual scrolling" (auto-enabled by default)

**Generated spec example:**
```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "DataTable",
      "props": {
        "columns": ["id", "name", "email", "status"],
        "height": 400,
        "density": "comfortable",
        "virtualScrolling": true,
        "showRowNumbers": false
      }
    }
  }
}
```

#### Filter

Use Filter combined with DataTable for searchable data.

**Example prompts:**
- "Searchable user table"
- "Table with filter, 200ms debounce"
- "Add search to the employee list"

**Prompt tips:**
- Placeholder text: "search placeholder: Find users..."
- Debounce: "with 150ms debounce" (reduces API calls)

#### DensityToggle

Use DensityToggle to let users adjust row spacing.

**Example prompts:**
- "Table with density selector"
- "Add density toggle with labels"

#### ViewModeToggle

Use ViewModeToggle to switch between table and chart views.

**Example prompts:**
- "Data with table/chart switcher"
- "Toggle between table and chart views"

### Molecules

#### TableWithFilters

Combines DataTable + Filter + DensityToggle in one component.

**Example prompts:**
- "Filterable table of customers"
- "Employee directory with search and density options"
- "Product catalog with filter, compact by default"

**Prompt tips:**
- This is the go-to for interactive data tables
- Includes search and density controls by default
- Specify initial density: "start in compact mode"

**Generated spec example:**
```json
{
  "root": "table",
  "elements": {
    "table": {
      "type": "TableWithFilters",
      "props": {
        "columns": ["id", "name", "department", "salary"],
        "height": 500,
        "initialDensity": "compact",
        "showFilter": true,
        "showDensityToggle": true,
        "virtualScrolling": true
      }
    }
  }
}
```

#### ChartWithControls

Chart with configuration panel for type/axis selection.

**Example prompts:**
- "Chart with options to change type and axes"
- "Interactive chart, let users pick bar/line/pie"
- "Data visualization with collapsible controls"

**Prompt tips:**
- Users can change chart type at runtime
- Controls can start collapsed: "controls hidden by default"
- Specify initial type: "start as line chart"

**Generated spec example:**
```json
{
  "root": "chart",
  "elements": {
    "chart": {
      "type": "ChartWithControls",
      "props": {
        "height": 400,
        "initialChartType": "bar",
        "showControls": true,
        "controlsCollapsed": false
      }
    }
  }
}
```

### Organisms

#### SQLResultsDisplay

Complete SQL results viewer with table, chart, and export options.

**Example prompts:**
- "Full SQL results display for this query"
- "Query results with table and chart views, export options"
- "Show SQL results starting in chart mode"

**Prompt tips:**
- Best for complete data exploration interfaces
- Includes view mode toggle, density, and export
- Specify initial view: "start with chart view"
- Mention context if needed: "for MCP Apps environment"

**Generated spec example:**
```json
{
  "root": "results",
  "elements": {
    "results": {
      "type": "SQLResultsDisplay",
      "props": {
        "sql": "SELECT * FROM sales",
        "context": "web",
        "initialViewMode": "table",
        "tableHeight": 400,
        "chartHeight": 400
      }
    }
  }
}
```

## Common Patterns

### Dashboard with Multiple Views

**Prompt:**
"Sales dashboard: bar chart of revenue by region, and a filterable table of recent orders"

This generates a spec with multiple elements.

### Data Exploration Interface

**Prompt:**
"Interactive data explorer: let users switch between table and chart, with filtering and density options"

Best served by SQLResultsDisplay or TableWithFilters + ChartWithControls.

### Compact Data Display

**Prompt:**
"Show 100 records in a compact table with row numbers"

Generates DataTable with compact density and row numbers enabled.

## Tips for Better Results

1. **Be specific about component type** when you know what you want
   - "bar chart" vs just "chart"
   - "filterable table" vs just "table"

2. **Mention key props** that matter to you
   - "400px tall"
   - "compact density"
   - "with virtual scrolling"

3. **Describe the use case** for complex UIs
   - "for exploring large datasets"
   - "for a quick status overview"

4. **Start simple** and iterate
   - First prompt: "Show users in a table"
   - Refine: "Make it filterable with compact rows"

## Error Handling

If your prompt results in an invalid spec:
- Check that component names are spelled correctly
- Verify prop values are valid (e.g., density must be compact/comfortable/spacious)
- The fallback UI will show validation errors with details

## API Reference

See the [Catalog Schema](/packages/components/src/catalog/schema.ts) for complete prop definitions.
