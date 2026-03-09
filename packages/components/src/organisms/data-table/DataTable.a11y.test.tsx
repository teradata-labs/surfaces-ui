import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DataTable } from './DataTable';
import type { DataTableColumn } from './types';

expect.extend(toHaveNoViolations);

interface User {
  id: number;
  name: string;
  role: string;
  sessions: number;
  [key: string]: unknown;
}

const data: User[] = [
  { id: 1, name: 'Alice', role: 'Admin', sessions: 42 },
  { id: 2, name: 'Bob', role: 'Editor', sessions: 18 },
];

const columns: DataTableColumn<User>[] = [
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'role', header: 'Role', type: 'text' },
  { id: 'sessions', header: 'Sessions', type: 'number' },
];

const fullColumns: DataTableColumn<User>[] = [
  { id: '_select', type: 'checkbox' },
  ...columns,
  { id: '_actions', type: 'actions' },
];

describe('DataTable a11y', () => {
  it('has no violations with basic data', async () => {
    const { container } = render(
      <DataTable data={data} columns={columns} aria-label="Users" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with selection', async () => {
    const { container } = render(
      <DataTable
        data={data}
        columns={fullColumns}
        selectedKeys={new Set([1])}
        onSelectionChange={() => {}}
        getRowKey={(row: User) => row.id}
        aria-label="Users with selection"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with active sort', async () => {
    const { container } = render(
      <DataTable
        data={data}
        columns={fullColumns}
        sort={{ columnId: 'name', direction: 'asc' }}
        onSortChange={() => {}}
        aria-label="Users sorted"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in empty state', async () => {
    const { container } = render(
      <DataTable data={[]} columns={columns} aria-label="Empty table" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
