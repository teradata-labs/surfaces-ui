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
} from './schema';
import type { z } from 'zod';

// Component definitions for prompt generation
const componentDefinitions = {
  Chart: {
    schema: ChartSchema,
    description: 'Render data as a chart using ECharts with theme integration. Use for visualizing trends, comparisons, and distributions.',
  },
  DataTable: {
    schema: DataTableSchema,
    description: 'Display tabular data with virtual scrolling for large datasets. Use for detailed row-by-row data inspection.',
  },
  Filter: {
    schema: FilterSchema,
    description: 'Filter table data by search term or column-specific filters. Combine with DataTable for searchable data.',
  },
  DensityToggle: {
    schema: DensityToggleSchema,
    description: 'Toggle between compact, comfortable, and spacious row density. Use with DataTable.',
  },
  ViewModeToggle: {
    schema: ViewModeToggleSchema,
    description: 'Toggle between table and chart view modes. Use to switch visualization types.',
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
  let prompt = `# Available UI Components\n\n`;
  prompt += `You can generate specifications for these components:\n\n`;

  for (const [name, def] of Object.entries(componentDefinitions)) {
    prompt += `## ${name}\n`;
    prompt += `${def.description}\n\n`;
    prompt += `Props:\n`;

    // Extract prop descriptions from Zod schema
    const shape = (def.schema as z.ZodObject<any>).shape;
    for (const [propName, propSchema] of Object.entries(shape)) {
      const zodType = propSchema as z.ZodTypeAny;
      const desc = zodType.description || 'No description';
      prompt += `- ${propName}: ${desc}\n`;
    }
    prompt += `\n`;
  }

  prompt += `# Available Actions\n\n`;
  for (const [name, description] of Object.entries(actionDefinitions)) {
    prompt += `- ${name}: ${description}\n`;
  }

  return prompt;
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
  };

  return examples[componentName] || '{}';
}
