import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const iconButtonVariants = cva(
  [
    'rounded-full flex items-center justify-center transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        standard:
          'text-on-surface-variant hover:bg-(--on-surface-8-raw)',
        filled:
          'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
        tonal:
          'bg-surface-container text-on-surface-variant hover:bg-(--on-surface-8-raw)',
        outlined:
          'border border-su-outline text-on-surface-variant hover:bg-(--on-surface-8-raw)',
      },
      size: {
        sm: 'w-8 h-8',
        default: 'w-10 h-10',
        lg: 'w-12 h-12',
      },
    },
    defaultVariants: {
      variant: 'standard',
      size: 'default',
    },
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Selected/active state — overrides bg to secondary-container */
  active?: boolean;
  /** Required for accessibility */
  'aria-label': string;
  className?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, active, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        iconButtonVariants({ variant, size }),
        active && 'bg-secondary-container text-secondary-container-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
