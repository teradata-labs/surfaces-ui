/**
 * Alert — Covalent alert with full-page and inline modes.
 *
 * Matches Figma node 12084:18137.
 *
 * Full-page: solid-colored background (negative, caution, positive, secondary).
 * Inline: tinted container background with border.
 *
 * Layout: icon (24px) | text (title + description) | action slot | dismiss icon.
 * Min height 64px, rounded-xl (12px).
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* ── Status icons ─────────────────────────────────────────────────────── */

const NegativeIcon = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
  </svg>
);

const CautionIcon = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
  </svg>
);

const PositiveIcon = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="8 12 11 15 16 9" />
  </svg>
);

const SecondaryIcon = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="w-6 h-6 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
  </svg>
);

/* ── Variants ─────────────────────────────────────────────────────────── */

const alertVariants = cva(
  // Base: full-width, rounded, horizontal layout with icon area
  'relative w-full rounded-xl overflow-hidden min-h-16 flex items-start pl-6 pr-4',
  {
    variants: {
      variant: {
        // Full-page solid backgrounds
        negative: 'bg-negative text-on-negative',
        caution: 'bg-caution text-on-caution',
        positive: 'bg-positive text-on-positive',
        secondary: 'bg-secondary text-secondary-foreground',
        loading: 'bg-primary text-primary-foreground',
        default: 'bg-surface-container text-on-surface',
      },
      mode: {
        'full-page': '',
        inline: '',
      },
    },
    compoundVariants: [
      // Inline mode: tinted container bg instead of solid
      { mode: 'inline', variant: 'negative', className: 'bg-negative-container text-on-negative-container' },
      { mode: 'inline', variant: 'caution', className: 'bg-caution-container text-on-caution-container' },
      { mode: 'inline', variant: 'positive', className: 'bg-positive-container text-on-positive-container' },
      { mode: 'inline', variant: 'secondary', className: 'bg-secondary-container text-secondary-container-foreground' },
      { mode: 'inline', variant: 'loading', className: 'bg-primary/8 text-on-surface' },
      { mode: 'inline', variant: 'default', className: 'bg-surface-container-highest text-on-surface' },
    ],
    defaultVariants: {
      variant: 'default',
      mode: 'full-page',
    },
  },
);

export type AlertVariant = 'negative' | 'caution' | 'positive' | 'secondary' | 'loading' | 'default';
export type AlertMode = 'full-page' | 'inline';

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  /** Alert title text */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** When provided, renders a dismiss (×) button and calls this handler. */
  onDismiss?: () => void;
  /** Optional action slot (e.g. a Button) rendered on the right */
  action?: React.ReactNode;
  /** Display mode — full-page (solid bg) or inline (tinted container bg) */
  mode?: AlertMode;
}

const iconMap: Record<AlertVariant, React.FC> = {
  negative: NegativeIcon,
  caution: CautionIcon,
  positive: PositiveIcon,
  secondary: SecondaryIcon,
  loading: LoadingIcon,
  default: SecondaryIcon,
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', mode = 'full-page', title, description, onDismiss, action, ...props }, ref) => {
    const Icon = iconMap[variant ?? 'default'];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant, mode }), className)}
        {...props}
      >
        {/* Icon */}
        <div className="flex items-start pt-5 pr-6 shrink-0">
          <Icon />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-2.5 self-stretch">
          <p className="text-base leading-6 font-normal">{title}</p>
          {description && (
            <p className="text-sm leading-5 opacity-80">{description}</p>
          )}
        </div>

        {/* Action items (label button + dismiss icon) */}
        <div className="flex items-center h-16 shrink-0">
          {action && <div className="mr-1">{action}</div>}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss alert"
              className="flex items-center justify-center w-12 h-12 rounded-full opacity-70 transition-opacity hover:opacity-100"
            >
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
            </button>
          )}
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

/* ── Backward-compatible sub-components ───────────────────────────────── */

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 leading-none font-medium tracking-tight', className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
