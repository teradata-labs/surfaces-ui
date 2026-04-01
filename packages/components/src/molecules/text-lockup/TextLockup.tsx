import * as React from 'react';
import { cn } from '../../lib/utils';

export type TextLockupSize = 'sm' | 'md' | 'lg';

export interface TextLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary title text */
  title: string;
  /** Subtitle / supporting text */
  subtitle?: string;
  /** Size preset */
  size?: TextLockupSize;
  /** Alignment */
  align?: 'left' | 'center';
  className?: string;
}

const titleStyles: Record<TextLockupSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-lg font-bold',
};

const subtitleStyles: Record<TextLockupSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

const TextLockup = React.forwardRef<HTMLDivElement, TextLockupProps>(
  ({ title, subtitle, size = 'md', align = 'left', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col',
        align === 'center' && 'items-center text-center',
        className
      )}
      {...props}
    >
      <span className={cn('text-foreground', titleStyles[size])}>{title}</span>
      {subtitle && (
        <span className={cn('text-on-surface-variant', subtitleStyles[size])}>{subtitle}</span>
      )}
    </div>
  )
);
TextLockup.displayName = 'TextLockup';

export { TextLockup };
