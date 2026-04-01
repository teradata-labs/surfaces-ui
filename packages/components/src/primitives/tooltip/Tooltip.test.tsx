import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './Tooltip';

describe('Tooltip', () => {
  const renderTooltip = (content = 'Tooltip text') => {
    return render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Trigger</button>
          </TooltipTrigger>
          <TooltipContent>{content}</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
  };

  it('renders the trigger', () => {
    renderTooltip();
    expect(screen.getByText('Trigger')).toBeDefined();
  });

  it('does not show tooltip content initially', () => {
    renderTooltip();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByText('Trigger'));
    // Wait for tooltip to appear
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('shows tooltip on focus', async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab(); // Focus the trigger
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByRole('tooltip')).toBeDefined();
  });

  it('renders custom content', async () => {
    const user = userEvent.setup();
    renderTooltip('Custom tooltip message');

    await user.hover(screen.getByText('Trigger'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('Custom tooltip message');
  });
});
