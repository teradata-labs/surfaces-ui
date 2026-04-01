import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FocusedPage } from './FocusedPage';

expect.extend(toHaveNoViolations);

describe('FocusedPage a11y', () => {
  it('has no violations', async () => {
    const { container } = render(
      <FocusedPage
        title="Account Settings"
        subtitle="Manage your account"
        onBack={() => {}}
        breadcrumbs={[{ label: 'Home' }, { label: 'Settings' }]}
      >
        <p>Content</p>
      </FocusedPage>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
