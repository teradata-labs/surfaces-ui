/**
 * Collapsible - Simple collapsible section component
 */

import * as React from 'react';
import { cn } from '../lib/utils';

export interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({
  open = true,
  onOpenChange,
  children,
  className
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(open);

  React.useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleToggle = React.useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  }, [isOpen, onOpenChange]);

  return (
    <div className={cn('collapsible', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === CollapsibleTrigger) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onClick: handleToggle,
              'aria-expanded': isOpen,
            });
          }
          if (child.type === CollapsibleContent) {
            return React.cloneElement(child as React.ReactElement<any>, {
              open: isOpen,
            });
          }
        }
        return child;
      })}
    </div>
  );
}

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function CollapsibleTrigger({
  children,
  className,
  ...props
}: CollapsibleTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between',
        'text-sm font-medium',
        'hover:opacity-80 transition-opacity',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface CollapsibleContentProps {
  children: React.ReactNode;
  open?: boolean;
  className?: string;
}

export function CollapsibleContent({
  children,
  open = true,
  className
}: CollapsibleContentProps) {
  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200',
        open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}
