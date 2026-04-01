import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StatusDialog } from './StatusDialog';

expect.extend(toHaveNoViolations);

describe('StatusDialog a11y', () => {
  it('has no violations in success state', async () => {
    const { container } = render(
      <StatusDialog open status="success" title="Operation Complete" description="Your data was saved." />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations in error state with action', async () => {
    const { container } = render(
      <StatusDialog
        open
        status="error"
        title="Error"
        description="Something went wrong."
        action={<button>Retry</button>}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
