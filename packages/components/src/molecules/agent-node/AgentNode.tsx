/**
 * AgentNode — Custom ReactFlow node for agent orchestration DAGs
 *
 * Specialized flow node that displays agent identity, status, and
 * step number. Uses FlowNode internally with status-based variant mapping.
 *
 * Level: Molecule (~80 lines)
 */

import * as React from 'react';
import { Position } from '@xyflow/react';
import { Bot, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { FlowHandle } from '../../primitives/flow-handle';
import type { FlowNodeVariant } from '../../primitives/flow-node';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface AgentNodeData extends Record<string, unknown> {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  stepNumber?: number;
  onClick?: () => void;
}

/** Props passed to the AgentNode by ReactFlow */
interface AgentNodeProps {
  id: string;
  data: AgentNodeData;
  type?: string;
}

const variantBorderClasses: Record<FlowNodeVariant, string> = {
  default: 'border-su-outline-variant',
  info: 'border-primary/30',
  positive: 'border-positive/30',
  warning: 'border-warning/30',
  error: 'border-error/30',
  purple: 'border-tertiary/30',
};

const statusConfig: Record<AgentStatus, {
  icon: typeof Clock;
  label: string;
  badgeClass: string;
  variant: FlowNodeVariant;
}> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    badgeClass: 'bg-surface-container text-muted-foreground',
    variant: 'default',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    badgeClass: 'bg-primary/10 text-primary',
    variant: 'info',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Done',
    badgeClass: 'bg-positive/10 text-positive',
    variant: 'positive',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    badgeClass: 'bg-error/10 text-error',
    variant: 'error',
  },
  skipped: {
    icon: Clock,
    label: 'Skipped',
    badgeClass: 'bg-surface-container text-muted-foreground/60',
    variant: 'default',
  },
};

export function AgentNode({ data }: AgentNodeProps) {
  const config = statusConfig[data.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="agent-node">
      {/* Handles */}
      <FlowHandle type="target" position={Position.Left} />
      <FlowHandle type="source" position={Position.Right} />

      <div className={cn(
        'w-[280px] rounded-lg border-2 bg-surface shadow-sm hover:shadow-md transition-all',
        variantBorderClasses[config.variant],
      )}>
        <div className="p-4 space-y-3">
          {/* Agent Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-foreground truncate">
                {data.agentName}
              </h4>
              <p className="text-xs text-muted-foreground">
                Agent: {data.agentId}
              </p>
            </div>
          </div>

          {/* Status + Step */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('text-xs font-medium', config.badgeClass)}>
              <StatusIcon className={cn(
                'h-3 w-3 mr-1',
                data.status === 'running' && 'animate-spin',
              )} />
              {config.label}
            </Badge>
            {data.stepNumber != null && (
              <span className="text-xs text-muted-foreground">
                Step #{data.stepNumber}
              </span>
            )}
          </div>

          {/* View Details Button */}
          {data.onClick && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={data.onClick}
            >
              View Agent Details
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
