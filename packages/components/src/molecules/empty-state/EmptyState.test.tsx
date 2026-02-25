import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

const IconPlaceholder = () => <svg aria-hidden="true" />;

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No data found" />);
    expect(screen.getByText('No data found')).toBeDefined();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title="Empty" description="Try adjusting your filters." />);
    expect(screen.getByText('Try adjusting your filters.')).toBeDefined();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Try')).toBeNull();
  });

  it('renders action button when action is provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Create New', onClick: vi.fn() }}
      />
    );
    expect(screen.getByRole('button', { name: 'Create New' })).toBeDefined();
  });

  it('calls action.onClick when button clicked', () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Empty" action={{ label: 'Create', onClick }} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not render action button when action is omitted', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <EmptyState title="Empty" icon={<IconPlaceholder />} />
    );
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <EmptyState title="Empty" className="my-empty" />
    );
    expect(container.firstElementChild?.className).toContain('my-empty');
  });
});
