import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CircularProgress } from './CircularProgress';

expect.extend(toHaveNoViolations);

describe('CircularProgress a11y', () => {
  it('has no axe violations at 0%', async () => {
    const { container } = render(<CircularProgress value={0} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations at 50%', async () => {
    const { container } = render(<CircularProgress value={50} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations at 100%', async () => {
    const { container } = render(<CircularProgress value={100} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations without label', async () => {
    const { container } = render(<CircularProgress value={75} showLabel={false} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
