/**
 * NodeDetailPanel — Right-side detail panel for SQL explain nodes
 *
 * Shows full statistics for a selected explain plan node:
 * cost breakdown, timing, rows, buffers, conditions, sort/hash info.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '../../primitives/badge';
import { IconButton } from '../../molecules/icon-button';
import { cn } from '../../lib/utils';
import type { ExplainNode, CostLevel } from './types';
import { formatCost, formatTime, formatRows } from './cost-utils';

// ── Sub-components ───────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
        {title}
      </h4>
      <div className="bg-muted/20 rounded-lg p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          'text-foreground text-right break-all',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── Cost badge mapping ───────────────────────────────────────────────────

const costBadgeStyles: Record<CostLevel, string> = {
  low: 'bg-positive/10 text-positive',
  moderate: 'bg-warning/10 text-warning',
  high: 'bg-error/10 text-error',
};

// ── Main component ───────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node: ExplainNode;
  costLevel: CostLevel;
  onClose: () => void;
}

export function NodeDetailPanel({ node, costLevel, onClose }: NodeDetailPanelProps) {
  return (
    <div className="w-[400px] shrink-0 border-l border-su-outline-variant bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-su-outline-variant">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {node.nodeType}
            </h3>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 font-medium shrink-0', costBadgeStyles[costLevel])}
            >
              {costLevel}
            </Badge>
          </div>
          {node.relationName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {node.schemaName ? `${node.schemaName}.` : ''}
              {node.relationName}
              {node.alias && node.alias !== node.relationName ? ` (${node.alias})` : ''}
            </p>
          )}
          {node.strategy && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Strategy: {node.strategy}
            </p>
          )}
        </div>
        <IconButton
          onClick={onClose}
          variant="standard"
          size="sm"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Cost */}
        <DetailSection title="Cost">
          <DetailRow label="Startup Cost" value={formatCost(node.startupCost)} />
          <DetailRow label="Total Cost" value={formatCost(node.totalCost)} />
          <DetailRow label="Plan Width" value={`${node.planWidth} bytes`} />
        </DetailSection>

        {/* Timing */}
        <DetailSection title="Timing">
          <DetailRow label="Startup Time" value={formatTime(node.actualStartupTime)} />
          <DetailRow label="Total Time" value={formatTime(node.actualTotalTime)} />
          <DetailRow label="Loops" value={String(node.actualLoops)} />
        </DetailSection>

        {/* Rows */}
        <DetailSection title="Rows">
          <DetailRow label="Estimated" value={formatRows(node.planRows)} />
          <DetailRow label="Actual" value={formatRows(node.actualRows)} />
          {node.rowsRemovedByFilter != null && (
            <DetailRow
              label="Removed by Filter"
              value={formatRows(node.rowsRemovedByFilter)}
            />
          )}
        </DetailSection>

        {/* Buffers */}
        {(node.sharedHitBlocks || node.sharedReadBlocks || node.sharedWrittenBlocks) && (
          <DetailSection title="Buffers">
            {node.sharedHitBlocks != null && (
              <DetailRow label="Shared Hit" value={`${node.sharedHitBlocks} blocks`} />
            )}
            {node.sharedReadBlocks != null && (
              <DetailRow label="Shared Read" value={`${node.sharedReadBlocks} blocks`} />
            )}
            {node.sharedWrittenBlocks != null && (
              <DetailRow label="Shared Written" value={`${node.sharedWrittenBlocks} blocks`} />
            )}
          </DetailSection>
        )}

        {/* Conditions */}
        {(node.filter || node.indexCond || node.hashCond || node.joinFilter || node.mergeCond || node.recheckCond) && (
          <DetailSection title="Conditions">
            {node.filter && <DetailRow label="Filter" value={node.filter} mono />}
            {node.indexCond && <DetailRow label="Index Cond" value={node.indexCond} mono />}
            {node.hashCond && <DetailRow label="Hash Cond" value={node.hashCond} mono />}
            {node.joinFilter && <DetailRow label="Join Filter" value={node.joinFilter} mono />}
            {node.mergeCond && <DetailRow label="Merge Cond" value={node.mergeCond} mono />}
            {node.recheckCond && <DetailRow label="Recheck Cond" value={node.recheckCond} mono />}
          </DetailSection>
        )}

        {/* Sort */}
        {node.sortKey && (
          <DetailSection title="Sort">
            <DetailRow label="Sort Key" value={node.sortKey.join(', ')} mono />
            {node.sortMethod && <DetailRow label="Method" value={node.sortMethod} />}
            {node.sortSpaceUsed != null && (
              <DetailRow
                label="Space Used"
                value={`${node.sortSpaceUsed} kB (${node.sortSpaceType})`}
              />
            )}
          </DetailSection>
        )}

        {/* Hash */}
        {node.hashBuckets != null && (
          <DetailSection title="Hash">
            <DetailRow label="Buckets" value={String(node.hashBuckets)} />
            {node.hashBatches != null && (
              <DetailRow label="Batches" value={String(node.hashBatches)} />
            )}
            {node.peakMemoryUsage != null && (
              <DetailRow label="Peak Memory" value={`${node.peakMemoryUsage} kB`} />
            )}
          </DetailSection>
        )}

        {/* Output Columns */}
        {node.output && node.output.length > 0 && (
          <DetailSection title="Output Columns">
            <div className="flex flex-wrap gap-1">
              {node.output.map((col, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {col}
                </Badge>
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  );
}
