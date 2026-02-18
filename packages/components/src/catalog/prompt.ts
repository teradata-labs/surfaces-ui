/**
 * AI System Prompt for json-render Catalog
 *
 * Generates system prompt for AI models to understand available components.
 */
import { catalog } from './schema';

export const aiSystemPrompt = catalog.prompt({
  customRules: [
    'Use Chart for visualizing trends, comparisons, and distributions',
    'Use DataTable for detailed row-by-row data inspection',
    'Always include Filter when showing large datasets (>50 rows)',
    'Use ViewModeToggle to let users switch between table and chart views',
    'Prefer comfortable density unless user requests compact/spacious',
  ],
});

export function getCatalogPrompt(): string {
  return aiSystemPrompt;
}
