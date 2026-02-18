/**
 * Demo JSON specs for catalog components
 *
 * Example json-render Spec objects for testing each component type.
 * These demonstrate the flat element map format and state management.
 */
import type { Spec } from '@json-render/core';

/* ── Sample Data ───────────────────────────────────────────────────── */

export const sampleData = [
  { name: 'Product A', value: 100, category: 'Electronics' },
  { name: 'Product B', value: 200, category: 'Clothing' },
  { name: 'Product C', value: 150, category: 'Electronics' },
  { name: 'Product D', value: 300, category: 'Home' },
  { name: 'Product E', value: 250, category: 'Clothing' },
];

/* ── Primitive Specs ───────────────────────────────────────────────── */

/**
 * Chart primitive - bar chart visualization
 */
export const chartSpec: Spec = {
  root: 'chart-1',
  elements: {
    'chart-1': {
      type: 'Chart',
      props: {
        type: 'bar',
        xAxis: 'name',
        yAxis: 'value',
        height: 300,
        showDataLabels: true,
      },
    },
  },
  state: {
    data: sampleData,
  },
};

/**
 * DataTable primitive - simple table view
 */
export const dataTableSpec: Spec = {
  root: 'table-1',
  elements: {
    'table-1': {
      type: 'DataTable',
      props: {
        columns: ['name', 'value', 'category'],
        height: 250,
        density: 'comfortable',
        virtualScrolling: false,
      },
    },
  },
  state: {
    data: sampleData,
  },
};

/* ── Molecule Specs ────────────────────────────────────────────────── */

/**
 * TableWithFilters molecule - table with search and density controls
 */
export const tableWithFiltersSpec: Spec = {
  root: 'filtered-table-1',
  elements: {
    'filtered-table-1': {
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
  state: {
    data: sampleData,
  },
};

/* ── Organism Specs ────────────────────────────────────────────────── */

/**
 * SQLResultsDisplay organism - complete feature-rich results view
 */
export const sqlResultsSpec: Spec = {
  root: 'sql-results-1',
  elements: {
    'sql-results-1': {
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
  state: {
    data: sampleData,
  },
};
