import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Alert } from './Alert';

expect.extend(toHaveNoViolations);

describe('Alert a11y', () => {
  it('has no violations with basic alert', async () => {
    const { container } = render(
      <Alert title="Alert title" description="Alert description" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with dismiss button', async () => {
    const { container } = render(
      <Alert title="Dismissible" description="Can be dismissed." onDismiss={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations for each variant', async () => {
    for (const variant of ['negative', 'caution', 'positive', 'secondary', 'loading', 'default'] as const) {
      const { container } = render(
        <Alert title={`${variant} alert`} variant={variant} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    }
  });

  it('has no violations in inline mode', async () => {
    const { container } = render(
      <Alert title="Inline alert" mode="inline" variant="negative" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with action slot', async () => {
    const { container } = render(
      <Alert
        title="Error"
        action={<button>Retry</button>}
        onDismiss={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
