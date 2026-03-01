import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormField } from './FormField';
import { Input } from '../../primitives/input';

expect.extend(toHaveNoViolations);

describe('FormField a11y', () => {
  it('has no axe violations (default)', async () => {
    const { container } = render(
      <FormField label="Email address" htmlFor="email">
        <Input id="email" type="email" placeholder="name@example.com" />
      </FormField>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with error', async () => {
    const { container } = render(
      <FormField label="Email address" error="Invalid email." htmlFor="email-err">
        <Input id="email-err" type="email" aria-invalid="true" />
      </FormField>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with helper text', async () => {
    const { container } = render(
      <FormField
        label="Password"
        helperText="Must be at least 8 characters."
        htmlFor="pw"
      >
        <Input id="pw" type="password" />
      </FormField>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
