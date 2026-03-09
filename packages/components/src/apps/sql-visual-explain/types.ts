/**
 * SQL Visual Explain — Type definitions
 *
 * Models a PostgreSQL EXPLAIN ANALYZE plan tree.
 */

/** Represents a single node in a PostgreSQL EXPLAIN ANALYZE plan */
export interface ExplainNode {
  id: string;
  /** Operation type, e.g. "Seq Scan", "Hash Join", "Sort", "Aggregate" */
  nodeType: string;
  /** Relation/table name (if applicable) */
  relationName?: string;
  /** Schema name */
  schemaName?: string;
  /** Alias used in the query */
  alias?: string;
  /** Join type for join nodes */
  joinType?: string;
  /** Strategy (e.g. "HashAggregate", "Plain") */
  strategy?: string;

  // ── Cost estimates ──────────────────────────────────────────────────
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;

  // ── Actual runtime (from ANALYZE) ──────────────────────────────────
  actualStartupTime: number;
  actualTotalTime: number;
  actualRows: number;
  actualLoops: number;

  // ── Buffers ────────────────────────────────────────────────────────
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
  sharedWrittenBlocks?: number;

  // ── Conditions ─────────────────────────────────────────────────────
  filter?: string;
  rowsRemovedByFilter?: number;
  indexCond?: string;
  joinFilter?: string;
  hashCond?: string;
  mergeCond?: string;
  recheckCond?: string;

  // ── Sort info ──────────────────────────────────────────────────────
  sortKey?: string[];
  sortMethod?: string;
  sortSpaceUsed?: number;
  sortSpaceType?: string;

  // ── Hash info ──────────────────────────────────────────────────────
  hashBuckets?: number;
  hashBatches?: number;
  peakMemoryUsage?: number;

  // ── Output columns ─────────────────────────────────────────────────
  output?: string[];

  // ── Children ───────────────────────────────────────────────────────
  children: ExplainNode[];
}

/** Cost classification for visual mapping */
export type CostLevel = 'low' | 'moderate' | 'high';
