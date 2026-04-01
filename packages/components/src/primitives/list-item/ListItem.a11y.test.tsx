import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ListItem } from './ListItem';

expect.extend(toHaveNoViolations);

describe('ListItem a11y', () => {
  it('has no violations for static item', async () => {
    const { container } = render(<ListItem primary="Static item" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations for interactive item', async () => {
    const { container } = render(<ListItem primary="Click me" onClick={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
