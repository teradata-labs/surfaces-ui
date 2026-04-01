/**
 * Teradata EXPLAIN Visual Types
 * Based on wireframe from docs/plans/visual-explain/visual-explain-app.html
 */

export type StepType = 'lock' | 'agg' | 'sort' | 'return' | 'retrieve' | 'scan';

export type ConfidenceLevel = '' | 'none' | 'low' | 'moderate' | 'high';

/**
 * Individual step in a Teradata EXPLAIN plan
 */
export interface TeradataStep {
  /** Step type (lock, agg, sort, return, etc.) */
  type: StepType;

  /** Human-readable label (e.g., "All-AMPs aggregate") */
  label: string;

  /** Sub-label with details (e.g., "GROUP BY pclass, sex") */
  sub: string;

  /** Optimizer confidence level */
  confidence: ConfidenceLevel;

  /** Scan type (e.g., "All-rows scan", "Unique PI") */
  scanType?: string;

  /** Estimated spool rows (formatted string, e.g., "756") */
  rows?: string;

  /** Estimated spool bytes (formatted string, e.g., "40,824") */
  bytes?: string;

  /** Estimated time (formatted string, e.g., "0.01s") */
  time?: string;

  /** Observations about this step (color-coded in UI) */
  obs: string[];

  /** Optimizer rewrites applied (shown in purple pills) */
  rewrites: string[];
}

/**
 * Highlights for SQL clause matching
 */
export interface SQLHighlights {
  lock?: string;
  agg?: string;
  sort?: string;
  return?: string;
  scan?: string;
  retrieve?: string;
}

/**
 * Complete query with EXPLAIN plan
 */
export interface TeradataQuery {
  /** Display name for query selector */
  name: string;

  /** Original SQL text */
  sql: string;

  /** Raw EXPLAIN output text */
  raw: string;

  /** Parsed execution plan steps */
  steps: TeradataStep[];

  /** SQL clause highlights for each step type */
  highlights: SQLHighlights;
}

/**
 * Complete EXPLAIN plan with metadata
 */
export interface ExplainPlan {
  /** List of queries in the plan */
  queries: TeradataQuery[];

  /** Currently selected query index */
  currentQueryIndex: number;

  /** Currently selected step index (null = none selected) */
  activeStepIndex: number | null;
}

/**
 * Step metadata for rendering (icons, colors)
 */
export interface StepTypeMeta {
  icon: string;
  badgeClass: string;
  label: string;
}

/**
 * Confidence badge metadata
 */
export interface ConfidenceMeta {
  cls: string;
  txt: string;
}

/**
 * Action button definition for sendPrompt
 */
export interface ActionButton {
  label: string;
  prompt: string;
  variant?: 'default' | 'primary';
}
