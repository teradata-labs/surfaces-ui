import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface SideSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Which edge the sheet slides from */
  side?: 'left' | 'right';
  /** Sheet title (required for accessibility) */
  title: string;
  /** Optional subtitle */
  description?: string;
  /** Custom width. Default: '380px' */
  width?: string | number;
  /** Sheet body content */
  children?: React.ReactNode;
  /** Optional footer content (e.g. action buttons) */
  footer?: React.ReactNode;
  className?: string;
}

/* ── Sub-components ───────────────────────────────────────────────────── */

export interface SideSheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const SideSheetHeader: React.FC<SideSheetHeaderProps> = ({ className, ...props }) => (
  <div
    className={cn(
      'flex items-center justify-between px-6 py-4 border-b border-su-outline-variant',
      className
    )}
    {...props}
  />
);
SideSheetHeader.displayName = 'SideSheetHeader';

export interface SideSheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const SideSheetContent: React.FC<SideSheetContentProps> = ({ className, ...props }) => (
  <div
    className={cn('flex-1 overflow-y-auto px-6 py-4', className)}
    {...props}
  />
);
SideSheetContent.displayName = 'SideSheetContent';

export interface SideSheetFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const SideSheetFooter: React.FC<SideSheetFooterProps> = ({ className, ...props }) => (
  <div
    className={cn(
      'flex items-center justify-end gap-2 px-6 py-4 border-t border-su-outline-variant',
      className
    )}
    {...props}
  />
);
SideSheetFooter.displayName = 'SideSheetFooter';

/* ── Close icon ───────────────────────────────────────────────────────── */

const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Main component ───────────────────────────────────────────────────── */

const SideSheet: React.FC<SideSheetProps> = ({
  open,
  onOpenChange,
  side = 'right',
  title,
  description,
  width = '380px',
  children,
  footer,
  className,
}) => {
  const isLeft = side === 'left';
  const widthValue = typeof width === 'number' ? `${width}px` : width;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-9998 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-0 z-9999 h-full bg-background border shadow-lg',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:duration-300 data-[state=closed]:duration-200',
            isLeft
              ? 'left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
              : 'right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            className
          )}
          style={{ width: widthValue, maxWidth: '100vw' }}
        >
          {/* Header */}
          <SideSheetHeader>
            <div className="flex flex-col gap-0.5 min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground truncate">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground truncate">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="rounded-full p-1 text-on-surface-variant hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <CloseIcon />
            </DialogPrimitive.Close>
          </SideSheetHeader>

          {/* Body */}
          <SideSheetContent>{children}</SideSheetContent>

          {/* Footer */}
          {footer && <SideSheetFooter>{footer}</SideSheetFooter>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
SideSheet.displayName = 'SideSheet';

export { SideSheet, SideSheetHeader, SideSheetContent, SideSheetFooter };
