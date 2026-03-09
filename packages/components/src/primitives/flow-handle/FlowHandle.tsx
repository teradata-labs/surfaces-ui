/**
 * FlowHandle — Themed ReactFlow connection handle
 *
 * Thin wrapper around ReactFlow's Handle with SurfacesUI theme tokens.
 * Used inside FlowNode and custom node components.
 */

import * as React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../lib/utils';

export interface FlowHandleProps {
  /** Handle type — source (output) or target (input) */
  type: 'source' | 'target';
  /** Position of the handle on the node */
  position: Position;
  /** Color variant mapped to theme tokens */
  variant?: 'primary' | 'positive' | 'error';
  /** Optional handle ID for multiple handles */
  id?: string;
  className?: string;
}

const variantClasses: Record<string, string> = {
  primary: '!bg-primary',
  positive: '!bg-positive',
  error: '!bg-error',
};

const FlowHandle = React.forwardRef<HTMLDivElement, FlowHandleProps>(
  ({ type, position, variant = 'primary', id, className }, ref) => (
    <Handle
      ref={ref}
      type={type}
      position={position}
      id={id}
      className={cn(
        '!w-3 !h-3 !border-2 !border-background',
        variantClasses[variant],
        className,
      )}
    />
  ),
);
FlowHandle.displayName = 'FlowHandle';

export { FlowHandle };
