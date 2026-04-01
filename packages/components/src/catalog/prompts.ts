/**
 * AI Prompt Generation Utilities for json-render Catalog
 *
 * Generates coherent, AI-consumable descriptions of components
 * for use in LLM prompts that generate UI specifications.
 *
 * Note: Catalog schemas only include AI-specifiable props.
 * Runtime props (callbacks, className) and context props (data)
 * are handled by registry wrappers, not specified by AI.
 */
import {
  ChartSchema,
  DataTableSchema,
  FilterSchema,
  DensityToggleSchema,
  ViewModeToggleSchema,
  TableWithFiltersSchema,
  ChartWithControlsSchema,
  SQLResultsDisplaySchema,
} from './schema';
import type { z } from 'zod';
import { generateComponentCatalogPrompt } from './component-schemas';

// Component definitions for prompt generation
const componentDefinitions = {
  // Primitives
  Chart: {
    schema: ChartSchema,
    description: 'Render data as a chart using ECharts with theme integration. Use for visualizing trends, comparisons, and distributions.',
    category: 'primitive',
  },
  DataTable: {
    schema: DataTableSchema,
    description: 'Display tabular data with virtual scrolling for large datasets. Use for detailed row-by-row data inspection.',
    category: 'primitive',
  },
  Filter: {
    schema: FilterSchema,
    description: 'Filter table data by search term or column-specific filters. Combine with DataTable for searchable data.',
    category: 'primitive',
  },
  DensityToggle: {
    schema: DensityToggleSchema,
    description: 'Toggle between compact, comfortable, and spacious row density. Use with DataTable.',
    category: 'primitive',
  },
  ViewModeToggle: {
    schema: ViewModeToggleSchema,
    description: 'Toggle between table and chart view modes. Use to switch visualization types.',
    category: 'primitive',
  },
  // Molecules
  TableWithFilters: {
    schema: TableWithFiltersSchema,
    description: 'Data table with search filter and density toggle',
    category: 'molecule',
  },
  ChartWithControls: {
    schema: ChartWithControlsSchema,
    description: 'Chart with type/axis configuration panel',
    category: 'molecule',
  },
  // Organisms
  SQLResultsDisplay: {
    schema: SQLResultsDisplaySchema,
    description: 'Full SQL results with table/chart views and export',
    category: 'organism',
  },
} as const;

const actionDefinitions = {
  export_csv: 'Export current data to CSV file',
  copy_json: 'Copy data as JSON to clipboard',
} as const;

type ComponentName = keyof typeof componentDefinitions;

/**
 * Example prompts for each component type.
 * Used for documentation and testing AI prompt generation.
 */
interface PromptExample {
  prompt: string;
  description: string;
  expectedComponent: string;
}

const PROMPT_EXAMPLES: Record<ComponentName, PromptExample[]> = {
  Chart: [
    { prompt: "Show monthly sales as a line chart", description: "Time series visualization", expectedComponent: "Chart" },
    { prompt: "Create a bar chart comparing department budgets", description: "Category comparison", expectedComponent: "Chart" },
    { prompt: "Display market share as a pie chart", description: "Part-to-whole relationship", expectedComponent: "Chart" },
  ],
  DataTable: [
    { prompt: "Show all customer records in a table", description: "Basic data table", expectedComponent: "DataTable" },
    { prompt: "Display orders with compact rows for dense data", description: "Compact density", expectedComponent: "DataTable" },
    { prompt: "Table of products with row numbers", description: "With row numbers", expectedComponent: "DataTable" },
  ],
  Filter: [
    { prompt: "Add search to filter the table", description: "Search input", expectedComponent: "Filter" },
    { prompt: "Filter with 200ms debounce", description: "With debounce", expectedComponent: "Filter" },
  ],
  DensityToggle: [
    { prompt: "Let users change row density", description: "Density control", expectedComponent: "DensityToggle" },
    { prompt: "Add density toggle with text labels", description: "With labels", expectedComponent: "DensityToggle" },
  ],
  ViewModeToggle: [
    { prompt: "Toggle between table and chart views", description: "View switcher", expectedComponent: "ViewModeToggle" },
  ],
  TableWithFilters: [
    { prompt: "Filterable table of employees", description: "Searchable table", expectedComponent: "TableWithFilters" },
    { prompt: "Product catalog with search and density options", description: "Full featured table", expectedComponent: "TableWithFilters" },
  ],
  ChartWithControls: [
    { prompt: "Interactive chart with type selector", description: "Configurable chart", expectedComponent: "ChartWithControls" },
    { prompt: "Chart where users can change axes", description: "Axis selection", expectedComponent: "ChartWithControls" },
  ],
  SQLResultsDisplay: [
    { prompt: "Full SQL results with table and chart views", description: "Complete results UI", expectedComponent: "SQLResultsDisplay" },
    { prompt: "Query results starting in chart mode", description: "Chart-first view", expectedComponent: "SQLResultsDisplay" },
  ],
};

