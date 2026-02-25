/**
 * SurfacesUI Component Showcase
 *
 * Interactive demo of all 8 catalog components.
 * Shows live previews, JSON specs, and usage examples.
 *
 * DEV-ONLY: Access at http://localhost:5173/src/apps/showcase.html
 * NOT packaged as MCP app.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../theme/ThemeProvider';
import { SurfacesRenderer } from '../catalog/renderer';
import '../theme/tokens.css';

const { useState } = React;

// Sample data for demos
const sampleData = [
  { name: 'Product A', value: 100, category: 'Electronics' },
  { name: 'Product B', value: 200, category: 'Clothing' },
  { name: 'Product C', value: 150, category: 'Electronics' },
  { name: 'Product D', value: 300, category: 'Home' },
  { name: 'Product E', value: 250, category: 'Clothing' },
];

// Component specifications
const componentSpecs = {
  // ORGANISMS
  sqlResultsDisplay: {
    name: 'SQLResultsDisplay',
    category: 'Organism',
    description: 'Complete SQL results with table/chart views and export',
    spec: {
      root: 'results',
      elements: {
        results: {
          type: 'SQLResultsDisplay',
          props: {
            sql: 'SELECT name, value, category FROM products',
            context: 'web',
            initialViewMode: 'table',
            tableHeight: 300,
            chartHeight: 300,
          },
        },
      },
    },
    data: sampleData,
  },

  // MOLECULES
  tableWithFilters: {
    name: 'TableWithFilters',
    category: 'Molecule',
    description: 'Data table with search filter and density toggle',
    spec: {
      root: 'table',
      elements: {
        table: {
          type: 'TableWithFilters',
          props: {
            columns: ['name', 'value', 'category'],
            height: 300,
            initialDensity: 'comfortable',
            showFilter: true,
            showDensityToggle: true,
          },
        },
      },
    },
    data: sampleData,
  },

  chartWithControls: {
    name: 'ChartWithControls',
    category: 'Molecule',
    description: 'Chart with type/axis configuration panel',
    spec: {
      root: 'chart',
      elements: {
        chart: {
          type: 'ChartWithControls',
          props: {
            columns: ['name', 'value', 'category'],
            height: 300,
            initialChartType: 'bar',
            initialXAxis: 'name',
            initialYAxis: 'value',
            showControls: true,
          },
        },
      },
    },
    data: sampleData,
  },

  // PRIMITIVES
  dataTable: {
    name: 'DataTable',
    category: 'Primitive',
    description: 'Virtualized data table for large datasets',
    spec: {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            columns: ['name', 'value', 'category'],
            height: 250,
            density: 'comfortable',
            virtualScrolling: false,
          },
        },
      },
    },
    data: sampleData,
  },

  chart: {
    name: 'Chart',
    category: 'Primitive',
    description: 'ECharts-based visualization with multiple types',
    spec: {
      root: 'chart',
      elements: {
        chart: {
          type: 'Chart',
          props: {
            type: 'bar',
            xAxis: 'name',
            yAxis: 'value',
            height: 250,
            showDataLabels: true,
          },
        },
      },
    },
    data: sampleData,
  },

  filter: {
    name: 'Filter',
    category: 'Primitive',
    description: 'Search filter with debouncing',
    spec: {
      root: 'filter',
      elements: {
        filter: {
          type: 'Filter',
          props: {
            placeholder: 'Search products...',
            debounceMs: 300,
            ariaLabel: 'Filter table data',
          },
        },
      },
    },
    data: [],
  },

  densityToggle: {
    name: 'DensityToggle',
    category: 'Primitive',
    description: 'Switch between compact/comfortable/spacious density',
    spec: {
      root: 'toggle',
      elements: {
        toggle: {
          type: 'DensityToggle',
          props: {
            value: 'comfortable',
            showLabels: true,
          },
        },
      },
    },
    data: [],
  },

  viewModeToggle: {
    name: 'ViewModeToggle',
    category: 'Primitive',
    description: 'Toggle between table and chart view modes',
    spec: {
      root: 'toggle',
      elements: {
        toggle: {
          type: 'ViewModeToggle',
          props: {
            modes: ['table', 'chart'],
            activeMode: 'table',
            showLabels: true,
          },
        },
      },
    },
    data: [],
  },
};

function getExamplePrompt(componentName: string): string {
  const prompts: Record<string, string> = {
    'SQLResultsDisplay': 'Show SQL results with table and chart views',
    'TableWithFilters': 'Create a filterable table with density controls',
    'ChartWithControls': 'Display a chart with axis configuration',
    'DataTable': 'Show data in a table',
    'Chart': 'Create a bar chart of values',
    'Filter': 'Add a search filter',
    'DensityToggle': 'Add density toggle',
    'ViewModeToggle': 'Add table/chart toggle',
  };
  return prompts[componentName] || 'Generate a UI component';
}

function Showcase() {
  const [selectedComponent, setSelectedComponent] = useState('sqlResultsDisplay');
  const [showJson, setShowJson] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const currentComponent = componentSpecs[selectedComponent as keyof typeof componentSpecs];
  const categories = ['all', 'Organism', 'Molecule', 'Primitive'];

  const filteredComponents = Object.entries(componentSpecs).filter(
    ([_, comp]) => filterCategory === 'all' || comp.category === filterCategory
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">SurfacesUI Component Showcase</h1>
              <p className="text-sm text-muted-foreground">
                8 components powered by json-render
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowJson(!showJson)}
                className="px-3 py-1.5 text-sm rounded border hover:bg-accent"
              >
                {showJson ? 'Hide JSON' : 'Show JSON'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Category Filter */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        filterCategory === cat
                          ? 'bg-secondary-container text-secondary-container-foreground'
                          : 'border border-cv-outline text-on-surface-variant hover:bg-secondary-container/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Component List */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Components ({filteredComponents.length})
                </h3>
                <nav className="space-y-1">
                  {filteredComponents.map(([key, comp]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedComponent(key)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-full transition-colors ${
                        selectedComponent === key
                          ? 'bg-secondary-container text-secondary-container-foreground font-medium'
                          : 'text-on-surface-variant hover:bg-secondary-container/10'
                      }`}
                    >
                      <div>{comp.name}</div>
                      <div className={`text-xs ${selectedComponent === key ? 'text-secondary-container-foreground/70' : 'text-on-surface-variant/70'}`}>{comp.category}</div>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Component Info */}
            <div className="bg-card rounded-lg border border-cv-outline-variant p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold">{currentComponent.name}</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full border border-cv-outline text-on-surface-variant">
                    {currentComponent.category}
                  </span>
                </div>
                <p className="text-muted-foreground">{currentComponent.description}</p>
              </div>

              {/* Component Preview */}
              <div className="border border-cv-outline-variant rounded-lg p-4 bg-background">
                <SurfacesRenderer
                  spec={currentComponent.spec}
                  initialState={{ data: currentComponent.data }}
                />
              </div>
            </div>

            {/* JSON Spec (conditional) */}
            {showJson && (
              <div className="bg-card rounded-lg border border-cv-outline-variant p-6">
                <h3 className="text-lg font-semibold mb-3">JSON Specification</h3>
                <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(currentComponent.spec, null, 2)}
                </pre>
              </div>
            )}

            {/* Usage Info */}
            <div className="bg-card rounded-lg border border-cv-outline-variant p-6">
              <h3 className="text-lg font-semibold mb-3">Usage</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Generate this component with natural language:
              </p>
              <div className="bg-muted p-3 rounded font-mono text-sm">
                "{getExamplePrompt(currentComponent.name)}"
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                → Use with vantage-mcp or surfaces-ui MCP server
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ThemeProvider>
      <Showcase />
    </ThemeProvider>
  );
}
