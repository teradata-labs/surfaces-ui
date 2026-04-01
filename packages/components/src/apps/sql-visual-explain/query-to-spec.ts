/**
 * Query to json-render Spec Converter
 * Converts Teradata query data into json-render spec for rendering
 */

import type { Spec } from '@json-render/react';
import type { TeradataQuery } from './teradata-types';

/**
 * Convert Teradata query to json-render spec
 */
export function queryToSpec(query: TeradataQuery, queryIndex: number = 0): Spec {
  const spec: Spec = {
    root: 'app-container',
    elements: {
      // ── Root Container ────────────────────────────────────────────────
      'app-container': {
        type: 'Box',
        props: {
          direction: 'row',
          gap: 0,
          padding: 0,
        },
        children: ['workflow-column', 'main-column'],
      },

      // ── Workflow Column (Left) ────────────────────────────────────────
      'workflow-column': {
        type: 'WorkflowColumn',
        props: {
          steps: query.steps,
        },
      },

      // ── Main Column (Right) ───────────────────────────────────────────
      'main-column': {
        type: 'Box',
        props: {
          direction: 'column',
          gap: 0,
          padding: 0,
        },
        children: ['analysis-panel', 'sql-editor'],
      },

      // ── Analysis Panel ────────────────────────────────────────────────
      'analysis-panel': {
        type: 'AnalysisPanel',
        props: {
          query,
        },
      },

      // ── SQL Editor (Bottom) ───────────────────────────────────────────
      'sql-editor': {
        type: 'SQLEditorPanel',
        props: {
          sql: query.sql,
          rawExplain: query.raw,
          highlights: query.highlights,
          queryCount: 1,
        },
      },
    },
    state: {
      // Active step index (null = none selected)
      activeStepIndex: null,
      // Current query data
      query,
      // Query index (for multi-query support)
      queryIndex,
    },
  };

  return spec as any;
}

/**
 * Convert multiple queries to spec with query selector
 */
export function queriesToSpec(queries: TeradataQuery[]): Spec {
  const spec: Spec = {
    root: 'app-container',
    elements: {
      // ── Root Container ────────────────────────────────────────────────
      'app-container': {
        type: 'Box',
        props: {
          direction: 'column',
          gap: 0,
          padding: 0,
        },
        children: ['topbar', 'content'],
      },

      // ── Topbar ────────────────────────────────────────────────────────
      'topbar': {
        type: 'TopBar',
        props: {
          queries: queries.map((q) => ({ name: q.name })),
        },
      },

      // ── Content Area ──────────────────────────────────────────────────
      'content': {
        type: 'Box',
        props: {
          direction: 'row',
          gap: 0,
          padding: 0,
        },
        children: ['workflow-column', 'main-column'],
      },

      // ── Workflow Column (Left) ────────────────────────────────────────
      'workflow-column': {
        type: 'WorkflowColumn',
        props: {},
      },

      // ── Main Column (Right) ───────────────────────────────────────────
      'main-column': {
        type: 'Box',
        props: {
          direction: 'column',
          gap: 0,
          padding: 0,
        },
        children: ['analysis-panel', 'sql-editor'],
      },

      // ── Analysis Panel ────────────────────────────────────────────────
      'analysis-panel': {
        type: 'AnalysisPanel',
        props: {},
      },

      // ── SQL Editor (Bottom) ───────────────────────────────────────────
      'sql-editor': {
        type: 'SQLEditorPanel',
        props: {
          queryCount: queries.length,
        },
      },
    },
    state: {
      // Active step index (null = none selected)
      activeStepIndex: null,
      // All queries
      queries,
      // Current query index
      currentQueryIndex: 0,
    },
  };

  return spec as any;
}