/**
 * Generate a full catalog prompt describing all available components.
 * Used as system context for AI models generating UI specs.
 */
export function generateCatalogPrompt(options: { includeExamples?: boolean } = {}): string {
  const organisms = Object.entries(componentDefinitions).filter(([_, def]) => def.category === 'organism');
  const molecules = Object.entries(componentDefinitions).filter(([_, def]) => def.category === 'molecule');
  const primitives = Object.entries(componentDefinitions).filter(([_, def]) => def.category === 'primitive');

  let prompt = `# Available UI Components\n\n`;
  prompt += `Generate specifications for SQL results visualization.\n\n`;

  // Organisms section first (top-level recommendation)
  prompt += `## Organisms (Recommended for complete views)\n`;
  prompt += `Use organisms for full-featured UI sections:\n\n`;
  for (const [name, def] of organisms) {
    prompt += formatComponent(name, def);
  }

  // Molecules section
  prompt += `## Molecules (For custom compositions)\n`;
  prompt += `Use molecules for integrated functionality:\n\n`;
  for (const [name, def] of molecules) {
    prompt += formatComponent(name, def);
  }

  // Primitives section
  prompt += `## Primitives (For fine-grained control)\n`;
  prompt += `Use primitives for specific UI elements:\n\n`;
  for (const [name, def] of primitives) {
    prompt += formatComponent(name, def);
  }

  prompt += `# Available Actions\n\n`;
  for (const [name, description] of Object.entries(actionDefinitions)) {
    prompt += `- ${name}: ${description}\n`;
  }

  if (options.includeExamples) {
    prompt += `\n# Example Prompts\n\n`;
    for (const [name, examples] of Object.entries(PROMPT_EXAMPLES)) {
      if (examples.length > 0) {
        prompt += `## ${name}\n`;
        for (const ex of examples) {
          prompt += `- "${ex.prompt}" - ${ex.description}\n`;
        }
        prompt += `\n`;
      }
    }
  }

  return prompt;
}

/**
 * Helper function to format a component for the catalog prompt
 */
function formatComponent(name: string, def: { schema: z.ZodObject<z.ZodRawShape>; description: string; category: string }): string {
  let output = `### ${name}\n`;
  output += `${def.description}\n\n`;
  output += `Props:\n`;

  // Extract prop descriptions from Zod schema
  const shape = def.schema.shape;
  for (const [propName, propSchema] of Object.entries(shape)) {
    const zodType = propSchema as z.ZodTypeAny;
    const desc = zodType.description || 'No description';
    output += `- ${propName}: ${desc}\n`;
  }
  output += `\n`;

  return output;
}

/**
 * Generate a focused prompt for a single component.
 * Used when the target component type is already known.
 */
export function generateComponentPrompt(componentName: ComponentName): string {
  const def = componentDefinitions[componentName];
  if (!def) {
    throw new Error(`Unknown component: ${componentName}`);
  }

  let prompt = `# ${componentName}\n\n`;
  prompt += `${def.description}\n\n`;
  prompt += `## Props\n\n`;

  const shape = (def.schema as z.ZodObject<z.ZodRawShape>).shape;
  for (const [propName, propSchema] of Object.entries(shape)) {
    const zodType = propSchema as z.ZodTypeAny;
    const desc = zodType.description || 'No description';
    // Check if optional by looking for .optional() or default value
    const isOptional = zodType.isOptional() || ('_def' in zodType && 'defaultValue' in (zodType as unknown as { _def: Record<string, unknown> })._def);
    prompt += `- **${propName}**${isOptional ? ' (optional)' : ''}: ${desc}\n`;
  }

  return prompt;
}

