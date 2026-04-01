import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NotebookCell } from './NotebookCell';

expect.extend(toHaveNoViolations);

describe('NotebookCell a11y', () => {
  it('has no violations for code cell', async () => {
    const { container } = render(
      <NotebookCell
        type="code"
        value="SELECT * FROM users;"
        executionCount={1}
        status="success"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations for markdown cell with error', async () => {
    const { container } = render(
      <NotebookCell
        type="markdown"
        value="# Report"
        error={{ title: 'Render failed', description: 'Invalid syntax on line 3' }}
        renderedOutput={<p>Partial output</p>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when selected', async () => {
    const { container } = render(
      <NotebookCell
        type="code"
        value="print('hello')"
        selected
        onValueChange={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
