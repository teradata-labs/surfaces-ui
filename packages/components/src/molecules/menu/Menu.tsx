import * as React from 'react';
import { cn } from '../../lib/utils';

export interface MenuItemProps {
  /** Item label */
  label: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Destructive style */
  destructive?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface MenuProps {
  /** Menu trigger element */
  trigger: React.ReactNode;
  /** Menu items */
  items: MenuItemProps[];
  /** Alignment relative to trigger */
  align?: 'start' | 'end';
  className?: string;
}

function Menu({ trigger, items, align = 'start', className }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={menuRef} className={cn('relative inline-block', className)}>
      <div>
        {React.isValidElement(trigger)
          ? React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
              'aria-haspopup': 'menu',
              'aria-expanded': open,
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                setOpen(v => !v);
              },
            })
          : trigger}
      </div>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] py-1',
            'bg-surface-container rounded-lg shadow-lg',
            'border border-su-outline-variant',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-3 w-full px-4 py-2 text-sm text-left',
                'hover:bg-on-surface/8 active:bg-on-surface/12',
                'disabled:opacity-38 disabled:pointer-events-none',
                item.destructive ? 'text-destructive' : 'text-foreground'
              )}
            >
              {item.icon && <span className="shrink-0 w-5 h-5">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
Menu.displayName = 'Menu';

export { Menu };
