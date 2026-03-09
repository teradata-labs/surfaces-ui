import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Icon } from './Icon';

expect.extend(toHaveNoViolations);

describe('Icon a11y', () => {
  const svg = <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>;

  it('has no violations with label', async () => {
    const { container } = render(<Icon aria-label="Settings">{svg}</Icon>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with hidden decorative icon', async () => {
    const { container } = render(<Icon aria-hidden="true">{svg}</Icon>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
