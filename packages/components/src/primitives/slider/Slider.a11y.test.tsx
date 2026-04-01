import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Slider } from './Slider';

expect.extend(toHaveNoViolations);

describe('Slider a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Slider value={50} aria-label="Volume" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = render(<Slider value={50} disabled aria-label="Volume" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
