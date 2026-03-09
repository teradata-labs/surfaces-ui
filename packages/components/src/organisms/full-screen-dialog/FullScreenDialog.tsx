import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface FullScreenDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title shown in the top bar */
  title: string;
  /** Optional action button (e.g. Save) in top-right */
  action?: React.ReactNode;
  /** Scrollable body content */
  children?: React.ReactNode;
  className?: string;
}

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

/* ── Component ───────────────────────────────────────────────────────── */

const FullScreenDialog: React.FC<FullScreenDialogProps> = ({
  open,
  onOpenChange,
  title,
  action,
  children,
  className,
}) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-0 z-9999 bg-background flex flex-col',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200',
          className
        )}
      >
        {/* Top app bar */}
        <header className="flex items-center h-14 px-4 border-b border-su-outline-variant shrink-0">
          <DialogPrimitive.Close
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <CloseIcon />
          </DialogPrimitive.Close>

          <DialogPrimitive.Title className="flex-1 text-lg font-semibold text-foreground text-center truncate mx-4">
            {title}
          </DialogPrimitive.Title>

          {action ? (
            <div className="shrink-0">{action}</div>
          ) : (
            /* Spacer to keep title centered */
            <div className="w-8" />
          )}
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {children}
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
FullScreenDialog.displayName = 'FullScreenDialog';

export { FullScreenDialog };
