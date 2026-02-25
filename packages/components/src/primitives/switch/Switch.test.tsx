import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders with role switch', () => {
    render(<Switch aria-label="Toggle setting" />);
    expect(screen.getByRole('switch')).toBeDefined();
  });

  it('renders as unchecked by default', () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole('switch').getAttribute('data-state')).toBe('unchecked');
  });

  it('renders as checked when defaultChecked is true', () => {
    render(<Switch aria-label="Toggle" defaultChecked />);
    expect(screen.getByRole('switch').getAttribute('data-state')).toBe('checked');
  });

  it('calls onCheckedChange when clicked', () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Toggle" onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onCheckedChange when disabled', () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Toggle" disabled onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts custom className', () => {
    render(<Switch aria-label="Toggle" className="my-custom-class" />);
    expect(screen.getByRole('switch').className).toContain('my-custom-class');
  });
});
