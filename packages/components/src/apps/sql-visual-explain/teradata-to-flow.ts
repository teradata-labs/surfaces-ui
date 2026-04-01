/**
 * Teradata to ReactFlow Conversion
 *
 * Converts Teradata EXPLAIN steps into ExplainNode tree structure
 * for ReactFlow visualization.
 */

import type { TeradataStep, StepType } from './teradata-types';
import type { ExplainNode } from './types';

/**
 * Map Teradata step type to operation name
 */
function stepTypeToOperation(type: StepType, label: string): string {
  const mapping: Record<StepType, string> = {
    lock: 'Access Lock',
    agg: 'Aggregate',
    sort: 'Sort',
    return: 'Return',
    retrieve: 'Retrieve',
    scan: 'Seq Scan',
  };
  return mapping[type] || label;
}

/**
 * Convert Teradata confidence to cost
 * Teradata: High confidence (close to 100%) = LOW cost/risk
 * ExplainNode: totalCost - higher = more expensive
 *
 * Invert: confidence → cost
 */
function confidenceToCost(confidence: string): number {
  if (!confidence) return 50; // Default moderate cost

  const level = confidence.toLowerCase();
  if (level === 'high') return 10; // High confidence = low cost
  if (level === 'moderate') return 50;
  if (level === 'low') return 80;
  if (level === 'none' || level === 'no') return 100; // No confidence = high cost/risk

  return 50;
}

/**
 * Parse row count string to number
 */
function parseRows(rows: string | undefined): number {
  if (!rows) return 0;
  return parseInt(rows.replace(/,/g, ''), 10) || 0;
}

/**
 * Parse time string to milliseconds
 */
function parseTime(time: string | undefined): number {
  if (!time) return 0;
  const match = time.match(/([\d.]+)s/);
  return match && match[1] ? parseFloat(match[1]) * 1000 : 0;
}

/**
 * Convert Teradata steps to ExplainNode tree
 * Steps are flat, so we create a sequential tree (each step is a child of the previous)
 */
export function teradataStepsToExplainNode(steps: TeradataStep[], queryName: string = 'Query'): ExplainNode {
  if (steps.length === 0) {
    // Return a placeholder node
    return {
      id: 'root',
      nodeType: 'Empty Plan',
      startupCost: 0,
      totalCost: 0,
      planRows: 0,
      planWidth: 0,
      actualStartupTime: 0,
      actualTotalTime: 0,
      actualRows: 0,
      actualLoops: 1,
      children: [],
    };
  }

  // Build tree: root → step1 → step2 → ... → stepN
  // Last step is the leaf, first step is root
  const nodes: ExplainNode[] = steps.map((step, idx) => {
    const cost = confidenceToCost(step.confidence);
    const rows = parseRows(step.rows);
    const time = parseTime(step.time);

    return {
      id: `step-${idx}`,
      nodeType: stepTypeToOperation(step.type, step.label),
      relationName: step.sub || undefined,
      startupCost: cost * 0.1, // Rough startup cost estimate
      totalCost: cost,
      planRows: rows,
      planWidth: 100, // Estimate
      actualStartupTime: time * 0.1,
      actualTotalTime: time,
      actualRows: rows,
      actualLoops: 1,
      filter: step.obs.length > 0 ? step.obs.join('; ') : undefined,
      sortKey: step.type === 'sort' && step.sub ? [step.sub] : undefined,
      children: [],
    };
  });

  // Link nodes: root -> child -> child -> ...
  for (let i = 0; i < nodes.length - 1; i++) {
    const currentNode = nodes[i];
    const nextNode = nodes[i + 1];
    if (currentNode && nextNode) {
      currentNode.children = [nextNode];
    }
  }

  const rootNode = nodes[0];
  if (!rootNode) {
    // Fallback if no nodes (shouldn't happen but TypeScript safety)
    return {
      id: 'root',
      nodeType: 'Empty Plan',
      startupCost: 0,
      totalCost: 0,
      planRows: 0,
      planWidth: 0,
      actualStartupTime: 0,
      actualTotalTime: 0,
      actualRows: 0,
      actualLoops: 1,
      children: [],
    };
  }

  return rootNode;
}
