import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('renders a button', () => {
    render(<IconButton aria-label="Settings">⚙️</IconButton>);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  });

  it('accepts variant props', () => {
    const { rerender } = render(<IconButton aria-label="Settings" variant="filled">⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('bg-primary');

    rerender(<IconButton aria-label="Settings" variant="outlined">⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('border');
  });

  it('accepts size props', () => {
    const { rerender } = render(<IconButton aria-label="Settings" size="sm">⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('w-8');

    rerender(<IconButton aria-label="Settings" size="lg">⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('w-12');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<IconButton aria-label="Settings" onClick={handleClick}>⚙️</IconButton>);
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies active state styling', () => {
    render(<IconButton aria-label="Settings" active>⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('bg-secondary-container');
  });

  it('is disabled when disabled prop is true', () => {
    render(<IconButton aria-label="Settings" disabled>⚙️</IconButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('accepts custom className', () => {
    render(<IconButton aria-label="Settings" className="custom-class">⚙️</IconButton>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });
});
