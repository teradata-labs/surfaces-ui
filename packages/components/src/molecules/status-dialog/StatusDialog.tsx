/**
 * StatusDialog — Covalent card modal with left status-color strip.
 *
 * Matches Figma node 13258:109.
 * Horizontal layout: left strip with status icon + right side (header / content / footer).
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

export type StatusDialogStatus = 'loading' | 'success' | 'error';

export interface StatusDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes (disabled during loading) */
  onOpenChange?: (open: boolean) => void;
  /** Current operation status */
  status: StatusDialogStatus;
  /** Dialog title */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button (e.g. retry for error) */
  action?: React.ReactNode;
  /** Optional expandable details (e.g. error code block) */
  details?: React.ReactNode;
  className?: string;
}

/* ── Status icons ─────────────────────────────────────────────────────── */

const Spinner = () => (
  <svg
    className="w-6 h-6 text-primary animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12" cy="12" r="10"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="31.4 31.4"
    />
  </svg>
);

const SuccessIcon = () => (
  <svg
    className="w-6 h-6 text-positive"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="8 12 11 15 16 9" />
  </svg>
);

const ErrorIcon = () => (
  <svg
    className="w-6 h-6 text-error"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
  </svg>
);

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

const statusIcons: Record<StatusDialogStatus, React.FC> = {
  loading: Spinner,
  success: SuccessIcon,
  error: ErrorIcon,
};

const statusStripStyles: Record<StatusDialogStatus, string> = {
  loading: 'bg-primary/8',
  success: 'bg-positive/8',
  error: 'bg-error/8',
};

const statusIconColors: Record<StatusDialogStatus, string> = {
  loading: 'text-primary',
  success: 'text-positive',
  error: 'text-error',
};

/* ── Component ───────────────────────────────────────────────────────── */

const StatusDialog: React.FC<StatusDialogProps> = ({
  open,
  onOpenChange,
  status,
  title,
  description,
  action,
  details,
  className,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const isLoading = status === 'loading';
  const StatusIcon = statusIcons[status];

  // Prevent closing while loading
  const handleOpenChange = (next: boolean) => {
    if (isLoading && !next) return;
    onOpenChange?.(next);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-9998 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-9999 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-md rounded-xl bg-surface overflow-hidden',
            // Elevation-5 shadow
            'shadow-[0px_8px_12px_6px_rgba(0,0,0,0.15),0px_4px_4px_0px_rgba(0,0,0,0.3)]',
            // Animations
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            className,
          )}
          onEscapeKeyDown={isLoading ? (e) => e.preventDefault() : undefined}
          onPointerDownOutside={isLoading ? (e) => e.preventDefault() : undefined}
          onInteractOutside={isLoading ? (e) => e.preventDefault() : undefined}
        >
          <div className="flex">
            {/* Left status strip */}
            <div
              className={cn(
                'flex flex-col items-center rounded-l-xl pt-3.5 px-4 self-stretch',
                statusStripStyles[status],
              )}
            >
              <div className={statusIconColors[status]}>
                <StatusIcon />
              </div>
            </div>

            {/* Right content */}
            <div className="flex-1 min-w-0">
              {/* Header row: title + close button */}
              <div className="flex items-center min-h-14 pl-4 py-1.5 pr-2">
                <DialogPrimitive.Title className="flex-1 text-xl font-medium text-on-surface leading-tight">
                  {title}
                </DialogPrimitive.Title>

                {!isLoading && (
                  <DialogPrimitive.Close
                    className={cn(
                      'shrink-0 flex items-center justify-center w-12 h-12 rounded-full',
                      'text-on-surface-variant hover:bg-on-surface/8 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </DialogPrimitive.Close>
                )}
              </div>

              {/* Content */}
              {(description || details) && (
                <div className="px-4 pb-2">
                  {description && (
                    <DialogPrimitive.Description className="text-sm text-on-surface-variant leading-5">
                      {description}
                    </DialogPrimitive.Description>
                  )}

                  {details && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {showDetails ? 'Hide details' : 'Show details'}
                      </button>
                      {showDetails && (
                        <div className="mt-2 text-xs text-on-surface-variant">
                          {details}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer with action */}
              {action && (
                <div className="flex justify-end p-4 pt-2">
                  {action}
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
StatusDialog.displayName = 'StatusDialog';

export { StatusDialog };
