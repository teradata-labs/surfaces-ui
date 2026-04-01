import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusDialog } from './StatusDialog';
import { Button } from '../../primitives/button';

describe('StatusDialog', () => {
  it('renders title', () => {
    render(<StatusDialog open status="success" title="Done!" />);
    expect(screen.getByText('Done!')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(
      <StatusDialog open status="success" title="Done" description="Your file was saved." />
    );
    expect(screen.getByText('Your file was saved.')).toBeDefined();
  });

  it('renders action when provided', () => {
    render(
      <StatusDialog
        open
        status="error"
        title="Error"
        action={<Button>Retry</Button>}
      />
    );
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<StatusDialog open={false} status="success" title="Done!" />);
    expect(screen.queryByText('Done!')).toBeNull();
  });

  it('shows spinner icon for loading status', () => {
    render(
      <StatusDialog open status="loading" title="Loading..." />
    );
    const svg = document.querySelector('.animate-spin');
    expect(svg).not.toBeNull();
  });

  it('shows positive strip for success status', () => {
    render(
      <StatusDialog open status="success" title="Success" />
    );
    // The left strip has the positive tint
    const strip = document.querySelector('[class*="bg-positive"]');
    expect(strip).not.toBeNull();
  });

  it('shows error strip for error status', () => {
    render(
      <StatusDialog open status="error" title="Error" />
    );
    const strip = document.querySelector('[class*="bg-error"]');
    expect(strip).not.toBeNull();
  });

  it('prevents closing during loading status', () => {
    const onOpenChange = vi.fn();
    render(
      <StatusDialog
        open
        status="loading"
        title="Loading..."
        onOpenChange={onOpenChange}
      />
    );
    // Try pressing Escape
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows closing when status is not loading', () => {
    const onOpenChange = vi.fn();
    render(
      <StatusDialog
        open
        status="success"
        title="Done"
        onOpenChange={onOpenChange}
      />
    );
    // Escape key triggers close on success status
    fireEvent.keyDown(document.body, { key: 'Escape' });
    // The dialog should allow the close
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('accepts custom className', () => {
    render(<StatusDialog open status="success" title="Done" className="my-dialog" />);
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('my-dialog');
  });

  it('renders close button for non-loading states', () => {
    render(<StatusDialog open status="success" title="Done" />);
    expect(screen.getByLabelText('Close')).toBeDefined();
  });

  it('does not render close button during loading', () => {
    render(<StatusDialog open status="loading" title="Loading..." />);
    expect(screen.queryByLabelText('Close')).toBeNull();
  });

  it('renders details toggle when details prop is provided', () => {
    render(
      <StatusDialog
        open
        status="error"
        title="Error"
        description="Something failed."
        details={<pre>Error code: 500</pre>}
      />
    );
    expect(screen.getByText('Show details')).toBeDefined();
  });

  it('toggles details visibility on click', () => {
    render(
      <StatusDialog
        open
        status="error"
        title="Error"
        details={<pre>Error code: 500</pre>}
      />
    );
    const toggle = screen.getByText('Show details');
    fireEvent.click(toggle);
    expect(screen.getByText('Error code: 500')).toBeDefined();
    expect(screen.getByText('Hide details')).toBeDefined();
  });
});