/**
 * Generate a component usage example for AI context.
 */
export function generateComponentExample(componentName: ComponentName): string {
  const examples: Record<ComponentName, string> = {
    Chart: `{
  "type": "Chart",
  "props": {
    "type": "bar",
    "xAxis": "category",
    "yAxis": "value",
    "height": 400
  }
}`,
    DataTable: `{
  "type": "DataTable",
  "props": {
    "columns": ["id", "name", "email"],
    "height": 400,
    "density": "comfortable",
    "virtualScrolling": true
  }
}`,
    Filter: `{
  "type": "Filter",
  "props": {
    "placeholder": "Search users...",
    "debounceMs": 150
  }
}`,
    DensityToggle: `{
  "type": "DensityToggle",
  "props": {
    "value": "comfortable",
    "showLabels": false
  }
}`,
    ViewModeToggle: `{
  "type": "ViewModeToggle",
  "props": {
    "modes": ["table", "chart"],
    "activeMode": "table"
  }
}`,
    TableWithFilters: `{
  "type": "TableWithFilters",
  "props": {
    "columns": ["id", "name", "email", "status"],
    "height": 500,
    "showFilter": true,
    "showDensityToggle": true,
    "virtualScrolling": true
  }
}`,
    ChartWithControls: `{
  "type": "ChartWithControls",
  "props": {
    "height": 400,
    "initialChartType": "bar",
    "showControls": true,
    "controlsCollapsed": false
  }
}`,
    SQLResultsDisplay: `{
  "type": "SQLResultsDisplay",
  "props": {
    "sql": "SELECT * FROM users WHERE active = true",
    "context": "web",
    "initialViewMode": "table",
    "tableHeight": 500,
    "chartHeight": 400
  }
}`,
  };

  return examples[componentName] || '{}';
}

/**
 * Generate a complete specification example for AI context.
 * Shows the full json-render spec structure.
 */
export function generateSpecExample(): string {
  return `{
  "root": "results",
  "elements": {
    "results": {
      "type": "SQLResultsDisplay",
      "props": {
        "sql": "SELECT category, SUM(amount) as total FROM transactions GROUP BY category",
        "initialViewMode": "chart",
        "chartHeight": 400
      }
    }
  },
  "data": [
    {"category": "Food", "total": 1500},
    {"category": "Transport", "total": 800},
    {"category": "Entertainment", "total": 600}
  ]
}`;
}

/**
 * Generate all example prompts for documentation or testing.
 */
export function generateAllExamples(): Record<ComponentName, PromptExample[]> {
  return PROMPT_EXAMPLES;
}

/**
 * Get example prompts for a specific component.
 */
export function getExamplesForComponent(componentName: ComponentName): PromptExample[] {
  return PROMPT_EXAMPLES[componentName] || [];
}

/**
 * Generate a full AI system prompt combining data visualization catalog
 * and the complete SurfacesUI component library schemas.
 *
 * Use this as the system prompt when AI agents need to scaffold
 * complete UIs (pages, dashboards, forms) - not just data viz.
 */
export function getFullSystemPrompt(options: { includeExamples?: boolean } = {}): string {
  let prompt = `# SurfacesUI Component Library\n\n`;
  prompt += `You are generating UI specifications for SurfacesUI, a React component library `;
  prompt += `designed for data analytics, AI/ML dashboards, and enterprise applications.\n\n`;
  prompt += `## Design System Rules\n\n`;
  prompt += `- All colors use CSS custom properties (e.g., --primary, --background)\n`;
  prompt += `- Spacing follows a 4px base scale: 4, 8, 12, 16, 24, 32, 48\n`;
  prompt += `- Typography uses the Covalent type scale (headline-1 through caption)\n`;
  prompt += `- Components support light and dark themes automatically\n`;
  prompt += `- All interactive elements must meet WCAG AA contrast requirements\n\n`;

  // Full component catalog with AI metadata
  prompt += generateComponentCatalogPrompt();

  prompt += `\n---\n\n`;

  // Data visualization catalog (json-render components)
  prompt += `# Data Visualization Components (json-render)\n\n`;
  prompt += `These components use the json-render spec format for data-driven UIs.\n`;
  prompt += `Data is injected via state provider, not specified inline.\n\n`;
  prompt += generateCatalogPrompt(options);

  return prompt;
}
