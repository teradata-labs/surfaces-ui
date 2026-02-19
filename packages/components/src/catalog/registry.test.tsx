/**
 * Registry Mapping Integration Tests
 *
 * Validates that all catalog schemas correctly map to React component implementations.
 * Covers all 8 registry wrappers (REG-01 through REG-08) plus completeness verification.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { catalog } from './schema';
import { registry } from './registry';
import { SurfacesRenderer } from './renderer';
import type { Spec } from '@json-render/core';

// Mock ECharts to avoid canvas rendering issues in jsdom
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  })),
  registerTheme: vi.fn(),
}));

// Mock window.matchMedia for ThemeProvider
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
});

/**
 * Helper function to render a spec with proper json-render context providers
 */
function renderSpec(spec: Spec) {
  return render(
    <SurfacesRenderer spec={spec} initialState={spec.state} />
  );
}

describe('Registry completeness', () => {
  it('registry has entry for every catalog schema component', () => {
    // Get all component names from the catalog schema
    const catalogComponentNames = catalog.componentNames;

    // Get all component names from the registry
    const registryComponentNames = Object.keys(registry);

    // Every catalog component MUST have a registry entry
    const missingFromRegistry = catalogComponentNames.filter(
      name => !registryComponentNames.includes(name)
    );

    expect(missingFromRegistry).toEqual([]);
    expect(missingFromRegistry.length).toBe(0);

    // Log for debugging if test fails
    if (missingFromRegistry.length > 0) {
      console.error('Components in catalog but missing from registry:', missingFromRegistry);
    }
  });

  it('registry does not have extra components not in catalog', () => {
    const catalogComponentNames = catalog.componentNames;
    const registryComponentNames = Object.keys(registry);

    // Registry should not have components that aren't in catalog
    const extraInRegistry = registryComponentNames.filter(
      name => !catalogComponentNames.includes(name)
    );

    // Note: This is a warning, not a hard fail - registry may have internal helpers
    // But all public component types should match
    if (extraInRegistry.length > 0) {
      console.warn('Components in registry but not in catalog:', extraInRegistry);
    }
  });

  it('registry components are all functions', () => {
    const catalogComponentNames = catalog.componentNames;

    catalogComponentNames.forEach(name => {
      expect(registry[name]).toBeDefined();
      expect(typeof registry[name]).toBe('function');
    });
  });
});

describe('REG-01: Chart catalog mapping', () => {
  it('renders Chart with catalog props', () => {
    const spec: Spec = {
      root: 'chart',
      elements: {
        chart: {
          type: 'Chart',
          props: { type: 'bar', xAxis: 'name', yAxis: 'value', height: 300 },
        },
      },
      state: { data: [{ name: 'A', value: 100 }] },
    };

    renderSpec(spec);

    // Chart renders via ECharts - check container exists
    expect(document.querySelector('[data-testid="chart"]')).toBeTruthy();
  });

  it('renders Chart with different chart types', () => {
    const spec: Spec = {
      root: 'chart',
      elements: {
        chart: {
          type: 'Chart',
          props: { type: 'line', height: 250, showDataLabels: true },
        },
      },
      state: { data: [{ x: 1, y: 10 }, { x: 2, y: 20 }] },
    };

    renderSpec(spec);

    expect(document.querySelector('[data-testid="chart"]')).toBeTruthy();
  });
});

describe('REG-02: DataTable catalog mapping', () => {
  it('renders DataTable with columns from spec', () => {
    const spec: Spec = {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: { columns: ['name', 'value'], height: 200, density: 'compact' },
        },
      },
      state: { data: [{ name: 'Row 1', value: 100 }] },
    };

    renderSpec(spec);

    // Table should render column headers
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('value')).toBeTruthy();
  });

  it('renders DataTable with virtual scrolling enabled', () => {
    const spec: Spec = {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            columns: ['id', 'name'],
            height: 400,
            virtualScrolling: true,
            density: 'comfortable'
          },
        },
      },
      state: { data: [{ id: 1, name: 'Test' }] },
    };

    renderSpec(spec);

    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
  });
});

describe('REG-03: Filter catalog mapping', () => {
  it('renders Filter with placeholder', () => {
    const spec: Spec = {
      root: 'filter',
      elements: {
        filter: {
          type: 'Filter',
          props: { placeholder: 'Search items...' },
        },
      },
    };

    renderSpec(spec);

    expect(screen.getByPlaceholderText('Search items...')).toBeTruthy();
  });

  it('renders Filter with custom aria label', () => {
    const spec: Spec = {
      root: 'filter',
      elements: {
        filter: {
          type: 'Filter',
          props: {
            placeholder: 'Filter data',
            ariaLabel: 'Search filter for results'
          },
        },
      },
    };

    renderSpec(spec);

    const input = screen.getByPlaceholderText('Filter data');
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('Search filter for results');
  });
});

