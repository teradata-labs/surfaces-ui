import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ActionRibbon } from './ActionRibbon';

expect.extend(toHaveNoViolations);

describe('ActionRibbon a11y', () => {
  it('has no axe violations (inactive)', async () => {
    const { container } = render(<ActionRibbon />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (positive)', async () => {
    const { container } = render(<ActionRibbon state="positive" label="Saved" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (checked with selection)', async () => {
    const { container } = render(
      <ActionRibbon
        state="checked"
        selectionCount={3}
        checked={true}
        onCheckedChange={() => {}}
        onClearSelection={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (loading)', async () => {
    const { container } = render(<ActionRibbon state="loading" label="Loading..." />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
