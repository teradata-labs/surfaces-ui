import * as React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../primitives/button';
import { IconButton } from '../../molecules/icon-button';

/* ── Types ────────────────────────────────────────────────────────────── */

export type OnboardingCardState = 'incomplete' | 'complete' | 'unavailable';

export interface OnboardingCard {
  /** Unique key for the card */
  id: string;
  /** Card heading */
  title: string;
  /** Card description */
  description: string;
  /** Card state */
  state?: OnboardingCardState;
  /** Icon rendered to the left of card text */
  icon?: React.ReactNode;
  /** CTA button label (shown when incomplete) */
  ctaLabel?: string;
  /** CTA callback */
  onCtaClick?: () => void;
}

export interface OnboardingCardsProps {
  /** Array of onboarding cards */
  cards: OnboardingCard[];
  /** Header heading text */
  heading?: string;
  /** Whether all cards are completed — shows completion banner */
  completed?: boolean;
  /** Whether the widget is collapsed (header only) */
  collapsed?: boolean;
  /** Callback when user clicks "Skip all" */
  onSkipAll?: () => void;
  /** Callback when user clicks the collapse/expand toggle */
  onToggleCollapse?: () => void;
  /** Callback when user clicks "Dismiss" on completion banner */
  onDismiss?: () => void;
  /** Completion banner message */
  completionMessage?: string;
  /** Completion banner description */
  completionDescription?: string;
  className?: string;
}

/* ── Icons ────────────────────────────────────────────────────────────── */

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 15 12 9 18 15" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Sub-component: OnboardingCardItem ────────────────────────────────── */

interface OnboardingCardItemProps {
  card: OnboardingCard;
}

function OnboardingCardItem({ card }: OnboardingCardItemProps) {
  const isComplete = card.state === 'complete';

  return (
    <div
      className={cn(
        'bg-surface-container-lowest rounded-xl overflow-hidden flex-shrink-0',
        'min-w-[288px] max-w-[444px] flex-1',
      )}
    >
      <div className="flex items-start p-6 pr-4 pt-2 pb-6 rounded-xl">
        {/* Icon */}
        {card.icon && (
          <div className="flex flex-col items-center pt-4 shrink-0">
            <div className="w-8 h-8 flex items-center justify-center text-on-surface">
              {card.icon}
            </div>
          </div>
        )}

        {/* Text + CTA */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 pl-4 pt-4">
          <p className="text-base font-medium leading-7 text-foreground tracking-[0.15px]">
            {card.title}
          </p>
          <p className="text-sm leading-5 text-foreground">
            {card.description}
          </p>

          {/* CTA area */}
          <div className="flex items-end h-9">
            {isComplete ? (
              <div className="flex items-center gap-1 pr-4">
                <CheckIcon />
                <span className="text-sm leading-5 text-success truncate">
                  Complete
                </span>
              </div>
            ) : card.ctaLabel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={card.onCtaClick}
              >
                {card.ctaLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */

const OnboardingCards = React.forwardRef<HTMLDivElement, OnboardingCardsProps>(
  (
    {
      cards,
      heading = 'Get started',
      completed = false,
      collapsed = false,
      onSkipAll,
      onToggleCollapse,
      onDismiss,
      completionMessage = 'You completed all onboarding setup',
      completionDescription,
      className,
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [scrollPage, setScrollPage] = React.useState(0);
    const [totalPages, setTotalPages] = React.useState(1);

    const completedCount = cards.filter((c) => c.state === 'complete').length;
    const totalCount = cards.length;

    // Calculate pagination from scroll position
    const updatePagination = React.useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
      const currentPage = Math.round(
        (el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) *
          (pages - 1),
      );
      setTotalPages(pages);
      setScrollPage(Math.min(currentPage, pages - 1));
    }, []);

    React.useEffect(() => {
      updatePagination();
      const el = scrollRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(updatePagination);
      observer.observe(el);
      return () => observer.disconnect();
    }, [updatePagination, cards.length]);

    const scrollBy = (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const amount = el.clientWidth * 0.8;
      el.scrollBy({
        left: direction === 'right' ? amount : -amount,
        behavior: 'smooth',
      });
    };

    const handleScroll = () => updatePagination();

    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface-container rounded-xl overflow-hidden min-w-[448px]',
          className,
        )}
        role="region"
        aria-label={heading}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5 pl-4 rounded-t-xl overflow-hidden">
          {/* Left: heading or completion banner */}
          <div className="flex-1 flex flex-col justify-center min-h-[64px] max-h-[88px] py-5 min-w-0">
            {completed ? (
              <div className="flex flex-col items-start gap-0">
                <div className="flex items-center gap-1 pr-4">
                  <CheckIcon />
                  <span className="text-base leading-6 text-success truncate">
                    {completionMessage}
                  </span>
                </div>
                {completionDescription && (
                  <p className="text-sm leading-5 text-on-surface-variant pl-7 mt-0.5">
                    {completionDescription}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-base leading-6 text-foreground truncate">
                {heading}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 py-2 shrink-0">
            {!completed && (
              <span className="text-sm font-medium leading-4 text-warning whitespace-nowrap">
                {completedCount}/{totalCount} complete
              </span>
            )}

            {!completed && onSkipAll && (
              <Button variant="text" size="sm" onClick={onSkipAll}>
                Skip all
              </Button>
            )}

            {completed && onDismiss && (
              <Button variant="text" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}

            {onToggleCollapse && (
              <IconButton
                variant="standard"
                size="sm"
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </IconButton>
            )}
          </div>
        </div>

        {/* ── Card container (hidden when collapsed) ──────────── */}
        {!collapsed && (
          <div className="flex items-center justify-center min-w-[448px] overflow-hidden pb-4 px-4">
            {/* Left scroll button */}
            <div className="flex items-center h-full pr-4 shrink-0">
              <IconButton
                variant="standard"
                size="default"
                onClick={() => scrollBy('left')}
                aria-label="Scroll left"
                className="bg-surface-container-lowest shadow-md rounded-full"
              >
                <ChevronLeftIcon />
              </IconButton>
            </div>

            {/* Scrollable card row */}
            <div
              ref={scrollRef}
              className="flex flex-1 gap-4 overflow-x-auto scroll-smooth min-w-[288px] scrollbar-hide"
              style={{ maxHeight: 208, scrollbarWidth: 'none' }}
              onScroll={handleScroll}
              role="list"
              aria-label="Onboarding cards"
            >
              {cards.map((card) => (
                <div key={card.id} role="listitem">
                  <OnboardingCardItem card={card} />
                </div>
              ))}
            </div>

            {/* Right scroll button */}
            <div className="flex items-center h-full pl-4 shrink-0">
              <IconButton
                variant="standard"
                size="default"
                onClick={() => scrollBy('right')}
                aria-label="Scroll right"
                className="bg-surface-container-lowest shadow-md rounded-full"
              >
                <ChevronRightIcon />
              </IconButton>
            </div>
          </div>
        )}

        {/* ── Carousel dots ──────────────────────────────────── */}
        {!collapsed && totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-1 pb-4"
            role="tablist"
            aria-label="Card pages"
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                role="tab"
                aria-selected={i === scrollPage}
                aria-label={`Page ${i + 1} of ${totalPages}`}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-colors',
                  i === scrollPage
                    ? 'bg-on-surface/[.38]'
                    : 'bg-on-surface/[.16]',
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
OnboardingCards.displayName = 'OnboardingCards';

export { OnboardingCards, OnboardingCardItem };
