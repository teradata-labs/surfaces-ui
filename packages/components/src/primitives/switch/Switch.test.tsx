import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch aria-label="Toggle" onCheckedChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onCheckedChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch aria-label="Toggle" disabled onCheckedChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts custom className', () => {
    render(<Switch aria-label="Toggle" className="my-custom-class" />);
    expect(screen.getByRole('switch').className).toContain('my-custom-class');
  });

  it('toggles on Space key press', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch aria-label="Toggle" onCheckedChange={onChange} />);

    const switchElement = screen.getByRole('switch');
    switchElement.focus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
