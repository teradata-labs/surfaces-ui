/**
 * ComponentCatalog — Browsable component list for AI context
 *
 * Shows all available components from the SurfacesUI library,
 * grouped by category. Users can search and click components
 * to add them to their prompt context.
 */
import * as React from 'react';
import { COMPONENT_SCHEMAS, type ComponentSchema } from '../../catalog/component-schemas';
import { Input } from '../../primitives/input';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, ChevronRight, Plus } from 'lucide-react';

// json-render specific components (from ui-schema.ts)
const JSON_RENDER_COMPONENTS: ComponentSchema[] = [
  {
    name: 'Box', figmaName: '', category: 'layout', level: 'atom',
    description: 'Flexbox/grid layout container for arranging children',
    props: [
      { name: 'direction', type: 'enum', required: false, default: 'column', description: 'Flex direction', values: ['row', 'column'] },
      { name: 'gap', type: 'number', required: false, default: '16', description: 'Gap between children in pixels' },
      { name: 'columns', type: 'number', required: false, description: 'Grid columns (overrides direction)' },
    ],
    usage: { when: ['Layout containers'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
  {
    name: 'StatCard', figmaName: '', category: 'data-display', level: 'molecule',
    description: 'KPI metric card with value, label, and trend indicator',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Metric label' },
      { name: 'value', type: 'string', required: true, description: 'Formatted metric value' },
      { name: 'change', type: 'string', required: false, description: 'Change indicator (e.g. "+12%")' },
      { name: 'trend', type: 'enum', required: false, description: 'Trend direction', values: ['up', 'down', 'neutral'] },
    ],
    usage: { when: ['KPI dashboards', 'Status summaries'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
  {
    name: 'Heading', figmaName: '', category: 'typography', level: 'atom',
    description: 'Text heading (h1-h4) for section titles',
    props: [
      { name: 'text', type: 'string', required: true, description: 'Heading text content' },
      { name: 'level', type: 'enum', required: false, default: '2', description: 'Heading level', values: ['1', '2', '3', '4'] },
    ],
    usage: { when: ['Section headers', 'Page titles'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
  {
    name: 'Text', figmaName: '', category: 'typography', level: 'atom',
    description: 'Body text paragraph with optional markdown formatting',
    props: [
      { name: 'content', type: 'string', required: true, description: 'Text content (supports **bold** and *italic*)' },
      { name: 'size', type: 'enum', required: false, default: 'base', description: 'Text size', values: ['sm', 'base', 'lg'] },
      { name: 'muted', type: 'boolean', required: false, default: 'false', description: 'Use secondary color' },
    ],
    usage: { when: ['Descriptions', 'Explanatory text'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
  {
    name: 'FormInput', figmaName: '', category: 'form', level: 'molecule',
    description: 'Labeled text input field for forms',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Input label' },
      { name: 'name', type: 'string', required: true, description: 'Field name for form state' },
      { name: 'type', type: 'enum', required: false, default: 'text', description: 'Input type', values: ['text', 'email', 'number', 'password', 'url'] },
      { name: 'required', type: 'boolean', required: false, default: 'false', description: 'Whether required' },
    ],
    usage: { when: ['Forms', 'Data entry'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
  {
    name: 'FormSelect', figmaName: '', category: 'form', level: 'molecule',
    description: 'Labeled dropdown select for forms',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Select label' },
      { name: 'name', type: 'string', required: true, description: 'Field name for form state' },
      { name: 'options', type: 'array', required: true, description: 'Dropdown options [{label, value}]' },
      { name: 'required', type: 'boolean', required: false, default: 'false', description: 'Whether required' },
    ],
    usage: { when: ['Forms', 'Selection from options'], whenNot: [], alternatives: [], dos: [], donts: [], patterns: [] },
    designTokens: [],
  },
];

// Combine all component schemas
const ALL_COMPONENTS = [...COMPONENT_SCHEMAS, ...JSON_RENDER_COMPONENTS];

// Group components by category
function groupByCategory(components: ComponentSchema[]): Record<string, ComponentSchema[]> {
  const groups: Record<string, ComponentSchema[]> = {};
  for (const comp of components) {
    const category = comp.category || 'other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(comp);
  }
  return groups;
}

const CATEGORY_LABELS: Record<string, string> = {
  actions: 'Actions',
  form: 'Form',
  'data-display': 'Data Display',
  feedback: 'Feedback',
  layout: 'Layout',
  navigation: 'Navigation',
  overlay: 'Overlay',
  typography: 'Typography',
  other: 'Other',
};

interface ComponentCatalogProps {
  /** Called when user clicks "Use" on a component */
  onUseComponent?: (component: ComponentSchema) => void;
  /** Max height for the catalog panel */
  maxHeight?: string;
}

export function ComponentCatalog({ onUseComponent, maxHeight = '500px' }: ComponentCatalogProps) {
  const [search, setSearch] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    if (!search.trim()) return ALL_COMPONENTS;
    const query = search.toLowerCase();
    return ALL_COMPONENTS.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query) ||
      c.category.toLowerCase().includes(query)
    );
  }, [search]);

  const grouped = React.useMemo(() => groupByCategory(filtered), [filtered]);

  const toggleCategory = React.useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-foreground">Component Catalog</div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Component List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <div className="flex flex-col gap-1">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, components]) => {
            const isExpanded = expandedCategories.has(category) || search.trim().length > 0;

            return (
              <div key={category}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />
                  }
                  {CATEGORY_LABELS[category] || category}
                  <span className="text-[10px] opacity-60">({components.length})</span>
                </button>

                {/* Component Cards */}
                {isExpanded && (
                  <div className="flex flex-col gap-0.5 ml-3 mb-2">
                    {components.map(comp => (
                      <div
                        key={comp.name}
                        className="flex items-start justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground">{comp.name}</div>
                          <div className="text-[10px] text-muted-foreground line-clamp-1">
                            {comp.description}
                          </div>
                        </div>
                        {onUseComponent && (
                          <button
                            onClick={() => onUseComponent(comp)}
                            className={cn(
                              'shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                              'p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10',
                            )}
                            title={`Add ${comp.name} to prompt`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground text-center">
        {ALL_COMPONENTS.length} components available
      </div>
    </div>
  );
}
