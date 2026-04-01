import * as React from 'react';
import { cn } from '../../lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface FocusedPageProps {
  /** Page title */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Back navigation callback — shows back arrow when provided */
  onBack?: () => void;
  /** Breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Max width of the centered content area. Default: '768px' */
  maxWidth?: string | number;
  /** Optional actions rendered in the header right area */
  headerActions?: React.ReactNode;
  /** Page body content */
  children?: React.ReactNode;
  className?: string;
}

/* ── Icons ────────────────────────────────────────────────────────────── */

const BackArrow = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ChevronRight = () => (
  <svg
    className="w-3.5 h-3.5 text-on-surface-variant"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ── Component ───────────────────────────────────────────────────────── */

const FocusedPage = React.forwardRef<HTMLDivElement, FocusedPageProps>(
  (
    {
      title,
      subtitle,
      onBack,
      breadcrumbs,
      maxWidth = '768px',
      headerActions,
      children,
      className,
    },
    ref
  ) => {
    const maxW = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;

    return (
      <div ref={ref} className={cn('min-h-full flex flex-col', className)}>
        {/* Header */}
        <header className="border-b border-su-outline-variant bg-background px-6 py-4">
          <div className="mx-auto" style={{ maxWidth: maxW }}>
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-2">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight />}
                    {crumb.onClick ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        className="text-xs text-on-surface-variant hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="text-xs text-on-surface-variant">{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}

            {/* Title row */}
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Go back"
                >
                  <BackArrow />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
              {headerActions && <div className="shrink-0 flex items-center gap-2">{headerActions}</div>}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto" style={{ maxWidth: maxW }}>
            {children}
          </div>
        </main>
      </div>
    );
  }
);
FocusedPage.displayName = 'FocusedPage';

export { FocusedPage };
