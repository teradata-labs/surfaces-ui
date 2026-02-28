import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChip, InputChip } from './Chip';

describe('FilterChip', () => {
  it('renders with label', () => {
    render(<FilterChip label="Active" />);
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeDefined();
  });

  it('renders as unselected by default', () => {
    render(<FilterChip label="Active" />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  });

  it('renders as selected when selected=true', () => {
    render(<FilterChip label="Active" selected />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });

  it('calls onSelectedChange on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChip label="Active" onSelectedChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onSelectedChange with false when deselecting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChip label="Active" selected onSelectedChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onSelectedChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChip label="Active" disabled onSelectedChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows checkmark icon when selected', () => {
    const { container } = render(<FilterChip label="Active" selected />);
    const icon = container.querySelector('svg');
    expect(icon).toBeDefined();
  });

  it('accepts custom className', () => {
    render(<FilterChip label="Active" className="custom-chip" />);
    expect(screen.getByRole('checkbox').className).toContain('custom-chip');
  });
});

describe('InputChip', () => {
  it('renders with label', () => {
    render(<InputChip label="React" />);
    expect(screen.getByText('React')).toBeDefined();
  });

  it('renders dismiss button when onDismiss provided', () => {
    render(<InputChip label="React" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove React' })).toBeDefined();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<InputChip label="React" onDismiss={onDismiss} />);
    await user.click(screen.getByLabelText('Remove React'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when onDismiss not provided', () => {
    const { container } = render(<InputChip label="React" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('accepts custom className', () => {
    const { container } = render(<InputChip label="React" className="custom-chip" />);
    expect(container.firstChild?.className).toContain('custom-chip');
  });
});
