import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChip, InputChip } from './Chip';

describe('FilterChip', () => {
  it('renders a button', () => {
    render(<FilterChip label="Analytics" />);
    expect(screen.getByRole('checkbox', { name: 'Analytics' })).toBeDefined();
  });

  it('shows checkmark icon when selected', () => {
    const { container } = render(<FilterChip label="Analytics" selected />);
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('does not show checkmark when unselected', () => {
    const { container } = render(<FilterChip label="Analytics" selected={false} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('calls onSelectedChange with toggled value', () => {
    const onChange = vi.fn();
    render(<FilterChip label="Analytics" selected={false} onSelectedChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onSelectedChange from true to false', () => {
    const onChange = vi.fn();
    render(<FilterChip label="Analytics" selected={true} onSelectedChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is accessible via aria-checked', () => {
    render(<FilterChip label="Analytics" selected={true} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });

  it('accepts custom className', () => {
    render(<FilterChip label="A" className="my-chip" />);
    expect(screen.getByRole('checkbox').className).toContain('my-chip');
  });
});

describe('InputChip', () => {
  it('renders the label text', () => {
    render(<InputChip label="React" />);
    expect(screen.getByText('React')).toBeDefined();
  });

  it('renders dismiss button when onDismiss is provided', () => {
    render(<InputChip label="React" onDismiss={vi.fn()} />);
    expect(screen.getByLabelText('Remove React')).toBeDefined();
  });

  it('does not render dismiss button without onDismiss', () => {
    render(<InputChip label="React" />);
    expect(screen.queryByLabelText('Remove React')).toBeNull();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<InputChip label="React" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Remove React'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
