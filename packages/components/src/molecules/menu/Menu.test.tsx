import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Menu } from './Menu';

const items = [
  { label: 'Edit', onClick: vi.fn() },
  { label: 'Duplicate', onClick: vi.fn() },
  { label: 'Delete', destructive: true, onClick: vi.fn() },
  { label: 'Archived', disabled: true },
];

describe('Menu', () => {
  it('renders trigger', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('menu is hidden by default', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens menu on click', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('renders all menu items', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Edit')).toBeDefined();
    expect(screen.getByText('Duplicate')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
    expect(screen.getByText('Archived')).toBeDefined();
  });

  it('calls onClick and closes menu', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Edit'));
    expect(items[0].onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disabled items are not clickable', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    const archived = screen.getByText('Archived');
    expect(archived.closest('button')?.disabled).toBe(true);
  });

  it('destructive items have destructive color', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Delete').closest('button')?.className).toContain('text-destructive');
  });

  it('has aria-haspopup and aria-expanded on trigger', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape', () => {
    render(<Menu trigger={<button>Open</button>} items={items} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('menu')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders with icon in item', () => {
    const itemsWithIcon = [
      { label: 'Star', icon: <svg data-testid="star-icon" /> },
    ];
    render(<Menu trigger={<button>Open</button>} items={itemsWithIcon} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('star-icon')).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(<Menu trigger={<button>Open</button>} items={items} className="custom-menu" />);
    expect((container.firstChild as HTMLElement).className).toContain('custom-menu');
  });
});
