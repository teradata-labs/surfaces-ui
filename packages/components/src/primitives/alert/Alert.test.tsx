import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders with role alert', () => {
    render(<Alert title="Test alert" />);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('renders title text', () => {
    render(<Alert title="Connection lost" />);
    expect(screen.getByText('Connection lost')).toBeDefined();
  });

  it('renders description when provided', () => {
    render(<Alert title="Error" description="Something went wrong." />);
    expect(screen.getByText('Something went wrong.')).toBeDefined();
  });

  it('renders dismiss button when onDismiss is provided', () => {
    render(<Alert title="Dismissible" onDismiss={() => {}} />);
    expect(screen.getByLabelText('Dismiss alert')).toBeDefined();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<Alert title="Dismissible" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss alert'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(<Alert title="No dismiss" />);
    expect(screen.queryByLabelText('Dismiss alert')).toBeNull();
  });

  it('renders action slot', () => {
    render(<Alert title="Alert" action={<button>Retry</button>} />);
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it.each([
    'negative',
    'caution',
    'positive',
    'secondary',
    'loading',
    'default',
  ] as const)('renders %s variant without error', (variant) => {
    const { container } = render(<Alert title="Test" variant={variant} />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders in full-page mode by default', () => {
    const { container } = render(<Alert title="Full-page" variant="negative" />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.className).toContain('bg-negative');
  });

  it('renders in inline mode with container background', () => {
    const { container } = render(<Alert title="Inline" variant="negative" mode="inline" />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.className).toContain('bg-negative-container');
  });

  it('applies custom className', () => {
    const { container } = render(<Alert title="Custom" className="my-alert" />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.className).toContain('my-alert');
  });

  it('renders loading icon with animation', () => {
    const { container } = render(<Alert title="Loading..." variant="loading" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });
});