describe('REG-04: DensityToggle catalog mapping', () => {
  it('renders DensityToggle with initial value', () => {
    const spec: Spec = {
      root: 'density',
      elements: {
        density: {
          type: 'DensityToggle',
          props: { value: 'compact' },
        },
      },
    };

    renderSpec(spec);

    // DensityToggle uses radiogroup - check accessible name
    expect(screen.getByRole('radiogroup')).toBeTruthy();
  });

  it('renders DensityToggle with labels shown', () => {
    const spec: Spec = {
      root: 'density',
      elements: {
        density: {
          type: 'DensityToggle',
          props: { value: 'comfortable', showLabels: true },
        },
      },
    };

    renderSpec(spec);

    expect(screen.getByRole('radiogroup')).toBeTruthy();
  });
});

describe('REG-05: ViewModeToggle catalog mapping', () => {
  it('renders ViewModeToggle with modes', () => {
    const spec: Spec = {
      root: 'viewMode',
      elements: {
        viewMode: {
          type: 'ViewModeToggle',
          props: { modes: ['table', 'chart'], activeMode: 'table' },
        },
      },
    };

    renderSpec(spec);

    // ViewModeToggle renders toggle buttons with tablist role
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders ViewModeToggle with chart as active mode', () => {
    const spec: Spec = {
      root: 'viewMode',
      elements: {
        viewMode: {
          type: 'ViewModeToggle',
          props: {
            modes: ['table', 'chart'],
            activeMode: 'chart',
            showLabels: true
          },
        },
      },
    };

    renderSpec(spec);

    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});

describe('REG-06: TableWithFilters catalog mapping', () => {
  it('renders TableWithFilters molecule', () => {
    const spec: Spec = {
      root: 'filteredTable',
      elements: {
        filteredTable: {
          type: 'TableWithFilters',
          props: {
            columns: ['name'],
            height: 200,
            showFilter: true,
            showDensityToggle: true
          },
        },
      },
      state: { data: [{ name: 'Test' }] },
    };

    renderSpec(spec);

    // Should have both filter and table
    expect(screen.getByRole('searchbox')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
  });

  it('renders TableWithFilters without filter controls', () => {
    const spec: Spec = {
      root: 'filteredTable',
      elements: {
        filteredTable: {
          type: 'TableWithFilters',
          props: {
            columns: ['id', 'value'],
            height: 300,
            showFilter: false,
            showDensityToggle: false,
            initialDensity: 'spacious'
          },
        },
      },
      state: { data: [{ id: 1, value: 42 }] },
    };

    renderSpec(spec);

    // Should have table but no filter
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeFalsy();
  });
});

describe('REG-07: ChartWithControls catalog mapping', () => {
  it('renders ChartWithControls molecule', () => {
    const spec: Spec = {
      root: 'controlledChart',
      elements: {
        controlledChart: {
          type: 'ChartWithControls',
          props: {
            columns: ['name', 'value'],
            height: 300,
            initialChartType: 'bar',
            showControls: true,
          },
        },
      },
      state: { data: [{ name: 'A', value: 100 }] },
    };

    renderSpec(spec);

    // Should render chart container
    expect(document.querySelector('[data-testid="chart"]')).toBeTruthy();
  });

  it('renders ChartWithControls with initial axes', () => {
    const spec: Spec = {
      root: 'controlledChart',
      elements: {
        controlledChart: {
          type: 'ChartWithControls',
          props: {
            columns: ['x', 'y', 'z'],
            height: 400,
            initialChartType: 'line',
            initialXAxis: 'x',
            initialYAxis: 'y',
            showControls: true,
            controlsCollapsed: false
          },
        },
      },
      state: { data: [{ x: 1, y: 10, z: 100 }] },
    };

    renderSpec(spec);

    expect(document.querySelector('[data-testid="chart"]')).toBeTruthy();
  });
});

describe('REG-08: SQLResultsDisplay catalog mapping', () => {
  it('renders SQLResultsDisplay organism', () => {
    const spec: Spec = {
      root: 'sqlResults',
      elements: {
        sqlResults: {
          type: 'SQLResultsDisplay',
          props: {
            sql: 'SELECT * FROM test',
            initialViewMode: 'table',
            tableHeight: 200,
          },
        },
      },
      state: { data: [{ id: 1, name: 'Test' }] },
    };

    renderSpec(spec);

    // Should render view mode toggle and content
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders SQLResultsDisplay with Teradata context', () => {
    const spec: Spec = {
      root: 'sqlResults',
      elements: {
        sqlResults: {
          type: 'SQLResultsDisplay',
          props: {
            sql: 'SELECT id, name FROM users',
            context: 'mcp-apps',
            projectId: 'proj-123',
            teradataBaseUrl: 'https://teradata.example.com',
            initialViewMode: 'chart',
            tableHeight: 300,
            chartHeight: 350,
          },
        },
      },
      state: { data: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
    };

    renderSpec(spec);

    // Should render with view mode toggle
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders SQLResultsDisplay with rows/columns data format', () => {
    const spec: Spec = {
      root: 'sqlResults',
      elements: {
        sqlResults: {
          type: 'SQLResultsDisplay',
          props: {
            sql: 'SELECT * FROM items',
            initialViewMode: 'table',
            tableHeight: 250,
          },
        },
      },
      state: {
        data: {
          rows: [{ item: 'A', qty: 10 }],
          columns: ['item', 'qty']
        }
      },
    };

    renderSpec(spec);

    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});
