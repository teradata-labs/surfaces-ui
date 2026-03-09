import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListItem } from './ListItem';

describe('ListItem', () => {
  it('renders primary text', () => {
    render(<ListItem primary="Item one" />);
    expect(screen.getByText('Item one')).toBeDefined();
  });

  it('renders secondary text', () => {
    render(<ListItem primary="Title" secondary="Subtitle" />);
    expect(screen.getByText('Subtitle')).toBeDefined();
  });

  it('renders tertiary text', () => {
    render(<ListItem primary="Title" secondary="Line 2" tertiary="Line 3" />);
    expect(screen.getByText('Line 3')).toBeDefined();
  });

  it('renders leading element', () => {
    render(<ListItem primary="Item" leading={<span data-testid="lead">L</span>} />);
    expect(screen.getByTestId('lead')).toBeDefined();
  });

  it('renders trailing element', () => {
    render(<ListItem primary="Item" trailing={<span data-testid="trail">T</span>} />);
    expect(screen.getByTestId('trail')).toBeDefined();
  });

  it('handles click', () => {
    const onClick = vi.fn();
    render(<ListItem primary="Clickable" onClick={onClick} />);
    fireEvent.click(screen.getByText('Clickable'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has button role when clickable', () => {
    render(<ListItem primary="Action" onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('handles Enter key', () => {
    const onClick = vi.fn();
    render(<ListItem primary="Key" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respects disabled state', () => {
    const onClick = vi.fn();
    render(<ListItem primary="Disabled" onClick={onClick} disabled />);
    fireEvent.click(screen.getByText('Disabled'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies selected style', () => {
    const { container } = render(<ListItem primary="Selected" selected />);
    expect((container.firstChild as HTMLElement).className).toContain('bg-primary/8');
  });

  it('accepts custom className', () => {
    const { container } = render(<ListItem primary="Custom" className="my-item" />);
    expect((container.firstChild as HTMLElement).className).toContain('my-item');
  });
});
