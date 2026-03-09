/**
 * SQL Visual Explain — Cost utilities
 *
 * Classification, formatting, and variant mapping for plan node costs.
 */

import type { FlowNodeVariant } from '../../primitives/flow-node';
import type { CostLevel, ExplainNode } from './types';

/** Classify a node's cost relative to the plan's maximum */
export function classifyCost(node: ExplainNode, maxCost: number): CostLevel {
  if (maxCost === 0) return 'low';
  const ratio = node.totalCost / maxCost;
  if (ratio < 0.3) return 'low';
  if (ratio < 0.7) return 'moderate';
  return 'high';
}

/** Map cost level to FlowNode variant */
export function costToVariant(level: CostLevel): FlowNodeVariant {
  switch (level) {
    case 'low':
      return 'positive';
    case 'moderate':
      return 'warning';
    case 'high':
      return 'error';
  }
}

/** Format cost as abbreviated string */
export function formatCost(cost: number): string {
  if (cost >= 1_000_000) return `${(cost / 1_000_000).toFixed(1)}M`;
  if (cost >= 1_000) return `${(cost / 1_000).toFixed(1)}K`;
  return cost.toFixed(1);
}

/** Format time in ms */
export function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(2)}ms`;
}

/** Format rows with commas */
export function formatRows(rows: number): string {
  return rows.toLocaleString();
}

/** Find the maximum totalCost across all nodes in the tree */
export function findMaxCost(node: ExplainNode): number {
  let max = node.totalCost;
  for (const child of node.children) {
    max = Math.max(max, findMaxCost(child));
  }
  return max;
}
