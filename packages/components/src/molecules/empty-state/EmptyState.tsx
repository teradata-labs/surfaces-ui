import * as React from 'react';
import { Button } from '../../primitives/button';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  /** Optional icon element displayed in the icon circle */
  icon?: React.ReactNode;
  /** Primary heading text */
  title: string;
  /** Optional supporting description */
  description?: string;
  /** Optional call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center py-12 gap-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          {icon}
        </div>
      )}
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-on-surface-variant mt-1 max-w-xs">{description}</p>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
