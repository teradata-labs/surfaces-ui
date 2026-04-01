import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SideSheet } from './SideSheet';

expect.extend(toHaveNoViolations);

describe('SideSheet a11y', () => {
  it('has no violations when open', async () => {
    const { container } = render(
      <SideSheet open title="Details" description="View item info">
        <p>Content</p>
      </SideSheet>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with footer', async () => {
    const { container } = render(
      <SideSheet open title="Filters" footer={<button>Apply</button>}>
        <p>Filter options</p>
      </SideSheet>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
