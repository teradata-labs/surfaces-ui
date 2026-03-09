import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TextLockup } from './TextLockup';

expect.extend(toHaveNoViolations);

describe('TextLockup a11y', () => {
  it('has no violations', async () => {
    const { container } = render(<TextLockup title="Card Title" subtitle="Supporting description" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
