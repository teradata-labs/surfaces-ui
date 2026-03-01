import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeDefined();
  });

  it('renders optional description', () => {
    render(<EmptyState title="No results" description="Try adjusting your filters" />);
    expect(screen.getByText('Try adjusting your filters')).toBeDefined();
  });

  it('renders optional icon', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">📦</span>} />);
    expect(screen.getByTestId('icon')).toBeDefined();
  });

  it('renders action button when provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Create', onClick: handleAction }}
      />
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeDefined();
  });

  it('calls action.onClick when button clicked', async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Create', onClick: handleAction }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('accepts custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="my-class" />);
    expect(container.firstChild?.className).toContain('my-class');
  });

  it('renders without icon by default', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('renders all elements when fully specified', () => {
    render(
      <EmptyState
        icon={<span data-testid="icon">📦</span>}
        title="No data"
        description="Get started by creating your first item"
        action={{ label: 'Create Item', onClick: vi.fn() }}
      />
    );
    expect(screen.getByTestId('icon')).toBeDefined();
    expect(screen.getByText('No data')).toBeDefined();
    expect(screen.getByText('Get started by creating your first item')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create Item' })).toBeDefined();
  });
});
