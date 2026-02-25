import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Checkbox } from './Checkbox';

expect.extend(toHaveNoViolations);

describe('Checkbox a11y', () => {
  it('has no axe violations (unchecked)', async () => {
    const { container } = render(<Checkbox aria-label="Accept terms" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (checked)', async () => {
    const { container } = render(
      <Checkbox aria-label="Accept terms" defaultChecked />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (indeterminate)', async () => {
    const { container } = render(
      <Checkbox aria-label="Accept terms" checked="indeterminate" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = render(
      <Checkbox aria-label="Accept terms" disabled />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
