import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CodeSnippet } from './CodeSnippet';

expect.extend(toHaveNoViolations);

describe('CodeSnippet a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <CodeSnippet code="SELECT * FROM users;" language="SQL" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with line numbers', async () => {
    const { container } = render(
      <CodeSnippet code={'line1\nline2'} showLineNumbers filename="test.ts" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
