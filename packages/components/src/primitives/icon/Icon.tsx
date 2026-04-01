import * as React from 'react';
import { cn } from '../../lib/utils';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeStyles: Record<IconSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon size preset */
  size?: IconSize;
  /** Apply a semantic color */
  color?: 'default' | 'primary' | 'muted' | 'success' | 'warning' | 'error';
  /** Icon content (SVG element or icon component) */
  children: React.ReactNode;
  className?: string;
}

const colorStyles: Record<NonNullable<IconProps['color']>, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  muted: 'text-on-surface-variant',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
  ({ size = 'md', color = 'default', children, className, ...props }, ref) => (
    <span
      ref={ref}
      role="img"
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        sizeStyles[size],
        colorStyles[color],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
);
Icon.displayName = 'Icon';

export { Icon };
