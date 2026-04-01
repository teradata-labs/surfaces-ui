import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Toolbar content (IconButtons, Buttons, Separators) */
  children: React.ReactNode;
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ children, orientation = 'horizontal', className, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      aria-orientation={orientation}
      className={cn(
        'flex items-center gap-1 p-1',
        orientation === 'vertical' && 'flex-col',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Toolbar.displayName = 'Toolbar';

export interface ToolbarSeparatorProps {
  className?: string;
}

function ToolbarSeparator({ className }: ToolbarSeparatorProps) {
  return (
    <div
      role="separator"
      className={cn('bg-su-outline-variant self-stretch', 'w-px min-h-[24px] mx-1', className)}
    />
  );
}
ToolbarSeparator.displayName = 'ToolbarSeparator';

export { Toolbar, ToolbarSeparator };
