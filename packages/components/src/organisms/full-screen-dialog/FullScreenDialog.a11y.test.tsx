import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FullScreenDialog } from './FullScreenDialog';

expect.extend(toHaveNoViolations);

describe('FullScreenDialog a11y', () => {
  it('has no violations when open', async () => {
    const { container } = render(
      <FullScreenDialog open title="Settings">
        <p>Settings content</p>
      </FullScreenDialog>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
