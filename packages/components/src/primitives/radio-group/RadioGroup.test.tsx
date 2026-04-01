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

describe('RadioGroupItem custom icon', () => {
  it('renders custom icon when selected', () => {
    render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioGroupItem
          value="a"
          aria-label="Option A"
          icon={<span data-testid="custom-radio-icon">✓</span>}
        />
      </RadioGroup>
    );
    expect(screen.getByTestId('custom-radio-icon')).toBeDefined();
  });

  it('renders default filled circle when no custom icon and selected', () => {
    const { container } = render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioGroupItem value="a" aria-label="Option A" />
      </RadioGroup>
    );
    // Default indicator is a div with w-3 h-3 rounded-full bg-primary
    const indicator = container.querySelector('.bg-primary.rounded-full');
    expect(indicator).not.toBeNull();
  });

  it('does not render icon when not selected', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioGroupItem
          value="a"
          aria-label="Option A"
          icon={<span data-testid="custom-radio-icon">✓</span>}
        />
      </RadioGroup>
    );
    expect(screen.queryByTestId('custom-radio-icon')).toBeNull();
  });
});
