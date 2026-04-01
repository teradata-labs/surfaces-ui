import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextLockup } from './TextLockup';

describe('TextLockup', () => {
  it('renders title', () => {
    render(<TextLockup title="Heading" />);
    expect(screen.getByText('Heading')).toBeDefined();
  });

  it('renders subtitle', () => {
    render(<TextLockup title="Title" subtitle="Supporting text" />);
    expect(screen.getByText('Supporting text')).toBeDefined();
  });

  it('renders without subtitle', () => {
    const { container } = render(<TextLockup title="Solo" />);
    expect(container.querySelectorAll('span').length).toBe(1);
  });

  it('applies sm size', () => {
    render(<TextLockup title="Small" size="sm" />);
    expect(screen.getByText('Small').className).toContain('text-sm');
  });

  it('applies lg size', () => {
    render(<TextLockup title="Large" size="lg" />);
    expect(screen.getByText('Large').className).toContain('text-lg');
  });

  it('applies center alignment', () => {
    const { container } = render(<TextLockup title="Centered" align="center" />);
    expect((container.firstChild as HTMLElement).className).toContain('text-center');
  });

  it('accepts custom className', () => {
    const { container } = render(<TextLockup title="Custom" className="my-lockup" />);
    expect((container.firstChild as HTMLElement).className).toContain('my-lockup');
  });
});
