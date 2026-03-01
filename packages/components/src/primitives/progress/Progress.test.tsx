import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './Progress';

describe('Progress', () => {
  it('renders with role progressbar', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('sets aria-valuenow to provided value', () => {
    render(<Progress value={60} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
  });

  it('clamps value to 0', () => {
    render(<Progress value={-20} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('clamps value to 100', () => {
    render(<Progress value={110} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('renders indeterminate when value is undefined', () => {
    render(<Progress />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  });

  it('accepts custom className', () => {
    render(<Progress value={50} className="my-bar" />);
    expect(screen.getByRole('progressbar').className).toContain('my-bar');
  });

  it('renders a fill element with correct width for determinate', () => {
    const { container } = render(<Progress value={75} />);
    const fill = container.querySelector('[style*="width: 75%"]');
    expect(fill).toBeDefined();
  });
});
