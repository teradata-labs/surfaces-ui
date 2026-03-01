import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Switch } from './Switch';

expect.extend(toHaveNoViolations);

describe('Switch a11y', () => {
  it('has no axe violations (unchecked)', async () => {
    const { container } = render(<Switch aria-label="Toggle feature" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (checked)', async () => {
    const { container } = render(
      <Switch aria-label="Toggle feature" defaultChecked />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = render(
      <Switch aria-label="Toggle feature" disabled />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
