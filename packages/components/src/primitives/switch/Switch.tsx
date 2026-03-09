/**
 * Switch — Covalent compact switch.
 *
 * Matches Figma node 7088:40480.
 * 36×20px overall with a 14px-tall translucent track
 * and a 20px elevated knob that slides 16px.
 */

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
      // Outer container — 36×20, holds both track and knob
      'group relative inline-flex w-9 h-5 shrink-0 cursor-pointer rounded-full',
      // Disabled
      'disabled:opacity-50 disabled:cursor-not-allowed',
      // Focus ring
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  >
    {/* Visual track — 14px tall, centered within the 20px container (3px inset) */}
    <span
      className={cn(
        'absolute inset-x-0 top-[3px] h-3.5 rounded-full transition-colors pointer-events-none',
        // Unchecked: on-surface at 20% opacity
        'bg-on-surface/20',
        // Checked: primary at 20% opacity
        'group-data-[state=checked]:bg-primary/20',
        // Disabled: on-surface at 8%
        'group-data-[disabled]:bg-on-surface/8',
      )}
    />
    {/* Knob — 20×20, full height, elevated */}
    <SwitchPrimitive.Thumb
      className={cn(
        'block w-5 h-5 rounded-full transition-transform',
        // Elevation-3 shadow
        'shadow-[0px_4px_8px_3px_rgba(0,0,0,0.15),0px_1px_3px_0px_rgba(0,0,0,0.3)]',
        // Unchecked: background color; Checked: primary
        'bg-background data-[state=checked]:bg-primary',
        // Slide 16px (36 − 20)
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export { Switch };
