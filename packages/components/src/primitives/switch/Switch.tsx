import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  className?: string;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // Track
      'relative inline-flex w-[52px] h-[32px] shrink-0 cursor-pointer rounded-full',
      'items-center px-1 transition-colors',
      // Unchecked: on-surface-variant; Checked: primary
      'bg-on-surface-variant data-[state=checked]:bg-primary',
      // Disabled
      'disabled:opacity-60 disabled:cursor-not-allowed',
      // Focus ring
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'block w-[24px] h-[24px] rounded-full shadow transition-transform',
        // Unchecked: on-surface-variant tint; Checked: primary-foreground
        'bg-primary-foreground data-[state=unchecked]:bg-on-surface-variant',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export { Switch };
