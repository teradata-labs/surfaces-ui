import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';

describe('Slider', () => {
  it('renders a range input', () => {
    render(<Slider aria-label="Volume" />);
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('renders with default value', () => {
    render(<Slider defaultValue={50} aria-label="Volume" />);
    expect(screen.getByRole('slider').getAttribute('value')).toBe('50');
  });

  it('renders with controlled value', () => {
    render(<Slider value={75} aria-label="Volume" />);
    expect(screen.getByRole('slider').getAttribute('value')).toBe('75');
  });

  it('calls onValueChange on input', () => {
    const onChange = vi.fn();
    render(<Slider defaultValue={50} onValueChange={onChange} aria-label="Volume" />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('respects min and max', () => {
    render(<Slider min={10} max={200} aria-label="Brightness" />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('min')).toBe('10');
    expect(slider.getAttribute('max')).toBe('200');
  });

  it('respects step', () => {
    render(<Slider step={5} aria-label="Volume" />);
    expect(screen.getByRole('slider').getAttribute('step')).toBe('5');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Slider disabled aria-label="Volume" />);
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('sets aria attributes', () => {
    render(<Slider value={30} min={0} max={100} aria-label="Opacity" />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('30');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
  });

  it('accepts custom className', () => {
    const { container } = render(<Slider className="custom-slider" aria-label="Test" />);
    expect((container.firstChild as HTMLElement)?.className).toContain('custom-slider');
  });
});
