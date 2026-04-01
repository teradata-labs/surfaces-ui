import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Menu } from './Menu';

expect.extend(toHaveNoViolations);

describe('Menu a11y', () => {
  const items = [
    { label: 'Edit' },
    { label: 'Delete', destructive: true },
  ];

  it('has no violations when closed', async () => {
    const { container } = render(<Menu trigger={<button>Actions</button>} items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when open', async () => {
    const { container } = render(<Menu trigger={<button>Actions</button>} items={items} />);
    fireEvent.click(screen.getByText('Actions'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
