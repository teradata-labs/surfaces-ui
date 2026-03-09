/**
 * SQL Visual Explain — Plan-to-flow conversion
 *
 * Pure functions that convert an ExplainNode tree into
 * ReactFlow Node[] and Edge[] for rendering on FlowCanvas.
 */

import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ExplainNode, CostLevel } from './types';
import { classifyCost, costToVariant, findMaxCost } from './cost-utils';
import type { FlowNodeVariant } from '../../primitives/flow-node';

export interface ExplainNodeData extends Record<string, unknown> {
  explainNode: ExplainNode;
  costLevel: CostLevel;
  variant: FlowNodeVariant;
  maxCost: number;
}

/** Flatten the tree into ReactFlow nodes with cost classification */
export function planToNodes(root: ExplainNode): Node<ExplainNodeData>[] {
  const maxCost = findMaxCost(root);
  const nodes: Node<ExplainNodeData>[] = [];

  function walk(node: ExplainNode) {
    const costLevel = classifyCost(node, maxCost);
    nodes.push({
      id: node.id,
      type: 'explainPlanNode',
      position: { x: 0, y: 0 }, // positioned by useAutoLayout
      data: {
        explainNode: node,
        costLevel,
        variant: costToVariant(costLevel),
        maxCost,
      },
    });
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return nodes;
}

/** Derive edges from parent-child relationships */
export function planToEdges(root: ExplainNode): Edge[] {
  const edges: Edge[] = [];

  function walk(node: ExplainNode) {
    for (const child of node.children) {
      edges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'hsl(var(--muted-foreground))',
        },
      });
      walk(child);
    }
  }

  walk(root);
  return edges;
}
