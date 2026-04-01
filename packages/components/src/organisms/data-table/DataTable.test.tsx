import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { DataTableColumn, RowAction } from './types';

/* ── Sample data ──────────────────────────────────────────────────────── */

interface User {
  id: number;
  name: string;
  role: string;
  sessions: number;
  [key: string]: unknown;
}

const sampleData: User[] = [
  { id: 1, name: 'Alice', role: 'Admin', sessions: 42 },
  { id: 2, name: 'Bob', role: 'Editor', sessions: 18 },
  { id: 3, name: 'Carol', role: 'Viewer', sessions: 7 },
  { id: 4, name: 'Dave', role: 'Admin', sessions: 33 },
  { id: 5, name: 'Eve', role: 'Editor', sessions: 12 },
];

const textColumns: DataTableColumn<User>[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'role', header: 'Role', type: 'text' },
  { id: 'sessions', header: 'Sessions', type: 'number' },
];

const fullColumns: DataTableColumn<User>[] = [
  { id: '_select', type: 'checkbox' },
  { id: 'name', header: 'Name', type: 'text', sortable: true },
  { id: 'role', header: 'Role', type: 'text', sortable: true },
  { id: 'sessions', header: 'Sessions', type: 'number', sortable: true },
  { id: '_actions', type: 'actions' },
];

const getRowKey = (row: User) => row.id;

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('DataTable', () => {
  /* ── Basic rendering ───────────────────────────────────────────────── */

  it('renders table with data', () => {
    render(<DataTable data={sampleData} columns={textColumns} />);
    expect(screen.getByRole('grid')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders empty state when no data', () => {
    render(<DataTable data={[]} columns={textColumns} />);
    expect(screen.getByText('No data to display')).toBeDefined();
  });

  it('renders header text', () => {
    render(<DataTable data={sampleData} columns={textColumns} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('Sessions')).toBeDefined();
  });

  /* ── Column alignment ──────────────────────────────────────────────── */

  it('renders text columns left-aligned', () => {
    render(<DataTable data={sampleData} columns={textColumns} />);
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader?.className).toContain('text-left');
  });

  it('renders number columns right-aligned', () => {
    render(<DataTable data={sampleData} columns={textColumns} />);
    const sessionsHeader = screen.getByText('Sessions').closest('th');
    expect(sessionsHeader?.className).toContain('text-right');
  });

  /* ── Checkbox selection ────────────────────────────────────────────── */

  it('renders checkbox column', () => {
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        selectedKeys={new Set()}
        onSelectionChange={() => {}}
        getRowKey={getRowKey}
      />,
    );
    // Header checkbox + 5 row checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(6);
  });

  it('fires onSelectionChange when toggling a row checkbox', () => {
    const onChange = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        selectedKeys={new Set()}
        onSelectionChange={onChange}
        getRowKey={getRowKey}
      />,
    );
    // Click first row's checkbox (index 1 = first body checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const newKeys = onChange.mock.calls[0][0] as Set<number>;
    expect(newKeys.has(1)).toBe(true); // id=1 (Alice)
  });

  it('fires onSelectionChange with select-all', () => {
    const onChange = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        selectedKeys={new Set()}
        onSelectionChange={onChange}
        getRowKey={getRowKey}
      />,
    );
    // Click header checkbox (index 0)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const newKeys = onChange.mock.calls[0][0] as Set<number>;
    expect(newKeys.size).toBe(5); // All 5 rows
  });

  it('fires onSelectionChange to deselect-all when all selected', () => {
    const onChange = vi.fn();
    const allSelected = new Set([1, 2, 3, 4, 5]);
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        selectedKeys={allSelected}
        onSelectionChange={onChange}
        getRowKey={getRowKey}
      />,
    );
    // Click header checkbox to deselect all
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const newKeys = onChange.mock.calls[0][0] as Set<number>;
    expect(newKeys.size).toBe(0);
  });

  it('sets aria-selected on selected rows', () => {
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        selectedKeys={new Set([1])}
        onSelectionChange={() => {}}
        getRowKey={getRowKey}
      />,
    );
    const rows = screen.getAllByRole('row');
    // row[0] is header, row[1] is first data row (Alice, id=1)
    expect(rows[1].getAttribute('aria-selected')).toBe('true');
    expect(rows[2].getAttribute('aria-selected')).toBeNull();
  });

  /* ── Sorting ───────────────────────────────────────────────────────── */

  it('fires onSortChange when clicking a sortable header', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        onSortChange={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith({ columnId: 'name', direction: 'asc' });
  });

  it('toggles sort direction on repeated clicks', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        sort={{ columnId: 'name', direction: 'asc' }}
        onSortChange={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
  });

  it('clears sort on third click', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        sort={{ columnId: 'name', direction: 'desc' }}
        onSortChange={onSort}
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith(null);
  });

  it('sets aria-sort on sorted column', () => {
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        sort={{ columnId: 'name', direction: 'asc' }}
        onSortChange={() => {}}
      />,
    );
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader?.getAttribute('aria-sort')).toBe('ascending');
  });

  /* ── Density ───────────────────────────────────────────────────────── */

  it('renders default density row heights', () => {
    render(<DataTable data={sampleData} columns={textColumns} density="default" />);
    const rows = screen.getAllByRole('row');
    // Body rows start at index 1
    expect(rows[1].style.height).toBe('48px');
  });

  it('renders compact density row heights', () => {
    render(<DataTable data={sampleData} columns={textColumns} density="compact" />);
    const rows = screen.getAllByRole('row');
    expect(rows[1].style.height).toBe('32px');
  });

  it('renders dense density row heights', () => {
    render(<DataTable data={sampleData} columns={textColumns} density="dense" />);
    const rows = screen.getAllByRole('row');
    expect(rows[1].style.height).toBe('24px');
  });

  /* ── Row actions ───────────────────────────────────────────────────── */

  it('renders actions column with menu trigger', () => {
    const actions: RowAction<User>[] = [
      { label: 'Edit', onClick: vi.fn() },
      { label: 'Delete', destructive: true, onClick: vi.fn() },
    ];
    render(
      <DataTable
        data={sampleData}
        columns={fullColumns}
        rowActions={actions}
      />,
    );
    // Each row should have an actions button
    const actionButtons = screen.getAllByLabelText(/Actions for row/);
    expect(actionButtons.length).toBe(5);
  });

  /* ── Row click ─────────────────────────────────────────────────────── */

  it('fires onRowClick with correct row', () => {
    const onClick = vi.fn();
    render(
      <DataTable
        data={sampleData}
        columns={textColumns}
        onRowClick={onClick}
      />,
    );
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]); // First data row
    expect(onClick).toHaveBeenCalledWith(sampleData[0], 0);
  });

  /* ── ARIA ───────────────────────────────────────────────────────────── */

  it('sets aria-rowcount and aria-colcount', () => {
    render(<DataTable data={sampleData} columns={textColumns} />);
    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-rowcount')).toBe('6'); // 5 rows + 1 header
    expect(grid.getAttribute('aria-colcount')).toBe('3');
  });

  it('passes aria-label to table', () => {
    render(
      <DataTable data={sampleData} columns={textColumns} aria-label="Users table" />,
    );
    expect(screen.getByRole('grid', { name: 'Users table' })).toBeDefined();
  });

  /* ── className pass-through ────────────────────────────────────────── */

  it('applies custom className', () => {
    const { container } = render(
      <DataTable data={sampleData} columns={textColumns} className="my-table" />,
    );
    expect(container.firstElementChild?.className).toContain('my-table');
  });
});
