import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Progress } from './Progress';

expect.extend(toHaveNoViolations);

describe('Progress a11y', () => {
  it('has no axe violations (determinate)', async () => {
    const { container } = render(<Progress value={50} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (indeterminate)', async () => {
    const { container } = render(<Progress />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations at 0%', async () => {
    const { container } = render(<Progress value={0} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations at 100%', async () => {
    const { container } = render(<Progress value={100} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
