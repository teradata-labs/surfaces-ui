import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Toolbar, ToolbarSeparator } from './Toolbar';

expect.extend(toHaveNoViolations);

describe('Toolbar a11y', () => {
  it('has no violations', async () => {
    const { container } = render(
      <Toolbar aria-label="Text formatting">
        <button>Bold</button>
        <button>Italic</button>
        <ToolbarSeparator />
        <button>Undo</button>
      </Toolbar>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
