/**
 * Teradata EXPLAIN Parser
 * Converts raw EXPLAIN text into structured TeradataStep objects
 *
 * Based on spec from docs/plans/visual-explain/visual-explain-app-spec.md
 */

import type { TeradataStep, StepType } from './teradata-types';

/**
 * Parse raw Teradata EXPLAIN output into structured steps
 */
export function parseExplain(text: string): TeradataStep[] {
  const steps: TeradataStep[] = [];

  // Split by step number pattern: "\n  1)", "\n  2)", etc.
  const stepBlocks = text.split(/\n(?=\s*\d+\))/);

  for (const block of stepBlocks) {
    if (!block.trim()) continue;

    const step = parseStep(block);
    steps.push(step);
  }

  return steps;
}

/**
 * Parse individual step block
 */
function parseStep(block: string): TeradataStep {
  const step: TeradataStep = {
    type: detectStepType(block),
    label: extractLabel(block),
    sub: extractSub(block),
    confidence: extractConfidence(block),
    scanType: extractScanType(block),
    rows: extractRows(block),
    bytes: extractBytes(block),
    time: extractTime(block),
    obs: extractObservations(block),
    rewrites: extractRewrites(block),
  };

  return step;
}

/**
 * Detect step type from keywords
 */
function detectStepType(block: string): StepType {
  const lower = block.toLowerCase();

  if (/lock|first.*lock/i.test(block)) return 'lock';
  if (/sum step|aggregate/i.test(block)) return 'agg';
  if (/sort|order/i.test(block)) return 'sort';
  if (/end transaction|result/i.test(block)) return 'return';
  if (/retrieve/i.test(block) && !/sum|sort/i.test(block)) return 'retrieve';
  if (/scan/i.test(block)) return 'scan';

  // Default to lock
  return 'lock';
}

/**
 * Extract human-readable label
 */
function extractLabel(block: string): string {
  const lower = block.toLowerCase();

  if (/lock/i.test(block)) return 'Access lock';
  if (/sum step|aggregate/i.test(block)) {
    if (/all-amps/i.test(block)) return 'All-AMPs aggregate';
    return 'Aggregate';
  }
  if (/retrieve.*sort/i.test(block)) return 'Retrieve + sort';
  if (/sort/i.test(block)) return 'Sort';
  if (/end transaction/i.test(block)) return 'Return results';
  if (/retrieve/i.test(block)) return 'Retrieve';
  if (/scan/i.test(block)) return 'Scan';

  return 'Step';
}

/**
 * Extract sub-label with operation details
 */
function extractSub(block: string): string {
  // GROUP BY clause
  const groupByMatch = block.match(/group(?:ing)? by ([^,.\n]+)/i);
  if (groupByMatch && groupByMatch[1]) {
    let groupBy = groupByMatch[1].trim();
    // Truncate long CASE expressions
    if (groupBy.length > 40) {
      groupBy = groupBy.substring(0, 37) + '...';
    }
    return `GROUP BY ${groupBy}`;
  }

  // ORDER BY / SORT BY
  const sortMatch = block.match(/sort by ([^,.\n]+)/i);
  if (sortMatch && sortMatch[1]) {
    return `ORDER BY ${sortMatch[1].trim()}`;
  }

  // Table name
  const tableMatch = block.match(/(?:from|lock)\s+([a-z0-9_]+\.)?([a-z0-9_]+)/i);
  if (tableMatch && tableMatch[2]) {
    return tableMatch[2];
  }

  // Return to client
  if (/end transaction/i.test(block)) {
    return '→ client';
  }

  return '';
}

/**
 * Extract confidence level
 */
function extractConfidence(block: string): 'none' | 'low' | 'moderate' | 'high' | '' {
  const match = block.match(/with (no|low|moderate|high) confidence/i);
  if (!match || !match[1]) return '';

  const level = match[1].toLowerCase();
  if (level === 'no') return 'none';
  if (level === 'low') return 'low';
  if (level === 'moderate') return 'moderate';
  if (level === 'high') return 'high';

  return '';
}

/**
 * Extract scan type
 */
function extractScanType(block: string): string | undefined {
  if (/all-rows scan/i.test(block)) return 'All-rows scan';
  if (/unique pi/i.test(block)) return 'Unique PI';
  if (/pi columns|pi access/i.test(block)) return 'PI access';
  if (/table lock/i.test(block)) return 'Table lock';
  if (/spool sort/i.test(block)) return 'Spool sort';

  return undefined;
}

/**
 * Extract estimated rows
 */
function extractRows(block: string): string {
  // Pattern: "756 rows" or "to be 756 rows"
  const match = block.match(/(?:to be |estimated.*?)?([\d,]+)\s+rows/i);
  return match && match[1] ? match[1] : '';
}

/**
 * Extract estimated bytes
 */
function extractBytes(block: string): string {
  // Pattern: "(40,824 bytes)" or "40,824 bytes"
  const match = block.match(/\(?([\d,]+)\s+bytes\)?/i);
  return match && match[1] ? match[1] : '';
}

/**
 * Extract estimated time
 */
function extractTime(block: string): string {
  // Pattern: "0.01s" or "0.01 seconds"
  const match = block.match(/([\d.]+)\s*s(?:ec(?:onds)?)?/i);
  return match ? match[1] + 's' : '';
}

/**
 * Extract observations (step-specific insights)
 */
function extractObservations(block: string): string[] {
  const obs: string[] = [];

  // No residual conditions
  if (/no residual conditions/i.test(block)) {
    obs.push('No residual conditions — full table scan');
  }

  // No statistics
  if (/no statistics|no confidence.*statistics/i.test(block)) {
    obs.push('No statistics collected — optimizer estimates unreliable');
  }

  // View resolution
  const viewMatch = block.match(/view\s+([a-z0-9_.]+)\s+resolves to\s+([a-z0-9_.]+)/i);
  if (viewMatch) {
    obs.push(`View ${viewMatch[1]} resolves to ${viewMatch[2]}`);
  }

  // Total time (for return steps)
  const totalTimeMatch = block.match(/total estimated time:\s*([\d.]+)/i);
  if (totalTimeMatch) {
    obs.push(`Total estimated time: ${totalTimeMatch[1]}s`);
  }

  return obs;
}

/**
 * Extract optimizer rewrites
 */
function extractRewrites(block: string): string[] {
  const rewrites: string[] = [];

  // Integer boundary optimization: "age < 13" → "age <= 12"
  if (/age\s*<=\s*\d+/i.test(block) && /age\s*<\s*\d+/i.test(block)) {
    rewrites.push('age < N → age <= N-1 (integer boundary optimization)');
  }

  return rewrites;
}
