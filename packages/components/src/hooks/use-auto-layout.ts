/**
 * useAutoLayout — Dagre-based auto-layout for ReactFlow graphs
 *
 * Generic hook that positions nodes in a hierarchical DAG layout
 * using the dagre library. Reusable by any flow component.
 */

import { useMemo } from 'react';
import * as dagre from 'dagre';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';

// ── Types ─────────────────────────────────────────────────────────────────

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutConfig {
  direction: LayoutDirection;
  nodeWidth: number;
  nodeHeight: number;
  nodeSpacing?: number;
  rankSpacing?: number;
}

const DEFAULT_CONFIG: Required<LayoutConfig> = {
  direction: 'LR',
  nodeWidth: 280,
  nodeHeight: 100,
  nodeSpacing: 80,
  rankSpacing: 200,
};

// ── Handle Position Helper ────────────────────────────────────────────────

function getHandlePositions(direction: LayoutDirection) {
  if (direction === 'TB') {
    return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
  }
  return { sourcePosition: Position.Right, targetPosition: Position.Left };
}

// ── Core Layout Function ──────────────────────────────────────────────────

/**
 * Apply dagre layout to nodes and edges.
 * Returns new arrays with updated positions — does not mutate inputs.
 */
export function getLayoutedElements<
  N extends Node = Node,
  E extends Edge = Edge,
>(
  nodes: N[],
  edges: E[],
  config: Partial<LayoutConfig> = {},
): { nodes: N[]; edges: E[] } {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Create dagre graph
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: cfg.direction,
    nodesep: cfg.nodeSpacing,
    ranksep: cfg.rankSpacing,
    marginx: 20,
    marginy: 20,
  });

  // Add nodes
  nodes.forEach((node) => {
    g.setNode(node.id, { width: cfg.nodeWidth, height: cfg.nodeHeight });
  });

  // Add edges
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run layout
  dagre.layout(g);

  const { sourcePosition, targetPosition } = getHandlePositions(cfg.direction);

  // Apply positions (dagre returns center; convert to top-left for ReactFlow)
  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - cfg.nodeWidth / 2,
        y: pos.y - cfg.nodeHeight / 2,
      },
      sourcePosition,
      targetPosition,
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ── React Hook ────────────────────────────────────────────────────────────

/**
 * Memoized auto-layout hook.
 * Re-computes layout only when nodes, edges, or config change.
 */
export function useAutoLayout<
  N extends Node = Node,
  E extends Edge = Edge,
>(
  nodes: N[],
  edges: E[],
  config: Partial<LayoutConfig> = {},
): { nodes: N[]; edges: E[] } {
  return useMemo(
    () => getLayoutedElements(nodes, edges, config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges, config.direction, config.nodeWidth, config.nodeHeight, config.nodeSpacing, config.rankSpacing],
  );
}
