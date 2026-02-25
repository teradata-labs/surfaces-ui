import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('selects item on click and calls onValueChange', () => {
    const onChange = vi.fn();
    renderGroup(onChange);
    fireEvent.click(screen.getByLabelText('Option B'));
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
});
