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
 * Generate a full catalog prompt describing all available components.
 * Used as system context for AI models generating UI specs.
 */
export function generateCatalogPrompt(): string {
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

  return prompt;
}

/**
 * Helper function to format a component for the catalog prompt
 */
function formatComponent(name: string, def: { schema: z.ZodObject<any>; description: string; category: string }): string {
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

  const shape = (def.schema as z.ZodObject<any>).shape;
  for (const [propName, propSchema] of Object.entries(shape)) {
    const zodType = propSchema as z.ZodTypeAny;
    const desc = zodType.description || 'No description';
    // Check if optional by looking for .optional() or default value
    const isOptional = zodType.isOptional() || ('_def' in zodType && 'defaultValue' in (zodType as any)._def);
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
