/**
 * SQL Visual EXPLAIN Registry
 *
 * json-render component registry for Teradata EXPLAIN visualization.
 * Extends base UI catalog with custom EXPLAIN components.
 */

import * as React from 'react';
import { defineRegistry, type ComponentContext, useStateValue } from '@json-render/react';
import { uiCatalog } from '../catalog/ui-registry';
import { WorkflowNode } from './sql-visual-explain/WorkflowNode';
import { StepAnalysisCard } from './sql-visual-explain/StepAnalysisCard';
import { SQLEditor } from './sql-visual-explain/SQLEditor';
import { cn } from '@/lib/utils';
import type { TeradataQuery } from './sql-visual-explain/teradata-types';
import { executePromptAction, buildCompareStepsPrompt, buildRunExplainPrompt } from './sql-visual-explain/send-prompt-utils';

// Import base components
import {
  type BoxProps,
} from '../catalog/ui-schema';

/**
 * TopBar - Query selector and action buttons
 */
function TopBar(ctx: ComponentContext<typeof uiCatalog, never>) {
  console.log('[TopBar] RENDERING');
  console.log('[TopBar] Props:', ctx.props);

  const queries = (ctx.props as { queries: Array<{ name: string }> }).queries;
  console.log('[TopBar] Queries from props:', queries);

  const [currentQueryIndex, setCurrentQueryIndex] = React.useState(0);
  const [activeStepIndex, setActiveStepIndex] = React.useState<number | null>(null);
  const allQueries = useStateValue<TeradataQuery[]>('/queries') || [];
  console.log('[TopBar] All queries from state:', allQueries);
  const currentQuery = allQueries[currentQueryIndex];
  console.log('[TopBar] Current query:', currentQuery);

  const handleQueryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentQueryIndex(newIndex);
    setActiveStepIndex(null);
  };

  const handleCopySQL = async () => {
    if (currentQuery) {
      try {
        await navigator.clipboard.writeText(currentQuery.sql);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };

  const handleRunExplain = () => {
    if (currentQuery) {
      executePromptAction(buildRunExplainPrompt(currentQuery.sql));
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-card">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-info" />
        <span className="text-sm font-medium text-foreground">Visual EXPLAIN</span>
      </div>
      <div className="w-px h-4 bg-border mx-1" />
      <select
        value={currentQueryIndex}
        onChange={handleQueryChange}
        className="text-sm px-2.5 py-1 border border-border rounded-lg bg-muted text-foreground cursor-pointer hover:border-border-strong outline-none"
      >
        {queries.map((q, idx) => (
          <option key={idx} value={idx}>
            {q.name}
          </option>
        ))}
      </select>
      <div className="ml-auto flex gap-2">
        <button
          onClick={handleCopySQL}
          className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
        >
          📋 Copy SQL
        </button>
        <button
          onClick={handleRunExplain}
          className="text-xs px-3 py-1.5 border border-info bg-info-light text-info-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          ▶ Run EXPLAIN ↗
        </button>
      </div>
    </div>
  );
}

/**
 * WorkflowColumn - Left panel with step nodes
 */
function WorkflowColumn(ctx: ComponentContext<typeof uiCatalog, never>) {
  console.log('[WorkflowColumn] RENDERING');
  console.log('[WorkflowColumn] Props:', ctx.props);

  const queries = useStateValue<TeradataQuery[]>('/queries');
  console.log('[WorkflowColumn] Queries from state:', queries);

  const currentQueryIndex = useStateValue<number>('/currentQueryIndex') || 0;
  console.log('[WorkflowColumn] Current query index:', currentQueryIndex);

  const [activeStepIndex, setActiveStepIndex] = React.useState<number | null>(null);

  const query = queries?.[currentQueryIndex];
  console.log('[WorkflowColumn] Current query:', query);

  const steps = query?.steps || [];
  console.log('[WorkflowColumn] Steps:', steps);

  const handleStepClick = (index: number) => {
    setActiveStepIndex(index);
  };

  return (
    <div className="w-[210px] border-r border-border bg-muted p-3 overflow-y-auto">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3 px-0.5">
        Execution plan
      </div>
      <div className="flex flex-col items-center space-y-0">
        {steps.map((step, idx) => (
          <WorkflowNode
            key={idx}
            type={step.type}
            label={step.label}
            sub={step.sub}
            active={activeStepIndex === idx}
            onClick={() => handleStepClick(idx)}
            showConnector={idx < steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * AnalysisPanel - Right panel showing step analysis
 */
function AnalysisPanel(ctx: ComponentContext<typeof uiCatalog, never>) {
  const queries = useStateValue<TeradataQuery[]>('/queries');
  const currentQueryIndex = useStateValue<number>('/currentQueryIndex') || 0;
  const activeStepIndex = useStateValue<number | null>('/activeStepIndex');

  const query = queries?.[currentQueryIndex];

  if (!query) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-3xl mb-2 opacity-40">↑</div>
          <div className="text-sm">No query loaded</div>
        </div>
      </div>
    );
  }

  if (activeStepIndex === null) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-3xl mb-2 opacity-40">↑</div>
          <div className="text-sm">Select a step to see analysis</div>
        </div>
      </div>
    );
  }

  const step = query.steps[activeStepIndex!];
  if (!step) {
    return null;
  }

  const handleCompareAll = () => {
    executePromptAction(buildCompareStepsPrompt(query));
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <StepAnalysisCard
        step={step}
        stepIndex={activeStepIndex!}
        rawExplain={query.raw}
        sql={query.sql}
        onCompareAll={handleCompareAll}
      />
    </div>
  );
}

/**
 * SQLEditorPanel - Bottom panel with SQL editor
 */
function SQLEditorPanel(ctx: ComponentContext<typeof uiCatalog, never>) {
  const queryCount = (ctx.props as { queryCount?: number }).queryCount;
  const queries = useStateValue<TeradataQuery[]>('/queries');
  const currentQueryIndex = useStateValue<number>('/currentQueryIndex') || 0;
  const [activeStepIndex] = React.useState<number | null>(null);

  const query = queries?.[currentQueryIndex];

  if (!query) {
    return null;
  }

  const activeStep = activeStepIndex !== null && activeStepIndex < query.steps.length ? query.steps[activeStepIndex] : null;

  return (
    <SQLEditor
      sql={query.sql}
      rawExplain={query.raw}
      highlights={query.highlights}
      activeStepType={activeStep?.type}
      queryCount={queryCount || queries?.length || 1}
    />
  );
}

/**
 * Box component (layout container)
 */
function UIBox(ctx: ComponentContext<typeof uiCatalog, 'Box'>) {
  const props = ctx.props as BoxProps;
  const { direction = 'column', gap = 24, padding = 0 } = props;

  console.log('[UIBox] Rendering with props:', props);
  console.log('[UIBox] Children:', ctx.children);
  console.log('[UIBox] Children count:', React.Children.count(ctx.children));

  const style: React.CSSProperties = {
    gap: `${gap}px`,
    padding: padding > 0 ? `${padding}px` : undefined,
  };

  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        'border-4 border-pink-500'
      )}
      style={style}
    >
      <div className="bg-cyan-500 p-2 text-black text-xs">
        BOX: {direction} | Children: {React.Children.count(ctx.children)}
      </div>
      {ctx.children}
    </div>
  );
}

// Export Visual EXPLAIN registry
export const visualExplainRegistry = {
  components: {
    Box: UIBox,
    TopBar,
    WorkflowColumn,
    AnalysisPanel,
    SQLEditorPanel,
  } as any,
  actions: {} as any,
};
