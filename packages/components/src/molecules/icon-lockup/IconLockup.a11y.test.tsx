import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IconLockup } from './IconLockup';

expect.extend(toHaveNoViolations);

const icon = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>;

describe('IconLockup a11y', () => {
  it('has no violations', async () => {
    const { container } = render(<IconLockup icon={icon} label="Feature" description="Description text" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
