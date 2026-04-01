import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  const svg = <svg data-testid="test-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;

  it('renders children', () => {
    render(<Icon aria-label="Test">{svg}</Icon>);
    expect(screen.getByTestId('test-svg')).toBeDefined();
  });

  it('has role="img"', () => {
    render(<Icon aria-label="Test">{svg}</Icon>);
    expect(screen.getByRole('img')).toBeDefined();
  });

  it('applies default md size', () => {
    render(<Icon aria-label="Test">{svg}</Icon>);
    const el = screen.getByRole('img');
    expect(el.className).toContain('w-5');
    expect(el.className).toContain('h-5');
  });

  it('applies xs size', () => {
    render(<Icon size="xs" aria-label="Test">{svg}</Icon>);
    const el = screen.getByRole('img');
    expect(el.className).toContain('w-3');
    expect(el.className).toContain('h-3');
  });

  it('applies xl size', () => {
    render(<Icon size="xl" aria-label="Test">{svg}</Icon>);
    const el = screen.getByRole('img');
    expect(el.className).toContain('w-8');
    expect(el.className).toContain('h-8');
  });

  it('applies primary color', () => {
    render(<Icon color="primary" aria-label="Test">{svg}</Icon>);
    expect(screen.getByRole('img').className).toContain('text-primary');
  });

  it('applies error color', () => {
    render(<Icon color="error" aria-label="Test">{svg}</Icon>);
    expect(screen.getByRole('img').className).toContain('text-destructive');
  });

  it('accepts custom className', () => {
    render(<Icon className="custom-icon" aria-label="Test">{svg}</Icon>);
    expect(screen.getByRole('img').className).toContain('custom-icon');
  });
});
