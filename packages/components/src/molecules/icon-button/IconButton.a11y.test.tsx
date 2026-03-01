import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IconButton } from './IconButton';

expect.extend(toHaveNoViolations);

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

describe('IconButton a11y', () => {
  it('has no axe violations (standard)', async () => {
    const { container } = render(
      <IconButton aria-label="Add item">
        <PlusIcon />
      </IconButton>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (filled)', async () => {
    const { container } = render(
      <IconButton aria-label="Add item" variant="filled">
        <PlusIcon />
      </IconButton>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (disabled)', async () => {
    const { container } = render(
      <IconButton aria-label="Add item" disabled>
        <PlusIcon />
      </IconButton>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations (active)', async () => {
    const { container } = render(
      <IconButton aria-label="Add item" active>
        <PlusIcon />
      </IconButton>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
