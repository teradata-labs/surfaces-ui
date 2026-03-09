/**
 * FlowNode — Generic themed node shell for ReactFlow
 *
 * Provides a consistent card-based node appearance with variant-based
 * coloring via SurfacesUI theme tokens. Replaces hardcoded colors
 * from source components with semantic variants.
 *
 * Level: Atom (<50 lines of JSX)
 */

import * as React from 'react';
import { Position } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { FlowHandle } from '../flow-handle';

export type FlowNodeVariant = 'default' | 'info' | 'positive' | 'warning' | 'error' | 'purple';

export interface FlowNodeProps {
  /** Icon element displayed in the header */
  icon?: React.ReactNode;
  /** Primary label text */
  label: string;
  /** Supporting description */
  description?: string;
  /** Optional status badge slot (rendered in header) */
  status?: React.ReactNode;
  /** Visual variant mapped to theme tokens */
  variant?: FlowNodeVariant;
  /** Show source (output) handle on the right */
  sourceHandle?: boolean;
  /** Show target (input) handle on the left */
  targetHandle?: boolean;
  /** Extra content below description */
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<FlowNodeVariant, { header: string; border: string }> = {
  default: {
    header: 'bg-surface-container',
    border: 'border-su-outline-variant',
  },
  info: {
    header: 'bg-primary/10',
    border: 'border-primary/30',
  },
  positive: {
    header: 'bg-positive/10',
    border: 'border-positive/30',
  },
  warning: {
    header: 'bg-warning/10',
    border: 'border-warning/30',
  },
  error: {
    header: 'bg-error/10',
    border: 'border-error/30',
  },
  purple: {
    header: 'bg-tertiary/10',
    border: 'border-tertiary/30',
  },
};

const FlowNode = React.forwardRef<HTMLDivElement, FlowNodeProps>(
  (
    {
      icon,
      label,
      description,
      status,
      variant = 'default',
      sourceHandle = true,
      targetHandle = true,
      children,
      className,
    },
    ref,
  ) => {
    const styles = variantStyles[variant];

    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface rounded-lg shadow-sm border min-w-[200px] overflow-hidden',
          styles.border,
          className,
        )}
      >
        {/* Connection handles */}
        {targetHandle && <FlowHandle type="target" position={Position.Left} />}
        {sourceHandle && <FlowHandle type="source" position={Position.Right} />}

        {/* Colored header */}
        <div className={cn('p-3', styles.header)}>
          <div className="flex items-center gap-2">
            {icon && <span className="shrink-0">{icon}</span>}
            <h4 className="font-semibold text-foreground text-sm">{label}</h4>
            {status && <span className="ml-auto">{status}</span>}
          </div>
        </div>

        {/* Content */}
        {(description || children) && (
          <div className="p-3 pt-2">
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {children}
          </div>
        )}
      </div>
    );
  },
);
FlowNode.displayName = 'FlowNode';

export { FlowNode };
