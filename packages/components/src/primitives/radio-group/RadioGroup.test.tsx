import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from './RadioGroup';

describe('RadioGroup', () => {
  function renderGroup(onValueChange?: (v: string) => void) {
    return render(
      <RadioGroup aria-label="Options" onValueChange={onValueChange}>
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
        <RadioGroupItem value="c" aria-label="Option C" />
      </RadioGroup>
    );
  }

  it('renders a radiogroup role', () => {
    renderGroup();
    expect(screen.getByRole('radiogroup')).toBeDefined();
  });

  it('renders radio items', () => {
    renderGroup();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('selects item on click and calls onValueChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup(onChange);
    await user.click(screen.getByLabelText('Option B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('marks selected item as checked', () => {
    render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
      </RadioGroup>
    );
    expect(screen.getByLabelText('Option A').getAttribute('data-state')).toBe('checked');
    expect(screen.getByLabelText('Option B').getAttribute('data-state')).toBe('unchecked');
  });

  it('accepts custom className on RadioGroup', () => {
    render(
      <RadioGroup aria-label="Options" className="my-group">
        <RadioGroupItem value="a" aria-label="A" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup').className).toContain('my-group');
  });

  it('supports keyboard navigation with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup aria-label="Options" onValueChange={onChange} defaultValue="a">
        <RadioGroupItem value="a" aria-label="Option A" />
        <RadioGroupItem value="b" aria-label="Option B" />
        <RadioGroupItem value="c" aria-label="Option C" />
      </RadioGroup>
    );

    const firstRadio = screen.getByLabelText('Option A');
    firstRadio.focus();

    // Arrow down navigates to next radio
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByLabelText('Option B'));

    // Arrow right also navigates forward
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByLabelText('Option C'));

    // Arrow up navigates backward
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByLabelText('Option B'));

    // Arrow left also navigates backward
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByLabelText('Option A'));
  });
});
