import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

// ── NotificationBadge ─────────────────────────────────────────────────────
// Numeric/dot indicator overlaid on icons (different from the text Badge).

export interface NotificationBadgeProps {
  /** Text shown in count variant. Omit to render a dot. */
  content?: string;
  /** 'dot' shows a small filled circle; 'count' shows content in a pill. Default: 'count' when content is provided, else 'dot'. */
  variant?: 'dot' | 'count';
  className?: string;
}

function NotificationBadge({ content, variant, className }: NotificationBadgeProps) {
  const resolvedVariant = variant ?? (content ? 'count' : 'dot');

  if (resolvedVariant === 'dot') {
    return (
      <div
        className={cn('w-2 h-2 rounded-full bg-destructive', className)}
        role="status"
        aria-label="New notification"
      />
    );
  }

  return (
    <div
      className={cn(
        'min-w-[20px] h-5 px-1.5 rounded-full bg-destructive',
        'flex items-center justify-center',
        className
      )}
      role="status"
      aria-label={`${content} notifications`}
    >
      <span className="text-[11px] font-medium text-white leading-none">{content}</span>
    </div>
  );
}

export { NotificationBadge }
