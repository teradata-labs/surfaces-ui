import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './Tooltip';

expect.extend(toHaveNoViolations);

describe('Tooltip a11y', () => {
  it('has no violations with closed tooltip', async () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with open tooltip', async () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <button>Hover me</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
