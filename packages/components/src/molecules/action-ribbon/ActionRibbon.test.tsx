import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionRibbon } from './ActionRibbon';

describe('ActionRibbon', () => {
  it('renders with default inactive state', () => {
    render(<ActionRibbon />);
    expect(screen.getByRole('toolbar')).toBeDefined();
    expect(screen.getByText('No changes')).toBeDefined();
  });

  it('renders label text', () => {
    render(<ActionRibbon label="3 rows updated" />);
    expect(screen.getByText('3 rows updated')).toBeDefined();
  });

  it('renders active state with primary background', () => {
    render(<ActionRibbon state="active" label="Editing" />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.className).toContain('bg-primary/8');
    expect(screen.getByText('Editing')).toBeDefined();
  });

  it('renders positive state with check icon', () => {
    const { container } = render(<ActionRibbon state="positive" label="Saved" />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('renders caution state with warning icon', () => {
    const { container } = render(<ActionRibbon state="caution" label="Unsaved changes" />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(screen.getByText('Unsaved changes')).toBeDefined();
  });

  it('renders negative state with error icon', () => {
    const { container } = render(<ActionRibbon state="negative" label="Error occurred" />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(screen.getByText('Error occurred')).toBeDefined();
  });

  it('renders loading state with spinning icon', () => {
    const { container } = render(<ActionRibbon state="loading" label="Loading..." />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('class')).toContain('animate-spin');
  });

  it('renders pending state with ellipsis icon', () => {
    const { container } = render(<ActionRibbon state="pending" label="Pending" />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('renders checked state with checkbox and selection count', () => {
    render(<ActionRibbon state="checked" selectionCount={5} />);
    expect(screen.getByText(/5 items selected/)).toBeDefined();
    expect(screen.getByLabelText('Select all')).toBeDefined();
  });

  it('renders singular "item" for selection count of 1', () => {
    render(<ActionRibbon state="checked" selectionCount={1} />);
    expect(screen.getByText(/1 item selected/)).toBeDefined();
  });

  it('renders "Clear selection" link in checked state', () => {
    const onClear = vi.fn();
    render(<ActionRibbon state="checked" selectionCount={3} onClearSelection={onClear} />);
    expect(screen.getByText('Clear selection')).toBeDefined();
  });

  it('calls onClearSelection when clear link is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<ActionRibbon state="checked" selectionCount={3} onClearSelection={onClear} />);
    await user.click(screen.getByText('Clear selection'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render clear link when onClearSelection not provided', () => {
    render(<ActionRibbon state="checked" selectionCount={3} />);
    expect(screen.queryByText('Clear selection')).toBeNull();
  });

  it('renders icon slots', () => {
    render(
      <ActionRibbon
        icons={[
          <button key="1" aria-label="Edit">E</button>,
          <button key="2" aria-label="Delete">D</button>,
        ]}
      />
    );
    expect(screen.getByLabelText('Edit')).toBeDefined();
    expect(screen.getByLabelText('Delete')).toBeDefined();
  });

  it('renders action slots', () => {
    render(
      <ActionRibbon
        actions={[
          <button key="1">Save</button>,
          <button key="2">Cancel</button>,
        ]}
      />
    );
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('accepts custom className', () => {
    render(<ActionRibbon className="custom-ribbon" />);
    expect(screen.getByRole('toolbar').className).toContain('custom-ribbon');
  });

  it('sets aria-label based on state', () => {
    const { rerender } = render(<ActionRibbon label="Saved" />);
    expect(screen.getByRole('toolbar').getAttribute('aria-label')).toBe('Saved');

    rerender(<ActionRibbon state="checked" selectionCount={5} />);
    expect(screen.getByRole('toolbar').getAttribute('aria-label')).toBe('5 items selected');
  });
});
