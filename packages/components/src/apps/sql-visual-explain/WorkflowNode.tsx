/**
 * WorkflowNode - Pipedream-style step node
 * Based on wireframe design from visual-explain-app.html
 */

import * as React from 'react';
import { Lock, Sigma, ArrowUpDown, CornerDownLeft, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepType } from './teradata-types';

export interface WorkflowNodeProps {
  /** Step type determines icon and badge color */
  type: StepType;

  /** Primary label (e.g., "All-AMPs aggregate") */
  label: string;

  /** Sub-label with details (e.g., "GROUP BY pclass, sex") */
  sub: string;

  /** Whether this node is currently active/selected */
  active?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Show connector arrow below this node */
  showConnector?: boolean;
}

/** Icon mapping by step type */
const STEP_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  lock: Lock,
  agg: Sigma,
  sort: ArrowUpDown,
  return: CornerDownLeft,
  retrieve: Database,
  scan: Database,
};

/** Get icon component for step type */
function getIcon(type: StepType): React.ComponentType<{ className?: string }> {
  return STEP_ICONS[type] || Lock;
}

export function WorkflowNode({
  type,
  label,
  sub,
  active = false,
  onClick,
  showConnector = false,
}: WorkflowNodeProps) {
  const Icon = getIcon(type);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Node Card */}
      <button
        onClick={onClick}
        className={cn(
          'w-full rounded-lg border transition-all duration-150',
          'px-3 py-2 flex items-center gap-2',
          'cursor-pointer select-none',
          active
            ? 'bg-info-light border-info-border'
            : 'bg-card border-border hover:bg-muted hover:border-border-strong',
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
            active ? 'bg-info/15' : 'bg-muted',
          )}
        >
          <Icon className="h-3.5 w-3.5 text-foreground" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-xs font-medium text-foreground truncate">
            {label}
          </div>
          <div
            className={cn(
              'text-[11px] truncate mt-0.5',
              active ? 'text-info-foreground' : 'text-muted-foreground',
            )}
          >
            {sub}
          </div>
        </div>
      </button>

      {/* Connector Arrow */}
      {showConnector && (
        <div className="relative w-px h-5 bg-border my-0">
          {/* Arrowhead */}
          <div className="absolute bottom-[-4px] left-[-3px] w-[7px] h-[7px] border-r border-b border-border transform rotate-45" />
        </div>
      )}
    </div>
  );
}
