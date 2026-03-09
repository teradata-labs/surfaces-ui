import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusedPage } from './FocusedPage';

describe('FocusedPage', () => {
  it('renders title', () => {
    render(<FocusedPage title="Settings" />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders subtitle when provided', () => {
    render(<FocusedPage title="Settings" subtitle="Manage preferences" />);
    expect(screen.getByText('Manage preferences')).toBeDefined();
  });

  it('renders children', () => {
    render(
      <FocusedPage title="Settings">
        <p>Body content</p>
      </FocusedPage>
    );
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('shows back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<FocusedPage title="Settings" onBack={onBack} />);
    const backBtn = screen.getByLabelText('Go back');
    expect(backBtn).toBeDefined();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<FocusedPage title="Settings" onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not show back button without onBack', () => {
    render(<FocusedPage title="Settings" />);
    expect(screen.queryByLabelText('Go back')).toBeNull();
  });

  it('renders breadcrumbs', () => {
    render(
      <FocusedPage
        title="Settings"
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Account' },
          { label: 'Settings' },
        ]}
      />
    );
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Account')).toBeDefined();
    expect(screen.getByLabelText('Breadcrumb')).toBeDefined();
  });

  it('renders clickable breadcrumbs', () => {
    const onClick = vi.fn();
    render(
      <FocusedPage
        title="Settings"
        breadcrumbs={[
          { label: 'Home', onClick },
          { label: 'Settings' },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Home'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders header actions', () => {
    render(
      <FocusedPage title="Settings" headerActions={<button>Save</button>} />
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(<FocusedPage title="Settings" className="my-page" />);
    expect(container.firstElementChild?.className).toContain('my-page');
  });

  it('applies custom maxWidth', () => {
    render(<FocusedPage title="Settings" maxWidth={600}><p>Content</p></FocusedPage>);
    const main = screen.getByRole('main');
    const inner = main.firstElementChild as HTMLElement;
    expect(inner.style.maxWidth).toBe('600px');
  });
});
