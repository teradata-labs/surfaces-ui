import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FilterChip, InputChip } from './Chip';

expect.extend(toHaveNoViolations);

describe('FilterChip a11y', () => {
  it('has no axe violations (unselected)', async () => {
    const { container } = render(<FilterChip label="Analytics" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (selected)', async () => {
    const { container } = render(<FilterChip label="Analytics" selected />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('InputChip a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <InputChip label="TypeScript" onDismiss={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations without dismiss', async () => {
    const { container } = render(<InputChip label="TypeScript" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
