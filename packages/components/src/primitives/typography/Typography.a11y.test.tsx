import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Typography } from './Typography';

expect.extend(toHaveNoViolations);

describe('Typography a11y', () => {
  it('has no violations with headline', async () => {
    const { container } = render(<Typography variant="headline-lg">Page Title</Typography>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with body text', async () => {
    const { container } = render(<Typography variant="body-md">Body content</Typography>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
