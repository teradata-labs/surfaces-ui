import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircularProgress } from './CircularProgress';

describe('CircularProgress', () => {
  it('renders with role progressbar', () => {
    render(<CircularProgress value={50} />);
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('sets aria-valuenow to the provided value', () => {
    render(<CircularProgress value={75} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75');
  });

  it('clamps value to 0', () => {
    render(<CircularProgress value={-10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('clamps value to 100', () => {
    render(<CircularProgress value={150} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('shows percentage label by default', () => {
    render(<CircularProgress value={42} />);
    expect(screen.getByText('42%')).toBeDefined();
  });

  it('hides label when showLabel=false', () => {
    render(<CircularProgress value={42} showLabel={false} />);
    expect(screen.queryByText('42%')).toBeNull();
  });

  it('accepts custom className', () => {
    render(<CircularProgress value={50} className="my-class" />);
    expect(screen.getByRole('progressbar').className).toContain('my-class');
  });

  it('renders SVG circles', () => {
    const { container } = render(<CircularProgress value={50} />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2); // track + fill
  });
});
