import * as React from 'react';
import { cn } from '../../lib/utils';

export type ListItemLines = 'one' | 'two' | 'three';

export interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary text */
  primary: string;
  /** Secondary text (for two/three-line layouts) */
  secondary?: string;
  /** Tertiary text (for three-line layout) */
  tertiary?: string;
  /** Leading element (icon, avatar, checkbox) */
  leading?: React.ReactNode;
  /** Trailing element (icon, text, switch) */
  trailing?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Selected/active state */
  selected?: boolean;
  /** Click handler */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
}

const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(
  (
    { primary, secondary, tertiary, leading, trailing, disabled, selected, onClick, className, ...props },
    ref
  ) => {
    const interactive = !!onClick && !disabled;

    return (
      <div
        ref={ref}
        role={onClick ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>); } } : undefined}
        aria-disabled={disabled || undefined}
        aria-selected={selected || undefined}
        className={cn(
          'flex items-center gap-4 px-4 min-h-[48px]',
          secondary && !tertiary && 'min-h-[64px]',
          tertiary && 'min-h-[72px] items-start py-2',
          interactive && 'cursor-pointer hover:bg-on-surface/8 active:bg-on-surface/12',
          selected && 'bg-primary/8',
          disabled && 'opacity-38 pointer-events-none',
          className
        )}
        {...props}
      >
        {leading && <span className="shrink-0 text-on-surface-variant">{leading}</span>}
        <div className="flex-1 min-w-0 py-2">
          <p className="text-sm text-foreground truncate">{primary}</p>
          {secondary && <p className="text-xs text-on-surface-variant truncate">{secondary}</p>}
          {tertiary && <p className="text-xs text-on-surface-variant truncate">{tertiary}</p>}
        </div>
        {trailing && <span className="shrink-0 text-on-surface-variant">{trailing}</span>}
      </div>
    );
  }
);
ListItem.displayName = 'ListItem';

export { ListItem };
