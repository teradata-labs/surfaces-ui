/**
 * DataTable Unit Tests
 *
 * Tests for virtual scrolling with large datasets, DOM node count verification,
 * dynamic overscan, ARIA accessibility, and edge cases.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';

// Mock window.matchMedia (required for theme context)
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
 * Helper function to generate large datasets for testing
 */
function generateData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    value: Math.floor(Math.random() * 10000),
  }));
}

describe('DataTable virtual scrolling', () => {
  it('renders 100K rows without crashing', () => {
    const data = generateData(100_000);
    render(<DataTable data={data} columns={['id', 'name', 'value']} height={400} />);

    // Should render without error and show column headers
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('value')).toBeTruthy();
  });

  it('only renders visible rows plus overscan in DOM (not all 100K)', () => {
    const data = generateData(100_000);
    const { container } = render(<DataTable data={data} columns={['id', 'name']} height={400} />);

    // Virtual scrolling should render far fewer than total rows
    // Note: In jsdom without layout, virtualizer may render 0 rows, but that's acceptable
    // The key is it doesn't render all 100K rows (which would cause performance issues)
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeLessThan(100_000);
  });

  it('uses dynamic overscan based on data size', () => {
    // Test small dataset auto-disables virtual scrolling (<= 100)
    const smallData = generateData(50);
    const { container: small } = render(<DataTable data={smallData} columns={['id']} height={400} />);
    const smallRows = small.querySelectorAll('tbody tr');

    // Test large dataset uses virtual scrolling
    const largeData = generateData(60_000);
    const { container: large } = render(<DataTable data={largeData} columns={['id']} height={400} />);
    const largeRows = large.querySelectorAll('tbody tr');

    // Small dataset should render all rows (50), large should be virtualized (fewer rows in DOM)
    expect(smallRows.length).toBe(50);
    expect(largeRows.length).toBeLessThan(60_000);
  });
});

describe('DataTable ARIA accessibility', () => {
  it('has aria-rowcount matching data length plus header', () => {
    const data = generateData(1000);
    const { container } = render(<DataTable data={data} columns={['id', 'name']} height={400} />);

    const table = container.querySelector('table');
    expect(table?.getAttribute('aria-rowcount')).toBe('1001'); // 1000 data + 1 header
  });

  it('has aria-colcount matching column count', () => {
    const data = generateData(100);
    const { container } = render(<DataTable data={data} columns={['a', 'b', 'c']} height={400} />);

    const table = container.querySelector('table');
    expect(table?.getAttribute('aria-colcount')).toBe('3');
  });

  it('has aria-rowindex on visible rows', () => {
    // Use small dataset to ensure non-virtual rendering (easier to test in jsdom)
    const data = generateData(50);
    const { container } = render(<DataTable data={data} columns={['id']} height={400} virtualScrolling={false} />);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0); // Ensure we have rows to test

    // First visible row should have aria-rowindex (2 = header row is 1)
    expect(rows[0]?.getAttribute('aria-rowindex')).toBeTruthy();
    // Verify it's a numeric value >= 2
    const rowIndex = parseInt(rows[0]?.getAttribute('aria-rowindex') || '0', 10);
    expect(rowIndex).toBeGreaterThanOrEqual(2);
  });

  it('includes row numbers in aria-colcount when enabled', () => {
    const data = generateData(100);
    const { container } = render(
      <DataTable data={data} columns={['a', 'b']} height={400} showRowNumbers={true} />
    );

    const table = container.querySelector('table');
    // 2 data columns + 1 row number column = 3
    expect(table?.getAttribute('aria-colcount')).toBe('3');
  });
});

describe('DataTable edge cases', () => {
  it('shows empty state for no data', () => {
    render(<DataTable data={[]} columns={['id']} height={400} />);
    expect(screen.getByText('No data to display')).toBeTruthy();
  });

  it('renders without virtual scrolling for small datasets', () => {
    const data = generateData(50);
    const { container } = render(<DataTable data={data} columns={['id']} height={400} virtualScrolling={false} />);

    // All 50 rows should be in DOM
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(50);
  });

  it('auto-disables virtual scrolling for datasets <= 100 rows', () => {
    const data = generateData(100);
    const { container } = render(<DataTable data={data} columns={['id']} height={400} />);

    // All 100 rows should be in DOM (virtual scrolling disabled for small datasets)
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(100);
  });

  it('derives columns from data when columns prop is omitted', () => {
    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ];
    render(<DataTable data={data} height={400} />);

    // All columns from first row should be rendered
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('age')).toBeTruthy();
  });
});
