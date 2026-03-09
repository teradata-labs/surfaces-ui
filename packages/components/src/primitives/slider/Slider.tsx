import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps {
  /** Current value */
  value?: number;
  /** Default value (uncontrolled) */
  defaultValue?: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Change handler */
  onValueChange?: (value: number) => void;
  /** Change committed (on mouse up / touch end) */
  onValueCommit?: (value: number) => void;
  /** Accessible label */
  'aria-label'?: string;
  className?: string;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value: controlledValue,
      defaultValue = 0,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      onValueCommit,
      'aria-label': ariaLabel,
      className,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const value = controlledValue ?? internalValue;
    const percent = ((value - min) / (max - min)) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setInternalValue(v);
      onValueChange?.(v);
    };

    const handleCommit = () => {
      onValueCommit?.(value);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex items-center w-full h-10 touch-none select-none',
          disabled && 'opacity-38 pointer-events-none',
          className
        )}
      >
        {/* Track background */}
        <div className="absolute h-1 w-full rounded-full bg-primary/20" />
        {/* Active track */}
        <div
          className="absolute h-1 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
        {/* Native range input (invisible but accessible) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />
        {/* Thumb */}
        <div
          className="absolute h-5 w-5 rounded-full bg-primary shadow-md border-2 border-primary-foreground pointer-events-none"
          style={{ left: `calc(${percent}% - 10px)` }}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
