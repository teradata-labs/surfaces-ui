import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Snackbar } from './Snackbar';

expect.extend(toHaveNoViolations);

describe('Snackbar a11y', () => {
  it('has no axe violations (default)', async () => {
    const { container } = render(<Snackbar message="Saved successfully" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (with action and dismiss)', async () => {
    const { container } = render(
      <Snackbar
        message="Item deleted"
        actionLabel="Undo"
        onAction={() => {}}
        dismissible
        onDismiss={() => {}}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
