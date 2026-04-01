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
import { ThemeWrapper } from './ThemeWrapper';
import { SurfacesRenderer } from '../catalog/renderer';
import { Button } from '../primitives/button';
import { Card, CardHeader, CardContent } from '../primitives/card';
import { Badge } from '../primitives/badge';
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

// Wrapper with submenu
function ShowcaseApp() {
  const [selectedComponent, setSelectedComponent] = useState('sqlResultsDisplay');

  // Generate submenu items
  const subMenuItems = Object.entries(componentSpecs).map(([key, comp]) => ({
    id: key,
    label: comp.name,
    onClick: () => setSelectedComponent(key),
  }));

  return (
    <ThemeWrapper
      title="Component Showcase"
      description="8 components powered by json-render"
      showDemoNav={true}
      currentDemo="showcase"
      subMenuItems={subMenuItems}
      activeSubItem={selectedComponent}
    >
      <ShowcaseContent selectedComponent={selectedComponent} />
    </ThemeWrapper>
  );
}

// Content component
function ShowcaseContent({ selectedComponent }: { selectedComponent: string }) {
  const [showJson, setShowJson] = useState(false);
  const currentComponent = componentSpecs[selectedComponent as keyof typeof componentSpecs];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowJson(!showJson)}
        >
          {showJson ? 'Hide JSON' : 'Show JSON'}
        </Button>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Component Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{currentComponent.name}</h2>
              <Badge variant="outline">{currentComponent.category}</Badge>
            </div>
            <p className="text-muted-foreground mt-2">{currentComponent.description}</p>
          </CardHeader>
          <CardContent>
            {/* Component Preview */}
            <div className="border border-su-outline-variant rounded-lg p-4 bg-background">
              <SurfacesRenderer
                spec={currentComponent.spec}
                initialState={{ data: currentComponent.data }}
              />
            </div>
          </CardContent>
        </Card>

        {/* JSON Spec (conditional) */}
        {showJson && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">JSON Specification</h3>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(currentComponent.spec, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Usage Info */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Usage</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Generate this component with natural language:
            </p>
            <div className="bg-muted p-3 rounded font-mono text-sm">
              "{getExamplePrompt(currentComponent.name)}"
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              → Use with vantage-mcp or surfaces-ui MCP server
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Mount application
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ShowcaseApp />);
}
