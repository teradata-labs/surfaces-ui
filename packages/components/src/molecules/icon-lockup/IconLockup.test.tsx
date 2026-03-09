import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconLockup } from './IconLockup';

const icon = <svg data-testid="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;

describe('IconLockup', () => {
  it('renders icon and label', () => {
    render(<IconLockup icon={icon} label="Settings" />);
    expect(screen.getByTestId('icon')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders description', () => {
    render(<IconLockup icon={icon} label="Title" description="Details here" />);
    expect(screen.getByText('Details here')).toBeDefined();
  });

  it('renders horizontal layout by default', () => {
    const { container } = render(<IconLockup icon={icon} label="Horizontal" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('items-center');
    expect(el.className).not.toContain('flex-col');
  });

  it('renders vertical layout', () => {
    const { container } = render(<IconLockup icon={icon} label="Vertical" layout="vertical" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex-col');
  });

  it('accepts custom className', () => {
    const { container } = render(<IconLockup icon={icon} label="Custom" className="my-lockup" />);
    expect((container.firstChild as HTMLElement).className).toContain('my-lockup');
  });
});
