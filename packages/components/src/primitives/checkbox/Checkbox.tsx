import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '../../lib/utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Custom icon to display when checked (replaces default checkmark) */
  icon?: React.ReactNode;
  /** Custom icon to display when indeterminate (replaces default dash) */
  indeterminateIcon?: React.ReactNode;
  className?: string;
}

const defaultCheck = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const defaultDash = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <line x1="2" y1="6" x2="10" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, icon, indeterminateIcon, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'w-[18px] h-[18px] shrink-0 rounded border-2 transition-colors',
      'border-on-surface-variant bg-transparent',
      // Checked / indeterminate: primary fill
      'data-[state=checked]:bg-primary data-[state=checked]:border-primary',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary',
      // Disabled
      'disabled:opacity-40 disabled:cursor-not-allowed',
      // Focus
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Flex center for the indicator
      'flex items-center justify-center',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary-foreground">
      {props.checked === 'indeterminate'
        ? (indeterminateIcon || defaultDash)
        : (icon || defaultCheck)}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
