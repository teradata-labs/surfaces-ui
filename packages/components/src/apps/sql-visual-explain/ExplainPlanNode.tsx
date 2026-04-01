/**
 * ExplainPlanNode — Custom ReactFlow node for SQL explain plans
 *
 * Renders a compact card showing operation type, table, cost, time, rows.
 * Color-coded by cost level: green (low), yellow (moderate), red (high).
 * Handles at Top/Bottom for TB layout.
 */

import * as React from 'react';
import { Position } from '@xyflow/react';
import { Table2, GitMerge, ArrowUpDown, Layers, Search, Hash } from 'lucide-react';
import { FlowHandle } from '../../primitives/flow-handle';
import { Badge } from '../../primitives/badge';
import { cn } from '../../lib/utils';
import type { ExplainNodeData } from './plan-to-flow';
import { formatCost, formatTime, formatRows } from './cost-utils';

// ── Icon mapping ─────────────────────────────────────────────────────────

const OP_ICONS: Record<string, React.ElementType> = {
  'Seq Scan': Table2,
  'Index Scan': Search,
  'Index Only Scan': Search,
  'Bitmap Heap Scan': Table2,
  'Hash Join': GitMerge,
  'Merge Join': GitMerge,
  'Nested Loop': GitMerge,
  Sort: ArrowUpDown,
  HashAggregate: Layers,
  Aggregate: Layers,
  Hash: Hash,
};

function getOpIcon(nodeType: string): React.ElementType {
  return OP_ICONS[nodeType] || Table2;
}

// ── Variant styling ──────────────────────────────────────────────────────

const variantStyles: Record<string, { header: string; border: string }> = {
  positive: { header: 'bg-positive/10', border: 'border-positive/30' },
  warning: { header: 'bg-warning/10', border: 'border-warning/30' },
  error: { header: 'bg-error/10', border: 'border-error/30' },
};

const costBadgeStyles: Record<string, string> = {
  low: 'bg-positive/10 text-positive',
  moderate: 'bg-warning/10 text-warning',
  high: 'bg-error/10 text-error',
};

// ── Component ────────────────────────────────────────────────────────────

interface ExplainPlanNodeProps {
  id: string;
  data: ExplainNodeData;
}

const defaultStyle = { header: 'bg-positive/10', border: 'border-positive/30' };

export function ExplainPlanNode({ data }: ExplainPlanNodeProps) {
  const { explainNode: node, costLevel, variant } = data;
  const styles = (
    variant in variantStyles ? variantStyles[variant as keyof typeof variantStyles] : defaultStyle
  ) as { header: string; border: string };
  const Icon = getOpIcon(node.nodeType);

  return (
    <div className="p-2" style={{ pointerEvents: 'all' }}>
      <FlowHandle type="target" position={Position.Top} />
      <FlowHandle type="source" position={Position.Bottom} />

      <div
        className={cn(
          'bg-card w-[280px] cursor-grab rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing',
          styles.border,
        )}
      >
        {/* Header */}
        <div className={cn('rounded-lg px-4 py-3', styles.header)}>
          <div className="flex items-center gap-2">
            <Icon className="text-foreground h-4 w-4 shrink-0" />
            <h4 className="text-foreground flex-1 truncate text-xs font-semibold">
              {node.nodeType}
            </h4>
            <Badge
              variant="secondary"
              className={cn('px-1.5 py-0 text-[10px] font-medium', costBadgeStyles[costLevel])}
            >
              {costLevel}
            </Badge>
          </div>
          {node.relationName && (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
              {node.schemaName ? `${node.schemaName}.` : ''}
              {node.relationName}
              {node.alias && node.alias !== node.relationName ? ` (${node.alias})` : ''}
            </p>
          )}
        </div>

        {/* Metrics */}
        <div className="space-y-2 px-4 py-3 mt-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Cost</span>
            <span className="text-foreground font-mono">{formatCost(node.totalCost)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Time</span>
            <span className="text-foreground font-mono">{formatTime(node.actualTotalTime)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Rows</span>
            <span className="text-foreground font-mono">
              {formatRows(node.actualRows)}
              {node.actualRows !== node.planRows && (
                <span className="text-muted-foreground/60 ml-1">
                  est.{formatRows(node.planRows)}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
