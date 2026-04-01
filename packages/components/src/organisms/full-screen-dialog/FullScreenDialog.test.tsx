import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FullScreenDialog } from './FullScreenDialog';

describe('FullScreenDialog', () => {
  it('renders title', () => {
    render(<FullScreenDialog open title="Settings" />);
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders children', () => {
    render(
      <FullScreenDialog open title="Settings">
        <p>Content here</p>
      </FullScreenDialog>
    );
    expect(screen.getByText('Content here')).toBeDefined();
  });

  it('renders action when provided', () => {
    render(
      <FullScreenDialog open title="Settings" action={<button>Save</button>}>
        <p>Content</p>
      </FullScreenDialog>
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<FullScreenDialog open={false} title="Settings" />);
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('calls onOpenChange when close button clicked', () => {
    const onOpenChange = vi.fn();
    render(<FullScreenDialog open title="Settings" onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fills the viewport (fixed inset-0)', () => {
    render(<FullScreenDialog open title="Settings" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('fixed');
    expect(dialog.className).toContain('inset-0');
  });

  it('accepts custom className', () => {
    render(<FullScreenDialog open title="Settings" className="my-fsd" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('my-fsd');
  });

  it('has close button with aria-label', () => {
    render(<FullScreenDialog open title="Settings" />);
    expect(screen.getByLabelText('Close')).toBeDefined();
  });
});
