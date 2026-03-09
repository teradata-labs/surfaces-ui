import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SideSheet } from './SideSheet';

describe('SideSheet', () => {
  it('renders title', () => {
    render(<SideSheet open title="Details" />);
    expect(screen.getByText('Details')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<SideSheet open title="Details" description="View item details" />);
    expect(screen.getByText('View item details')).toBeDefined();
  });

  it('renders children', () => {
    render(
      <SideSheet open title="Details">
        <p>Sheet content here</p>
      </SideSheet>
    );
    expect(screen.getByText('Sheet content here')).toBeDefined();
  });

  it('renders footer when provided', () => {
    render(
      <SideSheet open title="Details" footer={<button>Save</button>}>
        <p>Content</p>
      </SideSheet>
    );
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('does not render when closed', () => {
    render(<SideSheet open={false} title="Details" />);
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('calls onOpenChange when close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<SideSheet open title="Details" onOpenChange={onOpenChange} />);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders on the right side by default', () => {
    render(<SideSheet open title="Details" />);
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('right-0');
  });

  it('renders on the left side when specified', () => {
    render(<SideSheet open title="Details" side="left" />);
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('left-0');
  });

  it('applies custom width', () => {
    render(<SideSheet open title="Details" width={500} />);
    const content = screen.getByRole('dialog');
    expect(content.style.width).toBe('500px');
  });

  it('applies string width', () => {
    render(<SideSheet open title="Details" width="50vw" />);
    const content = screen.getByRole('dialog');
    expect(content.style.width).toBe('50vw');
  });

  it('accepts custom className', () => {
    render(<SideSheet open title="Details" className="my-sheet" />);
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('my-sheet');
  });

  it('has close button with aria-label', () => {
    render(<SideSheet open title="Details" />);
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeDefined();
  });
});
