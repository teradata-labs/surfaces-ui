import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Snackbar } from './Snackbar';

describe('Snackbar', () => {
  it('renders message', () => {
    render(<Snackbar message="Item saved" />);
    expect(screen.getByText('Item saved')).toBeDefined();
  });

  it('renders with role=status for a11y', () => {
    render(<Snackbar message="Done" />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('hides when open=false', () => {
    const { container } = render(<Snackbar message="Hidden" open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders action button and fires callback', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Snackbar message="Deleted" actionLabel="Undo" onAction={onAction} />);
    await user.click(screen.getByText('Undo'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders dismiss button and fires callback', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Snackbar message="Info" dismissible onDismiss={onDismiss} />);
    await user.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Snackbar message="Temp" duration={3000} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Snackbar message="Persistent" duration={0} onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('accepts custom className', () => {
    render(<Snackbar message="Test" className="custom-snack" />);
    expect(screen.getByRole('status').className).toContain('custom-snack');
  });

  it('applies variant styles', () => {
    const { rerender } = render(<Snackbar message="Ok" variant="positive" />);
    expect(screen.getByRole('status').className).toContain('bg-success');

    rerender(<Snackbar message="Err" variant="negative" />);
    expect(screen.getByRole('status').className).toContain('bg-destructive');
  });
});
