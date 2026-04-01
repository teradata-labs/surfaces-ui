import * as React from 'react';
import { cn } from '../../lib/utils';

export type TypographyVariant =
  | 'headline-lg'
  | 'headline-md'
  | 'headline-sm'
  | 'title-lg'
  | 'title-md'
  | 'title-sm'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'caption'
  | 'overline';

const variantStyles: Record<TypographyVariant, string> = {
  'headline-lg': 'text-3xl font-bold tracking-tight',
  'headline-md': 'text-2xl font-bold tracking-tight',
  'headline-sm': 'text-xl font-bold',
  'title-lg': 'text-lg font-semibold',
  'title-md': 'text-base font-semibold',
  'title-sm': 'text-sm font-semibold',
  'body-lg': 'text-base',
  'body-md': 'text-sm',
  'body-sm': 'text-xs',
  caption: 'text-xs text-on-surface-variant',
  overline: 'text-[0.625rem] font-medium uppercase tracking-widest text-on-surface-variant',
};

const defaultElements: Record<TypographyVariant, keyof React.JSX.IntrinsicElements> = {
  'headline-lg': 'h1',
  'headline-md': 'h2',
  'headline-sm': 'h3',
  'title-lg': 'h4',
  'title-md': 'h5',
  'title-sm': 'h6',
  'body-lg': 'p',
  'body-md': 'p',
  'body-sm': 'p',
  caption: 'span',
  overline: 'span',
};

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  /** Typography variant preset */
  variant?: TypographyVariant;
  /** Override the default HTML element */
  as?: keyof React.JSX.IntrinsicElements;
  /** Apply muted color */
  muted?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ variant = 'body-md', as, muted, className, children, ...props }, ref) => {
    const Component = (as || defaultElements[variant] || 'p') as React.ElementType;

    return (
      <Component
        ref={ref}
        className={cn(
          variantStyles[variant],
          muted && 'text-on-surface-variant',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Typography.displayName = 'Typography';

export { Typography };
