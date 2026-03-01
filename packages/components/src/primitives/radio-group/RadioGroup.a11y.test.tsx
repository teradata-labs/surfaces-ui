import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RadioGroup, RadioGroupItem } from './RadioGroup';

expect.extend(toHaveNoViolations);

describe('RadioGroup a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <RadioGroup aria-label="Choose an option">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
        <RadioGroupItem value="c" aria-label="Option C" />
      </RadioGroup>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a default value', async () => {
    const { container } = render(
      <RadioGroup aria-label="Choose an option" defaultValue="b">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
