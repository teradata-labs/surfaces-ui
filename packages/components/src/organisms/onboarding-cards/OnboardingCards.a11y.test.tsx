import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { OnboardingCards } from './OnboardingCards';

expect.extend(toHaveNoViolations);

describe('OnboardingCards a11y', () => {
  it('has no violations with incomplete cards', async () => {
    const { container } = render(
      <OnboardingCards
        cards={[
          { id: 'setup', title: 'Setup', description: 'Configure your account.', ctaLabel: 'Start' },
          { id: 'connect', title: 'Connect', description: 'Connect your data.', ctaLabel: 'Go' },
        ]}
        onSkipAll={() => {}}
        onToggleCollapse={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when completed', async () => {
    const { container } = render(
      <OnboardingCards
        cards={[
          { id: 'setup', title: 'Setup', description: 'Done.', state: 'complete' },
          { id: 'connect', title: 'Connect', description: 'Done.', state: 'complete' },
        ]}
        completed
        onDismiss={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
