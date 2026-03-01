import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EmptyState } from './EmptyState';

expect.extend(toHaveNoViolations);

describe('EmptyState a11y', () => {
  it('has no axe violations (minimal)', async () => {
    const { container } = render(<EmptyState title="No data found" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (with all props)', async () => {
    const { container } = render(
      <EmptyState
        title="No data found"
        description="Try adjusting your filters."
        action={{ label: 'Create New', onClick: () => {} }}
        icon={<svg aria-hidden="true" className="w-8 h-8" />}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
