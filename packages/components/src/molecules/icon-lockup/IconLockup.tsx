import * as React from 'react';
import { cn } from '../../lib/utils';

export type IconLockupLayout = 'horizontal' | 'vertical';

export interface IconLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon element (SVG or Icon component) */
  icon: React.ReactNode;
  /** Label text */
  label: string;
  /** Optional description */
  description?: string;
  /** Layout direction */
  layout?: IconLockupLayout;
  className?: string;
}

const IconLockup = React.forwardRef<HTMLDivElement, IconLockupProps>(
  ({ icon, label, description, layout = 'horizontal', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex gap-3',
        layout === 'horizontal' ? 'items-center' : 'flex-col items-center text-center',
        className
      )}
      {...props}
    >
      <span className="shrink-0 text-on-surface-variant">{icon}</span>
      <div className={cn(layout === 'vertical' && 'flex flex-col items-center')}>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-on-surface-variant">{description}</span>
        )}
      </div>
    </div>
  )
);
IconLockup.displayName = 'IconLockup';

export { IconLockup };
