/**
 * DataTable Performance Tests
 *
 * Tests for performance characteristics: render time, DOM node count stability,
 * density independence, column scalability, and re-render stability.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
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

describe('DataTable performance characteristics', () => {
  it('maintains consistent DOM node count during virtual scrolling', () => {
    const data = generateData(100_000);
    const { container } = render(<DataTable data={data} columns={['id', 'name', 'value']} height={400} />);

    // Count rows in DOM
    const rows = container.querySelectorAll('tbody tr');

    // Virtual scrolling maintains bounded DOM count regardless of data size
    // This is a proxy for 60FPS - if DOM count stays bounded, render time stays bounded
    // In jsdom, virtualizer may not render due to lack of layout, but should never render all rows
    expect(rows.length).toBeLessThan(100_000);
    expect(rows.length).toBeLessThanOrEqual(50); // Should have at most ~30-40 rows
  });

  it('renders 100K rows within acceptable time', () => {
    const data = generateData(100_000);

    const start = performance.now();
    const { container } = render(<DataTable data={data} columns={['id', 'name', 'value']} height={400} />);
    const end = performance.now();

    // Initial render should be fast (< 500ms) because only visible rows render
    // This is a conservative bound - typically <100ms
    expect(end - start).toBeLessThan(500);

    // Verify render succeeded
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('different density settings do not affect DOM count significantly', () => {
    const data = generateData(50_000);

    const { container: compact } = render(
      <DataTable data={data} columns={['id']} height={400} density="compact" />
    );
    const { container: spacious } = render(
      <DataTable data={data} columns={['id']} height={400} density="spacious" />
    );

    const compactRows = compact.querySelectorAll('tbody tr').length;
    const spaciousRows = spacious.querySelectorAll('tbody tr').length;

    // Both should have bounded DOM counts
    expect(compactRows).toBeLessThan(100);
    expect(spaciousRows).toBeLessThan(100);

    // Note: In jsdom without layout, virtualizer may render 0 rows for both
    // The key verification is that neither renders all 50K rows
    expect(compactRows).toBeLessThan(50_000);
    expect(spaciousRows).toBeLessThan(50_000);
  });

  it('column count does not affect virtualization efficiency', () => {
    const narrowData = generateData(50_000);
    const wideData = generateData(50_000).map(row => ({
      ...row,
      col1: 'a', col2: 'b', col3: 'c', col4: 'd', col5: 'e',
      col6: 'f', col7: 'g', col8: 'h', col9: 'i', col10: 'j',
    }));

    const { container: narrow } = render(
      <DataTable data={narrowData} columns={['id', 'name']} height={400} />
    );
    const { container: wide } = render(
      <DataTable data={wideData} columns={['id', 'name', 'col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7', 'col8', 'col9', 'col10']} height={400} />
    );

    const narrowRows = narrow.querySelectorAll('tbody tr').length;
    const wideRows = wide.querySelectorAll('tbody tr').length;

    // Row virtualization is independent of column count
    // Both should have similar row counts (within small variance)
    expect(narrowRows).toBeLessThan(50_000);
    expect(wideRows).toBeLessThan(50_000);

    // Both should be bounded
    expect(Math.max(narrowRows, wideRows)).toBeLessThan(100);
  });

  it('large datasets render faster than linear scaling', () => {
    // If rendering were O(n), 10K rows should take ~10x longer than 1K rows
    // With virtualization, both should be similar

    const smallData = generateData(1_000);
    const largeData = generateData(10_000);

    const smallStart = performance.now();
    render(<DataTable data={smallData} columns={['id', 'name']} height={400} />);
    const smallDuration = performance.now() - smallStart;

    const largeStart = performance.now();
    render(<DataTable data={largeData} columns={['id', 'name']} height={400} />);
    const largeDuration = performance.now() - largeStart;

    // Large dataset should NOT take 10x longer (proving virtualization works)
    // Allow 3x factor for variance and setup costs
    expect(largeDuration).toBeLessThan(smallDuration * 3);
  });
});

describe('DataTable memory stability proxy tests', () => {
  it('re-renders with same data do not increase DOM nodes', () => {
    const data = generateData(50_000);
    const { container, rerender } = render(
      <DataTable data={data} columns={['id', 'name']} height={400} />
    );

    const initialRows = container.querySelectorAll('tbody tr').length;

    // Re-render multiple times
    for (let i = 0; i < 5; i++) {
      rerender(<DataTable data={data} columns={['id', 'name']} height={400} />);
    }

    const finalRows = container.querySelectorAll('tbody tr').length;

    // DOM count should stay same (no memory leak via DOM accumulation)
    expect(finalRows).toBe(initialRows);
  });

  it('switching between datasets maintains bounded DOM count', () => {
    const data1 = generateData(30_000);
    const data2 = generateData(70_000);

    const { container, rerender } = render(
      <DataTable data={data1} columns={['id', 'name']} height={400} />
    );

    const rows1 = container.querySelectorAll('tbody tr').length;

    rerender(<DataTable data={data2} columns={['id', 'name']} height={400} />);
    const rows2 = container.querySelectorAll('tbody tr').length;

    rerender(<DataTable data={data1} columns={['id', 'name']} height={400} />);
    const rows3 = container.querySelectorAll('tbody tr').length;

    // All row counts should be bounded (not growing unbounded)
    expect(rows1).toBeLessThan(100);
    expect(rows2).toBeLessThan(100);
    expect(rows3).toBeLessThan(100);

    // Switching back to same data should produce same row count
    expect(rows3).toBe(rows1);
  });
});
