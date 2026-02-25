import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders with role checkbox', () => {
    render(<Checkbox aria-label="Accept terms" />);
    expect(screen.getByRole('checkbox')).toBeDefined();
  });

  it('renders as unchecked by default', () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('unchecked');
  });

  it('renders as checked when defaultChecked', () => {
    render(<Checkbox aria-label="Accept" defaultChecked />);
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('checked');
  });

  it('calls onCheckedChange on click', () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Accept" onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onCheckedChange when disabled', () => {
    const onChange = vi.fn();
    render(<Checkbox aria-label="Accept" disabled onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports indeterminate state', () => {
    render(<Checkbox aria-label="Accept" checked="indeterminate" />);
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('indeterminate');
  });

  it('accepts custom className', () => {
    render(<Checkbox aria-label="Accept" className="custom-cls" />);
    expect(screen.getByRole('checkbox').className).toContain('custom-cls');
  });
});
