/**
 * AgentFlowView — Read-only DAG view of agent orchestrations
 *
 * Displays agent steps as an auto-layouted directed acyclic graph.
 * Connections are derived from step dependencies. Shows empty state
 * when no steps are provided.
 *
 * Level: Organism (~120 lines)
 */

import * as React from 'react';
import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from '../../molecules/empty-state';
import { FlowCanvas } from '../flow-canvas';
import { AgentNode } from '../../molecules/agent-node';
import type { AgentNodeData } from '../../molecules/agent-node';
import { useAutoLayout } from '../../hooks/use-auto-layout';
import type { LayoutDirection } from '../../hooks/use-auto-layout';
import type { AgentStep } from './types';

// ── Props ─────────────────────────────────────────────────────────────────

export interface AgentFlowViewProps {
  /** Agent steps to display */
  steps: AgentStep[];
  /** Layout direction (default: 'LR') */
  direction?: LayoutDirection;
  /** Called when an agent node is clicked */
  onAgentClick?: (agentId: string) => void;
  /** Custom empty state icon */
  emptyIcon?: React.ReactNode;
  /** Custom empty state title */
  emptyTitle?: string;
  /** Custom empty state description */
  emptyDescription?: string;
  className?: string;
}

// ── Node Type Registry ────────────────────────────────────────────────────

const nodeTypes = {
  agentNode: AgentNode,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function stepsToNodes(
  steps: AgentStep[],
  onAgentClick?: (agentId: string) => void,
): Node<AgentNodeData>[] {
  return steps.map((step) => ({
    id: step.id,
    type: 'agentNode',
    position: { x: 0, y: 0 }, // positioned by layout
    data: {
      agentId: step.agentId,
      agentName: step.name,
      status: step.status,
      stepNumber: step.stepNumber,
      onClick: onAgentClick ? () => onAgentClick(step.agentId) : undefined,
    },
  }));
}

function stepsToEdges(steps: AgentStep[]): Edge[] {
  const stepIds = new Set(steps.map((s) => s.id));
  const edges: Edge[] = [];

  steps.forEach((step) => {
    step.dependsOn?.forEach((depId) => {
      if (stepIds.has(depId)) {
        edges.push({
          id: `${depId}-${step.id}`,
          source: depId,
          target: step.id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'hsl(var(--muted-foreground))',
          },
        });
      }
    });
  });

  return edges;
}

// ── Component ─────────────────────────────────────────────────────────────

const AgentFlowView = React.forwardRef<HTMLDivElement, AgentFlowViewProps>(
  (
    {
      steps,
      direction = 'LR',
      onAgentClick,
      emptyIcon,
      emptyTitle = 'No agents in this workflow',
      emptyDescription = 'Add agent steps to visualize the orchestration.',
      className,
    },
    ref,
  ) => {
    // Build raw nodes & edges from steps
    const rawNodes = React.useMemo(
      () => stepsToNodes(steps, onAgentClick),
      [steps, onAgentClick],
    );
    const rawEdges = React.useMemo(() => stepsToEdges(steps), [steps]);

    // Auto-layout
    const { nodes, edges } = useAutoLayout(rawNodes, rawEdges, {
      direction,
      nodeWidth: 280,
      nodeHeight: 120,
      nodeSpacing: 80,
      rankSpacing: 200,
    });

    // Empty state
    if (steps.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center justify-center h-full rounded-lg border-2 border-dashed border-su-outline-variant bg-surface-container/20',
            className,
          )}
        >
          <EmptyState
            icon={emptyIcon || <Bot className="h-8 w-8" />}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('h-full', className)}>
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          interactive={false}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
          }}
        />
      </div>
    );
  },
);
AgentFlowView.displayName = 'AgentFlowView';

export { AgentFlowView };
